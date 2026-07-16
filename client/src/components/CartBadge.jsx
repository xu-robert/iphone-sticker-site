import { useCart } from '../context/CartContext.jsx';

export default function CartBadge() {
  const { itemCount, openDrawer } = useCart();

  return (
    <button onClick={openDrawer} style={styles.btn}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {itemCount > 0 && <span style={styles.badge}>{itemCount}</span>}
    </button>
  );
}

const styles = {
  btn: {
    position: 'relative',
    color: 'var(--text)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '0.25rem',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    background: 'var(--brand-pink)',
    color: '#fff',
    fontSize: '0.6rem',
    fontWeight: 700,
    width: 17,
    height: 17,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
