import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

function formatDeliveryDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export default function CartPage() {
  const { items, pricing, removeItem, updateItemQuantity, updateItemSize, clearCart, subtotalCents } = useCart();
  const [shipping, setShipping] = useState({ email: '', name: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'CA' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [shippingRates, setShippingRates] = useState(null);
  const [selectedRate, setSelectedRate] = useState(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const rateDebounceRef = useRef(null);

  const shippingCents = selectedRate?.priceCents || pricing?.shippingCents || 399;
  const hasAddress = shipping.state && shipping.zip?.trim().length >= 3;
  const taxRate = hasAddress && (shipping.country || 'CA').toUpperCase() === 'CA' && pricing?.taxRates
    ? pricing.taxRates[shipping.state.toUpperCase().trim()] : null;
  const taxableCents = subtotalCents + (hasAddress ? shippingCents : 0);
  const taxCents = taxRate ? Math.round(taxableCents * taxRate.rate) : 0;
  const totalCents = subtotalCents + (items.length > 0 && hasAddress ? shippingCents + taxCents : 0);

  const updateField = (field, value) => {
    setShipping(prev => ({ ...prev, [field]: value }));
  };

  const fetchRates = useCallback(async (postalCode, country) => {
    setLoadingRates(true);
    try {
      const res = await fetch('/api/shipping/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postalCode, country }),
      });
      const data = await res.json();
      setShippingRates(data);
      if (data.rates?.length > 0) {
        setSelectedRate(data.rates[0]);
      }
    } catch {
      setShippingRates(null);
    } finally {
      setLoadingRates(false);
    }
  }, []);

  useEffect(() => {
    const zip = shipping.zip?.trim();
    if (!zip || zip.length < 3) {
      setShippingRates(null);
      setSelectedRate(null);
      return;
    }
    if (rateDebounceRef.current) clearTimeout(rateDebounceRef.current);
    rateDebounceRef.current = setTimeout(() => {
      fetchRates(zip, shipping.country);
    }, 600);
    return () => clearTimeout(rateDebounceRef.current);
  }, [shipping.zip, shipping.country, fetchRates]);

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
          shippingService: selectedRate?.service || null,
          origin: window.location.origin,
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
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🛒</div>
          <h1 style={styles.emptyTitle}>Your cart is empty</h1>
          <p style={styles.emptyText}>Add some stickers to get started!</p>
          <Link to="/workspace" style={styles.startLink}>Start Creating</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <h1 style={styles.pageTitle}>Your Cart</h1>
        <Link to="/workspace" style={styles.backLink}>← Continue Editing</Link>
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
          <div style={styles.shippingCard}>
            <h2 style={styles.sidebarTitle}>Shipping Info</h2>
            <input placeholder="Email *" type="email" value={shipping.email} onChange={e => updateField('email', e.target.value)} style={styles.input} />
            <input placeholder="Full Name *" value={shipping.name} onChange={e => updateField('name', e.target.value)} style={styles.input} />
            <input placeholder="Address Line 1 *" value={shipping.line1} onChange={e => updateField('line1', e.target.value)} style={styles.input} />
            <input placeholder="Address Line 2" value={shipping.line2} onChange={e => updateField('line2', e.target.value)} style={styles.input} />
            <div style={styles.inputRow}>
              <input placeholder="City *" value={shipping.city} onChange={e => updateField('city', e.target.value)} style={{ ...styles.input, flex: 2 }} />
              <input placeholder="Province/State *" value={shipping.state} onChange={e => updateField('state', e.target.value)} style={{ ...styles.input, flex: 1 }} />
            </div>
            <div style={styles.inputRow}>
              <input placeholder="Postal/ZIP *" value={shipping.zip} onChange={e => updateField('zip', e.target.value)} style={{ ...styles.input, flex: 1 }} />
              <select value={shipping.country} onChange={e => updateField('country', e.target.value)} style={{ ...styles.input, flex: 1 }}>
                <option value="CA">Canada</option>
                <option value="US">United States</option>
              </select>
            </div>
          </div>

          {(loadingRates || shippingRates) && (
            <div style={styles.ratesCard}>
              <h2 style={styles.sidebarTitle}>Shipping Method</h2>
              {loadingRates ? (
                <p style={styles.loadingText}>Calculating rates...</p>
              ) : shippingRates?.rates?.length > 0 ? (
                shippingRates.rates.map((rate, i) => (
                  <label key={i} style={{
                    ...styles.rateOption,
                    ...(selectedRate?.service === rate.service ? styles.rateOptionActive : {}),
                  }}>
                    <input
                      type="radio"
                      name="shippingRate"
                      checked={selectedRate?.service === rate.service}
                      onChange={() => setSelectedRate(rate)}
                      style={styles.rateRadio}
                    />
                    <div style={styles.rateInfo}>
                      <span style={styles.rateName}>{rate.description || rate.service}</span>
                      {rate.deliveryDate && (
                        <span style={styles.rateDelivery}>
                          Est. {formatDeliveryDate(rate.deliveryDate)}
                          {rate.deliveryDateLate ? ` – ${formatDeliveryDate(rate.deliveryDateLate)}` : ''}
                        </span>
                      )}
                      {!rate.deliveryDate && rate.deliveryDays && (
                        <span style={styles.rateDelivery}>~{rate.deliveryDays} business days</span>
                      )}
                    </div>
                    <span style={styles.ratePrice}>${(rate.priceCents / 100).toFixed(2)}</span>
                  </label>
                ))
              ) : (
                <p style={styles.loadingText}>No rates available</p>
              )}
              {shippingRates?.source === 'estimate' && (
                <p style={styles.estimateNote}>Estimated rates — final cost confirmed at checkout</p>
              )}
            </div>
          )}

          <div style={styles.summaryCard}>
            <h2 style={styles.sidebarTitle}>Order Summary</h2>
            <div style={styles.summaryRow}>
              <span>Subtotal</span><span>${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            <div style={styles.summaryRow}>
              <span>Shipping</span>
              {hasAddress ? (
                <span>${(shippingCents / 100).toFixed(2)}</span>
              ) : (
                <span style={styles.summaryPlaceholder}>Enter address</span>
              )}
            </div>
            <div style={styles.summaryRow}>
              <span>{taxRate ? `Tax (${taxRate.label})` : 'Tax'}</span>
              {hasAddress ? (
                <span>${(taxCents / 100).toFixed(2)}</span>
              ) : (
                <span style={styles.summaryPlaceholder}>Enter address</span>
              )}
            </div>
            <div style={{ ...styles.summaryRow, ...styles.totalRow }}>
              <span>Total</span>
              {hasAddress ? (
                <span>${(totalCents / 100).toFixed(2)}</span>
              ) : (
                <span style={styles.summaryPlaceholder}>—</span>
              )}
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
  page: { maxWidth: 1000, margin: '0 auto', padding: '1.5rem' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' },
  pageTitle: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  backLink: { fontSize: '0.9rem', color: 'var(--brand-purple)', textDecoration: 'none', fontWeight: 500 },
  emptyState: { textAlign: 'center', padding: '5rem 2rem' },
  emptyIcon: { fontSize: '3rem', marginBottom: '1rem' },
  emptyTitle: { fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.4rem' },
  emptyText: { color: 'var(--text-muted)', marginBottom: '1.5rem' },
  startLink: {
    display: 'inline-flex', padding: '0.7rem 1.5rem', fontSize: '0.95rem', fontWeight: 600,
    color: '#fff', background: 'var(--gradient-btn)', borderRadius: 'var(--radius-md)',
    textDecoration: 'none', boxShadow: 'var(--shadow-glow)',
  },
  layout: { display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  itemsSection: { flex: 2, minWidth: 300 },
  sidebar: { flex: 1, minWidth: 280 },
  itemCard: {
    display: 'flex', gap: '1rem', padding: '1rem', background: 'var(--bg-card)',
    borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)', marginBottom: '0.75rem',
  },
  itemPreview: {
    width: 80, height: 80, flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 0 0 / 12px 12px',
    borderRadius: 'var(--radius-sm)',
  },
  itemImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  itemDetails: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  itemRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' },
  itemLabel: { fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: 30 },
  itemPrice: { fontSize: '0.95rem', fontWeight: 600, marginLeft: 'auto' },
  removeBtn: {
    fontSize: '0.75rem', color: '#ef4444', background: 'none',
    border: 'none', cursor: 'pointer', fontWeight: 500,
  },
  chipRow: { display: 'flex', gap: '0.3rem' },
  chip: {
    padding: '0.25rem 0.55rem', borderRadius: 'var(--radius-sm)', fontSize: '0.7rem',
    fontWeight: 500, cursor: 'pointer', border: '1.5px solid var(--border)',
    background: 'var(--bg-card)', color: 'var(--text)',
  },
  chipActive: { borderColor: 'var(--brand-purple)', background: 'rgba(124,58,237,0.06)', color: 'var(--brand-purple)' },
  qtyInput: {
    width: 56, padding: '0.3rem', fontSize: '0.85rem',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', textAlign: 'center',
  },
  summaryCard: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '1.25rem',
    boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', marginBottom: '0.75rem',
  },
  shippingCard: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '1.25rem',
    boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', marginBottom: '0.75rem',
  },
  ratesCard: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '1.25rem',
    boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-light)', marginBottom: '0.75rem',
  },
  sidebarTitle: { fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem' },
  summaryRow: {
    display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem',
    color: 'var(--text)', marginBottom: '0.5rem',
  },
  summaryPlaceholder: {
    fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic',
  },
  totalRow: {
    borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', marginTop: '0.25rem',
    fontWeight: 700, fontSize: '1.05rem',
  },
  input: {
    width: '100%', padding: '0.55rem 0.75rem', fontSize: '0.9rem',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem',
    boxSizing: 'border-box', outline: 'none',
  },
  inputRow: { display: 'flex', gap: '0.5rem' },
  error: { color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.5rem' },
  rateOption: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--border)', marginBottom: '0.4rem',
    cursor: 'pointer', background: 'var(--bg-card)',
  },
  rateOptionActive: {
    borderColor: 'var(--brand-purple)', background: 'rgba(124,58,237,0.04)',
  },
  rateRadio: { accentColor: 'var(--brand-purple)' },
  rateInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem' },
  rateName: { fontSize: '0.85rem', fontWeight: 500 },
  rateDesc: { fontSize: '0.75rem', color: 'var(--text-muted)' },
  rateDelivery: { fontSize: '0.75rem', color: 'var(--brand-green)' },
  ratePrice: { fontSize: '0.9rem', fontWeight: 600, flexShrink: 0 },
  loadingText: { fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' },
  estimateNote: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontStyle: 'italic' },
  checkoutBtn: {
    width: '100%', padding: '0.8rem', fontSize: '1rem', fontWeight: 600,
    color: '#fff', background: 'var(--gradient-btn)', border: 'none',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', boxShadow: 'var(--shadow-glow)',
  },
};
