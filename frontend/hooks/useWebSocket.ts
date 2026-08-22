import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_BASE_URL, INITIAL_RECONNECT_DELAY, MAX_RECONNECT_DELAY } from '../constants';
import { ConnectionStatus, WSMessage } from '../types';

interface UseWebSocketReturn {
  status: ConnectionStatus;
  connectGlobal: () => void;
  subscribeMatch: (matchId: string | number) => void;
  unsubscribeMatch: (matchId: string | number) => void;
  disconnect: () => void;
}

export const useWebSocket = (
  onMessage: (msg: WSMessage) => void
): UseWebSocketReturn => {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const isIntentionalClose = useRef(false);
  const subscribedMatchIdsRef = useRef(new Set<string>());
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const normalizeId = (matchId: string | number) => String(matchId);

  const sendMessage = useCallback((message: WSMessage | Record<string, unknown>) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  // Core connect function
  const initConnection = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    if (ws.current) {
      if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
        return;
      }
      ws.current = null;
    }

    setStatus((prev) => (prev === 'connected' ? 'connected' : reconnectAttempts.current > 0 ? 'reconnecting' : 'connecting'));
    isIntentionalClose.current = false;

    // Construct URL
    const socketUrl = `${WS_BASE_URL}?all=1`;
    
    try {
      const socket = new WebSocket(socketUrl);
      ws.current = socket;

      socket.onopen = () => {
        if (ws.current !== socket) return;
        setStatus('connected');
        reconnectAttempts.current = 0;
        if (subscribedMatchIdsRef.current.size > 0) {
          socket.send(JSON.stringify({
            type: 'setSubscriptions',
            matchIds: Array.from(subscribedMatchIdsRef.current),
          }));
        }
        console.log('[WebSocket] Connected successfully');
      };

      socket.onmessage = (event) => {
        if (ws.current !== socket) return;
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch (e) {
          console.error('[WebSocket] Failed to parse message:', e);
        }
      };

      socket.onerror = () => {
        if (ws.current !== socket) return;
        console.warn('[WebSocket] Connection error occurred');
        if (socket.readyState === WebSocket.OPEN) {
          setStatus('error');
        }
      };

      socket.onclose = (event) => {
        if (ws.current !== socket) return;
        ws.current = null;

        if (!isIntentionalClose.current) {
          setStatus('disconnected');
          
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * (2 ** reconnectAttempts.current),
            MAX_RECONNECT_DELAY
          );
          
          console.log(`[WebSocket] Disconnected (Code: ${event.code}). Reconnecting in ${delay}ms...`);
          
          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current += 1;
            initConnection();
          }, delay);
        } else {
          setStatus('disconnected');
        }
      };

    } catch (e) {
      console.error('[WebSocket] Connection creation failed:', e);
      setStatus('error');
    }
  }, []);

  // Public connect method
  const connectGlobal = useCallback(() => {
    if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    reconnectAttempts.current = 0;
    initConnection();
  }, [initConnection]);

  const subscribeMatch = useCallback((matchId: string | number) => {
    const normalized = normalizeId(matchId);
    subscribedMatchIdsRef.current.add(normalized);
    sendMessage({ type: 'subscribe', matchId });
  }, [sendMessage]);

  const unsubscribeMatch = useCallback((matchId: string | number) => {
    const normalized = normalizeId(matchId);
    subscribedMatchIdsRef.current.delete(normalized);
    sendMessage({ type: 'unsubscribe', matchId });
  }, [sendMessage]);

  // Public disconnect method
  const disconnect = useCallback(() => {
    isIntentionalClose.current = true;
    
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    setStatus('disconnected');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    connectGlobal();
    return () => {
      isIntentionalClose.current = true;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [connectGlobal]);

  return { status, connectGlobal, subscribeMatch, unsubscribeMatch, disconnect };
};
