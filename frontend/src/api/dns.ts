import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface DnsConfig {
  magicDns: boolean;
  baseDomain: string;
  nameservers: string[];
  splitDns: Record<string, string[]>;
  searchDomains: string[];
}

async function fetchDns(): Promise<DnsConfig> {
  const res = await fetch('/api/dns');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<DnsConfig>;
}

async function patchDns(patch: Partial<DnsConfig>): Promise<{ ok: boolean; restartRequired: boolean }> {
  const res = await fetch('/api/dns', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
  return res.json() as Promise<{ ok: boolean; restartRequired: boolean }>;
}

export function useDns() {
  return useQuery({
    queryKey: ['dns'],
    queryFn: fetchDns,
    retry: 1,
  });
}

export function usePatchDns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: patchDns,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dns'] }),
  });
}
