#!/usr/bin/env bash
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RED="\033[0;31m"
RESET="\033[0m"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.dev.yml"

echo -e "${BOLD}${CYAN}TailUI — Dev Setup${RESET}"
echo ""

# ── Check dependencies ────────────────────────────────────────────────────
for cmd in docker openssl node; do
  if ! command -v "$cmd" &>/dev/null; then
    echo -e "${RED}ERROR: '$cmd' is required but not installed.${RESET}" >&2
    exit 1
  fi
done

# ── Overwrite guard ──────────────────────────────────────────────────────
if [[ -f .env ]]; then
  echo -e "${YELLOW}A .env file already exists.${RESET}"
  read -rp "Overwrite it and restart all services? [y/N] " overwrite
  if [[ "$overwrite" != "y" && "$overwrite" != "Y" ]]; then
    echo "Keeping existing .env. Starting services..."
    $COMPOSE up -d --build
    echo -e "${GREEN}Done.${RESET}"
    exit 0
  fi
fi

# ── Start Headscale first ────────────────────────────────────────────────
echo "Starting Headscale..."
$COMPOSE up -d headscale

echo -n "Waiting for Headscale to be healthy"
for i in $(seq 1 30); do
  if docker inspect tailui-headscale --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
    echo -e " ${GREEN}ready!${RESET}"
    break
  fi
  echo -n "."
  sleep 2
  if [[ $i -eq 30 ]]; then
    echo ""
    echo -e "${RED}Headscale did not become healthy after 60s.${RESET}"
    echo "Check logs: $COMPOSE logs headscale"
    exit 1
  fi
done

# ── Generate API key ─────────────────────────────────────────────────────
echo -n "Generating Headscale API key..."
API_KEY=$($COMPOSE exec -T headscale headscale apikeys create --expiration 90d 2>/dev/null | tr -d '\r\n ')
echo -e " ${GREEN}done${RESET}"

# ── Create seed users ────────────────────────────────────────────────────
echo "Creating seed users (dev, ops)..."
$COMPOSE exec -T headscale headscale users create dev  2>/dev/null && true
$COMPOSE exec -T headscale headscale users create ops  2>/dev/null && true

# ── Collect TailUI admin credentials ────────────────────────────────────
echo ""
echo -e "${BOLD}TailUI admin credentials:${RESET}"
read -rp "  Admin username [admin]: " ADMIN_USERNAME
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"

while true; do
  read -rsp "  Admin password: " ADMIN_PASSWORD; echo ""
  read -rsp "  Confirm password: " ADMIN_PASSWORD2; echo ""
  [[ "$ADMIN_PASSWORD" == "$ADMIN_PASSWORD2" ]] && break
  echo "  Passwords do not match, try again."
done

# ── Generate secrets ─────────────────────────────────────────────────────
SESSION_SECRET="$(openssl rand -hex 32)"

ADMIN_PASSWORD_HASH="$(node -e "
const path = require('path');
let bcrypt;
try {
  bcrypt = require(path.join(process.cwd(), 'backend/node_modules/bcryptjs'));
} catch {
  require('child_process').execSync('npm install --prefix /tmp/tailui-setup bcryptjs --silent 2>/dev/null');
  bcrypt = require('/tmp/tailui-setup/node_modules/bcryptjs');
}
bcrypt.hash('${ADMIN_PASSWORD}', 12).then(h => { process.stdout.write(h); });
")"

# ── Write .env ───────────────────────────────────────────────────────────
# printf %s prevents bash from interpreting $ in bcrypt hashes and secrets
{
  echo "HEADSCALE_URL=http://headscale:8080"
  echo "HEADSCALE_API_KEY=${API_KEY}"
  echo "ADMIN_USERNAME=${ADMIN_USERNAME}"
  printf 'ADMIN_PASSWORD_HASH_B64=%s\n' "$(printf '%s' "${ADMIN_PASSWORD_HASH}" | base64 -w0)"
  printf 'SESSION_SECRET=%s\n'      "${SESSION_SECRET}"
  echo "PORT=3001"
  echo "NODE_ENV=development"
  echo "LOG_LEVEL=info"
} > .env
echo -e "${GREEN}.env written.${RESET}"

# ── Start all services ───────────────────────────────────────────────────
echo ""
echo "Building and starting all services..."
$COMPOSE up -d --build

echo ""
echo -e "${GREEN}${BOLD}TailUI dev environment is running!${RESET}"
echo ""
echo -e "  Dashboard  → ${CYAN}http://localhost:5173${RESET}"
echo -e "  Headscale  → ${CYAN}http://localhost:8080${RESET}"
echo ""
echo -e "  Username   → ${CYAN}${ADMIN_USERNAME}${RESET}"
echo ""
echo -e "${BOLD}Useful commands:${RESET}"
echo "  $COMPOSE exec headscale headscale users list"
echo "  $COMPOSE exec headscale headscale nodes list"
echo "  $COMPOSE exec headscale headscale preauthkeys create --user dev --reusable"
echo "  $COMPOSE logs -f tailui-backend"
