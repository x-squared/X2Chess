/**
 * useAppStartup — initialises all application services and wires them to the
 * React reducer.
 *
 * This hook:
 *  1. Creates a `ServicesBundle` (held in a `useRef`) once on first render.
 *  2. Creates a `SessionOrchestrator` (held in a `useRef`) that wraps the bundle.
 *  3. Loads persisted preferences from `localStorage` on mount.
 *  4. Restores or creates the initial session.
 *  5. Returns the orchestrator as the `AppStartupServices` consumed by `ServiceContext`.
 *
 * Integration API:
 * - `const services = useAppStartup()` — call once in `AppShell`; pass the
 *   result to `<ServiceContext.Provider value={services}>`.
 *
 * Configuration API:
 * - No props or parameters.  All configuration comes from `localStorage` and
 *   compile-time constants (`DEFAULT_LOCALE`).
 *
 * Communication API:
 * - Inbound: `dispatch` from `useAppContext()`.
 * - Outbound: service callbacks dispatch fine-grained React actions directly.
 */

import { useRef, useEffect, useMemo } from "react";
import {
  DEFAULT_LOCALE,
  DEFAULT_APP_MODE,
} from "../app_shell/app_state";
import { resolveLocale } from "../app_shell/i18n";
import {
  resolveBuildAppMode,
  readBootstrapUiPrefs,
  resolveInitialLocale,
  initDevPrefsMode,
  readShellPrefsForStartup,
  type AppMode,
  type DevPrefsMode,
} from "../runtime/bootstrap_prefs";
import {
  workspaceSnapshotStore,
  type WorkspaceSnapshot,
} from "../runtime/workspace_snapshot_store";
import { migrateLocalStorage } from "../storage/migrate_local_storage";
import { migrateRemoteRulesCache } from "../runtime/remote_rules_store";
import { readShapePrefs } from "../runtime/shape_prefs";
import { readEditorStylePrefs } from "../runtime/editor_style_prefs";
import { readDefaultLayoutPrefs } from "../runtime/default_layout_prefs";
import { useAppContext } from "../state/app_context";
import type { AppStartupServices } from "../state/ServiceContext";
import type { AppAction } from "../state/actions";
import type { PgnModel } from "../model/pgn_model";
import type { GameSessionState } from "../game_sessions/game_session_state";
import type { AppStoreState } from "../state/app_reducer";
import type { Dispatch } from "react";
import {
  createAppServicesBundle,
  type ServicesBundle,
} from "./createAppServices";
import {
  createSessionOrchestrator,
  resolveSelectedMoveId,
} from "./session_orchestrator";
import { useTauriMenu } from "./useTauriMenu";
import { log } from "../logger";

// ── Shared types ──────────────────────────────────────────────────────────────

type LayoutMode = "plain" | "text" | "tree";

// ── Module-level helpers ──────────────────────────────────────────────────────

/**
 * Dispatch PGN, navigation, undo and focus state for the active session.
 * Called once at the end of the mount effect after sessions are restored.
 */
const dispatchInitialSessionState = (g: GameSessionState, dispatch: Dispatch<AppAction>): void => {
  const bp = g.boardPreview as { fen?: string; lastMove?: [string, string] | null } | null;
  dispatch({ type: "set_pgn_state", pgnText: g.pgnText, pgnModel: g.pgnModel as PgnModel | null, moves: Array.isArray(g.moves) ? g.moves : [], pgnTextLength: g.pgnText.length, moveCount: Array.isArray(g.moves) ? g.moves.length : 0 });
  dispatch({ type: "set_navigation", currentPly: Number(g.currentPly) || 0, selectedMoveId: resolveSelectedMoveId(g), boardPreview: bp?.fen ? { fen: String(bp.fen), lastMove: bp.lastMove ?? null } : null });
  dispatch({ type: "set_undo_redo_depth", undoDepth: Array.isArray(g.undoStack) ? g.undoStack.length : 0, redoDepth: Array.isArray(g.redoStack) ? g.redoStack.length : 0 });
  dispatch({ type: "set_pending_focus", commentId: g.pendingFocusCommentId });
};

/**
 * Read all persisted startup preferences and dispatch them to React state.
 *
 * @param dispatch - React dispatch function.
 * @param appMode - Resolved build mode (`DEV` or `PROD`).
 * @param devPrefsMode - Whether to apply stored user prefs or factory defaults in DEV.
 * @returns The resolved PGN layout mode, forwarded to `openFreshSession` when no
 *   snapshot exists.
 */
