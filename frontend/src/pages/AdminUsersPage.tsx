import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Copy, Check, Clock, Users, Link, X, Loader2, AlertCircle } from 'lucide-react';
import { useUsers } from '../api/users';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { ConfirmModal } from '../components/ConfirmModal';

// ── Types ──────────────────────────────────────────────────────────────────

interface AppUser {
  id: number;
  username: string;
  role: 'admin' | 'user';
  namespace: string | null;
  created_at: number;
}

interface Invitation {
  id: number;
  token: string;
  role: string;
  namespace: string | null;
  created_by: string;
  expires_at: number;
  created_at: number;
  inviteUrl?: string;
}

// ── API ────────────────────────────────────────────────────────────────────

async function fetchAppUsers(): Promise<AppUser[]> {
  const r = await fetch('/api/admin/users');
  if (!r.ok) throw new Error('Failed to fetch users');
  return r.json() as Promise<AppUser[]>;
}

async function fetchInvitations(): Promise<Invitation[]> {
  const r = await fetch('/api/admin/invitations');
  if (!r.ok) throw new Error('Failed to fetch invitations');
  return r.json() as Promise<Invitation[]>;
}

async function createInvitation(params: { role: string; namespace: string | null; expiresInHours: number }): Promise<Invitation> {
  const r = await fetch('/api/admin/invitations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
  return r.json() as Promise<Invitation>;
}

async function revokeInvitation(token: string): Promise<void> {
  const r = await fetch(`/api/admin/invitations/${token}`, { method: 'DELETE' });
  if (!r.ok) throw new Error('Failed to revoke');
}

async function deleteUser(id: number): Promise<void> {
  const r = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error((await r.json() as { error: string }).error);
}

// ── CopyButton ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
      {copied ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

// ── CreateInviteModal ──────────────────────────────────────────────────────

function CreateInviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: hsUsers = [] } = useUsers();
  const [role, setRole] = useState('user');
  const [namespace, setNamespace] = useState('');
  const [hours, setHours] = useState(48);
  const [result, setResult] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setLoading(true); setError('');
    try {
      const inv = await createInvitation({ role, namespace: namespace || null, expiresInHours: hours });
      setResult(inv);
      void qc.invalidateQueries({ queryKey: ['admin-invitations'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  const inviteUrl = result
    ? (result.inviteUrl?.startsWith('http')
        ? result.inviteUrl
        : `${window.location.origin}${result.inviteUrl ?? `/register/${result.token}`}`)
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">Create invitation link</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-700 text-gray-400"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!result ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Role</label>
                <select value={role} onChange={e => setRole(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {role === 'user' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Headscale namespace</label>
                  <select value={namespace} onChange={e => setNamespace(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                    <option value="">— select namespace —</option>
                    {hsUsers.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">The user will only see nodes and keys from this namespace.</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Expires in</label>
                <select value={hours} onChange={e => setHours(Number(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{error}</p>}
            </>
          ) : (
            <div className="space-y-3">
              <div className="bg-teal-950/30 border border-teal-700/30 rounded-lg p-3">
                <p className="text-sm text-teal-300 font-medium mb-2">Invitation created — share this link:</p>
                <p className="font-mono text-xs text-gray-300 break-all bg-gray-800 rounded p-2">{inviteUrl}</p>
              </div>
              <div className="flex justify-center">
                <CopyButton text={inviteUrl} />
              </div>
              <p className="text-xs text-gray-500 text-center">This link can only be used once and expires in {hours}h.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button onClick={() => void handleCreate()} disabled={loading || (role === 'user' && !namespace)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Generate link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore(s => s.username);
  const { data: appUsers = [], isLoading: loadingUsers } = useQuery({ queryKey: ['admin-users'], queryFn: fetchAppUsers });
  const { data: invitations = [], isLoading: loadingInvites } = useQuery({ queryKey: ['admin-invitations'], queryFn: fetchInvitations });

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AppUser | null>(null);

  const deleteUserMut = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeInviteMut = useMutation({
    mutationFn: (token: string) => revokeInvitation(token),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin-invitations'] }); toast.success('Invitation revoked'); },
  });

  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString();
  const isExpired  = (ts: number) => ts < Math.floor(Date.now() / 1000);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">User management</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage TailUI accounts and invitation links</p>
      </div>

      {/* TailUI accounts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Users className="w-4 h-4" /> Accounts ({appUsers.length})
          </h2>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          {loadingUsers ? (
            <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Username</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Namespace</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {appUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">
                      {u.username}
                      {u.username === currentUser && <span className="ml-2 text-xs text-gray-500">(you)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-900/40 text-purple-300' : 'bg-gray-800 text-gray-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400">{u.namespace ?? <span className="text-gray-600">—</span>}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.username !== currentUser && (
                        <button onClick={() => setConfirmDelete(u)} className="p-1.5 rounded-lg hover:bg-red-950 text-gray-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Invitations */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Link className="w-4 h-4" /> Pending invitations ({invitations.length})
          </h2>
          <button onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> New invitation
          </button>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          {loadingInvites ? (
            <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
          ) : invitations.length === 0 ? (
            <div className="p-6 text-center text-gray-600 text-sm">No pending invitations</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Namespace</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Created by</th>
                  <th className="px-4 py-3 text-left">Expires</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {invitations.map(inv => {
                  const expired = isExpired(inv.expires_at);
                  const url = `${window.location.origin}/register/${inv.token}`;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-300">{inv.namespace ?? <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${inv.role === 'admin' ? 'bg-purple-900/40 text-purple-300' : 'bg-gray-800 text-gray-400'}`}>
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{inv.created_by}</td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-xs ${expired ? 'text-red-400' : 'text-gray-400'}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(inv.expires_at)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!expired && <CopyButton text={url} />}
                          <button onClick={() => revokeInviteMut.mutate(inv.token)}
                            className="p-1.5 rounded-lg hover:bg-red-950 text-gray-500 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {showInviteModal && <CreateInviteModal onClose={() => setShowInviteModal(false)} />}

      <ConfirmModal
        open={!!confirmDelete}
        title={`Delete ${confirmDelete?.username ?? ''}`}
        message="This user will lose access to TailUI immediately."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (confirmDelete) deleteUserMut.mutate(confirmDelete.id); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
