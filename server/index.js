import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import { createSession, getSession, addSticker, removeSticker } from './sessions.js';

const PORT = process.env.PORT || 3001;
const UPLOADS_DIR = path.join(import.meta.dirname, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const app = express();
const server = createServer(app);

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

function handleUpload(req, res) {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found or expired' });
  if (!req.file) return res.status(400).json({ error: 'No image provided' });

  const SUB_TO_EXT = { jpeg: 'jpg', 'x-png': 'png', svg: 'svg', 'svg+xml': 'svg' };
  const sub = req.file.mimetype.split('/')[1];
  const ext = SUB_TO_EXT[sub] || sub;
  const filename = `${crypto.randomUUID()}.${ext}`;
  const sessionDir = path.join(UPLOADS_DIR, req.params.id);
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.writeFileSync(path.join(sessionDir, filename), req.file.buffer);

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
