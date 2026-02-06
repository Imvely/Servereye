import { useEffect, useRef, useCallback } from 'react';
import type { WSMessage } from '../types';

const WS_RECONNECT_DELAY = 3000;

export function useWebSocket(
  path: string,
  onMessage: (data: WSMessage) => void,
  enabled: boolean = true
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (!enabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${path}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`WebSocket connected: ${path}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (e) {
          console.error('WebSocket parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log(`WebSocket closed: ${path}`);
        wsRef.current = null;
        if (enabled) {
          reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY);
        }
      };

      ws.onerror = (error) => {
        console.error(`WebSocket error: ${path}`, error);
        ws.close();
      };
    } catch (e) {
      console.error('WebSocket connection error:', e);
      reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY);
    }
  }, [path, onMessage, enabled]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return wsRef;
}
