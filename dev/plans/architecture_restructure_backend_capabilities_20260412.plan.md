---
name: Architecture Restructure — Target Layout + Backend Capability Boundary
overview: Define a target architecture and migration path that keeps Tauri as the app runtime, treats the backend as an optional capability provider, preserves `parts/` as the portable core, and reorganizes `frontend/src/` into clearer ownership boundaries.
todos:
  - id: define-target-layers
    content: Establish the target four-layer architecture and the dependency rules between `app`, `features`, `platform`, and `parts`.
    status: done
  - id: define-backend-role
    content: Define the backend as an optional capability provider rather than the primary runtime host for the app.
    status: done
  - id: define-target-directory-layout
    content: Specify the target directory structure for `frontend/src/` and `backend/app/`.
    status: done
  - id: define-capability-interfaces
    content: Identify the core capability interfaces needed to prevent Tauri/backend transport leakage into feature code.
    status: done
  - id: map-current-to-target
    content: Provide a first-pass mapping from the current major files/directories to the target layout.
    status: done
  - id: define-migration-phases
    content: Break the restructure into safe phases with a recommended order of execution.
    status: done
  - id: define-first-wave-refactor
    content: Identify the smallest high-leverage first refactor slice that can start immediately.
    status: done
isProject: true
---

# Architecture Restructure — Target Layout + Backend Capability Boundary

## Why this plan exists

The current codebase has a stronger architecture than its directory layout suggests:

- `parts/` already acts like a portable library layer.
- `frontend/` already contains runtime integration, feature logic, and app shell concerns.
- Tauri is the actual app runtime.
- `backend/` exists and is expected to provide additional capabilities later, but not host the app.

The problem is not the absence of architectural ideas. The problem is that the code layout and
runtime boundaries do not make those ideas obvious or consistently enforceable.

This plan proposes a target structure that:

1. keeps **Tauri** as the app runtime and local integration layer,
2. keeps **`parts/`** as the framework-free core,
3. treats the **backend** as an optional capability provider,
4. separates **feature code** from **runtime/platform code**, and
5. makes ownership clearer so the codebase is easier to navigate and evolve.

---

## Architectural position

### Runtime model

- **Desktop runtime:** Tauri is the primary runtime host for the shipping app.
- **Browser runtime:** the web build remains a supported fat-client mode where feasible.
- **Backend runtime:** the backend is not the app host. It provides optional capabilities such as:
  - hot replacement of artefacts,
  - access to chess libraries / engines / analysis helpers,
  - future auxiliary services that do not need to own the UI process.

### Core rule

The app must remain usable without the backend for core local workflows:

- open and edit PGN,
- navigate sessions,
- manage local resources,
- save/load local state,
- use desktop integrations supplied by Tauri.

Backend-powered features should be explicit, optional, and degradable.

---

## Target layers

The target architecture has four main layers.

### Layer 1 — `parts/`

Portable domain and library code.

Examples:

- PGN parsing / serialization
- canonical resource contracts
- DB schema and migrations for the resource library
- engine protocol helpers
- board protocol helpers

Rules:

- no React
- no DOM
- no Tauri imports
- no backend transport imports
- no dependency on `frontend/`

### Layer 2 — `frontend/src/platform/`

Runtime- and transport-specific adapters.

Examples:

- Tauri command gateways
- native dialogs
- desktop FS/DB adapters
- backend HTTP/WebSocket clients
- browser-only fallbacks

Rules:

- may depend on `parts/`
- must not contain feature UI logic
- should expose stable capability APIs to `core/` and `features/`

### Layer 3 — `frontend/src/features/`

Feature-oriented application code.

Examples:

- editor
- resources
- sessions
- analysis
- training
- settings

Rules:

- may depend on `parts/`, `platform/`, and `core/`
- should not import raw Tauri or raw backend transport directly
- should consume capability interfaces and app services

### Layer 4 — `frontend/src/app/`

Bootstrap and top-level composition.

Examples:

- `main.tsx`
- app providers
- startup bootstrapping
- top-level shell composition

Rules:

- owns app startup and top-level wiring
- should not accumulate feature-specific orchestration over time

---

## Target dependency rules

These should eventually be encoded into automated checks.

