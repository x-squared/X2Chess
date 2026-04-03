# State Management Refactor — Tier 1 + Tier 2

**Status:** Ready to implement  
**Scope:** Tier 1 (three correctness fixes) + Tier 2 (resource-tab React state)  
**Tier 3** (per-session state objects, eliminating the snapshot dance) is deferred — it requires restructuring the pure-logic service layer and should be a separate plan.

---

## Background

An architectural audit found four structural problems in the state bridge between the
`legacyState` mutable singleton and the React `useReducer` store:

1. **Shell preferences are triple-written.** `render()` in `createAppServices.ts`
   dispatches ~8 preference fields (`locale`, `soundEnabled`, `pgnLayoutMode`, etc.)
   that the setters in `useAppStartup.ts` ALSO dispatch directly. The `render()` path
   is redundant and risks overwriting with a stale value from `legacyState`.

2. **Active session metadata is stale.** `toSessionItem` reads PGN headers (`White`,
   `Black`, `Event`, `Date`) from `session.snapshot.pgnModel`, which is only captured
   at switch/close time. While the user edits the active session, the tab title and
   session list reflect old header values.

3. **`loadPgnText` and `openGameFromRef` bypass the session model.** Both directly
   mutate `legacyState.pgnText`, `pgnModel`, `currentPly`, etc. without calling
   `sessionStore.persistActiveSession()` afterwards. If the user switches sessions
   immediately after loading, the loaded game is lost because the active session's
   snapshot is stale.

4. **Resource viewer tab data has no React representation.** `activeResourceRowCount`
   and `activeResourceErrorMessage` are declared in `AppStoreState` and in selectors
   but are never set by any reducer action — they are permanently `0` and `""`. The
   actual data lives only in `legacyState.resourceViewerTabs[n].rows`.

---

## Key files to read before starting

Read these in full before making any change:

| File | Why |
|---|---|
| `frontend/src/hooks/createAppServices.ts` | Contains `render()`, `toSessionItem`, `toResourceTab` |
| `frontend/src/hooks/useAppStartup.ts` | Contains `loadPgnText`, `openGameFromRef`, setters |
| `frontend/src/state/actions.ts` | Discriminated union of all dispatch actions |
| `frontend/src/state/app_reducer.ts` | Reducer cases + `AppStoreState` type |
| `frontend/src/game_sessions/session_model.ts` | `createSessionFromPgnText`, `applySessionSnapshotToState` |
| `frontend/src/game_sessions/session_store.ts` | `persistActiveSession`, `updateActiveSessionMeta` |

Also read `dev/rules/coding-style.mdc` and `dev/rules/typescript-strict-types.mdc`.

---

## Item T1-A — Remove shell preferences from `render()`

**Problem:** `render()` dispatches 8 preference fields. The setters already dispatch these
directly. This creates a redundant code path and risks `render()` overwriting a
correctly-dispatched value with a stale `legacyState` value.

**Fields affected:** `locale`, `soundEnabled`, `moveDelayMs`, `isMenuOpen`,
`isDevDockOpen`, `activeDevTab`, `isDeveloperToolsEnabled`, `pgnLayoutMode`.

### Changes to `frontend/src/hooks/createAppServices.ts`

In the `render()` function body, **remove** these 8 dispatch calls entirely:

```ts
// Remove all of these from render():
d({ type: "set_is_menu_open", open: Boolean(s.isMenuOpen) });
d({ type: "set_dev_dock_open", open: Boolean(s.isDevDockOpen) });
d({ type: "set_active_dev_tab", tab: toDevTab(s.activeDevTab) });
d({ type: "set_dev_tools_enabled", enabled: Boolean(s.isDeveloperToolsEnabled) });
d({ type: "set_locale", locale: String(s.locale || DEFAULT_LOCALE) });
d({ type: "set_move_delay_ms", value: Number(s.moveDelayMs) || 220 });
d({ type: "set_sound_enabled", enabled: Boolean(s.soundEnabled) });
d({ type: "set_layout_mode", mode: normalizeX2StyleValue(s.pgnLayoutMode) });
```

`render()` becomes responsible only for game state (pgn, navigation, sessions,
resource tabs) — not preferences.

### Changes to `frontend/src/hooks/useAppStartup.ts`

The startup `useEffect` currently loads prefs into `legacyState` and then calls
`syncStateToReact()` (which calls `render()`) to push them to React. After removing
those dispatches from `render()`, the effect must dispatch them directly. Replace the
relevant lines in the `useEffect` body:

