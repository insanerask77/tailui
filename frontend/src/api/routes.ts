import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface RouteNode {
  id: string;
  name: string;
  givenName: string;
}

export interface Route {
  id: string;
  node: RouteNode;
  prefix: string;
  advertised: boolean;
  enabled: boolean;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

const EXIT_PREFIXES = ['0.0.0.0/0', '::/0'];

export function isExitNodeRoute(route: Route): boolean {
  return EXIT_PREFIXES.includes(route.prefix);
}

async function fetchRoutes(): Promise<Route[]> {
  const res = await fetch('/api/routes');
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<Route[]>;
}

async function toggleRoute(routeId: string, enable: boolean): Promise<void> {
  const action = enable ? 'enable' : 'disable';
  const res = await fetch(`/api/routes/${routeId}/${action}`, { method: 'POST' });
  if (!res.ok) throw new Error((await res.json() as { error: string }).error);
}

export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: fetchRoutes,
    refetchInterval: 15_000,
  });
}

export function useToggleRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, enable }: { routeId: string; enable: boolean }) =>
      toggleRoute(routeId, enable),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] });
      qc.invalidateQueries({ queryKey: ['nodes'] });
    },
  });
}

export function useExitNodeIds(routes: Route[] | undefined): Set<string> {
  if (!routes) return new Set();
  return new Set(
    routes
      .filter((r) => isExitNodeRoute(r) && r.enabled)
      .map((r) => r.node.id),
  );
}
