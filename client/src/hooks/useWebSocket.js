import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebSocket(sessionId, role = 'desktop') {
  const [status, setStatus] = useState('disconnected');
  const listenersRef = useRef(new Set());
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const addListener = useCallback((fn) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const connect = useCallback(() => {
    if (!sessionId) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}://${host}/ws?session=${sessionId}&role=${role}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      for (const fn of listenersRef.current) fn(data);
    };
    ws.onclose = () => {
      setStatus('disconnected');
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      setStatus('error');
      ws.close();
    };
  }, [sessionId, role]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, addListener };
}
