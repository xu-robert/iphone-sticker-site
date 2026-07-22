import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = path.join(import.meta.dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'orders.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    reference             TEXT    NOT NULL UNIQUE,
    email                 TEXT    NOT NULL,
    shipping_name         TEXT    NOT NULL,
    shipping_line1        TEXT    NOT NULL,
    shipping_line2        TEXT,
    shipping_city         TEXT    NOT NULL,
    shipping_state        TEXT    NOT NULL,
    shipping_zip          TEXT    NOT NULL,
    shipping_country      TEXT    NOT NULL DEFAULT 'US',
    status                TEXT    NOT NULL DEFAULT 'pending',
    stripe_session_id     TEXT,
    stripe_payment_intent TEXT,
    subtotal_cents        INTEGER NOT NULL,
    shipping_cents        INTEGER NOT NULL DEFAULT 0,
    total_cents           INTEGER NOT NULL,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    paid_at               TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         INTEGER NOT NULL REFERENCES orders(id),
    image_url        TEXT    NOT NULL,
    size_inches      REAL    NOT NULL,
    size_label       TEXT    NOT NULL,
    quantity         INTEGER NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    subtotal_cents   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_reference ON orders(reference);
  CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
  CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`);

const cols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
if (!cols.includes('tax_cents')) {
  db.exec("ALTER TABLE orders ADD COLUMN tax_cents INTEGER NOT NULL DEFAULT 0");
}
if (!cols.includes('shipping_service')) {
  db.exec("ALTER TABLE orders ADD COLUMN shipping_service TEXT");
}

function generateReference() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'STK-';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    ref += chars[bytes[i] % chars.length];
  }
  return ref;
}

export function createOrder(data) {
  const reference = generateReference();
  const stmt = db.prepare(`
    INSERT INTO orders (reference, email, shipping_name, shipping_line1, shipping_line2,
      shipping_city, shipping_state, shipping_zip, shipping_country,
      subtotal_cents, shipping_cents, tax_cents, total_cents, stripe_session_id, shipping_service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    reference, data.email, data.name, data.line1, data.line2 || null,
    data.city, data.state, data.zip, data.country || 'CA',
    data.subtotalCents, data.shippingCents, data.taxCents || 0, data.totalCents, data.stripeSessionId || null,
    data.shippingService || null,
  );
  return { id: result.lastInsertRowid, reference };
}

export function createOrderItem(orderId, item) {
  db.prepare(`
    INSERT INTO order_items (order_id, image_url, size_inches, size_label, quantity, unit_price_cents, subtotal_cents)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orderId, item.imageUrl, item.inches, item.label, item.quantity, item.priceCents, item.quantity * item.priceCents);
}

export function updateOrderStripeSession(reference, stripeSessionId) {
  db.prepare('UPDATE orders SET stripe_session_id = ? WHERE reference = ?').run(stripeSessionId, reference);
}

export function markOrderPaid(stripeSessionId, paymentIntent) {
  db.prepare(`
    UPDATE orders SET status = 'paid', paid_at = datetime('now'), stripe_payment_intent = ?
    WHERE stripe_session_id = ? AND status = 'pending'
  `).run(paymentIntent, stripeSessionId);
}

export function getOrderByReference(reference) {
  const order = db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return order;
}

export function getOrderByReferenceAndEmail(reference, email) {
  const order = db.prepare('SELECT * FROM orders WHERE reference = ? AND email = ?').get(reference, email);
  if (!order) return null;
  order.items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  return order;
}

export function getAllOrders(statusFilter) {
  const orders = statusFilter
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(statusFilter)
    : db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  const itemStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  for (const order of orders) {
    order.items = itemStmt.all(order.id);
  }
  return orders;
}

export function updateOrderStatus(reference, status) {
  const result = db.prepare('UPDATE orders SET status = ? WHERE reference = ?').run(status, reference);
  return result.changes > 0;
}