const applyBootstrapPrefs = (
  dispatch: Dispatch<AppAction>,
  appMode: AppMode,
  devPrefsMode: DevPrefsMode,
): LayoutMode => {
  const prefs = readBootstrapUiPrefs(appMode, devPrefsMode);
  const shellPrefs = readShellPrefsForStartup(devPrefsMode);

  // Bootstrap UI flags and locale.
  dispatch({ type: "set_dev_tools_enabled", enabled: prefs.isDeveloperToolsEnabled });
  dispatch({ type: "set_locale", locale: resolveInitialLocale(resolveLocale, DEFAULT_LOCALE, devPrefsMode) });

  // Shell prefs — only dispatch when the value differs from the reducer default
  // so the initial render stays unchanged for users who never changed these.
  if (!shellPrefs.sound) {
    dispatch({ type: "set_sound_enabled", enabled: false });
  }
  if (Number.isFinite(shellPrefs.moveDelayMs) && shellPrefs.moveDelayMs > 0) {
    dispatch({ type: "set_move_delay_ms", value: shellPrefs.moveDelayMs });
  }
  if (!shellPrefs.positionPreviewOnHover) {
    dispatch({ type: "set_position_preview_on_hover", enabled: false });
  }

  // Board decoration and editor style prefs are always dispatched because their
  // defaults are non-trivial objects that must match stored values exactly.
  dispatch({ type: "set_shape_prefs", prefs: readShapePrefs() });
  dispatch({ type: "set_editor_style_prefs", prefs: readEditorStylePrefs() });
  dispatch({ type: "set_default_layout_prefs", prefs: readDefaultLayoutPrefs() });

  return shellPrefs.pgnLayout;
};

/**
 * Restore all sessions and resource tabs from a saved workspace snapshot.
 *
 * Session IDs in the snapshot are one-time identifiers from the previous run;
 * new IDs are assigned by the store on `openSession`.  An `idMap` bridges old →
 * new so the previously active session can be re-selected at the end.
 *
 * @param bundle - Fully wired services bundle.
 * @param snapshot - Workspace snapshot read from localStorage.
 * @param dispatch - React dispatch function.
 */
const restoreWorkspaceSnapshot = (
  bundle: ServicesBundle,
  snapshot: WorkspaceSnapshot,
  dispatch: Dispatch<AppAction>,
): void => {
  // Pass 1: open every saved session; build old-ID → new-ID map.
  const idMap = new Map<string, string>();
  for (const snap of snapshot.sessions) {
    try {
      const sessionState: GameSessionState =
        bundle.sessionModel.createSessionFromPgnText(snap.pgnText);
      sessionState.pgnLayoutMode = (snap.pgnLayoutMode as LayoutMode) || "plain";
      sessionState.currentPly = snap.currentPly;
      sessionState.selectedMoveId = snap.selectedMoveId;
      const opened = bundle.sessionStore.openSession({
        ownState: sessionState,
        title: snap.title,
        sourceRef: snap.sourceRef ?? null,
        saveMode: snap.saveMode,
      });
      if (snap.dirtyState === "dirty" || snap.dirtyState === "error") {
        bundle.sessionStore.updateActiveSessionMeta({ dirtyState: snap.dirtyState });
      }
      idMap.set(snap.sessionId, opened.sessionId);
    } catch {
      // Skip sessions with corrupt PGN.
    }
  }

  // Pass 2: re-select the session that was active when the snapshot was taken.
  if (snapshot.activeSessionId) {
    const restoredId = idMap.get(snapshot.activeSessionId);
    if (restoredId) bundle.sessionStore.switchToSession(restoredId);
  }

  // Pass 3: re-open resource viewer tabs.
  for (const tabSnap of snapshot.resourceTabs) {
    if (tabSnap.kind && tabSnap.locator) {
      bundle.resourceViewer.upsertTab({
        title: tabSnap.title,
        resourceRef: { kind: tabSnap.kind, locator: tabSnap.locator },
        select: tabSnap.tabId === snapshot.activeResourceTabId,
      });
    }
  }

  // Sync the active session's layout mode to React (skipped when "plain" because
  // that is already the reducer default).
  const activeLayout = bundle.activeSessionRef.current.pgnLayoutMode as LayoutMode;
  if (activeLayout !== "plain") {
    dispatch({ type: "set_layout_mode", mode: activeLayout });
  }
};

/**
 * Open a single blank session when no saved workspace exists.
 *
 * @param bundle - Fully wired services bundle.
 * @param pgnLayout - Default layout mode resolved from shell prefs.
 * @param dispatch - React dispatch function.
 */