```ts
// BEFORE:
s.isDeveloperToolsEnabled = prefs.isDeveloperToolsEnabled;
// ...
s.locale = resolveInitialLocale(resolveLocale, DEFAULT_LOCALE);
// ...
if (savedSound === "false") s.soundEnabled = false;
// ...
if (Number.isFinite(savedSpeed) && savedSpeed >= 0) s.moveDelayMs = savedSpeed;
// ...
if (savedLayout === "text" || ...) s.pgnLayoutMode = savedLayout;
// (then later) syncStateToReact(); ← this was dispatching all the above

// AFTER: keep legacyState writes (services still read these fields), but
// also dispatch directly so React gets the value even though render() no longer covers it:
s.isDeveloperToolsEnabled = prefs.isDeveloperToolsEnabled;
dispatch({ type: "set_dev_tools_enabled", enabled: prefs.isDeveloperToolsEnabled });

s.locale = resolveInitialLocale(resolveLocale, DEFAULT_LOCALE);
dispatch({ type: "set_locale", locale: s.locale });

if (savedSound === "false") {
  s.soundEnabled = false;
  dispatch({ type: "set_sound_enabled", enabled: false });
}
if (Number.isFinite(savedSpeed) && savedSpeed >= 0) {
  s.moveDelayMs = savedSpeed;
  dispatch({ type: "set_move_delay_ms", value: savedSpeed });
}
if (savedLayout === "text" || savedLayout === "tree" || savedLayout === "plain") {
  s.pgnLayoutMode = savedLayout;
  dispatch({ type: "set_layout_mode", mode: savedLayout });
}
// syncStateToReact() still called at the end for game state (pgn, sessions, etc.)
```

Note: `isMenuOpen` starts as `false` (correct default), `isDevDockOpen`/`activeDevTab`/
`isDeveloperToolsEnabled` are all handled via their respective setters once the user
interacts. Their initial values in `initialAppStoreState` in `app_reducer.ts` are
already correct, so no startup dispatch needed for those.

---

## Item T1-B — Fix active session metadata staleness

**Problem:** `toSessionItem` reads PGN headers from the session's frozen snapshot.
For the active session, the snapshot is only refreshed on switch/close, so headers
are stale while the user edits.

### Changes to `frontend/src/hooks/createAppServices.ts`

Change the signature of `toSessionItem` to accept an optional live model override:

```ts
// BEFORE:
export const toSessionItem = (raw: unknown, activeSessionId: string | null): SessionItemState => {
  const session: RawSession = (raw as RawSession) ?? {};
  const sessionId: string = typeof session.sessionId === "string" ? session.sessionId : "";
  const pgnModel: unknown = (session.snapshot as { pgnModel?: unknown } | null)?.pgnModel;
  ...
```

```ts
// AFTER:
export const toSessionItem = (
  raw: unknown,
  activeSessionId: string | null,
  liveModel: unknown | null,   // live pgnModel for the active session; null for inactive
): SessionItemState => {
  const session: RawSession = (raw as RawSession) ?? {};
  const sessionId: string = typeof session.sessionId === "string" ? session.sessionId : "";
  const isActive: boolean = sessionId !== "" && sessionId === activeSessionId;
  // For the active session, use the live model (always current); for others, use the snapshot.
  const pgnModel: unknown = (isActive && liveModel != null)
    ? liveModel
    : (session.snapshot as { pgnModel?: unknown } | null)?.pgnModel;
  ...
```

In `render()`, pass `legacyState.pgnModel` as the live model for the active session:

```ts
// BEFORE:
const sessions: SessionItemState[] = rawSessions
  .map((raw: unknown): SessionItemState => toSessionItem(raw, s.activeSessionId))
  .filter(...);

// AFTER:
const sessions: SessionItemState[] = rawSessions
  .map((raw: unknown): SessionItemState =>
    toSessionItem(raw, s.activeSessionId, s.pgnModel ?? null))
  .filter(...);
```

---

## Item T1-C — Fix `loadPgnText` and `openGameFromRef` to respect the session boundary

**Problem:** Both functions directly mutate `legacyState` fields without calling
`sessionStore.persistActiveSession()`. If the user switches sessions immediately
after, the active session's snapshot is stale and the loaded game is lost.

**Fix:** After applying the new game data to `legacyState`, always call
`persistActiveSession()` to flush the state into the session record immediately.

### Changes to `frontend/src/hooks/useAppStartup.ts`

