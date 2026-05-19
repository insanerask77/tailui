import { useQuery } from '@tanstack/react-query';

export interface AuditEvent {
  id: number;
  action: string;
  actor: string;
  target: string | null;
  ts: number;
}

export interface OverviewData {
  nodesTotal: number;
  nodesOnline: number;
  nodesOffline: number;
  usersCount: number;
  recentEvents: AuditEvent[];
}

async function fetchOverview(): Promise<OverviewData> {
  const res = await fetch('/api/overview');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<OverviewData>;
}

export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 15_000,
    retry: 2,
  });
}
