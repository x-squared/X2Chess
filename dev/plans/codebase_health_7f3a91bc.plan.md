---
name: Codebase Health — Architecture & File Size
overview: Fix all findings from the architecture review — architecture rule violations, structural concerns in the resource layer, duplicate utilities, large files, and top-level resource module issues.
todos:
  - id: remove-dom-from-resources-viewer
    content: Remove render() DOM function from resources_viewer/index.ts; move all UI output to ResourceViewer.tsx.
    status: done
  - id: split-resource-viewer-component
    content: Split ResourceViewer.tsx (793 lines) into TabBar, ResourceTable, MetadataDialog sub-components.
    status: done
  - id: consolidate-resource-viewer-utilities
    content: Consolidate duplicated clampWidth / persistTabPrefs / column-reconciliation helpers between ResourceViewer.tsx and resource_metadata_prefs.ts.
    status: done
  - id: wire-open-game-todo
    content: Complete the stubbed open-game-row TODO in ResourceViewer.tsx — wire to services.openSessionFromSourceRef (or equivalent).
    status: done
  - id: extract-create-services
    content: Extract the createServices factory block from useAppStartup.ts (713 lines) into src/hooks/createAppServices.ts.
    status: done
  - id: inject-io-into-file-adapter
    content: Move Tauri invoke call out of resource/adapters/file/file_adapter.ts; inject an I/O callback at construction via resource/io/fs_gateway.ts.
    status: done
  - id: consolidate-kind-mappings
    content: Consolidate the four kind-name mapping sites (kinds.ts, isPgnResourceRef, compatibility.ts, source_types.ts) into one authoritative registry.
    status: done
  - id: link-metadata-schema-to-viewer-columns
    content: Add a typed link between metadata_schema.ts key names and the frontend viewer column registry so drift is caught at compile time.
    status: done
  - id: split-text-editor-plan
    content: Consider splitting text_editor_plan.ts (653 lines) — extract tree emitter to text_editor_plan_tree.ts if the file grows further.
    status: pending
  - id: wire-resource-io-abstractions
    content: Wire resource/io/ abstractions (db_gateway.ts, fs_gateway.ts) before implementing DB adapter to avoid repeating the I/O-leak pattern.
    status: done
isProject: true
---

# Codebase Health — Architecture & File Size

Source: architecture review conducted 2026-03-21.

## Priority Overview

| Priority | Item | File(s) |
|----------|------|---------|
| Critical | DOM rendering in pure-logic module | `resources_viewer/index.ts` |
| High | Duplicate utility functions | `ResourceViewer.tsx` + `resource_metadata_prefs.ts` |
| High | ResourceViewer.tsx too large (793 lines) | `ResourceViewer.tsx` |
| High | useAppStartup.ts too large (713 lines) | `useAppStartup.ts` |
| Medium | Open-game row TODO unwired | `ResourceViewer.tsx` |
| Medium | Tauri I/O baked into resource library adapter | `resource/adapters/file/file_adapter.ts` |
| Medium | Four kind-name mapping sites | `kinds.ts`, `compatibility.ts`, `source_types.ts` |
| Medium | resources_viewer/index.ts large (645 lines) | `resources_viewer/index.ts` |
| Low | metadata schema ↔ viewer column drift risk | `metadata_schema.ts`, viewer prefs |
| Low | resource/io/ abstractions unwired | `resource/io/` |
| Deferred | text_editor_plan.ts (653 lines) — acceptable now | `text_editor_plan.ts` |

---

## Item 1 — Remove DOM rendering from `resources_viewer/index.ts`  ★ Critical

**Problem**: `resources_viewer/index.ts` is a pure-logic module but contains a `render()` function
that calls `document.createElement`, sets `innerHTML`, and wires `addEventListener` directly.
This violates ADR-013: "pure-logic modules must remain framework-free."

Additionally, tab/row state is split between the pure module's internal mutable state and
`ResourceViewer.tsx`'s own `useState`, meaning two systems own overlapping state.

**Fix**:
1. Delete the `render()` function and all DOM-building code from `resources_viewer/index.ts`.
2. Keep the module for: tab state model, metadata prefs, column ordering, row loading callbacks.
   These are pure-logic concerns with no DOM dependency.
