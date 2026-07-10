import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function OrderLookupPage() {
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async (e) => {
    e.preventDefault();
    setError('');
    setOrder(null);
    if (!reference || !email) { setError('Both fields are required.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/order/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: reference.trim(), email: email.trim() }),
      });
      if (!res.ok) throw new Error('Order not found. Check your reference number and email.');
      setOrder(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = order ? ({
    pending: 'Payment Pending',
    paid: 'Payment Confirmed',
    processing: 'Processing',
    shipped: 'Shipped',
    cancelled: 'Cancelled',
  }[order.status] || order.status) : '';

  const statusColor = order ? (
    order.status === 'paid' || order.status === 'shipped' ? '#34c759'
    : order.status === 'cancelled' ? '#ff3b30' : '#ff9500'
  ) : '';

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Order Lookup</h1>
        <p style={styles.subtitle}>Enter your reference number and email to check your order status.</p>

        <form onSubmit={handleLookup} style={styles.form}>
          <input placeholder="Reference (e.g. STK-ABC123)" value={reference}
            onChange={e => setReference(e.target.value.toUpperCase())} style={styles.input} />
          <input placeholder="Email address" type="email" value={email}
            onChange={e => setEmail(e.target.value)} style={styles.input} />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.lookupBtn}>
            {loading ? 'Looking up...' : 'Look Up Order'}
          </button>
        </form>

        {order && (
          <div style={styles.result}>
            <div style={styles.resultHeader}>
              <span style={styles.refValue}>{order.reference}</span>
              <span style={styles.statusBadge}>
                <span style={{ ...styles.statusDot, background: statusColor }} />
                {statusLabel}
              </span>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Items</h3>
              {order.items.map((item, i) => (
                <div key={i} style={styles.itemRow}>
                  <div style={styles.itemThumb}>
                    <img src={item.image_url} alt="Sticker" style={styles.itemImg} />
                  </div>
                  <span>{item.size_label} &times; {item.quantity}</span>
                  <span style={styles.itemPrice}>${(item.subtotal_cents / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={styles.totalRow}>
              <span>Total</span>
              <span style={{ fontWeight: 700 }}>${(order.total_cents / 100).toFixed(2)}</span>
            </div>

            {order.paid_at && (
              <p style={styles.paidAt}>Paid on {new Date(order.paid_at).toLocaleDateString()}</p>
            )}
          </div>
        )}

        <Link to="/" style={styles.link}>Back to Home</Link>
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 480, margin: '0 auto', padding: '2rem 1.5rem' },
  card: {
    background: '#fff', borderRadius: 16, padding: '2rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  subtitle: { color: '#86868b', fontSize: '0.9rem', margin: '0 0 1.5rem' },
  form: { textAlign: 'left', marginBottom: '1.5rem' },
  input: {
    width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.95rem',
    border: '1px solid #d1d1d6', borderRadius: 8, marginBottom: '0.6rem',
    boxSizing: 'border-box',
  },
  error: { color: '#ff3b30', fontSize: '0.85rem', margin: '0 0 0.5rem' },
  lookupBtn: {
    width: '100%', padding: '0.65rem', fontSize: '0.95rem', fontWeight: 600,
    background: '#007aff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  result: {
    textAlign: 'left', borderTop: '1px solid #f0f0f0', paddingTop: '1.25rem', marginBottom: '1.25rem',
  },
  resultHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem',
  },
  refValue: { fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace' },
  statusBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    fontSize: '0.8rem', fontWeight: 500,
  },
  statusDot: { width: 8, height: 8, borderRadius: '50%' },
  section: { marginBottom: '1rem' },
  sectionTitle: { fontSize: '0.75rem', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', margin: '0 0 0.5rem' },
  itemRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', fontSize: '0.9rem' },
  itemThumb: {
    width: 40, height: 40, flexShrink: 0, borderRadius: 6,
    background: 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 8px 8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  itemImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  itemPrice: { marginLeft: 'auto', fontWeight: 600 },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '1rem', marginBottom: '0.5rem' },
  paidAt: { fontSize: '0.8rem', color: '#86868b', margin: 0 },
  link: { color: '#007aff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 },
};
