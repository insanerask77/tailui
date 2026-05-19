import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface UserRow {
  id: string;
  name: string;
  createdAt: string;
  nodeCount: number;
}

async function fetchUsers(): Promise<UserRow[]> {
  const res = await fetch('/api/users');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<UserRow[]>;
}

async function createUser(name: string): Promise<void> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

async function renameUser(name: string, newName: string): Promise<void> {
  const res = await fetch(`/api/users/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName }),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

async function deleteUser(name: string): Promise<void> {
  const res = await fetch(`/api/users/${encodeURIComponent(name)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    refetchInterval: 30_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useRenameUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, newName }: { name: string; newName: string }) => renameUser(name, newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['nodes'] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['nodes'] });
    },
  });
}
