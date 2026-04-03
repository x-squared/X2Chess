# State Management — Tier 3: Per-Session State Objects

**Status:** Ready to implement (start in a fresh session)  
**Depends on:** `state_management_refactor_b4f8a2c1.plan.md` (Tier 1 + 2) — must be merged first.

---

## Problem statement

All game state (`pgnModel`, `pgnText`, `currentPly`, `moves`, `verboseMoves`,
`movePositionById`, `boardPreview`, `selectedMoveId`, `errorMessage`, `statusMessage`,
`undoStack`, `redoStack`) lives in a single flat `legacyState` object.  There is only
ever one live copy.  When sessions are switched, the current state is manually copied
into the departing session's `snapshot` field, and the arriving session's snapshot is
copied back.  This "snapshot dance" has two consequences:

1. The session boundary is only enforced at switch/close time.  Any code that mutates
   `legacyState` fields directly (and doesn't immediately call `persistActiveSession`)
   can silently lose data on the next switch.
2. A snapshot is a plain deep-cloned object.  There is no per-session identity that
   can be used to detect "which session owns what" at an arbitrary point in code.

The fix is to give each session its own live `GameSessionState` object, and make every
service module operate on a **ref** that always points to the active session's object.
Session switch becomes: update the ref to point to the new session's object.  No
copying, no snapshot dance.

---

## Key files to read before starting

| File | Why |
|---|---|
| `frontend/src/app_shell/app_state.ts` | `AppState` type — split into game vs. shared fields |
| `frontend/src/hooks/createAppServices.ts` | Main wiring; `ServicesBundle`; `render()` |
| `frontend/src/hooks/useAppStartup.ts` | Startup effect; service callbacks |
| `frontend/src/editor/pgn_runtime.ts` | `PgnRuntimeState` — defines which fields it uses |
| `frontend/src/editor/history.ts` | `EditorHistoryState` |
| `frontend/src/board/navigation.ts` | Navigation state shape |
| `frontend/src/board/move_lookup.ts` | `MoveLookupState` shape |
| `frontend/src/game_sessions/session_model.ts` | Will be simplified/removed |
| `frontend/src/game_sessions/session_store.ts` | Will be restructured |
| `frontend/src/game_sessions/session_persistence.ts` | Reads `pgnText` from state |
| `frontend/src/resources/index.ts` | Reads resource-related fields |

Also read `dev/rules/coding-style.mdc` and `dev/rules/typescript-strict-types.mdc`.

---

## Step 1 — Define `GameSessionState`

Create a new file `frontend/src/game_sessions/game_session_state.ts`.

This type is the union of every field that any service module currently reads/writes
from `legacyState` and that belongs to a single game session.  Derive it from the
state types declared inside the service modules:

```ts
/**
 * All state belonging to one open game session.
 * Each GameSession object carries its own live instance of this type.
 * Services operate on this type via an ActiveSessionRef.
 */
export type GameSessionState = {
  // PGN / editor
  pgnModel: unknown;
  pgnText: string;
  moves: string[];
  verboseMoves: Array<{ flags?: string; from?: string; to?: string }>;
  movePositionById: Record<string, unknown>;
  pgnLayoutMode: string;          // session-scoped layout preference

  // Navigation
  currentPly: number;
  selectedMoveId: string | null;
  boardPreview: { fen?: string; lastMove?: unknown } | null;
  animationRunId: number;
  isAnimating: boolean;

  // Editor messages
  errorMessage: string;
  statusMessage: string;
  pendingFocusCommentId: string | null;

  // Undo / redo
  undoStack: unknown[];
  redoStack: unknown[];
};

/** Ref object threaded through all service modules.  Services read/write `current`. */
export type ActiveSessionRef = { current: GameSessionState };

/** Build a fresh empty GameSessionState. */
export const createEmptyGameSessionState = (): GameSessionState => ({
  pgnModel: null,
  pgnText: "",
  moves: [],
  verboseMoves: [],
  movePositionById: {},
  pgnLayoutMode: "plain",
  currentPly: 0,
  selectedMoveId: null,
  boardPreview: null,
  animationRunId: 0,
  isAnimating: false,
  errorMessage: "",
  statusMessage: "",
  pendingFocusCommentId: null,
  undoStack: [],
  redoStack: [],
});
```

Note: `pgnLayoutMode` moves here from `legacyState` because it is a per-session
preference (the layout choice a user makes for a game is part of that game's state).

---

## Step 2 — Update `GameSession` in `session_store.ts`

Replace the `snapshot: SessionSnapshot` field with `ownState: GameSessionState`:

```ts
import type { GameSessionState } from "./game_session_state";

type GameSession = {
  sessionId: string;
  title: string;
  sourceRef: SourceRefLike | null;
  pendingResourceRef: SourceRefLike | null;
  revisionToken: string;
  dirtyState: DirtyState;
  saveMode: SaveMode;
  ownState: GameSessionState;   // replaces snapshot: SessionSnapshot
};
```

Remove `SessionSnapshot` and `SessionHistorySnapshot` types from `session_store.ts`
(they move to `game_session_state.ts` as `GameSessionState`).

---

## Step 3 — Restructure `createGameSessionStore`

The store no longer needs `captureActiveSessionSnapshot` or `applySessionSnapshotToState`.
Session switch just updates the ref:

```ts
type SessionStoreDeps = {
  state: SessionStoreState;
  activeSessionRef: ActiveSessionRef;         // replaces capture/apply callbacks
  disposeSessionState: (s: GameSessionState) => void;
};

const switchToSession = (sessionId: string): boolean => {
  const target = getSessions().find(s => s.sessionId === sessionId);
  if (!target) return false;
  // No copy needed — each session owns its object.
  state.activeSessionId = target.sessionId;
  activeSessionRef.current = target.ownState;   // swap the ref
  return true;
};

const openSession = ({ ownState, title, ... }: OpenSessionInput): GameSession => {
  const session: GameSession = { sessionId: ..., ownState, ... };
  getSessions().push(session);
  state.activeSessionId = session.sessionId;
  activeSessionRef.current = ownState;          // point ref at new session
  return session;
};

const closeSession = (sessionId: string) => {
  // ... remove from array, dispose ownState ...
  // point ref at next session's ownState
  activeSessionRef.current = next.ownState;
};
```

Remove `persistActiveSession` entirely — it has no meaning when sessions own their state.

---

## Step 4 — Update service module deps to use `ActiveSessionRef`

Every service module that currently declares a `*State` type and takes
`state: Record<string, unknown>` must change to accept
`sessionRef: ActiveSessionRef` instead.  Inside the module, replace every
`state.field` with `sessionRef.current.field`.

Affected modules and their current state type names:

| Module | Current deps param | State fields used |
|---|---|---|
| `editor/pgn_runtime.ts` | `state: Record<string,unknown>` cast to `PgnRuntimeState` | pgnModel, pgnText, moves, verboseMoves, currentPly, movePositionById, boardPreview, selectedMoveId, errorMessage, statusMessage, pendingFocusCommentId, animationRunId, isAnimating |
| `editor/history.ts` | `state: Record<string,unknown>` cast to `EditorHistoryState` | pgnModel, pgnText, currentPly, selectedMoveId, pgnLayoutMode, animationRunId, isAnimating, boardPreview, undoStack, redoStack |
| `board/navigation.ts` | `state` (check exact shape) | currentPly, moves, selectedMoveId, boardPreview, isAnimating, animationRunId |
| `board/move_lookup.ts` | `state` (check exact shape) | movePositionById |
| `game_sessions/session_persistence.ts` | `state` | pgnText |
| `runtime/pgn_model_update.ts` | `state` | pgnLayoutMode, and delegates to pgnRuntime |

For each module:
1. Replace `state: Record<string, unknown>` in `Deps` type with `sessionRef: ActiveSessionRef`.
2. Replace every `(state as SomeLocalType).field` access with `sessionRef.current.field`.
3. Remove the local `*State` type (it is now expressed by `GameSessionState`).

**Important**: `resources/index.ts` reads `state.gameDirectoryPath`,
`state.gameRootPath`, etc. — these are NOT game state, they are resource configuration
that stays in `legacyState` (shared state).  That module keeps its current `state`
parameter for those fields.

---

## Step 5 — Restructure `createGameSessionModel`

`session_model.ts` currently handles snapshot capture/apply/dispose and
`createSessionFromPgnText`.  After Tier 3:

- `captureActiveSessionSnapshot` / `applySessionSnapshotToState` / `disposeSessionSnapshot`
  are removed (no more snapshot dance).
- `createSessionFromPgnText` remains — it creates a fresh `GameSessionState` from PGN:

```ts
export const createSessionFromPgnText = (
  pgnText: string,
  deps: { parsePgn; serializeModel; ensureHeaders; buildPositions; stripAnnotations; t }
): GameSessionState => {
  // ... parse, validate, return populated GameSessionState
};
```

- `deriveSessionTitle` remains unchanged.

---

## Step 6 — Restructure `createAppServicesBundle`

```ts
// One shared ref; all services close over it.
const activeSessionRef: ActiveSessionRef = {
  current: createEmptyGameSessionState(),
};

// Shared (non-game) state keeps the current legacyState fields:
// resourceViewerTabs, activeResourceTabId, gameSessions, activeSessionId,
// nextSessionSeq, resourceViewerDefaultMetadataKeys, playerStore, appConfig,
// gameDirectoryHandle/Path, defaultSaveMode, appMode.
// (Sound, locale, moveDelayMs etc. are already pure React state after Tier 1.)
const sharedState: SharedAppState = createInitialSharedState();

// Pass sessionRef to all service modules:
const pgnRuntime = createPgnRuntimeCapabilities({ sessionRef: activeSessionRef, ... });
const history = createEditorHistoryCapabilities({ sessionRef: activeSessionRef, ... });
const navigation = createBoardNavigationCapabilities({ sessionRef: activeSessionRef, ... });
const moveLookup = createMoveLookupCapabilities({ sessionRef: activeSessionRef, ... });

// Session store gets the ref and swaps it on switch:
const sessionStore = createGameSessionStore({
  state: sharedState,
  activeSessionRef,
  disposeSessionState: (s) => { s.undoStack = []; s.redoStack = []; s.pgnModel = null; },
});
```

---

## Step 7 — Update `render()` in `createAppServices.ts`

`render()` now reads game state from `activeSessionRef.current` instead of `legacyState`:

```ts
const render = (): void => {
  const g: GameSessionState = activeSessionRef.current;
  const d: Dispatch<AppAction> = dispatchRef.current;

  if (g.pgnModel) {
    d({ type: "set_pgn", pgnText: g.pgnText, pgnModel: g.pgnModel as PgnModel, moves: g.moves });
  }
  d({ type: "set_current_ply", ply: g.currentPly });
  // ... etc.
};
```

---

## Step 8 — Update `useAppStartup.ts`

- Replace all `bundle.legacyState.pgnModel` / `bundle.legacyState.pgnText` etc. with
  `bundle.activeSessionRef.current.pgnModel` etc.
- `loadPgnText` and `openGameFromRef` write directly into `activeSessionRef.current`
  (which is the active session's object) — `persistActiveSession` call added in Tier 1
  can be removed (it is no longer meaningful).

---

## Step 9 — Simplify `AppState` / rename to `SharedAppState`

After Tier 3, `AppState` only contains fields that are truly shared across sessions:

```ts
export type SharedAppState = {
  gameSessions: unknown[];
  activeSessionId: string | null;
  nextSessionSeq: number;
  resourceViewerTabs: unknown[];
  activeResourceTabId: string | null;
  resourceViewerDefaultMetadataKeys: string[];
  activeSourceKind: string;
  defaultSaveMode: string;
  appMode: string;
  isDeveloperToolsEnabled: boolean;  // kept for getTranslator + bootstrap logic
  locale: string;                    // kept for getTranslator
  soundEnabled: boolean;             // kept for moveSoundPlayer
  moveDelayMs: number;               // kept for navigation
  playerStore: PlayerRecord[];
  appConfig: Record<string, unknown>;
  gameDirectoryHandle: unknown;
  gameDirectoryPath: string;
  gameRootPath: string;
  autosaveTimer: number | null;
  saveRequestSeq: number;
  isHydratingGame: boolean;
};
```

All game-specific fields (`pgnModel`, `pgnText`, `currentPly`, etc.) are gone.

---

## What does NOT change

- The React store (`AppStoreState`), actions, reducer, and selectors are unchanged.
- `render()` still drives React updates the same way.
- The resource viewer (`resources_viewer/index.ts`) is unchanged.
- All components and hooks that call service callbacks are unchanged.
- `resource/` library is unchanged.

---

## Verification

1. `npm run typecheck` passes.
2. `npm test` passes.
3. Manual smoke-test:
   - Open three games in separate tabs.  Edit each.  Switch tabs — each game
     retains its own state (board position, PGN, undo depth).
   - Drop a new file — it opens in a new tab, existing tabs unchanged.
   - Close a dirty tab — confirmation dialog appears; after confirm the adjacent tab
     is activated with its correct state.
   - Undo in one tab; switch to another tab; switch back — undo stack is still intact.

---

## Execution order

1. Create `game_session_state.ts` with `GameSessionState`, `ActiveSessionRef`, `createEmptyGameSessionState`.
2. Update `session_store.ts` — replace `snapshot` with `ownState`, remove `persistActiveSession`, add `activeSessionRef` param.
3. Update `session_model.ts` — remove snapshot API, keep `createSessionFromPgnText` returning `GameSessionState`.
4. Update each pure-logic service module to use `sessionRef` (Steps 4–5 above).
5. Update `createAppServices.ts` — new `ServicesBundle` with `activeSessionRef`, rewrite `render()`.
6. Update `useAppStartup.ts` — route all game-field accesses through `activeSessionRef.current`.
7. Update `app_state.ts` — strip game fields, rename to `SharedAppState`.
8. Run typecheck + tests after each module update to catch regressions early.
