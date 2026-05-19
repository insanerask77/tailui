import { useState, useMemo } from 'react';
import { Search, Wifi, WifiOff, AlertCircle, Clock, Tag } from 'lucide-react';
import { useNodes, useUsers, type NodeRow } from '../api/nodes';
import { Skeleton } from '../components/Skeleton';

type StatusFilter = 'all' | 'online' | 'offline' | 'expired';

function relativeTime(iso: string): string {
  if (!iso || iso.startsWith('0001-')) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ node }: { node: NodeRow }) {
  if (node.expired) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
        Expired
      </span>
    );
  }
  if (node.online) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-teal-400">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0 animate-pulse" />
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 flex-shrink-0" />
      Offline
    </span>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-blue-950 text-blue-300 border border-blue-800">
          <Tag size={9} />
          {t.replace('tag:', '')}
        </span>
      ))}
    </div>
  );
}

export default function NodesPage() {
  const { data: nodes, isLoading, isError, error } = useNodes();
  const { data: users = [] } = useUsers();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [userFilter, setUserFilter] = useState('all');

  const filtered = useMemo(() => {
    if (!nodes) return [];
    return nodes.filter((n) => {
      if (statusFilter === 'online' && !n.online) return false;
      if (statusFilter === 'offline' && (n.online || n.expired)) return false;
      if (statusFilter === 'expired' && !n.expired) return false;
      if (userFilter !== 'all' && n.user.name !== userFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = n.given_name.toLowerCase().includes(q) || n.name.toLowerCase().includes(q);
        const matchIp = n.ip_addresses.some((ip) => ip.includes(q));
        if (!matchName && !matchIp) return false;
      }
      return true;
    });
  }, [nodes, search, statusFilter, userFilter]);

  const counts = useMemo(() => ({
    total: nodes?.length ?? 0,
    online: nodes?.filter((n) => n.online).length ?? 0,
    expired: nodes?.filter((n) => n.expired).length ?? 0,
  }), [nodes]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Nodes</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {isLoading ? 'Loading…' : `${counts.total} nodes · ${counts.online} online`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hostname or IP…"
            className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm
                       text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="expired">Expired</option>
        </select>

        {/* User filter */}
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.name}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* Error */}
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
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Hostname</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">IP</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">User</th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && [...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-gray-800/50">
                {[...Array(5)].map((_, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <Skeleton className="h-4" />
                  </td>
                ))}
              </tr>
            ))}

            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-500">
                  {nodes?.length === 0
                    ? 'No nodes registered yet. Register a Tailscale/Headscale client to get started.'
                    : 'No nodes match the current filters.'}
                </td>
              </tr>
            )}

            {!isLoading && filtered.map((node) => (
              <tr key={node.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-5 py-3.5">
                  <StatusBadge node={node} />
                </td>
                <td className="px-5 py-3.5">
                  <div className="font-medium text-white">{node.given_name || node.name}</div>
                  {node.given_name && node.given_name !== node.name && (
                    <div className="text-xs text-gray-500">{node.name}</div>
                  )}
                  <TagList tags={[...node.valid_tags, ...node.forced_tags]} />
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-gray-300">
                  {node.ip_addresses[0] ?? '—'}
                  {node.ip_addresses[1] && (
                    <div className="text-gray-500">{node.ip_addresses[1]}</div>
                  )}
                </td>
                <td className="px-5 py-3.5 text-gray-300">{node.user.name}</td>
                <td className="px-5 py-3.5 text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} />
                    {relativeTime(node.last_seen)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status summary footer */}
      {!isLoading && nodes && nodes.length > 0 && (
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Wifi size={11} className="text-teal-400" />{counts.online} online</span>
          <span className="flex items-center gap-1"><WifiOff size={11} />{counts.total - counts.online - counts.expired} offline</span>
          {counts.expired > 0 && (
            <span className="flex items-center gap-1 text-red-400"><AlertCircle size={11} />{counts.expired} expired</span>
          )}
          <span className="ml-auto">Auto-refresh every 15s</span>
        </div>
      )}
    </div>
  );
}
