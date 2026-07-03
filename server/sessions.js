const SESSION_TTL = 24 * 60 * 60 * 1000;

const sessions = new Map();

function generateId() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return sessions.has(id) ? generateId() : id;
}

export function createSession() {
  const id = generateId();
  sessions.set(id, {
    id,
    createdAt: Date.now(),
    stickers: [],
  });
  return id;
}

export function getSession(id) {
  const session = sessions.get(id);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL) {
    sessions.delete(id);
    return null;
  }
  return session;
}

export function addSticker(sessionId, sticker) {
  const session = getSession(sessionId);
  if (!session) return null;
  session.stickers.push(sticker);
  return sticker;
}

export function removeSticker(sessionId, filename) {
  const session = getSession(sessionId);
  if (!session) return false;
  const idx = session.stickers.findIndex((s) => s.filename === filename);
  if (idx === -1) return false;
  session.stickers.splice(idx, 1);
  return true;
}
