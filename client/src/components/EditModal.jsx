import { useState, useEffect, useCallback, useRef } from 'react';
import { traceContour } from '../helpers/contourTracing.js';

const CUT_TYPES = [
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

function useContourTracing(imageUrl, outlineEnabled, outlineThickness) {
  const [traceResult, setTraceResult] = useState(null);
  const [tracing, setTracing] = useState(false);

  useEffect(() => {
    if (!outlineEnabled || !imageUrl) {
      setTraceResult(null);
      return;
    }

    let cancelled = false;
    setTracing(true);

    traceContour(imageUrl, outlineThickness).then((result) => {
      if (!cancelled) {
        setTraceResult(result);
        setTracing(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setTraceResult(null);
        setTracing(false);
      }
    });

    return () => { cancelled = true; };
  }, [imageUrl, outlineEnabled, outlineThickness]);

  return { traceResult, tracing };
}

function drawBezierPath(ctx, segments) {
  if (segments.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(segments[0].p0.x, segments[0].p0.y);
  for (const s of segments) {
    const isLine = s.cp1.x === s.p0.x && s.cp1.y === s.p0.y && s.cp2.x === s.p1.x && s.cp2.y === s.p1.y;
    if (isLine) {
      ctx.lineTo(s.p1.x, s.p1.y);
    } else {
      ctx.bezierCurveTo(s.cp1.x, s.cp1.y, s.cp2.x, s.cp2.y, s.p1.x, s.p1.y);
    }
  }
  ctx.closePath();
}

function StickerCanvas({ imageUrl, outlineEnabled, outlineColor, outlineThickness, traceResult }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (imgRef.current) draw();
  }, [outlineEnabled, outlineColor, outlineThickness, traceResult]);

  function draw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const padding = outlineEnabled && traceResult ? outlineThickness + 2 : 0;
    canvas.width = img.width + padding * 2;
    canvas.height = img.height + padding * 2;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (outlineEnabled && traceResult && traceResult.segments.length > 0) {
      ctx.save();
      ctx.translate(padding, padding);
      drawBezierPath(ctx, traceResult.segments);
      ctx.fillStyle = outlineColor;
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(img, padding, padding);
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
    />
  );
}

export default function EditModal({ sticker, onSave, onCancel }) {
  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [outlineColor, setOutlineColor] = useState('#ffffff');
  const [outlineThickness, setOutlineThickness] = useState(3);
  const [bgRemovalEnabled, setBgRemovalEnabled] = useState(false);
  const [cutType, setCutType] = useState('circle');

  const { traceResult, tracing } = useContourTracing(
    sticker.imageUrl, outlineEnabled, outlineThickness
  );

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
    if (!outlineEnabled || !traceResult || traceResult.segments.length === 0) {
      onSave(sticker, { outlineEnabled, outlineColor, outlineThickness, bgRemovalEnabled, cutType });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const padding = outlineThickness + 2;
      const canvas = document.createElement('canvas');
      canvas.width = img.width + padding * 2;
      canvas.height = img.height + padding * 2;
      const ctx = canvas.getContext('2d');

      ctx.save();
      ctx.translate(padding, padding);
      drawBezierPath(ctx, traceResult.segments);
      ctx.fillStyle = outlineColor;
      ctx.fill();
      ctx.restore();

      ctx.drawImage(img, padding, padding);

      const processedUrl = canvas.toDataURL('image/png');
      onSave(sticker, {
        outlineEnabled, outlineColor, outlineThickness, bgRemovalEnabled, cutType,
        processedImageUrl: processedUrl,
      });
    };
    img.src = sticker.imageUrl;
  }, [sticker, onSave, outlineEnabled, outlineColor, outlineThickness, bgRemovalEnabled, cutType, traceResult]);

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
              <StickerCanvas
                imageUrl={sticker.imageUrl}
                outlineEnabled={outlineEnabled}
                outlineColor={outlineColor}
                outlineThickness={outlineThickness}
                traceResult={traceResult}
              />
              {tracing && <div style={styles.tracingOverlay}>Tracing...</div>}
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
    maxWidth: 1200, width: '92vw', height: '90vh',
    overflow: 'hidden', display: 'flex', flexDirection: 'column',
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
    padding: '1.5rem', display: 'flex', gap: '1.5rem',
    flex: 1, overflow: 'hidden', minHeight: 0,
  },
  previewSection: {
    flex: 3, display: 'flex', justifyContent: 'center', alignItems: 'center',
    minWidth: 0, minHeight: 0,
  },
  previewWrap: {
    width: '100%', height: '100%', position: 'relative',
    background: 'repeating-conic-gradient(#e8e8e8 0% 25%, #fff 0% 50%) 0 0 / 20px 20px',
    borderRadius: 12, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '1.5rem',
  },
  tracingOverlay: {
    position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.8rem',
    padding: '0.3rem 0.8rem', borderRadius: 6,
  },
  controlsSection: {
    flex: 1, minWidth: 220, maxWidth: 280, overflowY: 'auto',
  },
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
