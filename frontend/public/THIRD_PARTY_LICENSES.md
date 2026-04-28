# Third-Party Licenses

This file lists all external libraries and assets bundled with X2Chess and
shipped to end users, together with their license identifiers. Build-time-only
tools (compilers, type definitions, test frameworks) are listed separately and
are never included in a production artifact.

> **Maintenance obligation:** This file must be reviewed and updated whenever a
> new deployment is prepared. See `dev/rules/deployment-checklist.mdc`.

---

## 1 — Frontend JavaScript (shipped in every build)

| Package | Version | License |
|---|---|---|
| `react` | 19.2.4 | MIT |
| `react-dom` | 19.2.4 | MIT |
| `chessground` | 9.2.1 | GPL-3.0-or-later |
| `chess.js` | 1.4.0 | BSD-2-Clause |
| `@tauri-apps/api` | 2.10.1 | MIT OR Apache-2.0 |
| `@tauri-apps/plugin-log` | 2.8.0 | MIT OR Apache-2.0 |
| `@tauri-apps/plugin-process` | 2.3.1 | MIT OR Apache-2.0 |
| `@tauri-apps/plugin-updater` | 2.10.0 | MIT OR Apache-2.0 |

**Note on `chessground`:** the GPL-3.0 copyleft license applies to the bundled
JavaScript and any derivative works. The X2Chess desktop application is
distributed as a GPL-3.0-compatible product.

---

## 2 — Desktop binary Rust crates (desktop build only)

| Crate | Version | License |
|---|---|---|
| `tauri` | 2.10.3 | MIT OR Apache-2.0 |
| `tauri-plugin-log` | 2.8.0 | MIT OR Apache-2.0 |
| `tauri-plugin-process` | 2.3.1 | MIT OR Apache-2.0 |
| `tauri-plugin-updater` | 2.10.0 | MIT OR Apache-2.0 |
| `rfd` (native file dialogs) | 0.15.4 | MIT |
| `rusqlite` (SQLite bindings) | 0.32.1 | MIT |
| `serde_json` | 1.0.149 | MIT OR Apache-2.0 |
| `reqwest` (HTTP client) | 0.12.28 | MIT OR Apache-2.0 |
| `tokio` (async runtime) | 1.50.0 | MIT |
| `log` (logging facade) | 0.4.29 | MIT OR Apache-2.0 |
| `chrono` (date/time) | 0.4.44 | MIT OR Apache-2.0 |

---

## 3 — Build-time only (not shipped)

These packages are used at build or test time and are not present in any
production artifact. They are listed for completeness.

| Package | Version | License | Role |
|---|---|---|---|
| `typescript` | 5.9.3 | Apache-2.0 | Type checker |
| `vite` | 7.3.1 | MIT | Bundler |
| `@vitejs/plugin-react` | 4.7.0 | MIT | Vite React transform |
| `tsx` | 4.21.0 | MIT | TypeScript test runner |
| `@tauri-apps/cli` | 2.10.1 | MIT OR Apache-2.0 | Desktop build CLI |
| `@types/node` | 25.5.0 | MIT | Node type definitions |
| `@types/react` | 19.2.14 | MIT | React type definitions |
| `@types/react-dom` | 19.2.3 | MIT | React DOM type definitions |
| `ts-morph` | 27.0.2 | MIT | AST tooling (scripts) |
| `madge` | 8.0.0 | MIT | Circular dependency check |
| `fast-check` | 3.23.2 | MIT | Property-based testing |
| `tauri-build` | 2.x | MIT OR Apache-2.0 | Tauri build script |

---

## 4 — Static assets

| Asset | Location | License | Notes |
|---|---|---|---|
| Merida chess piece set (SVG) | `public/board-assets/img/pieces/merida/` | Public domain | Classic set by Armando Marroquin |
| `merida-blue.svg` board | `public/board-assets/img/boards/` | Unknown — needs verification | |
| Chess sound effects | `public/sounds/chess/` | Unknown — needs verification | |
| `canvaschess.js` | `public/canvaschess.js` | Unknown — needs verification | No copyright header found |

**Action required:** Items marked "Unknown — needs verification" must have their
origin and license confirmed before the next public release. Add the verified
details to this table and commit the result.

---

*Last updated: 2026-04-27. Versions reflect the production lock files
(`frontend/package-lock.json`, `frontend/src-tauri/Cargo.lock`).*
