import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

export default function OrderConfirmationPage() {
  const { reference } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/order/${reference}`)
      .then(r => r.ok ? r.json() : Promise.reject('Order not found'))
      .then(setOrder)
      .catch(e => setError(typeof e === 'string' ? e : e.message))
      .finally(() => setLoading(false));
  }, [reference]);

  if (loading) return <div style={styles.page}><p>Loading...</p></div>;
  if (error) return (
    <div style={styles.page}>
      <p style={styles.error}>{error}</p>
      <Link to="/" style={styles.link}>Back to home</Link>
    </div>
  );

  const statusLabel = {
    pending: 'Payment Pending',
    paid: 'Payment Confirmed',
    processing: 'Processing',
    shipped: 'Shipped',
    cancelled: 'Cancelled',
  }[order.status] || order.status;

  const statusColor = order.status === 'paid' || order.status === 'shipped' ? '#34c759'
    : order.status === 'cancelled' ? '#ff3b30' : '#ff9500';

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.checkmark}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#34c759" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h1 style={styles.title}>Order {order.status === 'paid' ? 'Confirmed' : 'Received'}!</h1>
        <p style={styles.subtitle}>Save your reference number for tracking.</p>

        <div style={styles.refBox}>
          <span style={styles.refLabel}>Reference</span>
          <span style={styles.refValue}>{order.reference}</span>
        </div>

        <div style={styles.statusBadge}>
          <span style={{ ...styles.statusDot, background: statusColor }} />
          {statusLabel}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Items</h3>
          {order.items.map((item, i) => (
            <div key={i} style={styles.itemRow}>
              <div style={styles.itemThumb}>
                <img src={item.image_url} alt="Sticker" style={styles.itemImg} />
              </div>
              <div style={styles.itemInfo}>
                <span>{item.size_label} &times; {item.quantity}</span>
                <span style={styles.itemPrice}>${(item.subtotal_cents / 100).toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Shipping</h3>
          <p style={styles.address}>
            {order.shipping_name}<br />
            {order.shipping_line1}<br />
            {order.shipping_line2 && <>{order.shipping_line2}<br /></>}
            {order.shipping_city}, {order.shipping_state} {order.shipping_zip}<br />
            {order.shipping_country}
          </p>
        </div>

        <div style={styles.totalSection}>
          <div style={styles.totalRow}><span>Subtotal</span><span>${(order.subtotal_cents / 100).toFixed(2)}</span></div>
          <div style={styles.totalRow}><span>Shipping</span><span>${(order.shipping_cents / 100).toFixed(2)}</span></div>
          <div style={{ ...styles.totalRow, fontWeight: 700, borderTop: '1px solid #e0e0e0', paddingTop: '0.5rem' }}>
            <span>Total</span><span>${(order.total_cents / 100).toFixed(2)}</span>
          </div>
        </div>

        <div style={styles.actions}>
          <Link to="/" style={styles.link}>Back to Home</Link>
          <Link to="/order-lookup" style={styles.link}>Look Up Another Order</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 560, margin: '0 auto', padding: '2rem 1.5rem' },
  card: {
    background: '#fff', borderRadius: 16, padding: '2rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', textAlign: 'center',
  },
  checkmark: { marginBottom: '0.75rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem' },
  subtitle: { color: '#86868b', fontSize: '0.95rem', margin: '0 0 1.5rem' },
  refBox: {
    display: 'inline-flex', flexDirection: 'column', gap: '0.25rem',
    background: '#f5f5f7', borderRadius: 10, padding: '0.75rem 1.5rem', marginBottom: '1rem',
  },
  refLabel: { fontSize: '0.7rem', color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  refValue: { fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#1d1d1f' },
  statusBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    fontSize: '0.85rem', fontWeight: 500, color: '#1d1d1f', marginBottom: '1.5rem',
  },
  statusDot: { width: 8, height: 8, borderRadius: '50%' },
  section: { textAlign: 'left', marginBottom: '1.25rem' },
  sectionTitle: { fontSize: '0.8rem', fontWeight: 600, color: '#86868b', textTransform: 'uppercase', margin: '0 0 0.5rem' },
  itemRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' },
  itemThumb: {
    width: 48, height: 48, flexShrink: 0, borderRadius: 6,
    background: 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 10px 10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  itemImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  itemInfo: { flex: 1, display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' },
  itemPrice: { fontWeight: 600 },
  address: { fontSize: '0.9rem', lineHeight: 1.5, color: '#1d1d1f', margin: 0 },
  totalSection: { textAlign: 'left', marginBottom: '1.5rem' },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.35rem' },
  actions: { display: 'flex', justifyContent: 'center', gap: '1.5rem' },
  link: { color: '#007aff', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 },
  error: { color: '#ff3b30', textAlign: 'center' },
};
