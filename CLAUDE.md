# X2Chess — Claude Code Project Instructions

## Repository layout

```
X2Chess/
├── frontend/          TypeScript/React UI (Vite, Tauri-compatible)
│   ├── src/           Application source
│   │   ├── app_shell/ App-level bootstrap, i18n, game-info helpers
│   │   ├── board/     Board rendering and navigation (pure-logic)
│   │   ├── components/  React UI components
│   │   ├── editor/    PGN text editor (pure-logic + React components)
│   │   ├── game_sessions/ Session lifecycle (pure-logic)
│   │   ├── hooks/     React hooks (useAppStartup, useTranslator, …)
│   │   ├── model/     PGN model types and operations (pure-logic)
│   │   ├── resources/ Resource capabilities + source gateway (pure-logic)
│   │   ├── resources_viewer/ Resource viewer logic + viewer_utils (pure-logic)
│   │   ├── runtime/   Bootstrap helpers, pgn_model_update (pure-logic)
│   │   ├── services/  Thin service registries (resource_loader, …)
│   │   └── state/     React reducer, selectors, ServiceContext, AppContext
│   └── test/          Node test runner tests (tsx --test)
├── resource/          Top-level canonical resource library (TypeScript)
│   ├── adapters/      file, directory, db adapters
│   ├── client/        ResourceClient API + compatibility bridge
│   ├── database/      DB schema + migration runner
│   ├── domain/        Contracts, kinds, game_ref, resource_ref, metadata
│   └── io/            FsGateway, DbGateway, path_utils
├── backend/           Lean 4 game-logic library
├── doc/               Architecture ADRs (architecture-adr-manual.qmd)
├── dev/architecture/  Principles register + health log (continuous arch review)
└── scripts/           Build/tooling scripts
```

## Rules

Detailed coding rules live in `dev/rules/*.mdc`. **Read the relevant rule files
before working on frontend or resource code.** Key files:

| Rule file | When to read |
|---|---|
| `coding-style.mdc` | Any frontend TypeScript/TSX change |
| `typescript-strict-types.mdc` | Any TypeScript change |
| `component-contract.mdc` | Adding or editing a React component |
| `dual-target-architecture.mdc` | Resource, adapter, or build changes |
| `public-code-documentation.mdc` | Adding exported functions or modules |
| `regression-tests.mdc` | Bug fixes |
| `ui-style-and-theming.mdc` | CSS or UI changes |
| `i18n-gui-alignment.mdc` | Any user-facing string change |
| `manual-checklist-maintenance.mdc` | Any user-facing feature change |

The remaining rules govern manual/doc maintenance and are lower-priority for
code tasks but should be consulted when editing `doc/`.

## Key commands (run from `frontend/`)

```bash
npm run typecheck        # TypeScript type-check (no emit)
npm test                 # Run all tests  (tsx --test "test/**/*.test.ts")
npm run dev              # Vite dev server on :5287
npm run build            # Type-check + Vite production build
npm run desktop:dev      # Tauri dev (requires Rust toolchain)
```

## Architecture rules (ADR-013 + codebase conventions)

**Pure-logic modules** (`model/`, `editor/`, `board/`, `game_sessions/`,
`resources/`, `resources_viewer/`, `runtime/`, `resource/`) **must not** import
React, DOM APIs, or Tauri globals. Violations are critical bugs.

**React component modules** (`components/`, `hooks/`, `state/`, `app_shell/`)
may use React freely and may read from context, but must not reach into
pure-logic internal state directly.

**I/O injection**: Tauri `invoke` calls belong in the frontend integration point
(`resources/source_gateway.ts`) behind the `FsGateway` interface
(`resource/io/fs_gateway.ts`). Adapters receive an injected gateway.

**Single rendering owner**: all DOM output for a feature lives in exactly one
React component. Dual-ownership (component + imperative module both rendering
the same area) is a violation.

## Coding conventions

- TypeScript strict mode; avoid `any`, prefer `unknown` with narrowing.
- Explicit return types on exported functions.
- `type` imports for type-only imports.
- Pure functions return new values; never mutate arguments except where the
  function's contract explicitly documents mutation (legacy mutable state objects).
- No migration-history language in comments (no "Slice N", "legacy bridge",
  "imperative bootstrap removed" etc.).
- Marker syntax: `[[br]]` and `[[indent]]` only (not `\n`, `\i`, `<br>`).

## Architecture review (`dev/architecture/`)

- `principles.md` — 22 testable principles derived from ADR-001–013 and all rule files;
  each has a severity, verification method (automated or manual), and current status.
- `health-log.md` — rolling dated log of review findings against the principles register;
  append a new entry after each periodic review or major feature milestone.

**Review cadence:** monthly full scan + automated checks on each PR build.
**Automated subset:** grep-based checks for P01, P02, P08, P09, P15 via `scripts/arch-check.sh`
(to be created when violations are resolved; currently documents the "clean" target state).

