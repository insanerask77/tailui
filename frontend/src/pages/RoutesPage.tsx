import { useMemo } from 'react';
import { Network, ArrowUpRight, Server, ToggleLeft, ToggleRight } from 'lucide-react';
import { useRoutes, useToggleRoute, isExitNodeRoute, type Route } from '../api/routes';
import { toast } from '../stores/toastStore';

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={disabled}
      className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 disabled:opacity-40 ${
        enabled ? 'bg-teal-600' : 'bg-gray-700'
      }`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
        enabled ? 'translate-x-4' : 'translate-x-0.5'
      }`} />
    </button>
  );
}

// ── Route row ─────────────────────────────────────────────────────────────────
function RouteRow({ route }: { route: Route }) {
  const toggle = useToggleRoute();
  const exitNode = isExitNodeRoute(route);

  async function handleToggle(enable: boolean) {
    try {
      await toggle.mutateAsync({ routeId: route.id, enable });
      toast.success(enable ? `Route ${route.prefix} enabled` : `Route ${route.prefix} disabled`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <tr className="border-b border-gray-800/50 last:border-0 hover:bg-gray-800/20 transition-colors">
      {/* Prefix */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <code className="font-mono text-sm text-gray-200">{route.prefix}</code>
          {exitNode && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
                             bg-purple-950 text-purple-300 border border-purple-800">
              <ArrowUpRight size={9} /> Exit node
            </span>
          )}
        </div>
      </td>
      {/* Advertised */}
      <td className="px-5 py-3.5">
        <span className={`text-xs ${route.advertised ? 'text-teal-400' : 'text-gray-500'}`}>
          {route.advertised ? 'Yes' : 'No'}
        </span>
      </td>
      {/* Enabled toggle */}
      <td className="px-5 py-3.5">
        <Toggle
          enabled={route.enabled}
          onChange={handleToggle}
          disabled={!route.advertised || toggle.isPending}
        />
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RoutesPage() {
  const { data: routes, isLoading, error } = useRoutes();

  const grouped = useMemo(() => {
    if (!routes) return [];
    const map = new Map<string, { node: Route['node']; routes: Route[] }>();
    for (const r of routes) {
      const key = r.node.id;
      if (!map.has(key)) map.set(key, { node: r.node, routes: [] });
      map.get(key)!.routes.push(r);
    }
    return [...map.values()].sort((a, b) => (a.node.givenName || a.node.name).localeCompare(b.node.givenName || b.node.name));
  }, [routes]);

  const exitCount = routes?.filter((r) => isExitNodeRoute(r) && r.enabled).length ?? 0;
  const enabledCount = routes?.filter((r) => r.enabled).length ?? 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Routes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Subnet routes and exit nodes</p>
        </div>
        <div className="flex gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1.5">
            <Network size={13} className="text-teal-400" />
            {enabledCount} enabled
          </span>
          {exitCount > 0 && (
            <span className="flex items-center gap-1.5">
              <ArrowUpRight size={13} className="text-purple-400" />
              {exitCount} exit node{exitCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-950/50 border border-red-800/50 text-sm text-red-300">
          {(error as Error).message}
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse">
              <div className="h-4 w-32 bg-gray-800 rounded mb-3" />
              <div className="h-4 w-48 bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && grouped.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
            <Network size={22} className="text-gray-500" />
          </div>
          <p className="text-sm text-gray-400">No routes advertised yet</p>
          <p className="text-xs text-gray-600 max-w-xs text-center">
            Routes appear here when a Tailscale client advertises subnet routes or exit node capability.
          </p>
        </div>
      )}

      {/* Route groups */}
      <div className="space-y-4">
        {grouped.map(({ node, routes: nodeRoutes }) => {
          const hasExitRoute = nodeRoutes.some(isExitNodeRoute);
          const enabledHere = nodeRoutes.filter((r) => r.enabled).length;
          return (
            <div key={node.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {/* Node header */}
              <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-800 bg-gray-800/40">
                <Server size={14} className="text-gray-400 flex-shrink-0" />
                <span className="font-medium text-white text-sm">{node.givenName || node.name}</span>
                {hasExitRoute && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs
                                   bg-purple-950 text-purple-300 border border-purple-800">
                    <ArrowUpRight size={9} /> Exit node capable
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-500">
                  {enabledHere}/{nodeRoutes.length} enabled
                </span>
              </div>

              {/* Routes table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800/60">
                    <th className="px-5 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prefix</th>
                    <th className="px-5 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advertised</th>
                    <th className="px-5 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <ToggleRight size={12} /> Enabled
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {nodeRoutes.map((r) => <RouteRow key={r.id} route={r} />)}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
