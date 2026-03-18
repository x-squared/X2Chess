#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> X2Chess: full macOS development setup"

bash "$REPO_ROOT/scripts/setup_tauri_toolchain_macos.sh"

echo "==> Installing frontend dependencies"
cd "$REPO_ROOT/frontend"
npm install

echo "==> Creating backend virtual environment"
cd "$REPO_ROOT/backend"
python3 -m venv .venv

echo "==> Ensuring runtime data folders"
mkdir -p "$REPO_ROOT/run/DEV" "$REPO_ROOT/run/TEST"

echo "==> Installing backend dependencies"
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

echo "==> Development setup complete"
echo ""
echo "Run web app:"
echo "  cd \"$REPO_ROOT/frontend\" && npm run dev"
echo ""
echo "Run backend:"
echo "  cd \"$REPO_ROOT/backend\" && source .venv/bin/activate && X2CHESS_RUN_SCENARIO=DEV uvicorn app.main:app --reload"
echo ""
echo "Run desktop app:"
echo "  cd \"$REPO_ROOT/frontend\" && npm run desktop:dev"
