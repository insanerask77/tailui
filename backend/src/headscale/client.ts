import type {
  HsNode, HsUser, HsPreAuthKey, HsRoute,
  HsApiKey, HsDnsConfig, HsPolicy,
} from './types';

function base() {
  const url = process.env.HEADSCALE_URL;
  if (!url) throw new Error('HEADSCALE_URL env var is required');
  return url;
}

function key() {
  const k = process.env.HEADSCALE_API_KEY;
  if (!k) throw new Error('HEADSCALE_API_KEY env var is required');
  return k;
}

async function hs<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${base()}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${key()}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Headscale ${res.status} ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Nodes ─────────────────────────────────────────────────────────────────
export const nodes = {
  list: () =>
    hs<{ nodes: HsNode[] }>('/node').then((r) => r.nodes ?? []),

  rename: (id: string, name: string) =>
    hs<{ node: HsNode }>(`/node/${id}/rename/${encodeURIComponent(name)}`, { method: 'POST' }),

  delete: (id: string) =>
    hs<Record<string, never>>(`/node/${id}`, { method: 'DELETE' }),

  expire: (id: string) =>
    hs<{ node: HsNode }>(`/node/${id}/expire`, { method: 'POST' }),

  setTags: (id: string, tags: string[]) =>
    hs<{ node: HsNode }>(`/node/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    }),

  move: (id: string, user: string) =>
    hs<{ node: HsNode }>(`/node/${id}/user?user=${encodeURIComponent(user)}`, { method: 'PUT' }),
};

// ── Users ─────────────────────────────────────────────────────────────────
export const users = {
  list: () =>
    hs<{ users: HsUser[] }>('/user').then((r) => r.users ?? []),

  create: (name: string) =>
    hs<{ user: HsUser }>('/user', { method: 'POST', body: JSON.stringify({ name }) }),

  rename: (oldName: string, newName: string) =>
    hs<{ user: HsUser }>(`/user/${encodeURIComponent(oldName)}/rename/${encodeURIComponent(newName)}`, {
      method: 'POST',
    }),

  delete: (name: string) =>
    hs<Record<string, never>>(`/user/${encodeURIComponent(name)}`, { method: 'DELETE' }),
};

// ── Pre-auth keys ─────────────────────────────────────────────────────────
export const preauthkeys = {
  list: (user: string) =>
    hs<{ preAuthKeys: HsPreAuthKey[] }>(`/preauthkey?user=${encodeURIComponent(user)}`)
      .then((r) => r.preAuthKeys ?? []),

  create: (params: {
    user: string;
    reusable: boolean;
    ephemeral: boolean;
    expiration: string;
    aclTags: string[];
  }) =>
    hs<{ preAuthKey: HsPreAuthKey }>('/preauthkey', {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  expire: (user: string, key: string) =>
    hs<Record<string, never>>('/preauthkey/expire', {
      method: 'POST',
      body: JSON.stringify({ user, key }),
    }),
};

// ── API keys ──────────────────────────────────────────────────────────────
export const apikeys = {
  list: () =>
    hs<{ apiKeys: HsApiKey[] }>('/apikey').then((r) => r.apiKeys ?? []),

  create: (expiration: string) =>
    hs<{ apiKey: string }>('/apikey', {
      method: 'POST',
      body: JSON.stringify({ expiration }),
    }),

  revoke: (prefix: string) =>
    hs<Record<string, never>>(`/apikey/${encodeURIComponent(prefix)}`, { method: 'DELETE' }),
};

// ── Routes ────────────────────────────────────────────────────────────────
export const routes = {
  list: () =>
    hs<{ routes: HsRoute[] }>('/routes').then((r) => r.routes ?? []),

  enable: (id: string) =>
    hs<{ route: HsRoute }>(`/routes/${id}/enable`, { method: 'POST' }),

  disable: (id: string) =>
    hs<{ route: HsRoute }>(`/routes/${id}/disable`, { method: 'POST' }),
};

// ── DNS ───────────────────────────────────────────────────────────────────
export const dns = {
  get: async (): Promise<HsDnsConfig> => {
    const [nameservers, splits, domains, magic, baseDomain] = await Promise.all([
      hs<{ nameservers: string[] }>('/dns/nameservers').then((r) => r.nameservers ?? []),
      hs<{ nameservers: Record<string, string[]> }>('/dns/split_dns').then((r) => r.nameservers ?? {}),
      hs<{ dns_search_domains: string[] }>('/dns/search_paths').then((r) => r.dns_search_domains ?? []),
      hs<{ enabled: boolean }>('/dns/magicDNS').then((r) => r.enabled),
      hs<{ magic_dns_base_domain: string }>('/dns/domains').then((r) => r.magic_dns_base_domain ?? ''),
    ]);
    return {
      nameservers,
      restricted_nameservers: splits,
      domains,
      magic_dns: magic,
      base_domain: baseDomain,
    };
  },
};

// ── Policy ────────────────────────────────────────────────────────────────
export const policy = {
  get: () => hs<HsPolicy>('/policy'),
  put: (p: string) =>
    hs<HsPolicy>('/policy', { method: 'PUT', body: JSON.stringify({ policy: p }) }),
};

// ── Online helper ─────────────────────────────────────────────────────────
const ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

export function isOnline(node: HsNode): boolean {
  if (!node.lastSeen) return false;
  return Date.now() - new Date(node.lastSeen).getTime() < ONLINE_THRESHOLD_MS;
}
