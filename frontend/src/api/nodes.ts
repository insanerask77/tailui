import { useQuery } from '@tanstack/react-query';

export interface NodeUser {
  id: string;
  name: string;
  created_at: string;
}

export interface NodeRow {
  id: string;
  name: string;
  given_name: string;
  user: NodeUser;
  last_seen: string;
  expiry: string;
  ip_addresses: string[];
  online: boolean;
  expired: boolean;
  valid_tags: string[];
  forced_tags: string[];
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

async function fetchUsers(): Promise<NodeUser[]> {
  const res = await fetch('/api/users');
  if (!res.ok) return [];
  return res.json() as Promise<NodeUser[]>;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 60_000,
  });
}