| From | May import | Must not import |
|---|---|---|
| `parts/` | other `parts/` modules | `frontend/`, `backend/`, Tauri, React |
| `frontend/src/platform/` | `parts/` | `frontend/src/features/*` |
| `frontend/src/core/` | `parts/`, `frontend/src/platform/` | feature UI components |
| `frontend/src/features/` | `parts/`, `frontend/src/platform/`, `frontend/src/core/` | raw transport APIs |
| `frontend/src/app/` | `features/`, `core/`, `platform/`, `parts/` | feature internals by deep relative coupling where avoidable |
| `backend/` | backend-local modules, backend libraries | `frontend/` |

Additional boundary rules:

- `@tauri-apps/*` imports belong under `frontend/src/platform/desktop/` unless there is a deliberate and documented exception.
- backend HTTP/WebSocket libraries belong under `frontend/src/platform/backend/`.
- capability contracts belong under `frontend/src/core/contracts/`.

---

## Target directory structure

## `frontend/src/`

```text
frontend/src/
  app/
    App.tsx
    main.tsx
    providers/
    startup/
    shell/

  core/
    contracts/
    services/
    orchestration/
    state/
    utils/

  platform/
    desktop/
      tauri/
      fs/
      db/
      dialogs/
      updater/
      storage/
    backend/
      client/
      chess_services/
      hotreload/
      artifacts/
    browser/
      storage/
      fallback/

  features/
    editor/
      components/
      hooks/
      services/
      model/
    sessions/
      components/
      hooks/
      services/
      guards/
    resources/
      components/
      hooks/
      services/
      gateways/
      web_import/
      metadata/
    analysis/
      components/
      hooks/
      services/
    training/
      components/
      hooks/
      services/
      protocols/
    settings/
      components/
      hooks/
      services/

  ui/
    components/
    dialogs/
    badges/
    board/
    styles/
```

### Notes

- `app/` is the composition root.
- `core/` contains the app’s internal service contracts and orchestration, not UI.
- `platform/` owns runtime-specific code.
- `features/` owns business/application behavior by feature area.
- `ui/` holds truly shared presentational components that are not feature-owned.

## `backend/app/`

```text
backend/app/
  api/
  chess_services/
  hotreload/
  artifacts/
  runtime/
```

### Backend notes

- `api/` owns transport-facing route/controller modules.
- `chess_services/` owns integrations with chess libraries and advanced analysis helpers.
- `hotreload/` owns artefact replacement and update-like support behavior.
- `artifacts/` owns domain-specific artefact handling.
- `runtime/` owns startup/config/environment concerns.

The backend should be organized by capability area first, transport details second.

---

## Capability interface model

To prevent Tauri and backend calls from leaking upward, the app should introduce stable
capability interfaces under `frontend/src/core/contracts/`.

Examples:

```ts
export type StorageGateway = {
  exportSnapshot(data: Record<string, string>): Promise<void>;
  importSnapshot(): Promise<Record<string, string> | null>;
};

export type ArtifactHotreloadGateway = {
  replaceArtifact(id: string, payload: unknown): Promise<void>;
};

export type ChessLibraryGateway = {
  analyzePosition(input: { fen: string; moves: string[] }): Promise<unknown>;
  probeTablebase(fen: string): Promise<unknown>;
};
```

Implementations can then live in:

- `platform/desktop/...`
- `platform/backend/...`
- `platform/browser/...`

Feature code consumes interfaces, not transport libraries.

---

## Current-to-target mapping

This is a first-pass mapping, not a promise that every file moves 1:1 exactly as written.

### App bootstrap and shell

| Current | Target |
|---|---|
| `frontend/src/main.tsx` | `frontend/src/app/main.tsx` |
| `frontend/src/App.tsx` | `frontend/src/app/App.tsx` |
| `frontend/src/components/shell/AppShell.tsx` | `frontend/src/app/shell/AppShell.tsx` |
| `frontend/src/hooks/useAppStartup.ts` | `frontend/src/app/startup/useAppStartup.ts` |
| `frontend/src/hooks/useTauriMenu.ts` | `frontend/src/platform/desktop/tauri/useTauriMenu.ts` or `frontend/src/app/startup/useDesktopMenu.ts` depending on final ownership |

### Core services / orchestration / state

