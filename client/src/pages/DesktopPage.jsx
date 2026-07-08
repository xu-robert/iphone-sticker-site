import { useEffect, useState, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import StickerGrid from '../components/StickerGrid.jsx';
import EditModal from '../components/EditModal.jsx';
import ConnectionStatus from '../components/ConnectionStatus.jsx';
import { useWebSocket } from '../hooks/useWebSocket.js';

export default function DesktopPage() {
  const [sessionId, setSessionId] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [lanHost, setLanHost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingSticker, setEditingSticker] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch('/api/host').then((r) => r.json()).then((d) => setLanHost(d));
    const stored = sessionStorage.getItem('sticker_session');
    if (stored) {
      restoreSession(stored);
    } else {
      createSession();
    }
  }, []);

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

  const handleFileUpload = useCallback(async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of files) {
      const form = new FormData();
      form.append('sticker', file, file.name);
      try {
        const res = await fetch(`/api/session/${sessionId}/upload`, { method: 'POST', body: form });
        if (!res.ok) console.error('Upload rejected:', await res.text());
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    e.target.value = '';
  }, [sessionId]);

  const handleEdit = useCallback((sticker) => {
    setEditingSticker(sticker);
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

  return (
    <>
      <header style={styles.header}>
        <h1 style={styles.title}>Sticker Grab</h1>
        <ConnectionStatus status={status} phoneConnected={phoneConnected} />
      </header>

      <div style={styles.qrCard}>
        <div style={styles.qrLeft}>
          <QRCodeSVG value={phoneUrl} size={180} level="M" />
        </div>
        <div style={styles.qrRight}>
          <h2 style={styles.qrHeading}>Scan with your iPhone</h2>
          <p style={styles.qrInstructions}>
            Open the camera app on your phone and scan this QR code.
            Then paste stickers into the input field — they'll appear here instantly.
          </p>
          <div style={styles.urlRow}>
            <code style={styles.urlCode}>{phoneUrl}</code>
          </div>
          <button onClick={handleNewSession} style={styles.newSessionBtn}>New Session</button>
        </div>
      </div>

      <div style={styles.uploadRow}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <button onClick={() => fileRef.current?.click()} style={styles.uploadBtn}>
          Upload from Computer
        </button>
        <span style={styles.uploadHint}>Max 20 MB per file</span>
      </div>

      <StickerGrid stickers={stickers} onDelete={handleDelete} onEdit={handleEdit} />

      {editingSticker && (
        <EditModal
          sticker={editingSticker}
          onSave={handleEditSave}
          onCancel={handleEditCancel}
        />
      )}
    </>
  );
}

const styles = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem',
  },
  title: { fontSize: '1.5rem', fontWeight: 700 },
  qrCard: {
    display: 'flex', gap: '2rem', padding: '2rem', background: '#fff',
    borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: '2rem',
    alignItems: 'center', flexWrap: 'wrap',
  },
  qrLeft: { flexShrink: 0 },
  qrRight: { flex: 1, minWidth: 200 },
  qrHeading: { fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' },
  qrInstructions: { color: '#6e6e73', lineHeight: 1.5, marginBottom: '1rem' },
  urlRow: { marginBottom: '0.75rem' },
  urlCode: {
    fontSize: '0.8rem', color: '#86868b', background: '#f5f5f7',
    padding: '0.35rem 0.6rem', borderRadius: 6, wordBreak: 'break-all',
  },
  newSessionBtn: {
    fontSize: '0.8rem', color: '#007aff', background: 'none',
    border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500,
  },
  uploadRow: { marginBottom: '1.5rem' },
  uploadBtn: {
    padding: '0.6rem 1.25rem', fontSize: '0.9rem', fontWeight: 500,
    background: '#007aff', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  uploadHint: { fontSize: '0.8rem', color: '#86868b', marginLeft: '0.75rem' },
};
