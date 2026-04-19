# `core/services`

Central service factories and orchestration modules that coordinate sessions, resources, and feature behavior.

These are high-value architecture files. They depend on contracts and canonical feature/platform modules; they must not import legacy bridges or raw Tauri globals.

---

## Two-phase construction

Session handling is built in two phases, both called once from `useAppStartup`:

**Phase 1 — `createAppServicesBundle`** (`createAppServices.ts`)

Instantiates and wires all stateful service objects: PGN runtime, editor history, resource capabilities, session model/store/persistence, move lookup, navigation, and resource viewer. Returns a `ServicesBundle` record.

**Phase 2 — `createSessionOrchestrator`** (`session_orchestrator.ts`)

Receives the `ServicesBundle` plus two stable mutable refs (`dispatchRef`, `stateRef`) and produces the `AppStartupServices` object consumed by `ServiceContext`. It delegates to four operation-group modules and adds the remaining operations directly.

---

## The `ActiveSessionRef`

`activeSessionRef.current` (a `GameSessionState`) is the shared mutable bridge between pure-logic services and React. It holds live in-memory state for the active game: `pgnModel`, `pgnText`, `moves`, `currentPly`, `selectedMoveId`, `movePositionById`, `boardPreview`, `pgnLayoutMode`, and `pendingFocusCommentId`.

All pure-logic services read and write through this ref. React never touches it directly — it is always informed via dispatch after a mutation.

---

## Flushing session state to React

After any inline mutation of `activeSessionRef.current`, the orchestrator calls `flushSessionState()`:

```
flushSessionState()
  └─ dispatchSessionStateSnapshot(activeSessionRef.current, dispatch)
       └─ dispatches set_pgn_state / set_navigation_state / etc.
```

Changes that go through service callbacks (`onSessionsChanged`, `onTabsChanged`, `onPgnChange`, `onNavigationChange`) are dispatched automatically by those callbacks and do not need a manual flush.

---

## Callback wiring (pure-logic → React)

Inside `createAppServicesBundle`, several typed callbacks are defined and injected into service constructors:

| Callback | Triggered by | Dispatches |
|---|---|---|
| `onPgnChange` | PGN runtime after any model change | full session snapshot |
| `onNavigationChange` | Navigation after ply/move change | `set_navigation_state` |
| `onUndoRedoDepthChange` | History after undo/redo stack change | `set_undo_redo_depth` |
| `onStatusChange` | Resources or persistence | `set_status_message` |
| `onErrorChange` | PGN runtime on parse error | `set_error_message` |
| `onSessionsChanged` | Session store on open/close/switch | `set_sessions` |
| `onTabsChanged` | Resource viewer on tab change | `set_resource_viewer` |
| `onRecordHistory` | PGN runtime after an edit | pushes undo snapshot; marks session dirty |
| `onScheduleAutosave` | PGN runtime after an edit | schedules autosave via persistence service |

---

## Operation groups

`createSessionOrchestrator` delegates to four sub-factories that each own a `Pick<AppStartupServices, …>` slice:

| Module | Covers |
|---|---|
| `session_nav_ops.ts` | Board navigation (`gotoFirst/Prev/Next/Last`, `gotoMoveById`), board flip, `applyPgnModelEdit` |
| `session_editing_ops.ts` | PGN text edits, header edits, comment/NAG/shape mutations, undo/redo, game reset |
| `session_shell_ops.ts` | Shell preferences (`setLayoutMode`, `setLocale`, `setSoundEnabled`, …), dev-dock state, import/export webview storage |
| `session_resource_open_ops.ts` | Opening resources/files/directories, opening games by ref or record ID, resource tab management |

The orchestrator also directly implements:
- **Session lifecycle**: `switchSession`, `closeSession`, `openPgnText`
- **Search**: `searchByPosition`, `searchByText`, `explorePosition`
- **Persistence**: `setSaveMode`, `saveActiveGameNow`, `saveSessionById`
- **Player management**: `getPlayers`, `addPlayer`, `deletePlayer`, `updatePlayer`
- **Overrideable UI stubs**: `openCurriculumPanel`, `openEditorStyleDialog`, `openDefaultLayoutDialog` (replaced by `AppShell` after construction)

---

## Session lifecycle

**Open** (`openPgnText` or resource-open ops):
1. `sessionModel.createSessionFromPgnText(pgnText)` builds a fresh `GameSessionState`.
2. `sessionStore.openSession(…)` registers it and fires `onSessionsChanged`.
3. `flushSessionState()` pushes PGN/navigation state to React.
4. `set_board_flipped` is dispatched based on the orientation header.

**Switch** (`switchSession`):
1. `sessionStore.switchToSession(sessionId)` updates `activeSessionRef.current`.
2. `flushSessionState()` syncs the new session's state to React.

**Close** (`closeSession`):
1. `sessionStore.closeSession(sessionId)` removes the session.
2. If the store is now empty, a blank session is opened automatically.
3. `flushSessionState()` syncs final state.

---

## Persistence

The `SessionPersistenceService` (`session_persistence.ts`) handles save behaviour:

- **Auto-save**: `onRecordHistory` calls `scheduleAutosaveForActiveSession()` after every edit. The service debounces writes and calls `resources.saveGameBySourceRef`.
- **Manual save**: `saveActiveGameNow()` calls `persistActiveSessionNow()` immediately.
- **New-game save**: If the session has no `sourceRef`, `ensureSourceForActiveSession` creates a new game record in the currently active resource tab before saving. The new file name is derived from PGN headers plus a per-session suffix so games do not all map to `imported-game.pgn`.
- **Resource list refresh**: After a successful `saveBySourceRef`, `onAfterSuccessfulSave` runs (wires to `resourceViewer.refreshActiveTabRows` in `createAppServices`) so the active resource table picks up new files.
- **Dirty flag**: `sessionStore.updateActiveSessionMeta({ dirtyState: "dirty" })` is set by `onRecordHistory` and cleared by the persistence service after a successful write.

---

## Session helpers (`session_helpers.ts`)

Stateless pure utilities shared across service modules:

- `lastLocatorSegment` — extracts a display name from a resource locator path.
- `normalizeStringField` / `normalizeOptionalRecordId` — defensive coercion of unknown values at contract boundaries.
- `buildSourceIdentityKey` — produces a stable `kind|locator|recordId` identity string used for dedup checks.
- `isPlaceholderHeaderValue` — detects unfilled PGN header values (`"?"`, `"????.??.??"`, etc.).