## Plan files (`dev/plans/`)

- `state_management_refactor_b4f8a2c1.plan.md` — Tier 1+2 state fixes (shell pref triple-write, stale session metadata, session bypass, resource tab React state) — **implemented**
- `state_management_tier3_e7c2b1a9.plan.md` — Tier 3: per-session `GameSessionState` objects + `ActiveSessionRef` (eliminates snapshot dance) — **implemented**
- `codebase_health_7f3a91bc.plan.md` — 10-item health backlog (Items 1–8 done,
  Items 9–10 deferred)
- `tree_text_editor_convergence_5ac46f02.plan.md` — tree/text/plain editor
  convergence (implemented)
- `multi-source_game_refactor_9d9ff012.plan.md` — multi-source game loading
- `pgn-resource-library-refactor_c8b17631.plan.md` — resource library extraction
- `resource_docs_cleanup_f409e241.plan.md` — resource API docs compliance
- `full_react_rewrite_08d1b94a.plan.md` — React migration (completed)
- `developer_tools_toggle_7c98bd50.plan.md` — developer-tools toggle
- `database_resource_2e8f4c91.plan.md` — SQLite `.x2chess` resource (Phase 1+5 in progress)
- `resource_ext_databases_a1b2c3d4.plan.md` — external game/opening/endgame database integration
- `format_importers_a2b3c4d5.plan.md` — import-time converters for EPD, CBH/CBV, and other formats
- `engines_integration_e5f6a7b8.plan.md` — chess engine (UCI) integration; Maia-2 for training
- `training_mode_c9d0e1f2.plan.md` — training mode (Replay protocol + transcript/merge infrastructure)
- `training_move_acceptance_3e4f5a6b.plan.md` — move acceptance algorithm (NAG/RAV/eval/[%train] signals, extended MoveEvalResult, user manual)
- `move_entry_game_editing_b3c4d5e6.plan.md` — board-only move entry, variation forks, truncation, dirty flag
- `text_mode_layout_example_f7a8b9c0.plan.md` — text-mode layout example with `[[br]]`/`[[indent]]` markers
- `metadata_definition_system_d1e2f3a4.plan.md` — metadata schemas (types, dialog, export/import)
- `new_game_setup_e5f6a7b8.plan.md` — New Game dialog (standard / custom FEN, castling, Chess960)
- `resource_viewer_ux_c2d3e4f5.plan.md` — DnD fix, filter/group, position extraction, game kind, Q/A annotations
- `physical_boards_9a2b3c4d.plan.md` — physical chess board integration (Millennium ChessLink, DGT; USB + BLE)
- `web_import_5f6a7b8c.plan.md` — import positions/games from chess websites via rule-based URL adapters
- `ota_updates_8d9e0f1a.plan.md` — OTA update channels: full app updater (Tauri) + rules server (data-only)
- `game_links_f1a2b3c4.plan.md` — game-link annotations (`[%link recordId="..."]`) with chip rendering, hover preview, and open-in-new-tab navigation
- `game_anchors_b4c5d6e7.plan.md` — named anchors (`[%anchor id="..." text="..."]`) at half-moves with in-game references, rich anchor picker, and position-preview hover
- `board_shapes_3f4a5b6c.plan.md` — square highlights and arrows via `[%csl]`/`[%cal]` PGN annotations + programmatic overlay (training hints, engine arrows)
- `move_hints_hover_d4e5f6a7.plan.md` — hover-over-piece shows legal destination dots; engine-coloured dot variants (green/yellow/red) via `moveHintColors` prop
- `user_guide_c5d6e7f8.plan.md` — on-demand user-guiding framework: Guide-me button, spatial component targeting via `data-guide-id`, positioned help dialog, narrowing full-text search (Phase 3: AI chat companion)

## Key types / entry points

| Concern | File |
|---|---|
| App state (mutable legacy) | `src/app_shell/app_state.ts` |
| React reducer + actions | `src/state/app_reducer.ts`, `src/state/actions.ts` |
| All service wiring | `src/hooks/createAppServices.ts` |
| Startup hook | `src/hooks/useAppStartup.ts` |
| Service callbacks contract | `src/state/ServiceContext.tsx` |
| Resource viewer root | `src/components/ResourceViewer.tsx` |
| Viewer shared utilities/types | `src/resources_viewer/viewer_utils.ts` |
| PGN text/tree editor plan | `src/editor/text_editor_plan.ts` |
| Tree numbering | `src/editor/tree_numbering.ts` |
| Canonical resource client | `resource/client/api.ts` |
| Canonical metadata schema | `resource/domain/metadata_schema.ts` |

## Testing notes

Tests use Node's built-in test runner (`node:test`) via `tsx`.
No mocking framework — tests use real implementations or simple stubs.
Test files live under `frontend/test/` mirroring `src/` structure.
