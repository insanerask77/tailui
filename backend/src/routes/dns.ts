import { FastifyInstance } from 'fastify';
import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';

interface DnsConfig {
  magicDns: boolean;
  baseDomain: string;
  nameservers: string[];
  splitDns: Record<string, string[]>;
  searchDomains: string[];
}

function configPath(): string | null {
  return process.env.HEADSCALE_CONFIG_PATH ?? null;
}

function readConfig(): unknown {
  const p = configPath();
  if (!p) return null;
  try {
    return yaml.load(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function parseDnsConfig(raw: unknown): DnsConfig {
  const cfg = raw as Record<string, unknown>;
  const dns = (cfg?.dns ?? {}) as Record<string, unknown>;
  const ns = dns.nameservers as Record<string, unknown> ?? {};
  return {
    magicDns: (dns.magic_dns as boolean) ?? false,
    baseDomain: (dns.base_domain as string) ?? '',
    nameservers: (ns.global as string[]) ?? [],
    splitDns: (ns.split as Record<string, string[]>) ?? {},
    searchDomains: (dns.search_domains as string[]) ?? [],
  };
}

function writeConfig(raw: unknown, patch: Partial<DnsConfig>): void {
  const p = configPath();
  if (!p) throw new Error('HEADSCALE_CONFIG_PATH not set — cannot write config');

  const cfg = raw as Record<string, unknown>;
  const dns = (cfg.dns ?? {}) as Record<string, unknown>;
  const ns = (dns.nameservers ?? {}) as Record<string, unknown>;

  if (patch.magicDns !== undefined)    dns.magic_dns = patch.magicDns;
  if (patch.baseDomain !== undefined)  dns.base_domain = patch.baseDomain;
  if (patch.nameservers !== undefined) ns.global = patch.nameservers;
  if (patch.splitDns !== undefined)    ns.split = patch.splitDns;
  if (patch.searchDomains !== undefined) dns.search_domains = patch.searchDomains;

  dns.nameservers = ns;
  cfg.dns = dns;

  writeFileSync(p, yaml.dump(cfg, { lineWidth: 120 }), 'utf8');
}

export async function dnsRoutes(app: FastifyInstance) {
  // ── GET DNS config ────────────────────────────────────────────────────────
  app.get('/api/dns', async (_req, reply) => {
    const raw = readConfig();
    if (raw === null) {
      if (!configPath()) {
        return reply.code(501).send({
          error: 'HEADSCALE_CONFIG_PATH not set — DNS config not available',
        });
      }
      return reply.code(500).send({ error: 'Failed to read headscale config' });
    }
    return parseDnsConfig(raw);
  });

  // ── PATCH DNS config ──────────────────────────────────────────────────────
  app.patch('/api/dns', async (req, reply) => {
    const body = req.body as Partial<DnsConfig>;
    const raw = readConfig();
    if (raw === null) {
      if (!configPath()) {
        return reply.code(501).send({
          error: 'HEADSCALE_CONFIG_PATH not set — DNS config cannot be modified',
        });
      }
      return reply.code(500).send({ error: 'Failed to read headscale config' });
    }
    try {
      writeConfig(raw, body);
      return { ok: true, restartRequired: true };
    } catch (err) {
      return reply.code(500).send({ error: (err as Error).message });
    }
  });
}
