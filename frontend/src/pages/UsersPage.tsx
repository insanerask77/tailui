import { useState } from 'react';
import { Users, Plus, Edit2, Trash2, Server, AlertTriangle } from 'lucide-react';
import { useUsers, useCreateUser, useRenameUser, useDeleteUser, type UserRow } from '../api/users';
import { toast } from '../stores/toastStore';

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

// ── Create modal ─────────────────────────────────────────────────────────────
function CreateModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const create = useCreateUser();

  const nameError = name && !NAME_RE.test(name)
    ? 'Lowercase letters, numbers, hyphens only (starting with letter/digit)'
    : '';

  async function submit() {
    if (!name || nameError) return;
    try {
      await create.mutateAsync(name);
      toast.success(`User "${name}" created`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Create user</h2>
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1.5">Username</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase())}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="e.g. alice"
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {nameError && <p className="text-xs text-red-400 mt-1.5">{nameError}</p>}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name || !!nameError || create.isPending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white
                       rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────────
function RenameModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [newName, setNewName] = useState(user.name);
  const rename = useRenameUser();

  const nameError = newName && !NAME_RE.test(newName)
    ? 'Lowercase letters, numbers, hyphens only (starting with letter/digit)'
    : '';

  async function submit() {
    if (!newName || nameError || newName === user.name) return;
    try {
      await rename.mutateAsync({ name: user.name, newName });
      toast.success(`Renamed to "${newName}"`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-1">Rename user</h2>
        <p className="text-xs text-gray-400 mb-4">Current name: <span className="text-gray-200">{user.name}</span></p>
        <div className="mb-4">
          <label className="block text-xs text-gray-400 mb-1.5">New username</label>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value.toLowerCase())}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {nameError && <p className="text-xs text-red-400 mt-1.5">{nameError}</p>}
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!newName || !!nameError || newName === user.name || rename.isPending}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white
                       rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {rename.isPending ? 'Renaming…' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete modal ──────────────────────────────────────────────────────────────
function DeleteModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const del = useDeleteUser();

  async function submit() {
    try {
      await del.mutateAsync(user.name);
      toast.success(`User "${user.name}" deleted`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-red-950 flex items-center justify-center flex-shrink-0">
            <Trash2 size={16} className="text-red-400" />
          </div>
          <h2 className="text-base font-semibold text-white">Delete user</h2>
        </div>

        {user.nodeCount > 0 && (
          <div className="flex items-start gap-2.5 bg-yellow-950/50 border border-yellow-800/50 rounded-lg p-3 mb-4">
            <AlertTriangle size={15} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-200">
              This user has <strong>{user.nodeCount}</strong> node{user.nodeCount !== 1 ? 's' : ''} assigned.
              Deleting the user will also remove their nodes from the tailnet.
            </p>
          </div>
        )}

        <p className="text-sm text-gray-300 mb-5">
          Are you sure you want to delete <span className="font-semibold text-white">{user.name}</span>?
          This action cannot be undone.
        </p>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={del.isPending}
            className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white
                       rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {del.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { data: users, isLoading, error } = useUsers();
  const [showCreate, setShowCreate] = useState(false);
  const [renaming, setRenaming] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Users</h1>
          <p className="text-sm text-gray-400 mt-0.5">Headscale namespaces</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600
                     hover:bg-blue-500 text-white rounded-lg transition"
        >
          <Plus size={15} />
          Create user
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/50 border border-red-800/50 text-sm text-red-300">
          {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nodes</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-800/50">
                  <td className="px-5 py-4"><div className="h-4 w-24 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-8 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="h-4 w-32 bg-gray-800 rounded animate-pulse" /></td>
                  <td className="px-5 py-4" />
                </tr>
              ))
            )}

            {!isLoading && users?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                      <Users size={18} className="text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-400">No users yet</p>
                    <button
                      onClick={() => setShowCreate(true)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition"
                    >
                      Create the first user
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {users?.map((user) => (
              <tr
                key={user.id}
                className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-indigo-900 flex items-center justify-center text-xs
                                    font-semibold text-indigo-300 flex-shrink-0">
                      {user.name[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-white">{user.name}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <Server size={13} className="text-gray-500" />
                    <span>{user.nodeCount}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-gray-400">
                  {user.createdAt
                    ? new Intl.DateTimeFormat('default', { dateStyle: 'medium' }).format(new Date(user.createdAt))
                    : '—'}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setRenaming(user)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-700 transition"
                      title="Rename"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleting(user)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950 transition"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {renaming && <RenameModal user={renaming} onClose={() => setRenaming(null)} />}
      {deleting && <DeleteModal user={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
