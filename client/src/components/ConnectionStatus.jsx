const STATUS_COLORS = {
  connected: '#34c759',
  disconnected: '#ff9500',
  error: '#ff3b30',
};

export default function ConnectionStatus({ status, phoneConnected }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: '#86868b' }}>
      {phoneConnected != null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ ...dot, backgroundColor: phoneConnected ? '#34c759' : '#d1d1d6' }} />
          {phoneConnected ? 'Phone linked' : 'Waiting for phone'}
        </span>
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ ...dot, backgroundColor: STATUS_COLORS[status] || '#ff9500' }} />
        {status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Reconnecting...'}
      </span>
    </div>
  );
}

const dot = { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' };
