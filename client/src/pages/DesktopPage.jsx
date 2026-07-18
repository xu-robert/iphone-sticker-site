import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import StickerGrid from '../components/StickerGrid.jsx';
import EditModal from '../components/EditModal.jsx';
import AddToCartModal from '../components/AddToCartModal.jsx';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useIsMobile } from '../hooks/useIsMobile.js';

export default function DesktopPage() {
  const { sessionId: urlSessionId } = useParams();
  const isMobile = useIsMobile();
  const [sessionId, setSessionId] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [lanHost, setLanHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingSticker, setEditingSticker] = useState(null);
  const [orderingSticker, setOrderingSticker] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);
  const pasteRef = useRef(null);

  useEffect(() => {
    fetch('/api/host').then((r) => r.json()).then((d) => setLanHost(d));
    if (urlSessionId) {
      restoreSession(urlSessionId);
    } else {
      const stored = sessionStorage.getItem('sticker_session');
      if (stored) {
        restoreSession(stored);
      } else {
        createSession();
      }
    }
  }, [urlSessionId]);

  async function createSession() {
    const res = await fetch('/api/session', { method: 'POST' });
    const { sessionId: id } = await res.json();
    sessionStorage.setItem('sticker_session', id);
    setSessionId(id);
    setLoading(false);
  }

  async function restoreSession(id) {
    const res = await fetch(`/api/session/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSessionId(data.sessionId);
      setStickers(data.stickers);
    } else {
      sessionStorage.removeItem('sticker_session');
      await createSession();
    }
    setLoading(false);
  }

  const { status, addListener } = useWebSocket(sessionId, 'desktop');

  useEffect(() => {
    return addListener((msg) => {
      if (msg.type === 'new_sticker') {
        setStickers((prev) => {
          if (prev.some((s) => s.filename === msg.filename)) return prev;
          return [...prev, { filename: msg.filename, imageUrl: msg.imageUrl, timestamp: msg.timestamp }];
        });
      } else if (msg.type === 'sticker_deleted') {
        setStickers((prev) => prev.filter((s) => s.filename !== msg.filename));
      } else if (msg.type === 'phone_connected') {
        setPhoneConnected(true);
      } else if (msg.type === 'phone_disconnected') {
        setPhoneConnected(false);
      }
    });
  }, [addListener]);

  const handleDelete = useCallback(async (filename) => {
    await fetch(`/api/session/${sessionId}/sticker/${filename}`, { method: 'DELETE' });
    setStickers((prev) => prev.filter((s) => s.filename !== filename));
  }, [sessionId]);

  const uploadFiles = useCallback(async (files) => {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const form = new FormData();
      form.append('sticker', file, file.name);
      try {
        const res = await fetch(`/api/session/${sessionId}/upload`, { method: 'POST', body: form });
        if (!res.ok) console.error('Upload rejected:', await res.text());
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
  }, [sessionId]);

  const handleFileUpload = useCallback(async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(files);
    e.target.value = '';
  }, [uploadFiles]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) await uploadFiles(files);
  }, [uploadFiles]);

  const extractAndUpload = useCallback(async () => {
    const el = pasteRef.current;
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
        await fetch(`/api/session/${sessionId}/upload`, { method: 'POST', body: form });
      } catch (e) {
        console.error('Upload failed:', e);
      }
    }
    el.innerHTML = '';
    setSending(false);
  }, [sessionId]);

  const handlePasteInput = useCallback(() => {
    const el = pasteRef.current;
    if (!el) return;
    if (el.querySelector('img')) {
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
          await fetch(`/api/session/${sessionId}/upload`, { method: 'POST', body: form });
        } catch (err) {
          console.error('Upload failed:', err);
        }
        setSending(false);
        return;
      }
    }
  }, [sessionId]);

  const handleEdit = useCallback((sticker) => {
    setEditingSticker(sticker);
  }, []);

  const handleOrder = useCallback((sticker) => {
    setOrderingSticker(sticker);
  }, []);

  const handleEditSave = useCallback((sticker, settings) => {
    setStickers((prev) => prev.map((s) => {
      if (s.filename !== sticker.filename) return s;
      return {
        ...s,
        displayUrl: settings.processedImageUrl || s.imageUrl,
        settings,
      };
    }));
    setEditingSticker(null);
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditingSticker(null);
  }, []);

  const handleNewSession = async () => {
    sessionStorage.removeItem('sticker_session');
    setStickers([]);
    setPhoneConnected(false);
    await createSession();
  };

  if (loading) return null;

  const phoneUrl = lanHost
    ? `http://${lanHost.ip}:${window.location.port || lanHost.port}/phone/${sessionId}`
    : `${window.location.origin}/phone/${sessionId}`;

  const desktopUrl = lanHost
    ? `${lanHost.ip}:${window.location.port || lanHost.port}/workspace/${sessionId}`
    : `${window.location.host}/workspace/${sessionId}`;

  return (
    <div style={styles.page}>
      {!isMobile && (
        <div style={styles.topRow}>
          <ConnectionStatus status={status} phoneConnected={phoneConnected} />
          <button onClick={handleNewSession} style={styles.newSessionBtn}>New Session</button>
        </div>
      )}

      {isMobile ? (
        <div style={styles.mobileUpload}>
          <div style={styles.desktopLink}>
            <p style={styles.desktopLinkText}>Continue editing on your computer:</p>
            <code style={styles.desktopLinkCode}>{desktopUrl}</code>
          </div>
          <div
            ref={pasteRef}
            contentEditable
            onInput={handlePasteInput}
            onPaste={handlePaste}
            style={styles.pasteArea}
            data-placeholder="Tap here and paste a sticker..."
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          <button onClick={() => fileRef.current?.click()} style={styles.mobileUploadBtn}>
            Choose from Photos
          </button>
          {sending && <p style={styles.sendingText}>Sending...</p>}
        </div>
      ) : (
        <div style={styles.twoCol}>
          <div style={styles.qrCard}>
            <QRCodeSVG value={phoneUrl} size={140} level="M"
              bgColor="transparent" fgColor="#1a1a2e" />
            <div style={styles.qrInfo}>
              <h2 style={styles.qrHeading}>Scan to send stickers</h2>
              <p style={styles.qrSub}>
                Open your phone camera and scan this code.
                Paste stickers and they appear here instantly.
              </p>
              <code style={styles.urlCode}>{phoneUrl}</code>
            </div>
          </div>

          <div
            style={{ ...styles.uploadCard, ...(dragOver ? styles.uploadCardDragOver : {}) }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <div style={styles.uploadIcon}>+</div>
            <p style={styles.uploadText}>Drop images here or click to upload</p>
            <p style={styles.uploadHint}>PNG, JPG, SVG up to 20 MB</p>
          </div>
        </div>
      )}

      <StickerGrid stickers={stickers} onDelete={handleDelete} onEdit={handleEdit} onOrder={handleOrder} />

      {editingSticker && (
        <EditModal
          sticker={editingSticker}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
        />
      )}

      {orderingSticker && (
        <AddToCartModal
          sticker={orderingSticker}
          onClose={() => setOrderingSticker(null)}
        />
      )}
    </div>
  );
}

async function imageElementToBlob(img) {
  if (img.src.startsWith('data:') || img.src.startsWith('blob:')) {
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
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '1.5rem',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  newSessionBtn: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.35rem 0.75rem',
    cursor: 'pointer',
    fontWeight: 500,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginBottom: '2rem',
  },
  qrCard: {
    display: 'flex',
    gap: '1.25rem',
    padding: '1.5rem',
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-light)',
    alignItems: 'center',
  },
  qrInfo: {
    flex: 1,
    minWidth: 0,
  },
  qrHeading: {
    fontSize: '1rem',
    fontWeight: 600,
    marginBottom: '0.4rem',
  },
  qrSub: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    marginBottom: '0.6rem',
  },
  urlCode: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    background: 'var(--bg-muted)',
    padding: '0.25rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    wordBreak: 'break-all',
    display: 'block',
  },
  uploadCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    border: '2px dashed var(--border)',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  uploadCardDragOver: {
    borderColor: 'var(--brand-purple)',
    background: 'rgba(124,58,237,0.04)',
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'var(--bg-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    color: 'var(--text-muted)',
    marginBottom: '0.75rem',
    fontWeight: 300,
  },
  uploadText: {
    fontSize: '0.9rem',
    fontWeight: 500,
    marginBottom: '0.25rem',
  },
  uploadHint: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  desktopLink: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  desktopLinkText: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginBottom: '0.4rem',
  },
  desktopLinkCode: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--brand-purple)',
    wordBreak: 'break-all',
  },
  mobileUpload: {
    marginBottom: '1.5rem',
  },
  pasteArea: {
    minHeight: 120,
    padding: '1rem',
    borderRadius: 'var(--radius-md)',
    border: '2px dashed var(--border)',
    background: 'var(--bg-card)',
    fontSize: '1rem',
    outline: 'none',
    lineHeight: 1.6,
    WebkitUserSelect: 'text',
    position: 'relative',
    marginBottom: '0.75rem',
  },
  mobileUploadBtn: {
    width: '100%',
    padding: '0.85rem',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    background: 'var(--gradient-btn)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
  },
  sendingText: {
    color: 'var(--brand-purple)',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
};