const openFreshSession = (
  bundle: ServicesBundle,
  pgnLayout: LayoutMode,
  dispatch: Dispatch<AppAction>,
): void => {
  try {
    const initialState: GameSessionState =
      bundle.sessionModel.createSessionFromPgnText("");
    initialState.pgnLayoutMode = pgnLayout;
    bundle.sessionStore.openSession({ ownState: initialState, title: "New Game" });
    // Sync non-default layout to React; "plain" is the reducer default so no
    // dispatch is needed in that case.
    if (pgnLayout !== "plain") {
      dispatch({ type: "set_layout_mode", mode: pgnLayout });
    }
  } catch (err: unknown) {
    const message: string = err instanceof Error ? err.message : String(err);
    log.error("useAppStartup", message);
    dispatch({ type: "set_error_message", message });
  }
};

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Initialise all application services on mount and return stable service callbacks.
 *
 * Must be called inside the `AppProvider` tree (needs `useAppContext`).
 *
 * @returns `AppStartupServices` to pass as the value of `<ServiceContext.Provider>`.
 */
export const useAppStartup = (): AppStartupServices => {
  const { dispatch, state } = useAppContext();

  // Keep a mutable ref to dispatch so service callbacks never go stale.
  const dispatchRef = useRef<Dispatch<AppAction>>(dispatch);
  dispatchRef.current = dispatch;

  // Mirror React state so services can read it synchronously via getters.
  const stateRef = useRef<AppStoreState>(state);
  stateRef.current = state;

  // Lazily create all services once (on first render).
  const bundleRef = useRef<ServicesBundle | null>(null);
  bundleRef.current ??= createAppServicesBundle(dispatchRef, stateRef);
  const bundle: ServicesBundle = bundleRef.current;

  // Guard against double-invocation (React StrictMode re-runs effects on the
  // same mounted component without resetting refs).
  const startupRanRef = useRef<boolean>(false);

  // ── Workspace persistence effect ─────────────────────────────────────────
  // Watches workspace-relevant React state fields and debounces a snapshot
  // write so rapid successive updates collapse into a single write.
  const workspaceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect((): (() => void) => {
    if (workspaceSaveTimerRef.current !== null) clearTimeout(workspaceSaveTimerRef.current);
    workspaceSaveTimerRef.current = setTimeout((): void => {
      workspaceSaveTimerRef.current = null;
      workspaceSnapshotStore.write({
        sessions: bundle.sessionStore.buildSessionSnapshots(),
        activeSessionId: bundle.sessionStore.getActiveSessionId(),
        resourceTabs: bundle.resourceViewer.buildTabSnapshots(),
        activeResourceTabId: bundle.resourceViewer.getActiveTabId(),
      });
    }, 500);
    return (): void => {
      if (workspaceSaveTimerRef.current !== null) clearTimeout(workspaceSaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessions, state.activeSessionId, state.resourceViewerTabSnapshots, state.activeResourceTabId]);

  // ── Mount effect: load preferences, initialise PGN, open first session ──
  useEffect((): void => {
    if (startupRanRef.current) return;
    startupRanRef.current = true;

    log.info("useAppStartup", "Hello — startup sequence begins");

    migrateLocalStorage();
    migrateRemoteRulesCache();

    const appMode = resolveBuildAppMode(DEFAULT_APP_MODE);
    const devPrefsMode: DevPrefsMode = appMode === "DEV" ? initDevPrefsMode() : "user";
    log.info("useAppStartup", `Starting in ${appMode} mode (devPrefsMode=${devPrefsMode})`);

    const pgnLayout = applyBootstrapPrefs(dispatch, appMode, devPrefsMode);

    const snapshot = workspaceSnapshotStore.read();
    if (snapshot.sessions.length > 0) {
      log.info("useAppStartup", `Restoring workspace: ${snapshot.sessions.length} session(s), ${snapshot.resourceTabs.length} resource tab(s)`);
      restoreWorkspaceSnapshot(bundle, snapshot, dispatch);
    } else {
      log.debug("useAppStartup", "No snapshot found — opening fresh session");
      openFreshSession(bundle, pgnLayout, dispatch);
    }

    dispatchInitialSessionState(bundle.activeSessionRef.current, dispatch);
    log.info("useAppStartup", "App ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // ── Return stable orchestrator ─────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const services = useMemo(() => createSessionOrchestrator(bundle, dispatchRef, stateRef), [bundle]);

  // Build the native desktop menu bar from the declarative definition.
  useTauriMenu(services);

  return services;
};
