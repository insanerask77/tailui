import { useQuery } from '@tanstack/react-query';
export { useUsers } from './users';

export interface NodeUser {
  id: string;
  name: string;
  createdAt: string;
}

export interface NodeRow {
  id: string;
  name: string;
  givenName: string;
  user: NodeUser;
  lastSeen: string;
  expiry: string;
  ipAddresses: string[];
  online: boolean;
  expired: boolean;
  validTags: string[];
  forcedTags: string[];
}

async function fetchNodes(): Promise<NodeRow[]> {
  const res = await fetch('/api/nodes');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<NodeRow[]>;
}

export function useNodes() {
  return useQuery({
    queryKey: ['nodes'],
    queryFn: fetchNodes,
    refetchInterval: 15_000,
    retry: 2,
  });
}