**`loadPgnText`** — add `persistActiveSession` + `updateActiveSessionMeta` after the
existing mutations:

```ts
// BEFORE:
loadPgnText: (pgnText: string): void => {
  const s: AppState = bundle.legacyState;
  s.pgnText = pgnText;
  s.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(pgnText)) as typeof s.pgnModel;
  s.currentPly = 0;
  s.selectedMoveId = null;
  bundle.pgnRuntime.syncChessParseState(pgnText);
  syncStateToReact();
},

// AFTER:
loadPgnText: (pgnText: string): void => {
  const s: AppState = bundle.legacyState;
  s.pgnText = pgnText;
  s.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(pgnText)) as typeof s.pgnModel;
  s.currentPly = 0;
  s.selectedMoveId = null;
  bundle.pgnRuntime.syncChessParseState(pgnText);
  // Flush into the session snapshot so a session switch cannot discard this load.
  bundle.sessionStore.persistActiveSession();
  bundle.sessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
  syncStateToReact();
},
```

**`openGameFromRef`** — add `persistActiveSession` immediately after the existing
direct legacyState mutations and before `updateActiveSessionMeta`:

```ts
// Existing lines (do not remove):
s.pgnText = result.pgnText;
s.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(result.pgnText)) as typeof s.pgnModel;
s.currentPly = 0;
s.selectedMoveId = null;
bundle.pgnRuntime.syncChessParseState(result.pgnText);
// ADD immediately after:
bundle.sessionStore.persistActiveSession();
// Then the existing updateActiveSessionMeta call:
bundle.sessionStore.updateActiveSessionMeta({
  sourceRef: { ... },
  dirtyState: "clean",
});
syncStateToReact();
```

---

## Item T2 — Resource viewer tab data in React state

**Problem:** `activeResourceRowCount` and `activeResourceErrorMessage` are declared in
`AppStoreState` and selectors but are never updated — they are permanently at their
initial values (`0`, `""`). The real data lives only in `legacyState.resourceViewerTabs`.

### Step 1: Add action to `frontend/src/state/actions.ts`

Add one new action variant inside the `AppAction` union, under the resource viewer
section:

```ts
| {
    type: "set_active_resource_data";
    rowCount: number;
    errorMessage: string;
  }
```

### Step 2: Add reducer case to `frontend/src/state/app_reducer.ts`

Add a case in `appReducer` under the resource viewer section:

```ts
case "set_active_resource_data":
  return {
    ...state,
    activeResourceRowCount: action.rowCount,
    activeResourceErrorMessage: action.errorMessage,
  };
```

### Step 3: Update `render()` in `frontend/src/hooks/createAppServices.ts`

After the existing resource-tabs dispatch block, add:

```ts
// Active resource tab data (row count + error).
const activeTab: unknown = (Array.isArray(s.resourceViewerTabs) ? s.resourceViewerTabs : [])
  .find((t: unknown): boolean => (t as { tabId?: string }).tabId === s.activeResourceTabId);
const activeRowCount: number = Array.isArray((activeTab as { rows?: unknown } | undefined)?.rows)
  ? ((activeTab as { rows: unknown[] }).rows).length
  : 0;
const activeTabError: string =
  typeof (activeTab as { errorMessage?: unknown } | undefined)?.errorMessage === "string"
    ? (activeTab as { errorMessage: string }).errorMessage
    : "";
d({ type: "set_active_resource_data", rowCount: activeRowCount, errorMessage: activeTabError });
```

---

## Verification

After all four items are done:

1. `npm run typecheck` must pass with zero errors.
2. `npm test` must pass.
3. Manual smoke-test:
   - Open two games in separate tabs. Edit White header in tab 1 — tab label updates immediately (T1-B).
   - Load a game from the resource viewer into the active session, then immediately click another tab and back — the game must still be there (T1-C).
   - Open a resource in the viewer — the row count selector in the resource panel must reflect real data (T2).
   - Toggle sound, change move speed, change locale — all persist correctly after a `render()` cycle (T1-A).

---

## What is NOT in scope

- Removing `legacyState` or changing service module interfaces.
- Per-session state objects (the "snapshot dance" elimination). That is Tier 3 and requires
  a separate plan touching `session_model.ts`, `session_store.ts`, and all service modules
  that currently mutate `legacyState` directly.
- Any UI or component changes.
- Changes to pure-logic modules under `model/`, `editor/`, `board/`, `game_sessions/`.