3. Move all rendering to `ResourceViewer.tsx` (which is being split anyway — see Item 2).
4. Unify tab state: `ResourceViewer.tsx` is the single owner via `useState`. The pure module
   exposes a state object/callbacks; the component renders from it.

**Test**: `tsc --noEmit` green; no `document.` or `innerHTML` in any file under `src/resources_viewer/`.

---

## Item 2 — Split `ResourceViewer.tsx` (793 lines)  ★ High

**Problem**: The component mixes four independent concerns in one 793-line file, making it
hard to read and maintain.

**Proposed split**:

```
ResourceViewer.tsx (root, ~150 lines)
  ├── ResourceTabBar.tsx       (~120 lines)  tab strip + open-resource button
  ├── ResourceTable.tsx        (~200 lines)  column headers + row list + resize handles
  └── ResourceMetadataDialog.tsx (~120 lines)  metadata key-value dialog
```

`ResourceViewer.tsx` becomes the composition root that wires the sub-components to
`useServiceContext()` callbacks and local state.

**Notes**:
- Sub-components receive only the props they need; no direct context access inside them.
- Column resize drag state stays local to `ResourceTable`.
- Dialog open/close state stays local to `ResourceViewer` (passed down as prop).
- This task depends on Item 1 (DOM removal) and Item 3 (utility consolidation) being done first.

---

## Item 3 — Consolidate duplicated utilities  ★ High

**Problem**: `ResourceViewer.tsx` and `resource_metadata_prefs.ts` both implement:
- Width clamping (`clampWidth` / `clampColumnWidth`)
- Tab preference persistence (`persistTabPrefs`)
- Column order reconciliation (`reconcileColumns` / `normalizeColumnOrder`)

**Fix**: Create `src/resources_viewer/viewer_utils.ts` with the canonical implementations.
Both consumers import from there. Delete the duplicates.

**Test**: `tsc --noEmit` green; grep confirms `clampWidth` exists in exactly one source file.

---

## Item 4 — Wire open-game-row TODO  ★ Medium

**Problem**: `ResourceViewer.tsx` has a TODO comment:
```typescript
// TODO: wire to sessionOpenService.openSessionFromSourceRef(row.sourceRef, row.identifier)
```
Row activation (double-click / Enter) does nothing.

**Fix**: Identify the correct `ServiceContext` callback for opening a game from a resource ref
(likely `services.loadGameFromRef` or a new `openGameRow` callback wired through `useAppStartup`).
Wire the row activation handler to that callback.

**Note**: May require adding a new callback to `AppStartupServices` / `ServiceContext` if none
currently handles this case. Check `source_gateway.ts` for the load entry point.

---

## Item 5 — Extract `createServices` factory from `useAppStartup.ts` (713 lines)  ★ High

**Problem**: `useAppStartup.ts` is 713 lines; roughly 250 of those are a single `createServices()`
factory block that constructs every service capability object and assembles them into
`AppStartupServices`. This is logically a separate concern from the React hook lifecycle.

**Fix**: Extract to `src/hooks/createAppServices.ts`:
```typescript
// createAppServices.ts
export const createAppServices = (
  bundle: AppBundle,
  syncStateToReact: () => void,
  dispatch: React.Dispatch<AppAction>,
): AppStartupServices => { ... };
```

`useAppStartup.ts` calls `createAppServices(bundle, syncStateToReact, dispatch)` and
becomes a focused lifecycle hook (~250 lines: `useRef`, `useEffect`, `useCallback`, `useMemo`).

**Test**: `tsc --noEmit` green; `useAppStartup.ts` drops below 300 lines.

---

## Item 6 — Inject I/O into `resource/adapters/file/file_adapter.ts`  ★ Medium

**Problem**: `file_adapter.ts` calls `invoke('load_text_file', ...)` (Tauri API) directly,
embedding a desktop-runtime concern inside the canonical resource library. The library's own
`resource/io/fs_gateway.ts` was presumably intended as the injection seam but is unused.

**Fix**:
1. Define `FsGateway` interface in `resource/io/fs_gateway.ts`:
   ```typescript
   export type FsGateway = {
     readTextFile(path: string): Promise<string>;
   };
   ```
