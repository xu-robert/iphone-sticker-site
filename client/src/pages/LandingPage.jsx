import { Link } from 'react-router-dom';
import { useIsMobile } from '../hooks/useIsMobile.js';

const STEPS = [
  { emoji: '📱', title: 'Upload', desc: 'Send stickers from your phone or drag files from your computer.' },
  { emoji: '✂️', title: 'Edit', desc: 'Remove backgrounds, add outlines, pick a shape — make it yours.' },
  { emoji: '🛒', title: 'Order', desc: 'Choose sizes and quantities, then check out in seconds.' },
  { emoji: '📬', title: 'Receive', desc: 'Custom die-cut stickers printed and shipped to your door.' },
];

const SIZES = [
  { label: '2"', price: '$3' },
  { label: '3"', price: '$4.50' },
  { label: '4"', price: '$6' },
  { label: '5"', price: '$8' },
];

export default function LandingPage() {
  const isMobile = useIsMobile();

  return (
    <div>
      <section style={styles.hero}>
        <div style={styles.heroInner}>
          <div style={styles.heroBadge}>Now in beta</div>
          <h1 style={styles.heroTitle}>
            Turn anything into a<br />
            <span style={styles.heroGradient}>sticker</span>
          </h1>
          <p style={styles.heroSub}>
            Upload from your phone, edit with magic background removal,
            and order custom die-cut stickers — all in one place.
          </p>
          <div style={styles.heroCta}>
            <Link to="/workspace" style={styles.ctaBtn}>
              Start Creating
              <span style={styles.ctaArrow}>→</span>
            </Link>
          </div>
          <p style={styles.heroNote}>No account needed. Free to try.</p>
        </div>
        <div style={styles.heroDeco} aria-hidden="true">
          <div style={styles.decoBlob1} />
          <div style={styles.decoBlob2} />
          <div style={styles.decoBlob3} />
        </div>
      </section>

      <section style={styles.stepsSection}>
        <h2 style={styles.sectionTitle}>How it works</h2>
        <div style={{ ...styles.stepsGrid, ...(isMobile ? styles.stepsGridMobile : {}) }}>
          {STEPS.map((step, i) => (
            <div key={i} style={styles.stepCard}>
              <div style={styles.stepNum}>{i + 1}</div>
              <div style={styles.stepEmoji}>{step.emoji}</div>
              <h3 style={styles.stepTitle}>{step.title}</h3>
              <p style={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.pricingSection}>
        <h2 style={styles.sectionTitle}>Simple pricing</h2>
        <p style={styles.sectionSub}>High-quality vinyl, weatherproof and dishwasher-safe.</p>
        <div style={{ ...styles.pricingGrid, ...(isMobile ? styles.pricingGridMobile : {}) }}>
          {SIZES.map((s, i) => (
            <div key={i} style={styles.priceCard}>
              <div style={styles.priceSize}>{s.label}</div>
              <div style={styles.priceAmt}>{s.price}</div>
              <div style={styles.priceUnit}>each</div>
            </div>
          ))}
        </div>
        <p style={styles.shippingNote}>+ $3.99 flat-rate shipping</p>
      </section>

      <section style={styles.ctaSection}>
        <div style={styles.ctaCard}>
          <h2 style={styles.ctaTitle}>Ready to make some stickers?</h2>
          <p style={styles.ctaSub}>It only takes a minute. No sign-up required.</p>
          <Link to="/workspace" style={styles.ctaBtnLg}>
            Get Started
            <span style={styles.ctaArrow}>→</span>
          </Link>
        </div>
      </section>

      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <span style={styles.footerLogo}>✦ Print Me to Life</span>
          <div style={styles.footerLinks}>
            <Link to="/order-lookup" style={styles.footerLink}>Track Order</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const styles = {
  hero: {
    position: 'relative',
    overflow: 'hidden',
    padding: 'clamp(2.5rem, 8vw, 5rem) 1.25rem clamp(2rem, 6vw, 4rem)',
    textAlign: 'center',
  },
  heroInner: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 640,
    margin: '0 auto',
  },
  heroBadge: {
    display: 'inline-block',
    padding: '0.3rem 0.9rem',
    borderRadius: 100,
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#7c3aed',
    background: 'rgba(124,58,237,0.08)',
    border: '1px solid rgba(124,58,237,0.15)',
    marginBottom: '1.5rem',
  },
  heroTitle: {
    fontSize: 'clamp(2.25rem, 5vw, 3.5rem)',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.03em',
    marginBottom: '1.25rem',
  },
  heroGradient: {
    background: 'var(--gradient-hero)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSub: {
    fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
    color: 'var(--text-muted)',
    lineHeight: 1.6,
    maxWidth: 480,
    margin: '0 auto 2rem',
  },
  heroCta: {
    marginBottom: '0.75rem',
  },
  ctaBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.85rem 2rem',
    fontSize: '1.05rem',
    fontWeight: 600,
    color: '#fff',
    background: 'var(--gradient-btn)',
    borderRadius: 14,
    textDecoration: 'none',
    boxShadow: 'var(--shadow-glow)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  ctaArrow: {
    fontSize: '1.15rem',
    transition: 'transform 0.15s',
  },
  heroNote: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  heroDeco: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
  },
  decoBlob1: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
    top: '-10%',
    right: '-5%',
  },
  decoBlob2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(236,72,153,0.06) 0%, transparent 70%)',
    bottom: '-5%',
    left: '-3%',
  },
  decoBlob3: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)',
    top: '20%',
    left: '10%',
  },

  stepsSection: {
    maxWidth: 900,
    margin: '0 auto',
    padding: 'clamp(1.5rem, 4vw, 3rem) 1rem clamp(2rem, 5vw, 4rem)',
    boxSizing: 'border-box',
    width: '100%',
  },
  sectionTitle: {
    fontSize: '1.75rem',
    fontWeight: 700,
    textAlign: 'center',
    letterSpacing: '-0.02em',
    marginBottom: '0.5rem',
  },
  sectionSub: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginBottom: '2rem',
  },
  stepsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '1.25rem',
    marginTop: '2rem',
  },
  stepsGridMobile: {
    gridTemplateColumns: '1fr 1fr',
    gap: '0.6rem',
    margin: '1.5rem 0 0',
  },
  stepCard: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    padding: '1.5rem 0.75rem',
    textAlign: 'center',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    position: 'relative',
    overflow: 'hidden',
    minWidth: 0,
  },
  stepNum: {
    position: 'absolute',
    top: 12,
    left: 14,
    fontSize: '0.7rem',
    fontWeight: 700,
    color: 'var(--brand-purple)',
    background: 'rgba(124,58,237,0.08)',
    width: 22,
    height: 22,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepEmoji: {
    fontSize: '2rem',
    marginBottom: '0.75rem',
  },
  stepTitle: {
    fontSize: '1.05rem',
    fontWeight: 600,
    marginBottom: '0.4rem',
  },
  stepDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },

  pricingSection: {
    maxWidth: 600,
    margin: '0 auto',
    padding: '2rem 1rem 3rem',
    textAlign: 'center',
    boxSizing: 'border-box',
    width: '100%',
  },
  pricingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.75rem',
    marginTop: '1.5rem',
  },
  pricingGridMobile: {
    gridTemplateColumns: 'repeat(2, 1fr)',
  },
  priceCard: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-md)',
    padding: '1.25rem 0.5rem',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    minWidth: 0,
  },
  priceSize: {
    fontSize: '1.4rem',
    fontWeight: 700,
    marginBottom: '0.25rem',
  },
  priceAmt: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: 'var(--brand-purple)',
  },
  priceUnit: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    marginTop: '0.15rem',
  },
  shippingNote: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginTop: '1rem',
  },

  ctaSection: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '1rem 1rem clamp(2rem, 5vw, 4rem)',
    boxSizing: 'border-box',
    width: '100%',
  },
  ctaCard: {
    background: 'var(--gradient-hero)',
    borderRadius: 'var(--radius-xl)',
    padding: 'clamp(2rem, 5vw, 3rem) clamp(1.25rem, 4vw, 2rem)',
    textAlign: 'center',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  ctaTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '0.5rem',
  },
  ctaSub: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '1.5rem',
  },
  ctaBtnLg: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.85rem 2.25rem',
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'var(--text)',
    background: '#fff',
    borderRadius: 14,
    textDecoration: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },

  footer: {
    borderTop: '1px solid var(--border-light)',
    padding: '1.5rem',
  },
  footerInner: {
    maxWidth: 900,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLogo: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  footerLinks: {
    display: 'flex',
    gap: '1.25rem',
  },
  footerLink: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    textDecoration: 'none',
  },
};
