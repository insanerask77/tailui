import { useState } from 'react';
import { Plus, Copy, Check, Clock, AlertCircle, Tag, RefreshCw, Zap } from 'lucide-react';
import { useAuthKeys, useCreateAuthKey, useExpireAuthKey, type AuthKey, type CreateKeyParams } from '../api/authkeys';
import { useUsers } from '../api/users';
import { toast } from '../stores/toastStore';

// ── Helpers ───────────────────────────────────────────────────────────────────
function isExpired(key: AuthKey): boolean {
  if (!key.expiration || key.expiration.startsWith('0001-')) return false;
  return new Date(key.expiration).getTime() < Date.now();
}

function fmt(iso: string) {
  if (!iso || iso.startsWith('0001-')) return '—';
  return new Intl.DateTimeFormat('default', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function keyPrefix(key: string): string {
  return key.length > 12 ? `${key.slice(0, 12)}…` : key;
}

// ── Copy Key modal ─────────────────────────────────────────────────────────────
function CopyKeyModal({ fullKey, onClose }: { fullKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(fullKey).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-teal-950 flex items-center justify-center flex-shrink-0">
            <Copy size={16} className="text-teal-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Auth key created</h2>
            <p className="text-xs text-gray-400">Copy it now — it won't be shown again</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 mb-4">
          <code className="flex-1 text-xs font-mono text-teal-300 break-all">{fullKey}</code>
          <button
            onClick={copy}
            className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
            title="Copy"
          >
            {copied ? <Check size={14} className="text-teal-400" /> : <Copy size={14} />}
          </button>
        </div>

        <div className="flex items-start gap-2.5 bg-yellow-950/40 border border-yellow-800/40 rounded-lg p-3 mb-5">
          <AlertCircle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-200">
            Save this key in a secure place. Once you close this dialog, the full key will no longer be displayed.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Key modal ───────────────────────────────────────────────────────────
function CreateKeyModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (key: string) => void;
}) {
  const { data: users = [] } = useUsers();
  const create = useCreateAuthKey();

  const defaultExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  const [user, setUser] = useState(users[0]?.name ?? '');
  const [reusable, setReusable] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [tagsInput, setTagsInput] = useState('');

  async function submit() {
    if (!user) return;
    const aclTags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('tag:') ? t : `tag:${t}`));

    const params: CreateKeyParams = {
      user,
      reusable,
      ephemeral,
      expiration: new Date(expiry).toISOString(),
      aclTags,
    };

    try {
      const result = await create.mutateAsync(params);
      onCreated(result.preAuthKey.key);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Create auth key</h2>

        <div className="space-y-4">
          {/* User */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">User</label>
            <select
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {users.map((u) => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Expiration</label>
            <input
              type="datetime-local"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">ACL tags (comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. server, db"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-600"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-2.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setReusable(!reusable)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  reusable ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  reusable ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </div>
              <div>
                <span className="text-sm text-white">Reusable</span>
                <p className="text-xs text-gray-500">Key can be used multiple times</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setEphemeral(!ephemeral)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${
                  ephemeral ? 'bg-blue-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  ephemeral ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </div>
              <div>
                <span className="text-sm text-white">Ephemeral</span>
                <p className="text-xs text-gray-500">Node removed when disconnected</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!user || create.isPending}
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

// ── Status badge ───────────────────────────────────────────────────────────────
function KeyStatus({ k }: { k: AuthKey }) {
  if (isExpired(k)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-950 text-red-300 border border-red-800">
        <AlertCircle size={9} /> Expired
      </span>
    );
  }
  if (k.used && !k.reusable) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-400 border border-gray-700">
        Used
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-950 text-teal-300 border border-teal-800">
      <Check size={9} /> Valid
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AuthKeysPage() {
  const { data: keys, isLoading, error } = useAuthKeys();
  const { data: users = [] } = useUsers();
  const expire = useExpireAuthKey();

  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState('all');
  const [expireConfirm, setExpireConfirm] = useState<AuthKey | null>(null);

  const filtered = (keys ?? []).filter((k) => filterUser === 'all' || k.user === filterUser);

  async function handleExpire(k: AuthKey) {
    try {
      await expire.mutateAsync({ user: k.user, key: k.key });
      toast.success('Key expired');
      setExpireConfirm(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Auth Keys</h1>
          <p className="text-sm text-gray-400 mt-0.5">Pre-authentication keys for node enrollment</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600
                     hover:bg-blue-500 text-white rounded-lg transition"
        >
          <Plus size={15} />
          Create key
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterUser}
          onChange={(e) => setFilterUser(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All users</option>
          {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
        <span className="text-xs text-gray-500">{filtered.length} key{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Error */}
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
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Key</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Flags</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Expires</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tags</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                <td className="px-5 py-4"><div className="h-4 w-32 bg-gray-800 rounded animate-pulse" /></td>
                <td className="px-5 py-4"><div className="h-4 w-16 bg-gray-800 rounded animate-pulse" /></td>
                <td className="px-5 py-4"><div className="h-4 w-14 bg-gray-800 rounded animate-pulse" /></td>
                <td className="px-5 py-4"><div className="h-4 w-20 bg-gray-800 rounded animate-pulse" /></td>
                <td className="px-5 py-4"><div className="h-4 w-28 bg-gray-800 rounded animate-pulse" /></td>
                <td className="px-5 py-4" /><td className="px-5 py-4" />
              </tr>
            ))}

            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                  No auth keys found.
                </td>
              </tr>
            )}

            {filtered.map((k) => {
              const expired = isExpired(k);
              return (
                <tr
                  key={k.id}
                  className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
                >
                  {/* Key */}
                  <td className="px-5 py-4">
                    <code className="font-mono text-xs text-gray-300">{keyPrefix(k.key)}</code>
                  </td>
                  {/* User */}
                  <td className="px-5 py-4 text-gray-300">{k.user}</td>
                  {/* Status */}
                  <td className="px-5 py-4"><KeyStatus k={k} /></td>
                  {/* Flags */}
                  <td className="px-5 py-4">
                    <div className="flex gap-1.5">
                      {k.reusable && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-950 text-blue-300">
                          <RefreshCw size={8} /> Reusable
                        </span>
                      )}
                      {k.ephemeral && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-orange-950 text-orange-300">
                          <Zap size={8} /> Ephemeral
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Expiry */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className={expired ? 'text-red-400' : 'text-gray-500'} />
                      <span className={`text-xs ${expired ? 'text-red-400' : 'text-gray-400'}`}>
                        {fmt(k.expiration)}
                      </span>
                    </div>
                  </td>
                  {/* Tags */}
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {k.aclTags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
                                                  bg-gray-800 text-gray-400 border border-gray-700">
                          <Tag size={8} />{t.replace('tag:', '')}
                        </span>
                      ))}
                    </div>
                  </td>
                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    {!expired && (
                      <button
                        onClick={() => setExpireConfirm(k)}
                        disabled={expire.isPending}
                        className="text-xs text-gray-500 hover:text-orange-400 transition px-2 py-1
                                   hover:bg-orange-950/40 rounded-lg disabled:opacity-40"
                      >
                        Expire
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Expire confirm inline */}
      {expireConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setExpireConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6">
            <h2 className="text-base font-semibold text-white mb-2">Expire auth key?</h2>
            <p className="text-sm text-gray-400 mb-5">
              Key <code className="font-mono text-xs text-gray-300">{keyPrefix(expireConfirm.key)}</code> will be
              immediately invalidated and cannot be used to enroll new nodes.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setExpireConfirm(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExpire(expireConfirm)}
                disabled={expire.isPending}
                className="px-4 py-2 text-sm font-medium bg-orange-600 hover:bg-orange-500 text-white
                           rounded-lg transition disabled:opacity-40"
              >
                {expire.isPending ? 'Expiring…' : 'Expire key'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(key) => { setShowCreate(false); setNewKey(key); }}
        />
      )}

      {newKey && <CopyKeyModal fullKey={newKey} onClose={() => setNewKey(null)} />}
    </div>
  );
}