2. `createFileAdapter(fsGateway: FsGateway): PgnResourceAdapter` — inject via constructor.
3. In `frontend/src/resources/source_gateway.ts` (the frontend integration point), supply the
   Tauri-backed implementation when creating the file adapter.

**Result**: The resource library becomes runtime-agnostic; Tauri dependency is 100% in the frontend.

---

## Item 7 — Consolidate kind-name mappings  ★ Medium

**Problem**: The `"file" | "directory" | "db"` kind names appear independently in four places:
- `resource/domain/kinds.ts` — canonical constants
- `isPgnResourceRef()` — hardcodes the kind literals again
- `resource/client/compatibility.ts` — maps legacy ↔ canonical
- `frontend/src/resources/source_types.ts` — re-aliases them again

Any new kind requires four edits; misspelling in one place is silent.

**Fix**:
1. `resource/domain/kinds.ts` exports `PGN_RESOURCE_KINDS` as a `const` tuple.
2. `isPgnResourceRef()` uses `PGN_RESOURCE_KINDS.includes(ref.kind)` rather than a literal union.
3. The compatibility map is derived from a single constant rather than repeated string literals.
4. `source_types.ts` imports the canonical constants instead of redefining them.

---

## Item 8 — Typed link between `metadata_schema.ts` and viewer column registry  ★ Low

**Problem**: `resource/domain/metadata_schema.ts` defines the canonical metadata key names
(Event, White, Black, ECO, X2Style, …). The frontend viewer's column visibility preferences
(`resource_metadata_prefs.ts`) hardcodes the same key names as plain strings. If a key is
renamed in the schema, the viewer silently shows stale column names.

**Fix**: Export a `METADATA_KEY` const object from `metadata_schema.ts`. The viewer's column
definitions reference `METADATA_KEY.Event`, `METADATA_KEY.White`, etc. A rename in the schema
immediately produces a TypeScript error at the viewer's column definition site.

---

## Item 9 — Wire `resource/io/` abstractions before DB adapter  ★ Low / Deferred

**Problem**: `resource/io/db_gateway.ts` and `fs_gateway.ts` exist as empty or minimal stubs.
The file adapter bypasses `fs_gateway.ts` (Item 6). The DB adapter is a placeholder.
If the DB adapter is implemented without first wiring the I/O layer, the same Tauri-leak
pattern will repeat for database I/O.

**Fix** (do this before any DB adapter work):
1. Complete Item 6 (fs_gateway injection for file adapter).
2. Define `DbGateway` interface in `resource/io/db_gateway.ts` with `query`, `execute`, `run`.
3. `createDbAdapter(dbGateway: DbGateway): PgnResourceAdapter` — ready to implement when needed.
4. Supply the Tauri SQLite-backed `DbGateway` in the frontend integration point.

---

## Item 10 — `text_editor_plan.ts` (653 lines) — monitor, no action now  ★ Deferred

The file grew to 653 lines with the addition of the tree emitter. It remains a single pure
function with a clear internal structure. No split recommended now.

**Trigger for future split**: if the tree emitter (`emitTreeVariation` and helpers) grows
beyond ~200 lines due to new features (e.g., multiple numbering strategies, move annotations),
extract to `src/editor/text_editor_plan_tree.ts`.

---

## Files Not Split (acceptable size)

| File | Lines | Reason |
|------|-------|--------|
| `model/pgn_commands.ts` | 549 | Cohesive set of PGN mutation commands; no obvious split point |
| `editor/text_editor_reconcile.ts` | 549 | Legacy DOM reconciler; not in active call chain; leave until replaced |
| `resources/source_picker_adapter.ts` | 541 | Broad but cohesive; handles all picker kinds and their error paths |

---

## Dependency Rules After Fixes

After Items 1–7 are complete, these rules must hold and can be verified with the existing
architecture dependency checker:

```
resource/           → no imports from frontend/, backend/
resources/          → may import from resource/ client only (not adapters or schema internals)
resources_viewer/   → no DOM imports; may import from resource/domain only
ResourceViewer.tsx  → imports from resources_viewer/, resources/, ServiceContext only
useAppStartup.ts    → imports createAppServices from createAppServices.ts
```
