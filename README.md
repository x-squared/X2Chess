# X2Chess

A chess PGN editor and game management tool for macOS, Windows, and Linux.

Load games from PGN files or databases, navigate and annotate moves, analyse
positions with a chess engine, explore openings and tablebases, and train your
recall with built-in study and training modes.

---

## Install

Download the latest installer for your platform from the
[Releases page](https://github.com/x-squared/X2Chess/releases/latest):

| Platform | File to download |
|---|---|
| macOS (Apple Silicon) | `x2chess_*_aarch64.dmg` |
| macOS (Intel) | `x2chess_*_x64.dmg` |
| Windows | `x2chess_*_x64-setup.exe` |
| Linux | `x2chess_*_amd64.AppImage` |

The app checks for updates automatically at startup. When a new version is
available you will see a notification in the menu.

---

## Run from source

Requirements: [Node.js 20+](https://nodejs.org), [Rust stable](https://rustup.rs)

### Web (browser, no Tauri)

```bash
cd frontend
npm install
npm run dev
# open http://localhost:5287
```

### Desktop (Tauri, with hot-reload)

```bash
cd frontend
npm install
npm run desktop:dev
```

### Type-check and test

```bash
cd frontend
npm run typecheck
npm test
```

---

## Build a production desktop app

```bash
cd frontend
npm run build          # type-check + build frontend bundle
npm run desktop:pack   # build Tauri app; output in src-tauri/target/release/bundle
```

---

## Release a new version (maintainers)

1. Update the version number in two files:
   - `frontend/src-tauri/tauri.conf.json` → `"version": "X.Y.Z"`
   - `frontend/src-tauri/Cargo.toml` → `version = "X.Y.Z"`

2. Commit and push:
   ```bash
   git add frontend/src-tauri/tauri.conf.json frontend/src-tauri/Cargo.toml
   git commit -m "chore: bump version to X.Y.Z"
   git push
   ```

3. Tag the release (this triggers the build workflow):
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

4. Wait for the [release workflow](https://github.com/x-squared/X2Chess/actions)
   to finish (15–25 minutes for all four platforms).

5. Go to [Releases](https://github.com/x-squared/X2Chess/releases), review the
   draft, then click **Publish release**.

See `dev/plans/ota_updates_8d9e0f1a.plan.md` for the full update infrastructure
plan, and `doc/setup-manual.qmd` for first-time environment setup.

---

## First-time setup for releases

Before you can publish a release, do this **once**:

1. **Enable GitHub Pages** in repo Settings → Pages → Source: GitHub Actions.

2. **Generate a signing key:**
   ```bash
   cd frontend
   npx tauri signer generate -w ~/.tauri/x2chess.key
   ```
   Copy the printed public key into `frontend/src-tauri/tauri.conf.json`
   under `plugins.updater.pubkey`.

3. **Add secrets** to GitHub (Settings → Secrets → Actions):
   - `TAURI_SIGNING_PRIVATE_KEY` — the private key from step 2
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password you chose (can be empty)

Full instructions: `dev/plans/ota_updates_8d9e0f1a.plan.md` → Phase U0.

---

## Project layout

```
frontend/          TypeScript/React UI (Vite + Tauri)
resource/          Canonical resource library (TypeScript)
engines/           Chess engine integration (UCI)
boards/            Physical board integration (planned)
backend/           Lean 4 game-logic library
update-server/     GitHub Pages content: update manifest + rules
.github/workflows/ CI and release automation
doc/               Architecture docs and user manual
dev/               Rules, plans, and developer notes
```

See `CLAUDE.md` for codebase conventions and `doc/user-manual.qmd` for the
end-user guide.
