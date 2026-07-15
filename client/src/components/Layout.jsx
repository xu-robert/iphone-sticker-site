import { Link, useLocation } from 'react-router-dom';
import CartBadge from './CartBadge.jsx';
import { useIsMobile } from '../hooks/useIsMobile.js';

export default function Layout({ children, hideNav }) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isWorkspace = location.pathname === '/workspace';
  const isMobile = useIsMobile();

  return (
    <div style={styles.wrapper}>
      {!hideNav && (
        <nav style={styles.nav}>
          <div style={styles.navInner}>
            <Link to="/" style={styles.logo}>
              <span style={styles.logoIcon}>✦</span>
              {!isMobile && <span style={styles.logoText}>Print Me to Life</span>}
            </Link>
            <div style={styles.navRight}>
              {!isHome && !isWorkspace && (
                <Link to="/workspace" style={styles.navLink}>Create</Link>
              )}
              {!isMobile && (
                <Link to="/order-lookup" style={styles.navLink}>Track Order</Link>
              )}
              <CartBadge />
            </div>
          </div>
        </nav>
      )}
      <main>{children}</main>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
  },
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(250,249,247,0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--border-light)',
  },
  navInner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '0.75rem 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    color: 'var(--text)',
  },
  logoIcon: {
    fontSize: '1.5rem',
    background: 'var(--gradient-hero)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  logoText: {
    fontSize: '1.15rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  navLink: {
    fontSize: '0.9rem',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    transition: 'color 0.15s',
  },
};
