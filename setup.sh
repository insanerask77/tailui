#!/usr/bin/env bash
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
DIM="\033[2m"
RESET="\033[0m"

banner() {
  echo -e "${BOLD}${CYAN}"
  echo "  ████████╗ █████╗ ██╗██╗     ██╗   ██╗██╗"
  echo "     ██╔══╝██╔══██╗██║██║     ██║   ██║██║"
  echo "     ██║   ███████║██║██║     ██║   ██║██║"
  echo "     ██║   ██╔══██║██║██║     ██║   ██║██║"
  echo "     ██║   ██║  ██║██║███████╗╚██████╔╝██║"
  echo "     ╚═╝   ╚═╝  ╚═╝╚═╝╚══════╝ ╚═════╝ ╚═╝"
  echo -e "${RESET}"
  echo -e "${BOLD}Headscale Admin Dashboard — Setup Wizard${RESET}"
  echo ""
}

step() { echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"; }
ok()   { echo -e "  ${GREEN}✓${RESET} $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
err()  { echo -e "  ${RED}✗${RESET}  $1"; }

# ── Dependencies ─────────────────────────────────────────────────────────────
banner
for cmd in docker openssl node; do
  if ! command -v "$cmd" &>/dev/null; then
    err "'$cmd' is required but not installed."
    exit 1
  fi
done

# ── Overwrite guard ──────────────────────────────────────────────────────────
if [[ -f .env ]]; then
  warn "A .env file already exists."
  read -rp "  Overwrite it and reconfigure? [y/N] " ow
  if [[ "$ow" != "y" && "$ow" != "Y" ]]; then
    echo "  Keeping existing .env."
    read -rp "  Re-launch services now? [Y/n] " launch
    if [[ "$launch" != "n" && "$launch" != "N" ]]; then
      source .env 2>/dev/null || true
      COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml"
      [[ -f Caddyfile ]] && COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.prod.yml"
      [[ -f docker-compose.proxy.yml ]] && COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.proxy.yml"
      docker compose $COMPOSE_FILES up -d --build
    fi
    exit 0
  fi
fi

# ── Mode selection ────────────────────────────────────────────────────────────
step "Deployment mode"
echo ""
echo -e "  ${BOLD}1) Development${RESET}  — local machine, no SSL, Headscale on localhost"
echo -e "  ${BOLD}2) Production${RESET}   — VPS with a domain, automatic HTTPS via Let's Encrypt"
echo ""
read -rp "  Select [1/2]: " MODE
MODE="${MODE:-1}"

# ── Admin credentials (common) ────────────────────────────────────────────────
step "Admin credentials"
echo ""
read -rp "  Username [admin]: " ADMIN_USERNAME
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"

while true; do
  read -rsp "  Password: " ADMIN_PASSWORD; echo ""
  read -rsp "  Confirm:  " ADMIN_PASSWORD2; echo ""
  [[ "$ADMIN_PASSWORD" == "$ADMIN_PASSWORD2" ]] && break
  err "Passwords do not match, try again."
done

# ── Hash password ─────────────────────────────────────────────────────────────
ok "Hashing password…"
ADMIN_PASSWORD_HASH="$(node -e "
const path = require('path');
let bcrypt;
try {
  bcrypt = require(path.join(__dirname, 'backend/node_modules/bcryptjs'));
} catch {
  require('child_process').execSync('npm install --prefix /tmp/tailui-setup bcryptjs --silent 2>/dev/null');
  bcrypt = require('/tmp/tailui-setup/node_modules/bcryptjs');
}
bcrypt.hash('${ADMIN_PASSWORD}', 12).then(h => process.stdout.write(h));
")"
SESSION_SECRET="$(openssl rand -hex 32)"

# ═════════════════════════════════════════════════════════════════════════════
# DEVELOPMENT MODE
# ═════════════════════════════════════════════════════════════════════════════
if [[ "$MODE" == "1" ]]; then
  step "Development configuration"

  HEADSCALE_URL="http://headscale:8080"

  # Detect local IP for public URLs
  LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
  echo -e "  ${DIM}Detected local IP: ${LOCAL_IP}${RESET}"
  read -rp "  TailUI public URL [http://${LOCAL_IP}:5173]: " TAILUI_PUBLIC_URL
  TAILUI_PUBLIC_URL="${TAILUI_PUBLIC_URL:-http://${LOCAL_IP}:5173}"
  HEADSCALE_PUBLIC_URL="http://${LOCAL_IP}:8080"

  warn "In dev mode a temporary API key will be generated after Headscale starts."
  echo ""
  read -rp "  Corporate HTTP proxy (leave blank if none): " HTTP_PROXY_VAL
  COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml"
  [[ -n "$HTTP_PROXY_VAL" ]] && COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.proxy.yml"

  # Write .env (no API key yet — generated after first boot)
  {
    echo "HEADSCALE_URL=${HEADSCALE_URL}"
    echo "HEADSCALE_PUBLIC_URL=${HEADSCALE_PUBLIC_URL}"
    echo "TAILUI_PUBLIC_URL=${TAILUI_PUBLIC_URL}"
    echo "HEADSCALE_API_KEY="
    echo "ADMIN_USERNAME=${ADMIN_USERNAME}"
    printf 'ADMIN_PASSWORD_HASH_B64=%s\n' "$(printf '%s' "${ADMIN_PASSWORD_HASH}" | base64 -w0)"
    printf 'SESSION_SECRET=%s\n' "${SESSION_SECRET}"
    echo "PORT=3001"
    echo "NODE_ENV=development"
    echo "LOG_LEVEL=info"
  } > .env
  ok ".env written."

  step "Starting services"
  docker compose $COMPOSE_FILES up -d --build

  # Wait for Headscale to be ready and generate API key
  echo "  Waiting for Headscale to start…"
  for i in $(seq 1 30); do
    if docker exec tailui-headscale headscale version &>/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  API_KEY="$(docker exec tailui-headscale headscale apikeys create --expiration 365d 2>/dev/null)"
  if [[ -n "$API_KEY" ]]; then
    # Update HEADSCALE_API_KEY in .env
    sed -i "s|^HEADSCALE_API_KEY=.*|HEADSCALE_API_KEY=${API_KEY}|" .env
    docker compose $COMPOSE_FILES up -d tailui-backend
    ok "API key generated and saved."
  else
    warn "Could not auto-generate API key. Run manually:"
    echo "    docker exec tailui-headscale headscale apikeys create --expiration 365d"
    echo "  Then update HEADSCALE_API_KEY in .env and restart:"
    echo "    docker compose $COMPOSE_FILES up -d tailui-backend"
  fi

  echo ""
  echo -e "${GREEN}${BOLD}TailUI is running!${RESET}"
  echo ""
  echo -e "  Dashboard → ${CYAN}http://localhost:5173${RESET}"
  echo -e "  Username  → ${CYAN}${ADMIN_USERNAME}${RESET}"
  echo ""
  echo -e "${DIM}To add devices:  tailscale up --login-server http://localhost:8080 --authkey <key>${RESET}"
  exit 0
fi

# ═════════════════════════════════════════════════════════════════════════════
# PRODUCTION MODE
# ═════════════════════════════════════════════════════════════════════════════

step "Domain configuration"
echo ""
echo -e "  ${DIM}You need two DNS A records pointing to this server's public IP.${RESET}"
echo -e "  ${DIM}Example:  hs.example.com   →  1.2.3.4${RESET}"
echo -e "  ${DIM}          admin.example.com →  1.2.3.4${RESET}"
echo ""

read -rp "  Headscale subdomain   (e.g. hs.example.com): " HEADSCALE_DOMAIN
while [[ -z "$HEADSCALE_DOMAIN" ]]; do
  err "Domain cannot be empty."
  read -rp "  Headscale subdomain: " HEADSCALE_DOMAIN
done

read -rp "  TailUI subdomain      (e.g. admin.example.com): " TAILUI_DOMAIN
while [[ -z "$TAILUI_DOMAIN" ]]; do
  err "Domain cannot be empty."
  read -rp "  TailUI subdomain: " TAILUI_DOMAIN
done

step "Let's Encrypt (HTTPS)"
echo ""
echo -e "  ${DIM}Caddy will automatically obtain and renew SSL certificates.${RESET}"
read -rp "  Email for cert notifications: " ACME_EMAIL
ACME_EMAIL="${ACME_EMAIL:-}"

step "Public IP"
echo ""
DETECTED_IP="$(curl -4sf --max-time 5 https://api.ipify.org 2>/dev/null || curl -4sf --max-time 5 https://ifconfig.me 2>/dev/null || echo '')"
if [[ -n "$DETECTED_IP" ]]; then
  echo -e "  Detected public IP: ${CYAN}${DETECTED_IP}${RESET}"
  read -rp "  Use this IP? [Y/n] " use_detected
  if [[ "$use_detected" == "n" || "$use_detected" == "N" ]]; then
    read -rp "  Enter VPS public IP: " PUBLIC_IP
  else
    PUBLIC_IP="$DETECTED_IP"
  fi
else
  read -rp "  Enter VPS public IP: " PUBLIC_IP
fi

step "Headscale API key"
echo ""
echo -e "  ${DIM}If this is a first install, start the stack first, then generate the key:${RESET}"
echo -e "  ${DIM}  docker exec tailui-headscale headscale apikeys create --expiration 365d${RESET}"
echo ""
read -rp "  API key (leave blank to configure later): " HEADSCALE_API_KEY
HEADSCALE_API_KEY="${HEADSCALE_API_KEY:-}"

# ── Update headscale config.yaml ──────────────────────────────────────────────
step "Updating Headscale config"
if [[ -f headscale/config.yaml ]]; then
  # Update server_url to use HTTPS domain
  sed -i "s|^server_url:.*|server_url: https://${HEADSCALE_DOMAIN}|" headscale/config.yaml
  # Update embedded DERP public IP
  sed -i "s|^    ipv4:.*|    ipv4: ${PUBLIC_IP}|" headscale/config.yaml
  ok "headscale/config.yaml updated (server_url + DERP IP)."
else
  warn "headscale/config.yaml not found — skipping."
fi

# ── Proxy detection ───────────────────────────────────────────────────────────
step "Proxy detection"
PROXY_LINE=""
if [[ -n "${http_proxy:-}" ]] || [[ -n "${HTTP_PROXY:-}" ]]; then
  DETECTED_PROXY="${http_proxy:-${HTTP_PROXY:-}}"
  warn "Corporate proxy detected: ${DETECTED_PROXY}"
  COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.prod.yml -f docker-compose.proxy.yml"
  PROXY_LINE="  # Corporate proxy detected — docker-compose.proxy.yml included"
else
  read -rp "  Corporate HTTP proxy (leave blank if none): " PROXY_VAL
  if [[ -n "$PROXY_VAL" ]]; then
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.prod.yml -f docker-compose.proxy.yml"
  else
    COMPOSE_FILES="-f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.prod.yml"
  fi
fi
COMPOSE_FILES="${COMPOSE_FILES:-"-f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.prod.yml"}"

# ── Generate Caddyfile ────────────────────────────────────────────────────────
step "Generating Caddyfile"

ACME_BLOCK=""
[[ -n "$ACME_EMAIL" ]] && ACME_BLOCK="  email ${ACME_EMAIL}"

cat > Caddyfile <<CADDYEOF
{
${ACME_BLOCK}
}

# Headscale control plane
${HEADSCALE_DOMAIN} {
    reverse_proxy headscale:8080
}

# TailUI admin panel
${TAILUI_DOMAIN} {
    reverse_proxy tailui-frontend:80
}
CADDYEOF
ok "Caddyfile written."

# ── Write .env ────────────────────────────────────────────────────────────────
step "Writing .env"
{
  echo "HEADSCALE_URL=http://headscale:8080"
  echo "HEADSCALE_PUBLIC_URL=https://${HEADSCALE_DOMAIN}"
  echo "TAILUI_PUBLIC_URL=https://${TAILUI_DOMAIN}"
  echo "HEADSCALE_DOMAIN=${HEADSCALE_DOMAIN}"
  echo "TAILUI_DOMAIN=${TAILUI_DOMAIN}"
  echo "ACME_EMAIL=${ACME_EMAIL}"
  echo "HEADSCALE_API_KEY=${HEADSCALE_API_KEY}"
  echo "ADMIN_USERNAME=${ADMIN_USERNAME}"
  printf 'ADMIN_PASSWORD_HASH_B64=%s\n' "$(printf '%s' "${ADMIN_PASSWORD_HASH}" | base64 -w0)"
  printf 'SESSION_SECRET=%s\n' "${SESSION_SECRET}"
  echo "PORT=3001"
  echo "NODE_ENV=production"
  echo "LOG_LEVEL=warn"
} > .env
ok ".env written."

# ── Firewall guide ────────────────────────────────────────────────────────────
step "Firewall rules"
echo ""
echo -e "  ${BOLD}Open these ports on your VPS:${RESET}"
echo ""
echo -e "  ${CYAN}# UFW (Ubuntu/Debian)${RESET}"
echo    "  ufw allow 80/tcp    # HTTP  (Let's Encrypt + redirect)"
echo    "  ufw allow 443/tcp   # HTTPS (Headscale control plane + TailUI)"
echo    "  ufw allow 443/udp   # HTTP/3"
echo    "  ufw allow 41641/udp # WireGuard (direct peer connections)"
echo    "  ufw allow 3478/udp  # STUN (NAT traversal)"
echo    "  ufw reload"
echo ""
echo -e "  ${CYAN}# iptables${RESET}"
echo    "  iptables -A INPUT -p tcp --dport 80 -j ACCEPT"
echo    "  iptables -A INPUT -p tcp --dport 443 -j ACCEPT"
echo    "  iptables -A INPUT -p udp --dport 443 -j ACCEPT"
echo    "  iptables -A INPUT -p udp --dport 41641 -j ACCEPT"
echo    "  iptables -A INPUT -p udp --dport 3478 -j ACCEPT"
echo ""
echo -e "  ${DIM}Note: 41641/udp is optional but strongly recommended — without it${RESET}"
echo -e "  ${DIM}all traffic goes through the DERP relay (higher latency).${RESET}"
echo ""
read -rp "  Press Enter to continue with the build… "

# ── DNS check ─────────────────────────────────────────────────────────────────
step "DNS propagation check"
for domain in "$HEADSCALE_DOMAIN" "$TAILUI_DOMAIN"; do
  RESOLVED="$(dig +short "$domain" 2>/dev/null | head -1 || nslookup "$domain" 2>/dev/null | awk '/^Address:/{print $2}' | tail -1 || echo '')"
  if [[ "$RESOLVED" == "$PUBLIC_IP" ]]; then
    ok "${domain} → ${RESOLVED}"
  elif [[ -n "$RESOLVED" ]]; then
    warn "${domain} → ${RESOLVED} (expected ${PUBLIC_IP} — DNS may not have propagated yet)"
  else
    warn "${domain} did not resolve — make sure DNS A records are set before starting"
  fi
done

# ── Launch ────────────────────────────────────────────────────────────────────
step "Building and starting services"
docker compose $COMPOSE_FILES up -d --build

# If no API key was provided, wait for Headscale and generate one
if [[ -z "$HEADSCALE_API_KEY" ]]; then
  echo "  Waiting for Headscale to start…"
  for i in $(seq 1 30); do
    if docker exec tailui-headscale headscale version &>/dev/null 2>&1; then break; fi
    sleep 2
  done
  API_KEY="$(docker exec tailui-headscale headscale apikeys create --expiration 365d 2>/dev/null)"
  if [[ -n "$API_KEY" ]]; then
    sed -i "s|^HEADSCALE_API_KEY=.*|HEADSCALE_API_KEY=${API_KEY}|" .env
    docker compose $COMPOSE_FILES up -d tailui-backend 2>/dev/null
    ok "API key generated and saved to .env."
  else
    warn "Could not auto-generate API key. Run manually after Headscale is healthy:"
    echo "    docker exec tailui-headscale headscale apikeys create --expiration 365d"
    echo "  Then: sed -i 's|^HEADSCALE_API_KEY=.*|HEADSCALE_API_KEY=<KEY>|' .env"
    echo "  Then: docker compose $COMPOSE_FILES up -d tailui-backend"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║           TailUI is running! 🎉             ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  TailUI dashboard  → ${CYAN}https://${TAILUI_DOMAIN}${RESET}"
echo -e "  Headscale server  → ${CYAN}https://${HEADSCALE_DOMAIN}${RESET}"
echo -e "  Username          → ${CYAN}${ADMIN_USERNAME}${RESET}"
echo ""
echo -e "${BOLD}To add devices:${RESET}"
echo -e "  ${DIM}tailscale up --login-server https://${HEADSCALE_DOMAIN} --authkey <key>${RESET}"
echo ""
echo -e "${BOLD}Useful commands:${RESET}"
echo -e "  ${DIM}docker compose $COMPOSE_FILES ps${RESET}"
echo -e "  ${DIM}docker compose $COMPOSE_FILES logs -f${RESET}"
echo -e "  ${DIM}docker compose $COMPOSE_FILES down${RESET}"
echo ""
echo -e "${YELLOW}Keep .env secure — it contains your API key and session secret.${RESET}"
