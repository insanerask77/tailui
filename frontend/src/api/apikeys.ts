import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ApiKey {
  id: string;
  prefix: string;
  expiration: string;
  createdAt: string;
  lastSeen: string | null;
}

async function fetchApiKeys(): Promise<ApiKey[]> {
  const res = await fetch('/api/apikeys');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<ApiKey[]>;
}

async function createApiKey(expiration: string): Promise<{ apiKey: string }> {
  const res = await fetch('/api/apikeys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiration }),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
  return res.json() as Promise<{ apiKey: string }>;
}

async function revokeApiKey(prefix: string): Promise<void> {
  const res = await fetch(`/api/apikeys/${encodeURIComponent(prefix)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['apikeys'],
    queryFn: fetchApiKeys,
    refetchInterval: 60_000,
  });
}

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apikeys'] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apikeys'] }),
  });
}
