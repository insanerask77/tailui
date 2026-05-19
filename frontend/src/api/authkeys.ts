import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface AuthKey {
  user: string;
  id: string;
  key: string;
  reusable: boolean;
  ephemeral: boolean;
  used: boolean;
  expiration: string;
  createdAt: string;
  aclTags: string[];
}

export interface CreateKeyParams {
  user: string;
  reusable: boolean;
  ephemeral: boolean;
  expiration: string;
  aclTags: string[];
}

async function fetchAuthKeys(): Promise<AuthKey[]> {
  const res = await fetch('/api/authkeys');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<AuthKey[]>;
}

async function createAuthKey(params: CreateKeyParams): Promise<{ preAuthKey: AuthKey }> {
  const res = await fetch('/api/authkeys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
  return res.json() as Promise<{ preAuthKey: AuthKey }>;
}

async function expireAuthKey(user: string, key: string): Promise<void> {
  const res = await fetch('/api/authkeys/expire', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, key }),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

export function useAuthKeys() {
  return useQuery({
    queryKey: ['authkeys'],
    queryFn: fetchAuthKeys,
    refetchInterval: 30_000,
  });
}

export function useCreateAuthKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAuthKey,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['authkeys'] }),
  });
}

export function useExpireAuthKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ user, key }: { user: string; key: string }) => expireAuthKey(user, key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['authkeys'] }),
  });
}
