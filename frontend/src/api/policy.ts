import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Policy {
  policy: string;
  updatedAt: string | null;
}

async function fetchPolicy(): Promise<Policy> {
  const res = await fetch('/api/policy');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<Policy>;
}

async function savePolicy(policy: string): Promise<Policy> {
  const res = await fetch('/api/policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy }),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
  return res.json() as Promise<Policy>;
}

export function usePolicy() {
  return useQuery({
    queryKey: ['policy'],
    queryFn: fetchPolicy,
    retry: 1,
  });
}

export function useSavePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: savePolicy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policy'] }),
  });
}
