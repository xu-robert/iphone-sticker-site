import { useState, useEffect, useCallback } from 'react';

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'cancelled'];
const STATUS_COLORS = {
  pending: '#ff9500', paid: '#34c759', processing: '#007aff', shipped: '#5856d6', cancelled: '#ff3b30',
};

function api(path, opts = {}) {
  const token = sessionStorage.getItem('admin_token');
  return fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers },
  });
}

function LoginForm({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error('Invalid password');
      const { token } = await res.json();
      sessionStorage.setItem('admin_token', token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.loginPage}>
      <div style={styles.loginCard}>
        <h1 style={styles.loginTitle}>Admin Login</h1>
        <form onSubmit={handleSubmit}>
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} style={styles.input} autoFocus />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.loginBtn}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function OrderRow({ order, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus) => {
    setUpdating(true);
    try {
      const res = await api(`/api/admin/orders/${order.reference}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) onStatusChange(order.reference, newStatus);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div style={styles.orderCard}>
      <div style={styles.orderHeader} onClick={() => setExpanded(!expanded)}>
        <div style={styles.orderMain}>
          <span style={styles.orderRef}>{order.reference}</span>
          <span style={{ ...styles.statusBadge, background: STATUS_COLORS[order.status] + '20', color: STATUS_COLORS[order.status] }}>
            {order.status}
          </span>
        </div>
        <div style={styles.orderMeta}>
          <span>{order.email}</span>
          <span style={styles.orderDate}>{new Date(order.created_at + 'Z').toLocaleDateString()}</span>
          <span style={styles.orderTotal}>${(order.total_cents / 100).toFixed(2)}</span>
          <span style={styles.expandIcon}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={styles.orderBody}>
          <div style={styles.detailSection}>
            <h4 style={styles.detailTitle}>Items</h4>
            {order.items.map((item, i) => (
              <div key={i} style={styles.itemRow}>
                <div style={styles.itemThumb}>
                  <img src={item.image_url} alt="" style={styles.itemImg} />
                </div>
                <span>{item.size_label} &times; {item.quantity}</span>
                <span style={styles.itemPrice}>${(item.subtotal_cents / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div style={styles.detailSection}>
            <h4 style={styles.detailTitle}>Shipping</h4>
            <p style={styles.address}>
              {order.shipping_name}<br />
              {order.shipping_line1}<br />
              {order.shipping_line2 && <>{order.shipping_line2}<br /></>}
              {order.shipping_city}, {order.shipping_state} {order.shipping_zip}<br />
              {order.shipping_country}
            </p>
          </div>

          <div style={styles.detailSection}>
            <h4 style={styles.detailTitle}>Totals</h4>
            <div style={styles.totalsGrid}>
              <span>Subtotal</span><span>${(order.subtotal_cents / 100).toFixed(2)}</span>
              <span>Shipping</span><span>${(order.shipping_cents / 100).toFixed(2)}</span>
              <span style={{ fontWeight: 700 }}>Total</span><span style={{ fontWeight: 700 }}>${(order.total_cents / 100).toFixed(2)}</span>
            </div>
          </div>

          <div style={styles.detailSection}>
            <h4 style={styles.detailTitle}>Update Status</h4>
            <div style={styles.statusRow}>
              {STATUSES.map(s => (
                <button key={s} disabled={updating || s === order.status}
                  onClick={() => handleStatusChange(s)}
                  style={s === order.status ? { ...styles.statusBtn, ...styles.statusBtnActive, borderColor: STATUS_COLORS[s], color: STATUS_COLORS[s] } : styles.statusBtn}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {order.paid_at && <p style={styles.paidAt}>Paid: {new Date(order.paid_at + 'Z').toLocaleString()}</p>}
          {order.stripe_payment_intent && <p style={styles.stripeId}>Stripe: {order.stripe_payment_intent}</p>}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('admin_token'));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const url = filter ? `/api/admin/orders?status=${filter}` : '/api/admin/orders';
    const res = await api(url);
    if (res.status === 401) {
      sessionStorage.removeItem('admin_token');
      setAuthed(false);
      return;
    }
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    if (authed) fetchOrders();
  }, [authed, fetchOrders]);

  const handleStatusChange = (reference, newStatus) => {
    setOrders(prev => prev.map(o => o.reference === reference ? { ...o, status: newStatus } : o));
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setAuthed(false);
  };

  if (!authed) return <LoginForm onLogin={() => setAuthed(true)} />;

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>Orders</h1>
        <button onClick={handleLogout} style={styles.logoutBtn}>Log Out</button>
      </div>

      <div style={styles.filterRow}>
        <button onClick={() => setFilter('')}
          style={!filter ? { ...styles.filterBtn, ...styles.filterBtnActive } : styles.filterBtn}>All</button>
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={filter === s ? { ...styles.filterBtn, ...styles.filterBtnActive } : styles.filterBtn}>{s}</button>
        ))}
        <button onClick={fetchOrders} style={styles.refreshBtn}>Refresh</button>
      </div>

      {loading && <p style={styles.loadingText}>Loading...</p>}

      {!loading && orders.length === 0 && (
        <p style={styles.emptyText}>No orders{filter ? ` with status "${filter}"` : ''}.</p>
      )}

      {orders.map(order => (
        <OrderRow key={order.reference} order={order} onStatusChange={handleStatusChange} />
      ))}
    </div>
  );
}

const styles = {
  loginPage: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#f5f5f7',
  },
  loginCard: {
    background: '#fff', borderRadius: 16, padding: '2.5rem',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)', width: 320, textAlign: 'center',
  },
  loginTitle: { fontSize: '1.35rem', fontWeight: 700, margin: '0 0 1.5rem' },
  input: {
    width: '100%', padding: '0.6rem 0.8rem', fontSize: '0.95rem',
    border: '1px solid #d1d1d6', borderRadius: 8, marginBottom: '0.75rem',
    boxSizing: 'border-box',
  },
  error: { color: '#ff3b30', fontSize: '0.85rem', margin: '0 0 0.5rem' },
  loginBtn: {
    width: '100%', padding: '0.65rem', fontSize: '0.95rem', fontWeight: 600,
    background: '#007aff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  page: { maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem',
  },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  logoutBtn: {
    fontSize: '0.85rem', color: '#ff3b30', background: 'none',
    border: 'none', cursor: 'pointer', fontWeight: 500,
  },
  filterRow: {
    display: 'flex', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center',
  },
  filterBtn: {
    padding: '0.35rem 0.7rem', borderRadius: 8, fontSize: '0.8rem',
    fontWeight: 500, cursor: 'pointer', border: '1.5px solid #d1d1d6',
    background: '#fff', color: '#1d1d1f', textTransform: 'capitalize',
  },
  filterBtnActive: { borderColor: '#007aff', background: '#eef4ff', color: '#007aff' },
  refreshBtn: {
    marginLeft: 'auto', padding: '0.35rem 0.7rem', borderRadius: 8,
    fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
    border: '1.5px solid #d1d1d6', background: '#fff', color: '#007aff',
  },
  loadingText: { color: '#86868b', textAlign: 'center', padding: '2rem 0' },
  emptyText: { color: '#86868b', textAlign: 'center', padding: '2rem 0' },
  orderCard: {
    background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    marginBottom: '0.75rem', overflow: 'hidden',
  },
  orderHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 1.25rem', cursor: 'pointer', flexWrap: 'wrap', gap: '0.5rem',
  },
  orderMain: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  orderRef: { fontWeight: 700, fontFamily: 'monospace', fontSize: '0.95rem' },
  statusBadge: {
    padding: '0.2rem 0.6rem', borderRadius: 6, fontSize: '0.7rem',
    fontWeight: 600, textTransform: 'uppercase',
  },
  orderMeta: { display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: '#86868b' },
  orderDate: {},
  orderTotal: { fontWeight: 600, color: '#1d1d1f' },
  expandIcon: { fontSize: '0.7rem', color: '#86868b' },
  orderBody: { padding: '0 1.25rem 1.25rem', borderTop: '1px solid #f0f0f0' },
  detailSection: { marginTop: '1rem' },
  detailTitle: {
    fontSize: '0.75rem', fontWeight: 600, color: '#86868b',
    textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.5rem',
  },
  itemRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', fontSize: '0.9rem' },
  itemThumb: {
    width: 40, height: 40, flexShrink: 0, borderRadius: 6,
    background: 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 8px 8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  itemImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  itemPrice: { marginLeft: 'auto', fontWeight: 600 },
  address: { fontSize: '0.9rem', lineHeight: 1.5, margin: 0 },
  totalsGrid: {
    display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.25rem 1rem',
    fontSize: '0.9rem', maxWidth: 200,
  },
  statusRow: { display: 'flex', gap: '0.35rem', flexWrap: 'wrap' },
  statusBtn: {
    padding: '0.3rem 0.6rem', borderRadius: 6, fontSize: '0.75rem',
    fontWeight: 500, cursor: 'pointer', border: '1.5px solid #d1d1d6',
    background: '#fff', color: '#1d1d1f', textTransform: 'capitalize',
  },
  statusBtnActive: { background: '#f5f5f7', fontWeight: 700 },
  paidAt: { fontSize: '0.8rem', color: '#86868b', margin: '1rem 0 0' },
  stripeId: { fontSize: '0.75rem', color: '#86868b', margin: '0.25rem 0 0', fontFamily: 'monospace' },
};
