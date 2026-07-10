import { useState } from 'react';
import { useCart } from '../context/CartContext.jsx';

export default function AddToCartModal({ sticker, onClose }) {
  const { pricing, addItem } = useCart();
  const [sizeValue, setSizeValue] = useState('3in');
  const [quantity, setQuantity] = useState(1);
  const [finalizing, setFinalizing] = useState(false);

  if (!pricing) return null;

  const size = pricing.sizes.find(s => s.value === sizeValue);
  const totalCents = size ? size.priceCents * quantity : 0;
  const displayUrl = sticker.displayUrl || sticker.imageUrl;

  const handleAdd = async () => {
    setFinalizing(true);
    try {
      let imageUrl;
      if (displayUrl.startsWith('data:')) {
        const res = await fetch('/api/cart/finalize-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: displayUrl }),
        });
        if (res.ok) {
          imageUrl = (await res.json()).imageUrl;
        } else {
          imageUrl = displayUrl;
        }
      } else {
        imageUrl = displayUrl;
      }
      addItem(imageUrl, displayUrl, sizeValue, quantity);
      onClose();
    } catch {
      addItem(displayUrl, displayUrl, sizeValue, quantity);
      onClose();
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Add to Cart</h2>
          <button onClick={onClose} style={styles.closeBtn}>&times;</button>
        </div>

        <div style={styles.body}>
          <div style={styles.preview}>
            <img src={displayUrl} alt="Sticker" style={styles.previewImg} />
          </div>

          <div style={styles.options}>
            <div style={styles.field}>
              <span style={styles.label}>Size</span>
              <div style={styles.chipRow}>
                {pricing.sizes.map(s => (
                  <button key={s.value} onClick={() => setSizeValue(s.value)}
                    style={sizeValue === s.value ? { ...styles.chip, ...styles.chipActive } : styles.chip}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.field}>
              <span style={styles.label}>Quantity</span>
              <input type="number" min={1} max={100} value={quantity}
                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                style={styles.numberInput} />
            </div>

            <div style={styles.priceRow}>
              <span style={styles.priceLabel}>Price</span>
              <span style={styles.priceValue}>${(totalCents / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleAdd} disabled={finalizing} style={styles.addBtn}>
            {finalizing ? 'Adding...' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1100,
  },
  modal: {
    background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    maxWidth: 480, width: '90vw', overflow: 'hidden',
  },
  header: {
    padding: '1.25rem 1.5rem', borderBottom: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: '1.15rem', fontWeight: 600, margin: 0 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1.5rem',
    color: '#86868b', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1,
  },
  body: { padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'flex-start' },
  preview: {
    width: 120, height: 120, flexShrink: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    background: 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 16px 16px',
    borderRadius: 8,
  },
  previewImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  options: { flex: 1 },
  field: { marginBottom: '1rem' },
  label: { fontSize: '0.85rem', fontWeight: 500, color: '#1d1d1f', display: 'block', marginBottom: '0.4rem' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  chip: {
    padding: '0.35rem 0.7rem', borderRadius: 8, fontSize: '0.8rem',
    fontWeight: 500, cursor: 'pointer', border: '1.5px solid #d1d1d6',
    background: '#fff', color: '#1d1d1f',
  },
  chipActive: { borderColor: '#007aff', background: '#eef4ff', color: '#007aff' },
  numberInput: {
    width: 72, padding: '0.4rem 0.5rem', fontSize: '0.9rem',
    border: '1px solid #d1d1d6', borderRadius: 6, textAlign: 'center',
  },
  priceRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.75rem 0', borderTop: '1px solid #f0f0f0', marginTop: '0.5rem',
  },
  priceLabel: { fontSize: '0.95rem', fontWeight: 500, color: '#1d1d1f' },
  priceValue: { fontSize: '1.15rem', fontWeight: 700, color: '#1d1d1f' },
  footer: {
    padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
  },
  cancelBtn: {
    padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 500,
    background: '#f5f5f7', color: '#1d1d1f', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  addBtn: {
    padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 500,
    background: '#34c759', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
};
