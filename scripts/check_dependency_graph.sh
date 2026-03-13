#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo "[dependency-graph] Starting architecture boundary checks"

run_arch_checker_if_available() {
  local checker_path=""
  if [[ -f "qa/spec_tools/check_architecture_dependencies.py" ]]; then
    checker_path="qa/spec_tools/check_architecture_dependencies.py"
  elif [[ -f "framework/spec_tools/check_architecture_dependencies.py" ]]; then
    checker_path="framework/spec_tools/check_architecture_dependencies.py"
  fi

  if [[ -n "${checker_path}" && -f "spec/architecture/dependency-rules.json" ]]; then
    echo "[dependency-graph] Running architecture rules via ${checker_path}"
    python3 "${checker_path}" --rules "spec/architecture/dependency-rules.json"
  else
    echo "[dependency-graph] No local architecture checker + rules pair found; skipping rule-engine check"
  fi
}

run_repo_hygiene_scans() {
  python3 - <<'PY'
from pathlib import Path
import re
import sys

repo_root = Path.cwd()
scan_roots = ["backend", "frontend", "scripts", "qa", "framework"]
extensions = {".py", ".sh", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
skip_dirs = {".git", ".venv", "node_modules", "__pycache__", "dist", "build"}
ignore_files = {
    "scripts/check_dependency_graph.sh",
    "scripts/check_translation_ownership.sh",
    "qa/spec_tools/check_domain_sync.py",
    "qa/tests/generated/test_client_server_specs.py",
    "qa/tests/generated/test_server_specs.py",
}
patterns = [
    ("runtime sys.path mutation", re.compile(r"sys\.path\.(append|insert)\(")),
    ("hard-coded workspace path", re.compile(r"(/Users/|/Workspace/AppSpace/)")),
    (
        "sibling repository path coupling",
        re.compile(r"\.\./(AppModules|AppSpec|AppStack|TPLK-App|My-RPA|Chess-App|AppTest)\b"),
    ),
]

roots = [repo_root / name for name in scan_roots if (repo_root / name).exists()]
if not roots:
    roots = [repo_root]

violations: list[tuple[str, str, int, str]] = []
for root in roots:
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in extensions:
            continue
        if any(part in skip_dirs for part in path.parts):
            continue
        rel_path = path.relative_to(repo_root).as_posix()
        if rel_path in ignore_files:
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        lines = content.splitlines()
        for idx, line in enumerate(lines, start=1):
            for label, regex in patterns:
                if regex.search(line):
                    violations.append((label, rel_path, idx, line.strip()))

if violations:
    print("[dependency-graph] Text-based boundary check FAILED")
    for label, rel, line_no, line in violations:
        print(f"[dependency-graph] ERROR ({label}) {rel}:{line_no}: {line}")
    sys.exit(1)

print("[dependency-graph] Text-based boundary checks passed")
PY
}

run_arch_checker_if_available
run_repo_hygiene_scans
echo "[dependency-graph] Architecture boundary checks passed"
