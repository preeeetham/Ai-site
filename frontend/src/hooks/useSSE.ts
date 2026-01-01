import { useEffect, useRef, useState } from 'react';
import { SSE_BASE_URL } from '@/utils/constants';

export type SSEEventType = 'status' | 'error' | 'progress' | 'done' | 'message';

export interface SSEEvent {
  type: SSEEventType;
  data: any;
  timestamp: Date;
}

interface UseSSEOptions {
  enabled?: boolean;
  onEvent?: (event: SSEEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useSSE(sessionId: string | null, options: UseSSEOptions = {}) {
  const { enabled = true, onEvent, onError, onOpen, onClose } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<SSEEvent[]>([]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      return;
    }

    const url = `${SSE_BASE_URL}/api/v1/sessions/${sessionId}/stream`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setIsConnected(true);
      onOpen?.();
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      onError?.(error);
      // EventSource will automatically reconnect on error
    };

    eventSource.onmessage = (messageEvent) => {
      try {
        // Skip comments/heartbeats (lines starting with :)
        if (messageEvent.data.startsWith(':')) {
          return;
        }

        // Only parse if data exists and is not empty
        if (!messageEvent.data || messageEvent.data.trim() === '') {
          return;
        }

        const data = JSON.parse(messageEvent.data);
        const event: SSEEvent = {
          type: data.type || 'message',
          data: data,
          timestamp: new Date(),
        };

        setEvents((prev) => [...prev, event]);
        onEvent?.(event);
      } catch (error) {
        // Silently skip parse errors for comments/heartbeats
        if (!messageEvent.data.startsWith(':')) {
          console.error('Failed to parse SSE message:', error, messageEvent.data);
        }
      }
    };

    // Listen for specific event types if the backend sends them
    eventSource.addEventListener('status', (e: MessageEvent) => {
      const event: SSEEvent = {
        type: 'status',
        data: JSON.parse(e.data),
        timestamp: new Date(),
      };
      setEvents((prev) => [...prev, event]);
      onEvent?.(event);
    });

    eventSource.addEventListener('error', (e: MessageEvent) => {
      const event: SSEEvent = {
        type: 'error',
        data: JSON.parse(e.data),
        timestamp: new Date(),
      };
      setEvents((prev) => [...prev, event]);
      onEvent?.(event);
    });

    eventSource.addEventListener('progress', (e: MessageEvent) => {
      const event: SSEEvent = {
        type: 'progress',
        data: JSON.parse(e.data),
        timestamp: new Date(),
      };
      setEvents((prev) => [...prev, event]);
      onEvent?.(event);
    });

    eventSource.addEventListener('done', (e: MessageEvent) => {
      const event: SSEEvent = {
        type: 'done',
        data: JSON.parse(e.data),
        timestamp: new Date(),
      };
      setEvents((prev) => [...prev, event]);
      onEvent?.(event);
    });

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      setIsConnected(false);
      onClose?.();
    };
  }, [sessionId, enabled, onEvent, onError, onOpen, onClose]);

  const close = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  };

  return {
    isConnected,
    events,
    close,
  };
}

