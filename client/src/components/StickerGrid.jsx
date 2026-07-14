export default function StickerGrid({ stickers, onDelete, onEdit, onOrder }) {
  if (stickers.length === 0) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>✦</div>
        <p style={styles.emptyTitle}>No stickers yet</p>
        <p style={styles.emptyText}>Scan the QR code with your phone or upload images to get started.</p>
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {stickers.map((sticker) => (
        <div key={sticker.filename} style={styles.card}>
          <div style={styles.imageWrap}>
            <img src={sticker.displayUrl || sticker.imageUrl} alt="Sticker" style={styles.image} />
          </div>
          <div style={styles.footer}>
            <div style={styles.actions}>
              <button onClick={() => onEdit(sticker)} style={styles.editBtn}>Edit</button>
              <button onClick={() => onOrder(sticker)} style={styles.orderBtn}>Order</button>
            </div>
            <button onClick={() => onDelete(sticker.filename)} style={styles.deleteBtn} title="Delete">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '1rem',
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    transition: 'box-shadow 0.15s, transform 0.15s',
  },
  imageWrap: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background:
      'repeating-conic-gradient(#f0f0f0 0% 25%, #fff 0% 50%) 0 0 / 16px 16px',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 0.75rem',
    borderTop: '1px solid var(--border-light)',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
  },
  editBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--brand-purple)',
    background: 'rgba(124,58,237,0.08)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.3rem 0.65rem',
    cursor: 'pointer',
  },
  orderBtn: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--brand-green)',
    background: 'rgba(16,185,129,0.08)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '0.3rem 0.65rem',
    cursor: 'pointer',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#d1d1d6',
    padding: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    transition: 'color 0.15s',
  },
  empty: {
    textAlign: 'center',
    padding: '4rem 2rem',
  },
  emptyIcon: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
    background: 'var(--gradient-hero)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  emptyTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '0.4rem',
  },
  emptyText: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    maxWidth: 320,
    margin: '0 auto',
    lineHeight: 1.5,
  },
};
