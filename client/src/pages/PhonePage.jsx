import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket.js';

export default function PhonePage() {
  const { sessionId } = useParams();
  const [valid, setValid] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch(`/api/session/${sessionId}`)
      .then((r) => setValid(r.ok))
      .catch(() => setValid(false));
  }, [sessionId]);

  const { status } = useWebSocket(valid ? sessionId : null, 'phone');

  const extractAndUpload = useCallback(async () => {
    const el = inputRef.current;
    if (!el) return;

    const images = el.querySelectorAll('img');
    if (images.length === 0) return;

    setSending(true);
    for (const img of images) {
      try {
        const blob = await imageElementToBlob(img);
        if (!blob) continue;

        const form = new FormData();
        form.append('sticker', blob, 'sticker.png');
        const res = await fetch(`/api/session/${sessionId}/upload`, { method: 'POST', body: form });
        if (res.ok) {
          const data = await res.json();
          setUploads((prev) => [data, ...prev]);
        }
      } catch (e) {
        console.error('Upload failed:', e);
      }
    }
    el.innerHTML = '';
    setSending(false);
  }, [sessionId]);

  const handleInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const hasImages = el.querySelector('img');
    if (hasImages) {
      setTimeout(extractAndUpload, 100);
    }
  }, [extractAndUpload]);

  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        setSending(true);
        const form = new FormData();
        form.append('sticker', blob, 'sticker.png');
        try {
          const res = await fetch(`/api/session/${sessionId}/upload`, { method: 'POST', body: form });
          if (res.ok) {
            const data = await res.json();
            setUploads((prev) => [data, ...prev]);
          }
        } catch (err) {
          console.error('Upload failed:', err);
        }
        setSending(false);
        return;
      }
    }
  }, [sessionId]);

  if (valid === null) return <div style={styles.center}>Loading...</div>;
  if (valid === false) {
    return (
      <div style={styles.center}>
        <p style={styles.errorText}>Session expired or invalid.</p>
        <p style={styles.subText}>Scan the QR code again from your computer.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.statusBar}>
        <span style={{ ...styles.dot, backgroundColor: status === 'connected' ? '#34c759' : '#ff9500' }} />
        <span style={styles.statusText}>
          {status === 'connected' ? 'Connected to browser' : 'Connecting...'}
        </span>
      </div>

      <h1 style={styles.heading}>Paste Stickers</h1>
      <p style={styles.instructions}>
        Tap below, then open your sticker keyboard and tap a sticker. It will be sent to your computer.
      </p>

      <div
        ref={inputRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        style={styles.inputArea}
        data-placeholder="Tap here and paste a sticker..."
      />

      {sending && <p style={styles.sendingText}>Sending...</p>}

      {uploads.length > 0 && (
        <div style={styles.history}>
          <p style={styles.historyLabel}>Sent ({uploads.length})</p>
          <div style={styles.thumbRow}>
            {uploads.map((s) => (
              <img key={s.filename} src={s.imageUrl} alt="" style={styles.thumb} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

async function imageElementToBlob(img) {
  if (img.src.startsWith('data:')) {
    const res = await fetch(img.src);
    return res.blob();
  }
  if (img.src.startsWith('blob:')) {
    const res = await fetch(img.src);
    return res.blob();
  }
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width || 300;
  canvas.height = img.naturalHeight || img.height || 300;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

const styles = {
  page: { padding: '1.5rem', maxWidth: 480, margin: '0 auto' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' },
  errorText: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' },
  subText: { color: '#86868b' },
  statusBar: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' },
  dot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  statusText: { fontSize: '0.85rem', color: '#86868b' },
  heading: { fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' },
  instructions: { color: '#6e6e73', lineHeight: 1.5, marginBottom: '1.5rem' },
  inputArea: {
    minHeight: 160, padding: '1rem', borderRadius: 12,
    border: '2px dashed #d1d1d6', background: '#fff',
    fontSize: '1rem', outline: 'none', lineHeight: 1.6,
    WebkitUserSelect: 'text', position: 'relative',
  },
  sendingText: { color: '#007aff', fontSize: '0.9rem', marginTop: '0.75rem', fontWeight: 500 },
  history: { marginTop: '2rem' },
  historyLabel: { fontSize: '0.85rem', color: '#86868b', marginBottom: '0.5rem', fontWeight: 500 },
  thumbRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  thumb: { width: 56, height: 56, objectFit: 'contain', borderRadius: 8, background: '#f5f5f7', padding: 4 },
};
