import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';

export default function CartDrawer() {
  const { items, drawerOpen, closeDrawer, removeItem, subtotalCents, pricing } = useCart();
  const navigate = useNavigate();
  const shippingCents = pricing?.shippingCents || 399;

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [drawerOpen]);

  if (!drawerOpen) return null;

  const handleCheckout = () => {
    closeDrawer();
    navigate('/cart');
  };

  return (
    <>
      <div style={styles.backdrop} onClick={closeDrawer} />
      <div style={styles.drawer}>
        <div style={styles.header}>
          <h2 style={styles.title}>Your Cart</h2>
          <button onClick={closeDrawer} style={styles.closeBtn}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={styles.body}>
          {items.length === 0 ? (
            <div style={styles.empty}>
              <p style={styles.emptyText}>Your cart is empty</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} style={styles.item}>
                <div style={styles.itemThumb}>
                  <img src={item.displayUrl} alt="" style={styles.itemImg} />
                </div>
                <div style={styles.itemInfo}>
                  <div style={styles.itemTop}>
                    <span style={styles.itemName}>{item.sizeLabel} Sticker</span>
                    <button onClick={() => removeItem(item.id)} style={styles.removeBtn}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                  <span style={styles.itemDetail}>Qty {item.quantity}</span>
                  <span style={styles.itemPrice}>${((item.unitPriceCents * item.quantity) / 100).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div style={styles.footer}>
            <div style={styles.subtotalRow}>
              <span style={styles.subtotalLabel}>Subtotal</span>
              <span style={styles.subtotalValue}>${(subtotalCents / 100).toFixed(2)}</span>
            </div>
            <p style={styles.shippingNote}>Shipping calculated at checkout</p>
            <button onClick={handleCheckout} style={styles.checkoutBtn}>
              Proceed to Checkout
            </button>
            <button onClick={closeDrawer} style={styles.keepShoppingBtn}>
              Keep Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.3)',
    backdropFilter: 'blur(2px)',
    zIndex: 1200,
  },
  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 'min(400px, 85vw)',
    background: 'var(--bg-card)',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
    zIndex: 1201,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideIn 0.25s ease-out',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.25rem 1.5rem',
    borderBottom: '1px solid var(--border-light)',
    flexShrink: 0,
  },
  title: {
    fontSize: '1.15rem',
    fontWeight: 700,
    margin: 0,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem 1.5rem',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.95rem',
  },
  item: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.75rem 0',
    borderBottom: '1px solid var(--border-light)',
  },
  itemThumb: {
    width: 60,
    height: 60,
    flexShrink: 0,
    borderRadius: 'var(--radius-sm)',
    background: 'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 0 0 / 10px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemImg: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  itemInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    minWidth: 0,
  },
  itemTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#d1d1d6',
    padding: '0.15rem',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  itemDetail: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  itemPrice: {
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  footer: {
    padding: '1.25rem 1.5rem',
    borderTop: '1px solid var(--border-light)',
    flexShrink: 0,
  },
  subtotalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem',
  },
  subtotalLabel: {
    fontSize: '1rem',
    fontWeight: 600,
  },
  subtotalValue: {
    fontSize: '1.15rem',
    fontWeight: 700,
  },
  shippingNote: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    marginBottom: '1rem',
  },
  checkoutBtn: {
    width: '100%',
    padding: '0.8rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#fff',
    background: 'var(--gradient-btn)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-glow)',
    marginBottom: '0.5rem',
  },
  keepShoppingBtn: {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.85rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
};
