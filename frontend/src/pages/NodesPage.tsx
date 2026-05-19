import { useState, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Search, Wifi, WifiOff, AlertCircle, Clock, Tag,
  MoreVertical, Trash2, Timer, ChevronDown, ArrowUpRight, Plus,
} from 'lucide-react';
import { useNodes, useUsers, type NodeRow } from '../api/nodes';
import { useRoutes, useExitNodeIds } from '../api/routes';
import { Skeleton } from '../components/Skeleton';
import { ConfirmModal } from '../components/ConfirmModal';
import { NodeDetailDrawer } from '../components/NodeDetailDrawer';
import { AddDeviceModal } from '../components/AddDeviceModal';
import { toast } from '../stores/toastStore';

type StatusFilter = 'all' | 'online' | 'offline' | 'expired';

// ── API helpers ────────────────────────────────────────────────────────────

async function apiDelete(id: string) {
  const res = await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(((await res.json()) as { error: string }).error);
}
async function apiExpire(id: string) {
  const res = await fetch(`/api/nodes/${id}/expire`, { method: 'POST' });
  if (!res.ok) throw new Error(((await res.json()) as { error: string }).error);
}
async function apiBulkDelete(ids: string[]) {
  const res = await fetch('/api/nodes/bulk-delete', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(((await res.json()) as { error: string }).error);
}
async function apiBulkExpire(ids: string[]) {
  const res = await fetch('/api/nodes/bulk-expire', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(((await res.json()) as { error: string }).error);
}

// ── Sub-components ─────────────────────────────────────────────────────────

function reltime(iso: string) {
  if (!iso || iso.startsWith('0001-')) return '—';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ node }: { node: NodeRow }) {
  if (node.expired) return (
    <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />Expired
    </span>
  );
  if (node.online) return (
    <span className="inline-flex items-center gap-1.5 text-xs text-teal-400">
      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0 animate-pulse" />Online
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />Offline
    </span>
  );
}

function RowMenu({ node, onExpire, onDelete, onOpen }: {
  node: NodeRow;
  onExpire: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 bg-gray-800 border border-gray-700
                          rounded-xl shadow-2xl overflow-hidden py-1">
            <button
              onClick={() => { setOpen(false); onOpen(); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              View details
            </button>
            <button
              disabled={node.expired}
              onClick={() => { setOpen(false); onExpire(); }}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Timer size={13} />Expire key
            </button>
            <div className="border-t border-gray-700 my-1" />
            <button
              onClick={() => { setOpen(false); onDelete(); }}
              className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-950 transition-colors flex items-center gap-2"
            >
              <Trash2 size={13} />Delete node
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function NodesPage() {
  const qc = useQueryClient();
  const { data: nodes, isLoading, isError, error } = useNodes();
  const { data: users = [] } = useUsers();
  const { data: routes } = useRoutes();
  const exitNodeIds = useExitNodeIds(routes);

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState<StatusFilter>('all');
  const [userFilter, setUserFilter]   = useState('all');
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [drawerNode, setDrawerNode]   = useState<NodeRow | null>(null);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [confirm, setConfirm]         = useState<{ type: 'delete' | 'expire' | 'bulk-delete' | 'bulk-expire'; ids: string[] } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['nodes'] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(id),
    onSuccess: () => { toast.success('Node deleted'); invalidate(); setDrawerOpen(false); },
    onError:   (e) => toast.error((e as Error).message),
  });
  const expireMutation = useMutation({
    mutationFn: (id: string) => apiExpire(id),
    onSuccess: () => { toast.success('Node key expired'); invalidate(); },
    onError:   (e) => toast.error((e as Error).message),
  });
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiBulkDelete(ids),
    onSuccess: (_, ids) => { toast.success(`${ids.length} nodes deleted`); setSelected(new Set()); invalidate(); },
    onError:   (e) => toast.error((e as Error).message),
  });
  const bulkExpireMutation = useMutation({
    mutationFn: (ids: string[]) => apiBulkExpire(ids),
    onSuccess: (_, ids) => { toast.success(`${ids.length} nodes expired`); setSelected(new Set()); invalidate(); },
    onError:   (e) => toast.error((e as Error).message),
  });

  function confirmAction() {
    if (!confirm) return;
    if (confirm.type === 'delete')       deleteMutation.mutate(confirm.ids[0]);
    if (confirm.type === 'expire')       expireMutation.mutate(confirm.ids[0]);
    if (confirm.type === 'bulk-delete')  bulkDeleteMutation.mutate(confirm.ids);
    if (confirm.type === 'bulk-expire')  bulkExpireMutation.mutate(confirm.ids);
    setConfirm(null);
  }

  const filtered = useMemo(() => {
    if (!nodes) return [];
    return nodes.filter((n) => {
      if (statusFilter === 'online'  && !n.online)                  return false;
      if (statusFilter === 'offline' && (n.online || n.expired))    return false;
      if (statusFilter === 'expired' && !n.expired)                 return false;
      if (userFilter !== 'all' && n.user.name !== userFilter)       return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.givenName.toLowerCase().includes(q) &&
            !n.name.toLowerCase().includes(q) &&
            !n.ipAddresses.some((ip) => ip.includes(q))) return false;
      }
      return true;
    });
  }, [nodes, search, statusFilter, userFilter]);

  const counts = useMemo(() => ({
    total:   nodes?.length ?? 0,
    online:  nodes?.filter((n) => n.online).length ?? 0,
    expired: nodes?.filter((n) => n.expired).length ?? 0,
  }), [nodes]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((n) => selected.has(n.id));

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected((s) => { const n = new Set(s); filtered.forEach((r) => n.delete(r.id)); return n; });
    } else {
      setSelected((s) => { const n = new Set(s); filtered.forEach((r) => n.add(r.id)); return n; });
    }
  }

  function openDrawer(node: NodeRow) {
    setDrawerNode(node);
    setDrawerOpen(true);
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Nodes</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isLoading ? 'Loading…' : `${counts.total} nodes · ${counts.online} online`}
          </p>
        </div>
        <button
          onClick={() => setAddDeviceOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add device
        </button>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-950 border border-blue-800 rounded-xl mb-4">
          <span className="text-sm text-blue-300 font-medium flex-1">{selected.size} node{selected.size > 1 ? 's' : ''} selected</span>
          <button
            onClick={() => setConfirm({ type: 'bulk-expire', ids: [...selected] })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700
                       text-gray-300 rounded-lg transition"
          >
            <Timer size={12} />Expire all
          </button>
          <button
            onClick={() => setConfirm({ type: 'bulk-delete', ids: [...selected] })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-950 hover:bg-red-900
                       text-red-400 border border-red-800 rounded-lg transition"
          >
            <Trash2 size={12} />Delete all
          </button>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-300">
            Deselect
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hostname or IP…"
            className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm
                       text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All users</option>
          {users.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>
      </div>

      {isError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg mb-5 text-sm bg-red-950 border border-red-800 text-red-300">
          <AlertCircle size={15} className="flex-shrink-0" />
          {(error as Error).message}
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  className="rounded border-gray-600 bg-gray-800 accent-blue-500"
                />
              </th>
              {['Status','Hostname','IP','User','Last seen',''].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && [...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                {[...Array(6)].map((_, j) => (
                  <td key={j} className="px-4 py-3.5"><Skeleton className="h-4" /></td>
                ))}
              </tr>
            ))}

            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                  {nodes?.length === 0
                    ? 'No nodes registered yet.'
                    : 'No nodes match the current filters.'}
                </td>
              </tr>
            )}

            {!isLoading && filtered.map((node) => (
              <tr
                key={node.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
                onClick={() => openDrawer(node)}
              >
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(node.id)}
                    onChange={(e) => {
                      setSelected((s) => {
                        const n = new Set(s);
                        e.target.checked ? n.add(node.id) : n.delete(node.id);
                        return n;
                      });
                    }}
                    className="rounded border-gray-600 bg-gray-800 accent-blue-500"
                  />
                </td>
                <td className="px-4 py-3.5"><StatusBadge node={node} /></td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{node.givenName || node.name}</span>
                    {exitNodeIds.has(node.id) && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
                                       bg-purple-950 text-purple-300 border border-purple-800">
                        <ArrowUpRight size={9} /> Exit
                      </span>
                    )}
                  </div>
                  {node.givenName && node.givenName !== node.name && (
                    <div className="text-xs text-gray-500">{node.name}</div>
                  )}
                  {[...node.validTags, ...node.forcedTags].length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {[...node.validTags, ...node.forcedTags].map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
                                                 bg-blue-950 text-blue-300 border border-blue-800">
                          <Tag size={9} />{t.replace('tag:', '')}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5 font-mono text-xs text-gray-300">
                  {node.ipAddresses[0] ?? '—'}
                  {node.ipAddresses[1] && <div className="text-gray-500">{node.ipAddresses[1]}</div>}
                </td>
                <td className="px-4 py-3.5 text-gray-300">{node.user.name}</td>
                <td className="px-4 py-3.5 text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} />{reltime(node.lastSeen)}
                  </span>
                </td>
                <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <RowMenu
                    node={node}
                    onOpen={() => openDrawer(node)}
                    onExpire={() => setConfirm({ type: 'expire', ids: [node.id] })}
                    onDelete={() => setConfirm({ type: 'delete', ids: [node.id] })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {!isLoading && nodes && nodes.length > 0 && (
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Wifi size={11} className="text-teal-400" />{counts.online} online</span>
          <span className="flex items-center gap-1"><WifiOff size={11} />{counts.total - counts.online - counts.expired} offline</span>
          {counts.expired > 0 && (
            <span className="flex items-center gap-1 text-red-400"><AlertCircle size={11} />{counts.expired} expired</span>
          )}
          <span className="ml-auto flex items-center gap-1"><ChevronDown size={11} />Auto-refresh 15s</span>
        </div>
      )}

      {/* Drawer */}
      <NodeDetailDrawer
        node={drawerNode}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onDeleteRequest={(n) => setConfirm({ type: 'delete', ids: [n.id] })}
      />

      {/* Confirm modal */}
      <ConfirmModal
        open={!!confirm}
        title={
          confirm?.type === 'delete'       ? 'Delete node' :
          confirm?.type === 'bulk-delete'  ? `Delete ${confirm.ids.length} nodes` :
          confirm?.type === 'expire'       ? 'Expire node key' :
                                             `Expire ${confirm?.ids.length} node keys`
        }
        message={
          confirm?.type === 'delete'      ? 'This node will be permanently removed from your network.' :
          confirm?.type === 'bulk-delete' ? `${confirm.ids.length} nodes will be permanently removed.` :
          confirm?.type === 'expire'      ? 'The node key will expire and the node will need to re-authenticate.' :
                                            `${confirm?.ids.length} node keys will be expired.`
        }
        confirmLabel={confirm?.type.includes('delete') ? 'Delete' : 'Expire'}
        destructive={confirm?.type.includes('delete')}
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
      {addDeviceOpen && <AddDeviceModal onClose={() => setAddDeviceOpen(false)} />}
    </div>
  );
}
