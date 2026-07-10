import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function CartPage() {
  const { items, pricing, removeItem, updateItemQuantity, updateItemSize, clearCart, subtotalCents } = useCart();
  const [shipping, setShipping] = useState({ email: '', name: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'US' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const shippingCents = pricing?.shippingCents || 399;
  const totalCents = subtotalCents + (items.length > 0 ? shippingCents : 0);

  const updateField = (field, value) => setShipping(prev => ({ ...prev, [field]: value }));

  const handleCheckout = async () => {
    setError('');
    if (!shipping.email || !shipping.name || !shipping.line1 || !shipping.city || !shipping.state || !shipping.zip) {
      setError('Please fill in all required shipping fields.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ imageUrl: i.imageUrl, sizeValue: i.sizeValue, quantity: i.quantity })),
          shipping,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      clearCart();
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div style={styles.page}>
        <h1 style={styles.pageTitle}>Your Cart</h1>
        <div style={styles.empty}>
          <p style={styles.emptyText}>Your cart is empty.</p>
          <Link to="/" style={styles.backLink}>Continue editing stickers</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <h1 style={styles.pageTitle}>Your Cart</h1>
        <Link to="/" style={styles.backLink}>Continue Editing</Link>
      </div>

      <div style={styles.layout}>
        <div style={styles.itemsSection}>
          {items.map(item => (
            <div key={item.id} style={styles.itemCard}>
              <div style={styles.itemPreview}>
                <img src={item.displayUrl} alt="Sticker" style={styles.itemImg} />
              </div>
              <div style={styles.itemDetails}>
                <div style={styles.itemRow}>
                  <span style={styles.itemLabel}>Size</span>
                  <div style={styles.chipRow}>
                    {pricing?.sizes.map(s => (
                      <button key={s.value} onClick={() => updateItemSize(item.id, s.value)}
                        style={item.sizeValue === s.value ? { ...styles.chip, ...styles.chipActive } : styles.chip}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={styles.itemRow}>
                  <span style={styles.itemLabel}>Qty</span>
                  <input type="number" min={1} max={100} value={item.quantity}
                    onChange={e => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                    style={styles.qtyInput} />
                  <span style={styles.itemPrice}>${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</span>
                  <button onClick={() => removeItem(item.id)} style={styles.removeBtn}>Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.sidebar}>
          <div style={styles.summaryCard}>
            <h2 style={styles.sidebarTitle}>Order Summary</h2>
            <div style={styles.summaryRow}>
              <span>Subtotal</span><span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            <div style={styles.summaryRow}>
              <span>Shipping</span><span>${(shippingCents / 100).toFixed(2)}</span>
            </div>
            <div style={{ ...styles.summaryRow, ...styles.totalRow }}>
              <span>Total</span><span>${(totalCents / 100).toFixed(2)}</span>
            </div>
          </div>

          <div style={styles.shippingCard}>
            <h2 style={styles.sidebarTitle}>Shipping Info</h2>
            <input placeholder="Email *" value={shipping.email} onChange={e => updateField('email', e.target.value)} style={styles.input} />
            <input placeholder="Full Name *" value={shipping.name} onChange={e => updateField('name', e.target.value)} style={styles.input} />
            <input placeholder="Address Line 1 *" value={shipping.line1} onChange={e => updateField('line1', e.target.value)} style={styles.input} />
            <input placeholder="Address Line 2" value={shipping.line2} onChange={e => updateField('line2', e.target.value)} style={styles.input} />
            <div style={styles.inputRow}>
              <input placeholder="City *" value={shipping.city} onChange={e => updateField('city', e.target.value)} style={{ ...styles.input, flex: 2 }} />
              <input placeholder="State *" value={shipping.state} onChange={e => updateField('state', e.target.value)} style={{ ...styles.input, flex: 1 }} />
            </div>
            <div style={styles.inputRow}>
              <input placeholder="ZIP *" value={shipping.zip} onChange={e => updateField('zip', e.target.value)} style={{ ...styles.input, flex: 1 }} />
              <input placeholder="Country" value={shipping.country} onChange={e => updateField('country', e.target.value)} style={{ ...styles.input, flex: 1 }} />
            </div>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button onClick={handleCheckout} disabled={submitting} style={styles.checkoutBtn}>
            {submitting ? 'Processing...' : 'Proceed to Checkout'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  backLink: { fontSize: '0.9rem', color: '#007aff', textDecoration: 'none', fontWeight: 500 },
  empty: { textAlign: 'center', padding: '4rem 0' },
  emptyText: { color: '#86868b', fontSize: '1.05rem', marginBottom: '1rem' },
  layout: { display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  itemsSection: { flex: 2, minWidth: 300 },
  sidebar: { flex: 1, minWidth: 280 },
  itemCard: {
    display: 'flex', gap: '1rem', padding: '1rem', background: '#fff',
    borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem',
  },
  itemPreview: {
    width: 80, height: 80, flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 12px 12px',
    borderRadius: 8,
  },
  itemImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  itemDetails: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  itemRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  itemLabel: { fontSize: '0.8rem', color: '#86868b', minWidth: 30 },
  itemPrice: { fontSize: '0.95rem', fontWeight: 600, marginLeft: 'auto' },
  removeBtn: {
    fontSize: '0.75rem', color: '#ff3b30', background: 'none',
    border: 'none', cursor: 'pointer', fontWeight: 500,
  },
  chipRow: { display: 'flex', gap: '0.3rem' },
  chip: {
    padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: '0.7rem',
    fontWeight: 500, cursor: 'pointer', border: '1.5px solid #d1d1d6',
    background: '#fff', color: '#1d1d1f',
  },
  chipActive: { borderColor: '#007aff', background: '#eef4ff', color: '#007aff' },
  qtyInput: {
    width: 56, padding: '0.3rem', fontSize: '0.85rem',
    border: '1px solid #d1d1d6', borderRadius: 6, textAlign: 'center',
  },
  summaryCard: {
    background: '#fff', borderRadius: 12, padding: '1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem',
  },
  shippingCard: {
    background: '#fff', borderRadius: 12, padding: '1.25rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1rem',
  },
  sidebarTitle: { fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem',
    color: '#1d1d1f', marginBottom: '0.5rem',
  },
  totalRow: {
    borderTop: '1px solid #f0f0f0', paddingTop: '0.5rem', marginTop: '0.25rem',
    fontWeight: 700, fontSize: '1rem',
  },
  input: {
    width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.9rem',
    border: '1px solid #d1d1d6', borderRadius: 8, marginBottom: '0.5rem',
    boxSizing: 'border-box',
  },
  inputRow: { display: 'flex', gap: '0.5rem' },
  error: { color: '#ff3b30', fontSize: '0.85rem', marginBottom: '0.5rem' },
  checkoutBtn: {
    width: '100%', padding: '0.75rem', fontSize: '1rem', fontWeight: 600,
    background: '#007aff', color: '#fff', border: 'none', borderRadius: 10,
    cursor: 'pointer',
  },
};