| Current | Target |
|---|---|
| `frontend/src/hooks/createAppServices.ts` | `frontend/src/core/services/createAppServices.ts` |
| `frontend/src/hooks/session_orchestrator.ts` | split across `frontend/src/core/orchestration/` and `frontend/src/core/services/` |
| `frontend/src/state/actions.ts` | `frontend/src/core/state/actions.ts` |
| `frontend/src/state/app_reducer.ts` | `frontend/src/core/state/app_reducer.ts` |
| `frontend/src/state/app_context.tsx` | `frontend/src/app/providers/AppStateProvider.tsx` |
| `frontend/src/state/ServiceContext.tsx` | `frontend/src/app/providers/ServiceProvider.tsx` and/or `frontend/src/core/contracts/app_services.ts` |

### Platform: desktop / browser / backend

| Current | Target |
|---|---|
| `frontend/src/resources/tauri_gateways.ts` | `frontend/src/platform/desktop/tauri/tauri_gateways.ts` |
| direct `invoke(...)` usage in orchestration/hooks | adapter behind `frontend/src/platform/desktop/...` |
| future backend clients | `frontend/src/platform/backend/client/` and feature-specific backend capability wrappers |

### Feature: resources

| Current | Target |
|---|---|
| `frontend/src/resources/source_gateway.ts` | `frontend/src/features/resources/gateways/source_gateway.ts` or split between feature and platform adapters |
| `frontend/src/resources/source_picker_adapter.ts` | `frontend/src/features/resources/gateways/source_picker_adapter.ts` |
| `frontend/src/resources/web_import/*` | `frontend/src/features/resources/web_import/*` |
| `frontend/src/components/resource_viewer/*` | `frontend/src/features/resources/components/*` |
| `frontend/src/components/web_import/*` | `frontend/src/features/resources/components/*` |
| `frontend/src/components/metadata/*` | `frontend/src/features/resources/metadata/*` |

### Feature: editor

| Current | Target |
|---|---|
| `frontend/src/components/game_editor/*` | `frontend/src/features/editor/components/*` |
| `frontend/src/editor/*` | split between `frontend/src/features/editor/model/`, `services/`, and `hooks/` |
| `frontend/src/components/anchors/*` | `frontend/src/features/editor/components/anchors/*` |
| `frontend/src/components/dialogs/AnnotateGameDialog.tsx` | `frontend/src/features/editor/components/AnnotateGameDialog.tsx` |
| `frontend/src/components/dialogs/EditStartPositionDialog.tsx` | `frontend/src/features/editor/components/EditStartPositionDialog.tsx` |
| `frontend/src/components/dialogs/ExtractPositionDialog.tsx` | `frontend/src/features/editor/components/ExtractPositionDialog.tsx` |

### Feature: sessions

| Current | Target |
|---|---|
| `frontend/src/game_sessions/*` | `frontend/src/features/sessions/services/*` and `frontend/src/features/sessions/model/*` |
| `frontend/src/components/shell/GameTabs.tsx` | `frontend/src/features/sessions/components/GameTabs.tsx` |
| `frontend/src/hooks/useNavigateGuard.ts` | `frontend/src/features/sessions/guards/useNavigateGuard.ts` |

### Feature: analysis

| Current | Target |
|---|---|
| `frontend/src/components/analysis/*` | `frontend/src/features/analysis/components/*` |
| `frontend/src/hooks/useEngineAnalysis.ts` | `frontend/src/features/analysis/hooks/useEngineAnalysis.ts` |
| `frontend/src/hooks/useOpeningExplorer.ts` | `frontend/src/features/analysis/hooks/useOpeningExplorer.ts` |
| `frontend/src/hooks/useTablebaseProbe.ts` | `frontend/src/features/analysis/hooks/useTablebaseProbe.ts` |
| `frontend/src/hooks/useVsEngine.ts` | `frontend/src/features/analysis/hooks/useVsEngine.ts` |

### Feature: training

| Current | Target |
|---|---|
| `frontend/src/training/*` | `frontend/src/features/training/*` |
| `frontend/src/hooks/useTrainingDialogState.ts` | `frontend/src/features/training/hooks/useTrainingDialogState.ts` |

### Feature: settings

