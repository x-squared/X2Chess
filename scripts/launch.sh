#!/usr/bin/env bash
# X2Chess dev launcher.  Prefers port 5287; falls back to 5288+ if occupied.
#
# Usage: scripts/launch.sh [desktop|desktop:isolated]
#        (default mode: desktop)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/../frontend" && pwd)"
BASE_PORT=5287

# ── Port selection ────────────────────────────────────────────────────────────

port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

PORT=$BASE_PORT
while port_in_use "$PORT"; do (( PORT++ )); done

[[ "$PORT" -ne "$BASE_PORT" ]] && echo "launch: :$BASE_PORT occupied; using :$PORT"

DEV_URL="http://localhost:$PORT"
echo "launch: starting on $DEV_URL"

# ── Launch ────────────────────────────────────────────────────────────────────

MODE=${1:-desktop}
cd "$FRONTEND_DIR"

tauri_config() {
  echo "{\"build\":{\"devUrl\":\"$DEV_URL\",\"beforeDevCommand\":\"npx vite --port $PORT --strictPort\"}}"
}

case "$MODE" in
  desktop|tauri)
    if [[ "$PORT" -eq "$BASE_PORT" ]]; then
      npm run desktop:dev
    else
      npx tauri dev --config "$(tauri_config)"
    fi
    ;;

  desktop:isolated)
    if [[ "$PORT" -eq "$BASE_PORT" ]]; then
      npm run desktop:dev:isolated
    else
      X2CHESS_WEBVIEW_DATA=../../run/DEV/webview-data \
        npx tauri dev --config "$(tauri_config)"
    fi
    ;;

  *)
    echo "usage: $(basename "$0") [desktop|desktop:isolated]" >&2
    exit 1
    ;;
esac
