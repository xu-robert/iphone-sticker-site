const STATUS_COLORS = {
  connected: '#10b981',
  disconnected: '#f97316',
  error: '#ef4444',
};

export default function ConnectionStatus({ status, phoneConnected }) {
  return (
    <div style={styles.wrap}>
      {phoneConnected != null && (
        <span style={styles.item}>
          <span style={{ ...styles.dot, backgroundColor: phoneConnected ? '#10b981' : 'var(--border)' }} />
          {phoneConnected ? 'Phone linked' : 'Waiting for phone'}
        </span>
      )}
      <span style={styles.item}>
        <span style={{ ...styles.dot, backgroundColor: STATUS_COLORS[status] || '#f97316' }} />
        {status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Reconnecting...'}
      </span>
    </div>
  );
}

const styles = {
  wrap: { display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' },
  item: { display: 'flex', alignItems: 'center', gap: '0.35rem' },
  dot: { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
};