| Current | Target |
|---|---|
| `frontend/src/components/settings/*` | `frontend/src/features/settings/components/*` |
| preference stores under `frontend/src/runtime/*prefs*` | split between `frontend/src/features/settings/services/` and `frontend/src/platform/browser/storage/` as appropriate |

### Shared UI

| Current | Target |
|---|---|
| `frontend/src/components/badges/*` | `frontend/src/ui/badges/*` unless feature-owned |
| `frontend/src/components/board/*` | `frontend/src/ui/board/*` for shared board UI; feature-owned board behavior stays in features/core |
| `frontend/src/components/dialogs/NewGameDialog.tsx` | `frontend/src/ui/dialogs/NewGameDialog.tsx` or `features/sessions/components/` depending on ownership |

---

## Migration phases

This restructure should not be done as one giant rename. It should be staged.

## Phase A — Boundary cleanup before folder moves

Goal: improve architecture without changing too many paths at once.

Tasks:

1. remove direct Tauri imports from orchestration and feature modules where possible,
2. introduce capability interfaces in `core/contracts/`,
3. add desktop adapter wrappers under `platform/desktop/`,
4. introduce backend adapter placeholders under `platform/backend/`.

Why first:

- this reduces coupling before the directory move,
- the eventual folder structure will reflect real boundaries rather than wishful ones.

## Phase B — Create the new top-level buckets

Goal: create stable target homes without moving every file immediately.

Tasks:

1. create `app/`, `core/`, `platform/`, `features/`, `ui/`,
2. move bootstrap and provider files first,
3. move Tauri gateway code into `platform/desktop/`,
4. move pure app orchestration into `core/`.

## Phase C — Move feature code by domain

Goal: make ownership legible feature by feature.

Suggested order:

1. `sessions`
2. `editor`
3. `resources`
4. `analysis`
5. `training`
6. `settings`

Reason:

- sessions and editor are on the hot path,
- resources is structurally important,
- analysis/training/settings are easier once the service seams are clearer.

## Phase D — Shrink the top-level shell

Goal: keep `AppShell` as a composition root rather than a feature owner.

Tasks:

1. split shell-specific concerns into feature shells/controller hooks,
2. keep only layout composition and top-level provider wiring in `app/shell/`,
3. move keyboard guards, training orchestration, and analysis coordination closer to their features.

## Phase E — Enforce with tooling

Goal: stop the codebase from drifting back.

Tasks:

1. add dependency checks for forbidden imports,
2. add a rule that `@tauri-apps/*` imports live under `platform/desktop/`,
3. add a rule that backend client libs live under `platform/backend/`,
4. update README and architecture docs to reflect the real stack.

---

## First-wave refactor to start now

This is the smallest useful first implementation slice.

### Scope

1. create:
   - `frontend/src/platform/desktop/tauri/`
   - `frontend/src/core/contracts/`
   - `frontend/src/core/services/`
2. move / wrap:
   - storage import/export desktop calls
   - Tauri file/DB gateway helpers
3. split:
   - `session_orchestrator.ts` into narrower service files

### Concrete target files

```text
frontend/src/core/contracts/storage_gateway.ts
frontend/src/core/services/storage_service.ts
frontend/src/core/services/navigation_service.ts
frontend/src/core/services/session_edit_service.ts
frontend/src/platform/desktop/tauri/storage_gateway.ts
frontend/src/platform/desktop/tauri/tauri_gateways.ts
```

### Immediate benefits

- removes transport leakage from orchestration,
- makes future backend support easier,
- reduces the size and responsibility of `session_orchestrator.ts`,
- creates the first real examples of the new architecture.

---

## Success criteria

The restructure is successful when:

1. feature code no longer imports raw Tauri APIs directly,
2. future backend capabilities can be added through `platform/backend/` without touching most feature code,
3. `AppShell` is mostly composition and layout,
4. major features have clear directory ownership,
5. `parts/` remains portable and isolated,
6. the README and architecture docs describe the actual structure of the app.

---

## Recommended next step

Use this document as the umbrella plan, then create implementation plans for:

1. **Phase A1:** Desktop adapter extraction
2. **Phase A2:** Session orchestrator split
3. **Phase B1:** top-level directory creation + bootstrap/provider moves
4. **Phase C1:** sessions/editor/resources migration

That keeps the work incremental and reviewable.
