import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import sharp from 'sharp';
import { ZipArchive } from 'archiver';
import Stripe from 'stripe';
import { Resend } from 'resend';
import { createSession, getSession, addSticker, removeSticker } from './sessions.js';
import { createOrder, createOrderItem, updateOrderStripeSession, markOrderPaid, getOrderByReference, getOrderByReferenceAndEmail, getAllOrders, updateOrderStatus } from './db.js';
import { SIZES, SHIPPING_FLAT_CENTS, TAX_RATES, getTaxRate, getSize } from './pricing.js';
import { isConfigured as isShippingConfigured, validateAddress, getShippingRates } from './shipping.js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = path.join(import.meta.dirname, 'uploads');
const ORDERS_ASSETS_DIR = path.join(import.meta.dirname, 'orders-assets');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(ORDERS_ASSETS_DIR, { recursive: true });

const app = express();
app.set('trust proxy', 1);
const server = createServer(app);

// Stripe webhook must be registered before express.json() — needs raw body
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed` });
  }
  console.log(`Webhook received: ${event.type}`);
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log(`Payment completed for order: ${session.metadata?.order_reference}, session: ${session.id}`);
    markOrderPaid(session.id, session.payment_intent);
    if (session.metadata?.order_reference) {
      const order = getOrderByReference(session.metadata.order_reference);
      if (order) {
        console.log(`Sending confirmation email to ${order.email} for ${order.reference}`);
        sendOrderConfirmationEmail(order).catch(err => console.error('Email send failed:', err));
      } else {
        console.error(`Order not found for reference: ${session.metadata.order_reference}`);
      }
    }
  }
  res.json({ received: true });
});

async function sendOrderConfirmationEmail(order) {
  if (!resend) { console.error('Resend not configured — RESEND_API_KEY missing'); return; }
  const fromAddress = process.env.RESEND_FROM || 'orders@stickergrab.com';
  const itemRows = order.items.map(item =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${item.size_label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">$${(item.subtotal_cents / 100).toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = `
    <div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1d1d1f">
      <h1 style="font-size:24px;margin:0 0 4px">Order Confirmed!</h1>
      <p style="color:#86868b;margin:0 0 24px">Thanks for your order. Here are the details.</p>

      <div style="background:#f5f5f7;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center">
        <div style="font-size:12px;color:#86868b;text-transform:uppercase;letter-spacing:0.05em">Reference</div>
        <div style="font-size:28px;font-weight:700;font-family:monospace">${order.reference}</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="border-bottom:2px solid #e0e0e0">
            <th style="padding:8px 12px;text-align:left;font-size:13px;color:#86868b">Item</th>
            <th style="padding:8px 12px;text-align:center;font-size:13px;color:#86868b">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:13px;color:#86868b">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div style="text-align:right;margin-bottom:24px">
        <div style="font-size:14px;color:#86868b;margin-bottom:4px">Subtotal: $${(order.subtotal_cents / 100).toFixed(2)}</div>
        <div style="font-size:14px;color:#86868b;margin-bottom:4px">Shipping: $${(order.shipping_cents / 100).toFixed(2)}</div>
        <div style="font-size:18px;font-weight:700">Total: $${(order.total_cents / 100).toFixed(2)}</div>
      </div>

      <div style="background:#f5f5f7;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:12px;color:#86868b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Shipping to</div>
        <div style="font-size:14px;line-height:1.5">
          ${order.shipping_name}<br>
          ${order.shipping_line1}<br>
          ${order.shipping_line2 ? order.shipping_line2 + '<br>' : ''}
          ${order.shipping_city}, ${order.shipping_state} ${order.shipping_zip}<br>
          ${order.shipping_country}
        </div>
      </div>

      <p style="font-size:13px;color:#86868b">You can check your order status anytime with your reference number and email.</p>
    </div>
  `;

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: order.email.toLowerCase(),
    subject: `Order Confirmed — ${order.reference}`,
    html,
  });
  if (error) {
    console.error('Resend API error:', error);
  } else {
    console.log('Email sent:', data?.id);
  }
}

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

app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  },
});

const uploadLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: 'Too many uploads, try again in a minute' } });
const sessionLimiter = rateLimit({ windowMs: 60_000, max: 10, message: { error: 'Too many sessions created, try again in a minute' } });
const checkoutLimiter = rateLimit({ windowMs: 60_000, max: 5, message: { error: 'Too many checkout attempts, try again in a minute' } });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, message: { error: 'Too many login attempts, try again later' } });
const apiLimiter = rateLimit({ windowMs: 60_000, max: 30, message: { error: 'Too many requests, try again in a minute' } });
const lookupLimiter = rateLimit({ windowMs: 60_000, max: 20, message: { error: 'Too many lookup attempts, try again in a minute' } });

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

app.post('/api/session', sessionLimiter, (req, res) => {
  const id = createSession();
  res.json({ sessionId: id });
});

app.get('/api/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found or expired' });
  res.json({ sessionId: session.id, stickers: session.stickers });
});

app.post('/api/session/:id/upload', uploadLimiter, (req, res) => {
  upload.single('sticker')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    handleUpload(req, res);
  });
});

async function handleUpload(req, res) {
  if (!SAFE_SESSION_ID.test(req.params.id)) return res.status(400).json({ error: 'Invalid session ID' });
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found or expired' });
  if (!req.file) return res.status(400).json({ error: 'No image provided' });

  let buffer = req.file.buffer;
  let ext;

  try {
    const image = sharp(buffer);
    const meta = await image.metadata();
    const MAX_DIM = 1500;
    const needsResize = meta.width > MAX_DIM || meta.height > MAX_DIM;

    let pipeline = image;
    if (needsResize) {
      pipeline = pipeline.resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true });
    }
    pipeline = pipeline.trim({ threshold: 10 });

    if (meta.hasAlpha) {
      buffer = await pipeline.png().toBuffer();
      ext = 'png';
    } else {
      buffer = await pipeline.toBuffer();
      const SUB_TO_EXT = { jpeg: 'jpg', 'x-png': 'png', svg: 'svg', 'svg+xml': 'svg' };
      const sub = req.file.mimetype.split('/')[1];
      ext = SUB_TO_EXT[sub] || sub;
    }
  } catch {
    return res.status(400).json({ error: 'Invalid image file' });
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

const SAFE_FILENAME = /^[a-f0-9-]+\.(png|jpg|jpeg|webp|svg)$/;
const SAFE_SESSION_ID = /^[a-hj-np-z2-9]{4}$/;

app.delete('/api/session/:id/sticker/:filename', (req, res) => {
  const { id, filename } = req.params;
  if (!SAFE_SESSION_ID.test(id)) return res.status(400).json({ error: 'Invalid session ID' });
  if (!SAFE_FILENAME.test(filename)) return res.status(400).json({ error: 'Invalid filename' });
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
  res.json({
    sizes: SIZES,
    shippingCents: SHIPPING_FLAT_CENTS,
    taxRates: TAX_RATES,
    currency: process.env.STRIPE_CURRENCY || 'cad',
    shippingConfigured: isShippingConfigured(),
  });
});

app.post('/api/upload-edited', uploadLimiter, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });
  let buffer;
  try {
    const meta = await sharp(req.file.buffer).metadata();
    buffer = await sharp(req.file.buffer).png().toBuffer();
  } catch {
    return res.status(400).json({ error: 'Invalid image file' });
  }
  const filename = `${crypto.randomUUID()}.png`;
  fs.writeFileSync(path.join(ORDERS_ASSETS_DIR, filename), buffer);
  res.json({ url: `/orders-assets/${filename}` });
});

app.post('/api/cart/finalize-image', express.json({ limit: '50mb' }), (req, res) => {
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

app.post('/api/address/validate', apiLimiter, async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });
  const result = await validateAddress(address);
  res.json(result);
});

app.post('/api/shipping/rates', apiLimiter, async (req, res) => {
  const { postalCode, country } = req.body;
  if (!postalCode) return res.status(400).json({ error: 'Postal code required' });
  const result = await getShippingRates(postalCode, country || 'CA');
  res.json(result);
});

app.post('/api/checkout', checkoutLimiter, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const { items, shipping, shippingService } = req.body;
  if (!items?.length || !shipping?.email || !shipping?.name || !shipping?.line1 || !shipping?.city || !shipping?.state || !shipping?.zip) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (shipping.email.length > 254 || shipping.name.length > 200 || shipping.line1.length > 200 ||
      (shipping.line2 && shipping.line2.length > 200) || shipping.city.length > 200 ||
      shipping.state.length > 50 || shipping.zip.length > 20 ||
      (shipping.country && shipping.country.length > 2)) {
    return res.status(400).json({ error: 'Field too long' });
  }

  const SAFE_IMAGE_URL = /^\/(uploads\/[a-z0-9]{4}\/[a-f0-9-]+\.\w{2,4}|orders-assets\/[a-f0-9-]+\.\w{2,4})$/;
  let subtotalCents = 0;
  const validatedItems = [];
  for (const item of items) {
    if (!item.imageUrl || !SAFE_IMAGE_URL.test(item.imageUrl)) {
      return res.status(400).json({ error: 'Invalid image URL' });
    }
    const size = getSize(item.sizeValue);
    if (!size) return res.status(400).json({ error: `Invalid size: ${item.sizeValue}` });
    const qty = Math.max(1, Math.floor(item.quantity));
    subtotalCents += size.priceCents * qty;
    validatedItems.push({ ...size, quantity: qty, imageUrl: item.imageUrl });
  }

  let appliedShipping = SHIPPING_FLAT_CENTS;
  if (shippingService && shipping.zip) {
    const rateResult = await getShippingRates(shipping.zip, shipping.country || 'CA');
    const matched = rateResult.rates?.find(r => r.service === shippingService);
    if (matched) appliedShipping = matched.priceCents;
  }
  const taxInfo = getTaxRate(shipping.state, shipping.country);
  const taxableCents = subtotalCents + appliedShipping;
  const taxCents = taxInfo ? Math.round(taxableCents * taxInfo.rate) : 0;
  const totalCents = taxableCents + taxCents;
  const order = createOrder({
    email: shipping.email, name: shipping.name,
    line1: shipping.line1, line2: shipping.line2,
    city: shipping.city, state: shipping.state, zip: shipping.zip,
    country: shipping.country || 'CA',
    subtotalCents, shippingCents: appliedShipping, taxCents, totalCents,
  });

  for (const item of validatedItems) {
    createOrderItem(order.id, item);
  }

  const origin = req.body.origin || `${req.protocol}://${req.get('host')}`;
  const currency = process.env.STRIPE_CURRENCY || 'cad';
  const line_items = validatedItems.map(item => ({
    price_data: {
      currency,
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
      currency,
      product_data: { name: 'Shipping' },
      unit_amount: appliedShipping,
    },
    quantity: 1,
  });
  if (taxCents > 0) {
    line_items.push({
      price_data: {
        currency,
        product_data: { name: `Tax (${taxInfo.label})` },
        unit_amount: taxCents,
      },
      quantity: 1,
    });
  }

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

app.post('/api/order/lookup', lookupLimiter, (req, res) => {
  const { reference, email } = req.body;
  if (!reference || !email) return res.status(400).json({ error: 'Reference and email required' });
  const order = getOrderByReferenceAndEmail(reference.toUpperCase(), email.toLowerCase());
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// --- Admin ---

const adminTokens = new Set();
const VALID_STATUSES = ['pending', 'paid', 'processing', 'shipped', 'cancelled'];

function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : req.query.token;
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/admin/login', authLimiter, (req, res) => {
  const { password } = req.body;
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.add(token);
  res.json({ token });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const status = req.query.status || null;
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status filter' });
  }
  res.json(getAllOrders(status));
});

app.get('/api/admin/orders/:reference/download', requireAdmin, (req, res) => {
  const order = getOrderByReference(req.params.reference);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const archive = new ZipArchive();
  res.set('Content-Type', 'application/zip');
  res.set('Content-Disposition', `attachment; filename="${order.reference}-stickers.zip"`);
  archive.pipe(res);

  order.items.forEach((item, i) => {
    const filePath = path.join(import.meta.dirname, item.image_url.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(item.image_url);
      archive.file(filePath, { name: `${i + 1}-${item.size_label}-x${item.quantity}${ext}` });
    }
  });

  archive.finalize();
});

app.patch('/api/admin/orders/:reference', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const updated = updateOrderStatus(req.params.reference, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json({ success: true });
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
