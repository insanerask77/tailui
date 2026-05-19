# TailUI — Headscale Admin Dashboard

A self-hosted admin panel for [Headscale](https://github.com/juanfont/headscale) that replicates the Tailscale console experience.

## Features

| Page | Description |
|------|-------------|
| **Dashboard** | Overview stats (nodes, online count, users) + recent activity feed |
| **Nodes** | List, rename, expire, delete; bulk actions; real-time online/offline badges |
| **Users** | Create/rename/delete namespaces; move nodes between users |
| **Auth Keys** | Create pre-auth keys (reusable, ephemeral, tags, expiry); one-time copy modal; expire |
| **API Keys** | Create/revoke Headscale API keys; one-time copy modal |
| **Routes** | Enable/disable subnet routes; exit node detection and toggle |
| **DNS** | MagicDNS toggle, base domain, global nameservers, split DNS per-domain |
| **ACL** | HuJSON policy editor with syntax validation, save, last-modified timestamp |

Real-time node status updates via Server-Sent Events — no page reload needed.

## Architecture

```
Browser → nginx :80 ──→ React SPA (static files)
                   └──→ Fastify BFF :3001 (internal)
                                    └──→ Headscale API
```

**BFF pattern**: the frontend never holds the Headscale API key. The backend proxy authenticates requests using a JWT httpOnly cookie and forwards them to Headscale with the API key.

## Requirements

- Docker + Docker Compose v2
- A running Headscale instance reachable on the `hs-net` Docker network
- The `hs-net` Docker network must exist: `docker network create hs-net`

## Quick Start

### 1. Clone the repo

```bash
git clone <this-repo> tailui
cd tailui
```

### 2. Run the setup wizard

```bash
bash setup.sh
```

The wizard asks whether you want **development** or **production** mode.

#### Development mode
Spins up a local Headscale instance alongside TailUI — no domain or SSL needed. Good for testing.

#### Production mode (VPS + custom domain)
Full guided setup:
1. Asks for two subdomains (Headscale + TailUI)
2. Asks for Let's Encrypt email
3. Detects public IP and patches `headscale/config.yaml`
4. Generates a `Caddyfile` for automatic HTTPS
5. Prints firewall rules to run
6. Checks DNS propagation
7. Builds and starts all containers
8. Auto-generates the Headscale API key

### 3. Open the dashboard

- **Production:** `https://admin.your-domain.com`
- **Development:** `http://localhost:5173`

## Production: DNS & ports

### DNS records (two A records, same IP)

| Record | Points to |
|--------|-----------|
| `hs.example.com` | VPS public IP |
| `admin.example.com` | VPS public IP |

### Firewall ports

| Port | Protocol | Required | Purpose |
|------|----------|----------|---------|
| 80 | TCP | ✅ | HTTP → HTTPS redirect + Let's Encrypt |
| 443 | TCP | ✅ | HTTPS — Headscale control plane + TailUI |
| 443 | UDP | Optional | HTTP/3 |
| 41641 | UDP | Recommended | WireGuard direct connections (bypasses DERP relay) |
| 3478 | UDP | Optional | STUN — NAT traversal |

> Without 41641/udp, all VPN traffic goes through the embedded DERP relay (higher latency). Open it for the best performance.

```bash
# UFW
ufw allow 80/tcp && ufw allow 443 && ufw allow 41641/udp && ufw allow 3478/udp && ufw reload
```

### Clients connect with

```bash
tailscale up --login-server https://hs.example.com --authkey <key>
```

## Configuration Reference

All settings are in `.env`. See `.env.example` for documentation.

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADSCALE_URL` | `http://headscale:8080` | Headscale API base URL (Docker service name) |
| `HEADSCALE_API_KEY` | — | API key from `headscale apikeys create` |
| `HEADSCALE_CONFIG_PATH` | `/etc/headscale/config.yaml` | Path to headscale config (enables DNS page) |
| `ADMIN_USERNAME` | `admin` | Panel login username |
| `ADMIN_PASSWORD_HASH` | — | bcrypt hash of your password (set by wizard) |
| `SESSION_SECRET` | — | 64-char hex string for JWT signing (set by wizard) |
| `PORT` | `3001` | Backend listen port (internal) |
| `NODE_ENV` | `production` | `production` or `development` |
| `LOG_LEVEL` | `warn` | `warn` or `info` |

### DNS Management

Headscale 0.23+ removed the DNS REST API. TailUI reads and writes the headscale `config.yaml` directly. The file is mounted into the backend container automatically via `docker-compose.yml`.

After saving DNS changes in the UI, restart Headscale for them to take effect:

```bash
docker compose restart headscale   # if running with embedded headscale
# or restart your existing headscale instance
```

## Update

```bash
git pull
docker compose up -d --build
```

## Development

Start a local Headscale instance alongside the app for testing:

```bash
bash dev.sh
```

This uses `docker-compose.dev.yml` which adds a Headscale 0.23 container, creates test users (`dev`, `ops`), and generates an API key automatically. The frontend Vite dev server proxies `/api` and `/auth` to the backend.

Manual dev start (after `dev.sh` has populated `.env`):

```bash
# Terminal 1 — backend (hot reload)
cd backend && npm run dev

# Terminal 2 — frontend (Vite HMR)
cd frontend && npm run dev
```

## Compatibility

Tested with **Headscale 0.23.x**. The Headscale gRPC-Gateway REST API uses camelCase JSON fields throughout (`lastSeen`, `givenName`, `ipAddresses`, etc.).
