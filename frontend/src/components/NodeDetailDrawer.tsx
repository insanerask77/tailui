import { useState } from 'react';
import { X, Clock, User, Tag, Wifi, WifiOff, AlertCircle, Edit2, Check, Shield } from 'lucide-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import type { NodeRow } from '../api/nodes';
import { toast } from '../stores/toastStore';

interface Props {
  node: NodeRow | null;
  open: boolean;
  onClose: () => void;
  onDeleteRequest: (node: NodeRow) => void;
}

async function patchNode(id: string, body: object) {
  const res = await fetch(`/api/nodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

async function expireNode(id: string) {
  const res = await fetch(`/api/nodes/${id}/expire`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

function fmt(iso: string | undefined) {
  if (!iso || iso.startsWith('0001-')) return '—';
  return new Intl.DateTimeFormat('default', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(iso));
}

function reltime(iso: string | undefined) {
  if (!iso || iso.startsWith('0001-')) return '—';
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NodeDetailDrawer({ node, open, onClose, onDeleteRequest }: Props) {
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['nodes'] });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => patchNode(id, { name }),
    onSuccess: () => { toast.success('Node renamed'); setEditingName(false); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const expireMutation = useMutation({
    mutationFn: (id: string) => expireNode(id),
    onSuccess: () => { toast.success('Node expired'); invalidate(); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!node) return null;

  const allTags = [...new Set([...node.valid_tags, ...node.forced_tags])];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-gray-900 border-l border-gray-800
                        shadow-2xl flex flex-col transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') renameMutation.mutate({ id: node.id, name: nameInput });
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => renameMutation.mutate({ id: node.id, name: nameInput })}
                  disabled={renameMutation.isPending}
                  className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white truncate">
                  {node.given_name || node.name}
                </h2>
                <button
                  onClick={() => { setNameInput(node.given_name || node.name); setEditingName(true); }}
                  className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                >
                  <Edit2 size={13} />
                </button>
              </div>
            )}
            {node.given_name && node.given_name !== node.name && (
              <p className="text-xs text-gray-500 mt-0.5">{node.name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-2">
            {node.online
              ? <><Wifi size={15} className="text-teal-400" /><span className="text-sm text-teal-400 font-medium">Online</span></>
              : node.expired
                ? <><AlertCircle size={15} className="text-red-400" /><span className="text-sm text-red-400 font-medium">Expired</span></>
                : <><WifiOff size={15} className="text-gray-500" /><span className="text-sm text-gray-500">Offline</span></>
            }
          </div>

          {/* IP addresses */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">IP Addresses</p>
            <div className="space-y-1">
              {node.ip_addresses.map((ip) => (
                <p key={ip} className="font-mono text-sm text-white">{ip}</p>
              ))}
              {node.ip_addresses.length === 0 && <p className="text-sm text-gray-500">—</p>}
            </div>
          </div>

          {/* User */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">User</p>
            <div className="flex items-center gap-2">
              <User size={14} className="text-gray-400" />
              <span className="text-sm text-white">{node.user.name}</span>
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                                           bg-blue-950 text-blue-300 border border-blue-800">
                    <Tag size={9} />
                    {t.replace('tag:', '')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Last seen</p>
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-gray-400" />
                <span className="text-sm text-white">{reltime(node.last_seen)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{fmt(node.last_seen)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Expiry</p>
              <div className="flex items-center gap-1.5">
                <Shield size={13} className={node.expired ? 'text-red-400' : 'text-gray-400'} />
                <span className={`text-sm ${node.expired ? 'text-red-400' : 'text-white'}`}>
                  {node.expiry && !node.expiry.startsWith('0001-') ? reltime(node.expiry) : 'No expiry'}
                </span>
              </div>
              {node.expiry && !node.expiry.startsWith('0001-') && (
                <p className="text-xs text-gray-500 mt-0.5">{fmt(node.expiry)}</p>
              )}
            </div>
          </div>

          {/* Node ID */}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Node ID</p>
            <p className="font-mono text-sm text-gray-300">{node.id}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={() => expireMutation.mutate(node.id)}
            disabled={expireMutation.isPending || node.expired}
            className="flex-1 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700
                       disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
          >
            {expireMutation.isPending ? 'Expiring…' : 'Expire key'}
          </button>
          <button
            onClick={() => onDeleteRequest(node)}
            className="flex-1 py-2 text-sm text-red-400 bg-red-950 hover:bg-red-900
                       border border-red-800 rounded-lg transition"
          >
            Delete node
          </button>
        </div>
      </div>
    </>
  );
}
