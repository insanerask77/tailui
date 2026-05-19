import type { ServerResponse } from 'http';
import * as headscale from '../headscale/client';

interface NodeStatus {
  id: string;
  online: boolean;
  lastSeen: string;
}

const clients = new Map<string, ServerResponse>();
let lastState = new Map<string, boolean>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function sse(client: ServerResponse, event: string, data: unknown) {
  try {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // client disconnected
  }
}

function broadcast(event: string, data: unknown) {
  clients.forEach((c) => sse(c, event, data));
}

async function poll() {
  try {
    const nodes = await headscale.nodes.list();
    const newState = new Map<string, boolean>(nodes.map((n) => [n.id, headscale.isOnline(n)]));

    const changes: NodeStatus[] = [];
    for (const [id, online] of newState) {
      if (lastState.get(id) !== online) {
        const node = nodes.find((n) => n.id === id)!;
        changes.push({ id, online, lastSeen: node.lastSeen });
      }
    }
    // Also handle removed nodes
    for (const id of lastState.keys()) {
      if (!newState.has(id)) changes.push({ id, online: false, lastSeen: '' });
    }

    if (changes.length > 0) broadcast('node_status', changes);
    lastState = newState;
  } catch {
    // Headscale unavailable — silently skip
  }
}

export function start() {
  if (pollTimer) return;
  poll();
  pollTimer = setInterval(poll, 15_000);
}

export function addClient(id: string, res: ServerResponse) {
  clients.set(id, res);
  // Send current known state immediately
  const initial: NodeStatus[] = [...lastState.entries()].map(([nodeId, online]) => ({
    id: nodeId,
    online,
    lastSeen: '',
  }));
  sse(res, 'initial', initial);
}

export function removeClient(id: string) {
  clients.delete(id);
}

export function clientCount(): number {
  return clients.size;
}
