import { useState, useEffect, useCallback } from 'react';

const CUT_TYPES = [
  { value: 'die-cut-tight', label: 'Die-Cut Tight' },
  { value: 'die-cut-loose', label: 'Die-Cut Loose' },
  { value: 'kiss-cut', label: 'Kiss-Cut' },
  { value: 'circle', label: 'Circle' },
];

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : () => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12,
        backgroundColor: checked ? '#34c759' : '#d1d1d6',
        padding: 2, cursor: disabled ? 'default' : 'pointer',
        transition: 'background-color 0.2s',
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'transform 0.2s',
        transform: checked ? 'translateX(20px)' : 'translateX(0)',
      }} />
    </div>
  );
}

export default function EditModal({ sticker, onSave, onCancel }) {
  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [outlineColor, setOutlineColor] = useState('#ffffff');
  const [outlineThickness, setOutlineThickness] = useState(3);
  const [bgRemovalEnabled, setBgRemovalEnabled] = useState(false);
  const [cutType, setCutType] = useState('die-cut-tight');
  const [padding, setPadding] = useState(10);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onCancel]);

  const handleSave = useCallback(() => {
    onSave(sticker, { outlineEnabled, outlineColor, outlineThickness, bgRemovalEnabled, cutType, padding });
  }, [sticker, onSave, outlineEnabled, outlineColor, outlineThickness, bgRemovalEnabled, cutType, padding]);

  return (
    <div style={styles.backdrop} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Edit Sticker</h2>
          <button onClick={onCancel} style={styles.closeBtn}>&times;</button>
        </div>

        <div style={styles.body}>
          <div style={styles.previewSection}>
            <div style={styles.previewWrap}>
              <img src={sticker.imageUrl} alt="Sticker preview" style={styles.previewImg} />
            </div>
          </div>

          <div style={styles.controlsSection}>
            <div style={styles.controlGroup}>
              <h3 style={styles.groupTitle}>Outline / Border</h3>
              <div style={styles.controlRow}>
                <span style={styles.label}>Enable outline</span>
                <ToggleSwitch checked={outlineEnabled} onChange={setOutlineEnabled} />
              </div>
              <div style={{ ...styles.controlRow, opacity: outlineEnabled ? 1 : 0.4 }}>
                <span style={styles.label}>Color</span>
                <input
                  type="color"
                  value={outlineColor}
                  onChange={(e) => setOutlineColor(e.target.value)}
                  disabled={!outlineEnabled}
                  style={styles.colorInput}
                />
              </div>
              <div style={{ ...styles.controlRow, opacity: outlineEnabled ? 1 : 0.4 }}>
                <span style={styles.label}>Thickness</span>
                <input
                  type="range" min={1} max={20}
                  value={outlineThickness}
                  onChange={(e) => setOutlineThickness(Number(e.target.value))}
                  disabled={!outlineEnabled}
                  style={styles.slider}
                />
                <span style={styles.valueLabel}>{outlineThickness}px</span>
              </div>
            </div>

            <div style={styles.controlGroup}>
              <h3 style={styles.groupTitle}>Background</h3>
              <div style={styles.controlRow}>
                <span style={styles.label}>Remove background</span>
                <ToggleSwitch checked={bgRemovalEnabled} onChange={setBgRemovalEnabled} />
              </div>
              <p style={styles.hint}>Coming soon</p>
            </div>

            <div style={styles.controlGroup}>
              <h3 style={styles.groupTitle}>Cut Shape</h3>
              <div style={styles.chipRow}>
                {CUT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setCutType(t.value)}
                    style={cutType === t.value ? { ...styles.chip, ...styles.chipActive } : styles.chip}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.controlGroup}>
              <h3 style={styles.groupTitle}>Padding</h3>
              <div style={styles.controlRow}>
                <input
                  type="range" min={0} max={50}
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                  style={styles.slider}
                />
                <span style={styles.valueLabel}>{padding}px</span>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
          <button onClick={handleSave} style={styles.saveBtn}>Save</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
    maxWidth: 640, width: '90vw', maxHeight: '90vh',
    overflow: 'auto', display: 'flex', flexDirection: 'column',
  },
  header: {
    padding: '1.25rem 1.5rem', borderBottom: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: '1.15rem', fontWeight: 600, margin: 0 },
  closeBtn: {
    background: 'none', border: 'none', fontSize: '1.5rem',
    color: '#86868b', cursor: 'pointer', padding: '0 0.25rem', lineHeight: 1,
  },
  body: {
    padding: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap',
    flex: 1, overflow: 'auto',
  },
  previewSection: { flex: '1 1 200px', display: 'flex', justifyContent: 'center' },
  previewWrap: {
    width: '100%', maxWidth: 280, aspectRatio: '1',
    background: 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 20px 20px',
    borderRadius: 12, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '1rem',
  },
  previewImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  controlsSection: { flex: '1 1 260px' },
  controlGroup: { marginBottom: '1.25rem' },
  groupTitle: {
    fontSize: '0.8rem', fontWeight: 600, color: '#86868b',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    marginBottom: '0.6rem', margin: 0, marginBottom: '0.6rem',
  },
  controlRow: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    marginBottom: '0.5rem',
  },
  label: { fontSize: '0.9rem', color: '#1d1d1f', flex: 1 },
  colorInput: {
    width: 32, height: 32, border: 'none', borderRadius: 6,
    cursor: 'pointer', padding: 0,
  },
  slider: { flex: 1, accentColor: '#007aff' },
  valueLabel: { fontSize: '0.8rem', color: '#86868b', minWidth: 36, textAlign: 'right' },
  hint: { fontSize: '0.8rem', color: '#86868b', fontStyle: 'italic', margin: '0.25rem 0 0' },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  chip: {
    padding: '0.4rem 0.8rem', borderRadius: 8, fontSize: '0.8rem',
    fontWeight: 500, cursor: 'pointer', border: '1.5px solid #d1d1d6',
    background: '#fff', color: '#1d1d1f',
  },
  chipActive: {
    borderColor: '#007aff', background: '#eef4ff', color: '#007aff',
  },
  footer: {
    padding: '1rem 1.5rem', borderTop: '1px solid #f0f0f0',
    display: 'flex', justifyContent: 'flex-end', gap: '0.75rem',
  },
  cancelBtn: {
    padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 500,
    background: '#f5f5f7', color: '#1d1d1f', border: 'none',
    borderRadius: 8, cursor: 'pointer',
  },
  saveBtn: {
    padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 500,
    background: '#007aff', color: '#fff', border: 'none',
    borderRadius: 8, cursor: 'pointer',
  },
};
