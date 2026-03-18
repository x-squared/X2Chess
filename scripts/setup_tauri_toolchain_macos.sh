#!/usr/bin/env bash
set -euo pipefail

echo "==> X2Chess: macOS toolchain setup (Tauri prerequisites)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script currently supports macOS only."
  exit 1
fi

ensure_xcode_clt() {
  if xcode-select -p >/dev/null 2>&1; then
    echo "Xcode Command Line Tools: already installed"
    return
  fi
  echo "Xcode Command Line Tools: missing; triggering installer"
  xcode-select --install || true
  echo "Complete the Apple installer prompt, then rerun this script."
  exit 1
}

ensure_homebrew() {
  if command -v brew >/dev/null 2>&1; then
    echo "Homebrew: already installed"
    return
  fi
  echo "Homebrew: installing"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

ensure_brew_pkg() {
  local pkg="$1"
  if brew list --formula | rg -x "$pkg" >/dev/null 2>&1; then
    echo "$pkg: already installed"
  else
    echo "$pkg: installing"
    brew install "$pkg"
  fi
}

ensure_rust() {
  if command -v rustc >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
    echo "Rust toolchain: already installed"
    return
  fi
  echo "Rust toolchain: installing via rustup"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env"
}

ensure_xcode_clt
ensure_homebrew
ensure_brew_pkg node
ensure_brew_pkg python
ensure_rust

echo "==> Toolchain setup complete"
echo "Node:  $(node --version)"
echo "npm:   $(npm --version)"
echo "Python:$(python3 --version)"
echo "rustc: $(rustc --version)"
echo "cargo: $(cargo --version)"
