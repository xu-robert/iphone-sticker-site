import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import sharp from 'sharp';
import Stripe from 'stripe';
import { createSession, getSession, addSticker, removeSticker } from './sessions.js';
import { createOrder, createOrderItem, updateOrderStripeSession, markOrderPaid, getOrderByReference, getOrderByReferenceAndEmail } from './db.js';
import { SIZES, SHIPPING_FLAT_CENTS, getSize } from './pricing.js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = path.join(import.meta.dirname, 'uploads');
const ORDERS_ASSETS_DIR = path.join(import.meta.dirname, 'orders-assets');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(ORDERS_ASSETS_DIR, { recursive: true });

const app = express();
const server = createServer(app);

// Stripe webhook must be registered before express.json() — needs raw body
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed` });
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    markOrderPaid(session.id, session.payment_intent);
  }
  res.json({ received: true });
});

// --- WebSocket ---

const wss = new WebSocketServer({ server, path: '/ws' });
const sessionClients = new Map();

function broadcast(sessionId, message, excludeWs) {
  const clients = sessionClients.get(sessionId);
  if (!clients) return;
  const data = JSON.stringify(message);
  for (const ws of clients) {
    if (ws !== excludeWs && ws.readyState === 1) ws.send(data);
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('session');
  const role = url.searchParams.get('role');

  if (!sessionId || !getSession(sessionId)) {
    ws.close(4001, 'Invalid session');
    return;
  }

  if (!sessionClients.has(sessionId)) sessionClients.set(sessionId, new Set());
  sessionClients.get(sessionId).add(ws);

  if (role === 'phone') {
    broadcast(sessionId, { type: 'phone_connected' }, ws);
  }

  ws.on('close', () => {
    const clients = sessionClients.get(sessionId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) sessionClients.delete(sessionId);
    }
    if (role === 'phone') {
      broadcast(sessionId, { type: 'phone_disconnected' });
    }
  });
});

// --- REST API ---

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

function getLanIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

app.get('/api/host', (req, res) => {
  res.json({ ip: getLanIp(), port: PORT });
});

app.post('/api/session', (req, res) => {
  const id = createSession();
  res.json({ sessionId: id });
});

app.get('/api/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found or expired' });
  res.json({ sessionId: session.id, stickers: session.stickers });
});

app.post('/api/session/:id/upload', (req, res) => {
  upload.single('sticker')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    handleUpload(req, res);
  });
});

async function handleUpload(req, res) {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found or expired' });
  if (!req.file) return res.status(400).json({ error: 'No image provided' });

  let buffer = req.file.buffer;
  let ext;

  try {
    const image = sharp(buffer);
    const meta = await image.metadata();

    if (meta.hasAlpha) {
      buffer = await image.trim({ threshold: 10 }).png().toBuffer();
      ext = 'png';
    } else {
      buffer = await image.trim({ threshold: 10 }).toBuffer();
      const SUB_TO_EXT = { jpeg: 'jpg', 'x-png': 'png', svg: 'svg', 'svg+xml': 'svg' };
      const sub = req.file.mimetype.split('/')[1];
      ext = SUB_TO_EXT[sub] || sub;
    }
  } catch {
    const SUB_TO_EXT = { jpeg: 'jpg', 'x-png': 'png', svg: 'svg', 'svg+xml': 'svg' };
    const sub = req.file.mimetype.split('/')[1];
    ext = SUB_TO_EXT[sub] || sub;
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const sessionDir = path.join(UPLOADS_DIR, req.params.id);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, filename), buffer);

  const sticker = {
    filename,
    imageUrl: `/uploads/${req.params.id}/${filename}`,
    timestamp: Date.now(),
  };
  addSticker(req.params.id, sticker);
  broadcast(req.params.id, { type: 'new_sticker', ...sticker });

  res.json(sticker);
}

app.delete('/api/session/:id/sticker/:filename', (req, res) => {
  const { id, filename } = req.params;
  const session = getSession(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!removeSticker(id, filename)) return res.status(404).json({ error: 'Sticker not found' });

  const filePath = path.join(UPLOADS_DIR, id, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  broadcast(id, { type: 'sticker_deleted', filename });
  res.json({ message: 'Deleted' });
});

app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/orders-assets', express.static(ORDERS_ASSETS_DIR));

// --- Orders / E-Commerce ---

app.get('/api/pricing', (req, res) => {
  res.json({ sizes: SIZES, shippingCents: SHIPPING_FLAT_CENTS });
});

app.post('/api/cart/finalize-image', express.json({ limit: '20mb' }), (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl || !dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image data' });
  }
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Invalid data URL format' });
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(ORDERS_ASSETS_DIR, filename), buffer);
  res.json({ imageUrl: `/orders-assets/${filename}` });
});

app.post('/api/checkout', async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const { items, shipping } = req.body;
  if (!items?.length || !shipping?.email || !shipping?.name || !shipping?.line1 || !shipping?.city || !shipping?.state || !shipping?.zip) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let subtotalCents = 0;
  const validatedItems = [];
  for (const item of items) {
    const size = getSize(item.sizeValue);
    if (!size) return res.status(400).json({ error: `Invalid size: ${item.sizeValue}` });
    const qty = Math.max(1, Math.floor(item.quantity));
    subtotalCents += size.priceCents * qty;
    validatedItems.push({ ...size, quantity: qty, imageUrl: item.imageUrl });
  }

  const totalCents = subtotalCents + SHIPPING_FLAT_CENTS;
  const order = createOrder({
    email: shipping.email, name: shipping.name,
    line1: shipping.line1, line2: shipping.line2,
    city: shipping.city, state: shipping.state, zip: shipping.zip,
    country: shipping.country || 'US',
    subtotalCents, shippingCents: SHIPPING_FLAT_CENTS, totalCents,
  });

  for (const item of validatedItems) {
    createOrderItem(order.id, item);
  }

  const origin = `${req.protocol}://${req.get('host')}`;
  const line_items = validatedItems.map(item => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: `Custom Sticker - ${item.label}`,
        images: item.imageUrl.startsWith('/') ? [`${origin}${item.imageUrl}`] : [item.imageUrl],
      },
      unit_amount: item.priceCents,
    },
    quantity: item.quantity,
  }));
  line_items.push({
    price_data: {
      currency: 'usd',
      product_data: { name: 'Shipping (Flat Rate)' },
      unit_amount: SHIPPING_FLAT_CENTS,
    },
    quantity: 1,
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: shipping.email,
      success_url: `${origin}/order/${order.reference}`,
      cancel_url: `${origin}/cart`,
      metadata: { order_reference: order.reference },
    });
    updateOrderStripeSession(order.reference, session.id);
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

app.get('/api/order/:reference', (req, res) => {
  const order = getOrderByReference(req.params.reference);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/order/lookup', (req, res) => {
  const { reference, email } = req.body;
  if (!reference || !email) return res.status(400).json({ error: 'Reference and email required' });
  const order = getOrderByReferenceAndEmail(reference.toUpperCase(), email.toLowerCase());
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// --- Static / SPA ---

const clientDist = path.join(import.meta.dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`LAN: http://${getLanIp()}:${PORT}`);
});
