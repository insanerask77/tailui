import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NodeRow } from '../api/nodes';

interface NodeStatus {
  id: string;
  online: boolean;
  lastSeen: string;
}

export function useNodeSSE() {
  const qc = useQueryClient();

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      es = new EventSource('/api/events');

      es.addEventListener('node_status', (e: MessageEvent<string>) => {
        const changes = JSON.parse(e.data) as NodeStatus[];
        qc.setQueryData<NodeRow[]>(['nodes'], (prev) => {
          if (!prev) return prev;
          return prev.map((node) => {
            const change = changes.find((c) => c.id === node.id);
            if (!change) return node;
            return {
              ...node,
              online: change.online,
              ...(change.lastSeen ? { lastSeen: change.lastSeen } : {}),
            };
          });
        });
      });

      es.addEventListener('initial', (e: MessageEvent<string>) => {
        const states = JSON.parse(e.data) as NodeStatus[];
        if (states.length === 0) return;
        qc.setQueryData<NodeRow[]>(['nodes'], (prev) => {
          if (!prev) return prev;
          return prev.map((node) => {
            const s = states.find((x) => x.id === node.id);
            return s ? { ...node, online: s.online } : node;
          });
        });
      });

      es.onerror = () => {
        es?.close();
        if (!closed) {
          reconnectTimer = setTimeout(connect, 5_000);
        }
      };
    }

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [qc]);
}
