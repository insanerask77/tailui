#!/usr/bin/env bash
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
CYAN="\033[0;36m"
RESET="\033[0m"

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

# ── Check dependencies ───────────────────────────────────────────────────────
for cmd in docker openssl node; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' is required but not installed." >&2
    exit 1
  fi
done

# ── Overwrite guard ──────────────────────────────────────────────────────────
if [[ -f .env ]]; then
  echo -e "${YELLOW}A .env file already exists.${RESET}"
  read -rp "Overwrite it? [y/N] " overwrite
  if [[ "$overwrite" != "y" && "$overwrite" != "Y" ]]; then
    echo "Keeping existing .env. Launching services..."
    docker compose up -d --build
    echo -e "${GREEN}Done.${RESET}"
    exit 0
  fi
fi

# ── Collect required values ──────────────────────────────────────────────────
echo ""
echo -e "${BOLD}Required configuration:${RESET}"
echo ""

read -rp "  Headscale API key (headscale apikeys create): " HEADSCALE_API_KEY
while [[ -z "$HEADSCALE_API_KEY" ]]; do
  echo "  API key cannot be empty."
  read -rp "  Headscale API key: " HEADSCALE_API_KEY
done

read -rp "  Admin username [admin]: " ADMIN_USERNAME
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"

while true; do
  read -rsp "  Admin password: " ADMIN_PASSWORD
  echo ""
  read -rsp "  Confirm password: " ADMIN_PASSWORD2
  echo ""
  if [[ "$ADMIN_PASSWORD" == "$ADMIN_PASSWORD2" ]]; then
    break
  fi
  echo "  Passwords do not match, try again."
done

read -rp "  Headscale URL [http://headscale:8080]: " HEADSCALE_URL
HEADSCALE_URL="${HEADSCALE_URL:-http://headscale:8080}"

# ── Generate secrets ─────────────────────────────────────────────────────────
echo ""
echo "Generating secrets..."

SESSION_SECRET="$(openssl rand -hex 32)"

# bcryptjs must be available inside the backend image; for setup we use a
# quick inline node call (bcryptjs installed as dep of backend)
ADMIN_PASSWORD_HASH="$(node -e "
const path = require('path');
let bcrypt;
try {
  bcrypt = require(path.join(__dirname, 'backend/node_modules/bcryptjs'));
} catch {
  // fallback: install bcryptjs temporarily
  require('child_process').execSync('npm install --prefix /tmp/tailui-setup bcryptjs --silent 2>/dev/null');
  bcrypt = require('/tmp/tailui-setup/node_modules/bcryptjs');
}
bcrypt.hash('${ADMIN_PASSWORD}', 12).then(h => { process.stdout.write(h); });
")"

# ── Write .env ───────────────────────────────────────────────────────────────
# printf %s prevents bash from interpreting $ in bcrypt hashes and secrets
{
  echo "HEADSCALE_URL=${HEADSCALE_URL}"
  echo "HEADSCALE_API_KEY=${HEADSCALE_API_KEY}"
  echo "ADMIN_USERNAME=${ADMIN_USERNAME}"
  printf 'ADMIN_PASSWORD_HASH=%s\n' "${ADMIN_PASSWORD_HASH}"
  printf 'SESSION_SECRET=%s\n'      "${SESSION_SECRET}"
  echo "PORT=3001"
  echo "NODE_ENV=production"
  echo "LOG_LEVEL=warn"
} > .env

echo -e "${GREEN}.env written.${RESET}"

# ── Launch ───────────────────────────────────────────────────────────────────
echo ""
echo "Building and starting services..."
docker compose up -d --build

echo ""
echo -e "${GREEN}${BOLD}TailUI is running!${RESET}"
echo ""
echo -e "  Dashboard → ${CYAN}http://localhost:5173${RESET}"
echo -e "  Username  → ${CYAN}${ADMIN_USERNAME}${RESET}"
echo ""
echo -e "${YELLOW}Keep your .env file secure — it contains your API key.${RESET}"
