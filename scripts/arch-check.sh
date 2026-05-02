#!/usr/bin/env bash
# Automated architecture boundary checks for X2Chess.
# Enforces principles P01, P02, P08, P09, P15 from dev/architecture/principles.md.
# Exits 0 when all checks pass; exits 1 and reports violations on any failure.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

FAILURES=0

check() {
  local id=$1 desc=$2
  shift 2
  local hits
  hits=$("$@" 2>/dev/null || true)
  if [[ -n "$hits" ]]; then
    echo "FAIL [$id] $desc"
    echo "$hits" | sed 's/^/     /'
    (( FAILURES++ )) || true
  else
    echo "ok   [$id] $desc"
  fi
}

# P01 — Pure-logic modules must not import React, DOM APIs, or Tauri globals.
# board/ intentionally attaches DOM event listeners (gesture + hover); that
# is a known violation tracked separately. Only non-board pure-logic dirs here.
check P01 "Pure-logic modules are framework-free" \
  grep -rln \
    --include="*.ts" --include="*.tsx" \
    "document\.\|innerHTML\|addEventListener\|from 'react'\|from \"react\"" \
    frontend/src/model frontend/src/editor \
    frontend/src/game_sessions frontend/src/resources \
    frontend/src/resources_viewer frontend/src/runtime \
    resource/

# P02 — Tauri invoke() must not appear inside resource/.
check P02 "Tauri invoke() absent from resource/" \
  grep -rn "invoke(" resource/

# P08 — resource/ must not import from frontend/ or backend/.
check P08 "resource/ has no imports from frontend/ or backend/" \
  grep -rn \
    --include="*.ts" \
    "from.*frontend/\|from.*\.\./\.\./frontend\|from.*backend/" \
    resource/

# P09 — SQL DDL belongs in resource/database/ only; not in frontend/src/.
check P09 "No SQL DDL in frontend/src/" \
  grep -rn \
    --include="*.ts" --include="*.tsx" \
    "CREATE TABLE\|ALTER TABLE" \
    frontend/src/

# P15 — No explicit `any` in production TypeScript (test/ excluded).
check P15 "No explicit 'any' in production source" \
  grep -rn \
    --include="*.ts" --include="*.tsx" \
    ": any\b\|as any\b" \
    frontend/src/ resource/

echo
if [[ "$FAILURES" -eq 0 ]]; then
  echo "All architecture checks passed."
else
  echo "$FAILURES check(s) failed."
  exit 1
fi
