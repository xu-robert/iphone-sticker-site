export default function StickerGrid({ stickers, onDelete, onEdit }) {
  if (stickers.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>No stickers yet — scan the QR code with your phone to get started!</p>
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {stickers.map((sticker) => (
        <div key={sticker.filename} style={styles.card}>
          <div style={styles.imageWrap}>
            <img src={sticker.imageUrl} alt="Sticker" style={styles.image} />
          </div>
          <div style={styles.footer}>
            <span style={styles.time}>{new Date(sticker.timestamp).toLocaleTimeString()}</span>
            <div style={styles.actions}>
              <button onClick={() => onEdit(sticker)} style={styles.editBtn}>Edit</button>
              <button onClick={() => onDelete(sticker.filename)} style={styles.deleteBtn}>Delete</button>
            </div>
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
    background: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  imageWrap: {
    aspectRatio: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background:
      'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 20px 20px',
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
    padding: '0.5rem 0.75rem',
    borderTop: '1px solid #f0f0f0',
  },
  time: {
    fontSize: '0.75rem',
    color: '#86868b',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
  },
  editBtn: {
    fontSize: '0.75rem',
    color: '#007aff',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
  },
  deleteBtn: {
    fontSize: '0.75rem',
    color: '#ff3b30',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 500,
  },
  empty: {
    textAlign: 'center',
    padding: '4rem 2rem',
  },
  emptyText: {
    color: '#86868b',
    fontSize: '1.05rem',
  },
};
