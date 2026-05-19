import { useState } from 'react';
import { Plus, Copy, Check, Clock, AlertCircle, Trash2, KeyRound } from 'lucide-react';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, type ApiKey } from '../api/apikeys';
import { toast } from '../stores/toastStore';

// ── Helpers ───────────────────────────────────────────────────────────────────
function isExpired(key: ApiKey): boolean {
  if (!key.expiration || key.expiration.startsWith('0001-')) return false;
  return new Date(key.expiration).getTime() < Date.now();
}

function fmt(iso: string | null) {
  if (!iso || iso.startsWith('0001-')) return '—';
  return new Intl.DateTimeFormat('default', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

function reltime(iso: string | null) {
  if (!iso || iso.startsWith('0001-')) return '—';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
            <KeyRound size={16} className="text-teal-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">API key created</h2>
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
            This key grants full access to the Headscale API. Store it securely — it cannot be retrieved after closing this dialog.
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

// ── Create modal ───────────────────────────────────────────────────────────────
function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (key: string) => void;
}) {
  const create = useCreateApiKey();
  const defaultExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const [expiry, setExpiry] = useState(defaultExpiry);

  async function submit() {
    try {
      const result = await create.mutateAsync(new Date(expiry).toISOString());
      onCreated(result.apiKey);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6">
        <h2 className="text-base font-semibold text-white mb-4">Create API key</h2>

        <div className="mb-5">
          <label className="block text-xs text-gray-400 mb-1.5">Expiration</label>
          <input
            type="datetime-local"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={create.isPending}
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ApiKeysPage() {
  const { data: keys, isLoading, error } = useApiKeys();
  const revoke = useRevokeApiKey();

  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  async function handleRevoke(key: ApiKey) {
    try {
      await revoke.mutateAsync(key.prefix);
      toast.success(`API key "${key.prefix}" revoked`);
      setRevokeTarget(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">API Keys</h1>
          <p className="text-sm text-gray-400 mt-0.5">Headscale API access keys</p>
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

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/50 border border-red-800/50 text-sm text-red-300">
          {(error as Error).message}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Prefix</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Expires</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last used</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 2 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="px-5 py-4">
                    <div className="h-4 w-24 bg-gray-800 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}

            {!isLoading && (keys ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
                      <KeyRound size={18} className="text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-400">No API keys yet</p>
                  </div>
                </td>
              </tr>
            )}

            {(keys ?? []).map((key) => {
              const expired = isExpired(key);
              return (
                <tr
                  key={key.id}
                  className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/30 transition-colors"
                >
                  {/* Prefix */}
                  <td className="px-5 py-4">
                    <code className="font-mono text-sm text-gray-200">{key.prefix}…</code>
                  </td>
                  {/* Status */}
                  <td className="px-5 py-4">
                    {expired ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-950 text-red-300 border border-red-800">
                        <AlertCircle size={9} /> Expired
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-teal-950 text-teal-300 border border-teal-800">
                        <Check size={9} /> Active
                      </span>
                    )}
                  </td>
                  {/* Created */}
                  <td className="px-5 py-4 text-gray-400 text-xs">{fmt(key.createdAt)}</td>
                  {/* Expires */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className={expired ? 'text-red-400' : 'text-gray-500'} />
                      <span className={`text-xs ${expired ? 'text-red-400' : 'text-gray-400'}`}>
                        {fmt(key.expiration)}
                      </span>
                    </div>
                  </td>
                  {/* Last used */}
                  <td className="px-5 py-4 text-xs text-gray-500">{reltime(key.lastSeen)}</td>
                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setRevokeTarget(key)}
                      disabled={revoke.isPending}
                      className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400
                                 hover:bg-red-950/40 px-2 py-1 rounded-lg transition disabled:opacity-40"
                    >
                      <Trash2 size={12} /> Revoke
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Revoke confirm modal */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRevokeTarget(null)} />
          <div className="relative z-10 w-full max-w-sm bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-950 flex items-center justify-center flex-shrink-0">
                <Trash2 size={16} className="text-red-400" />
              </div>
              <h2 className="text-base font-semibold text-white">Revoke API key?</h2>
            </div>
            <p className="text-sm text-gray-400 mb-5">
              Key <code className="font-mono text-xs text-gray-200">{revokeTarget.prefix}…</code> will be
              permanently revoked. Any service using it will lose access immediately.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setRevokeTarget(null)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(revokeTarget)}
                disabled={revoke.isPending}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white
                           rounded-lg transition disabled:opacity-40"
              >
                {revoke.isPending ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(key) => { setShowCreate(false); setNewKey(key); }}
        />
      )}

      {newKey && <CopyKeyModal fullKey={newKey} onClose={() => setNewKey(null)} />}
    </div>
  );
}
