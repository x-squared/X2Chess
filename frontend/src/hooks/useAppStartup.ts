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
  type DevPrefsMode,
} from "../runtime/bootstrap_prefs";
import { workspaceSnapshotStore } from "../runtime/workspace_snapshot_store";
import { migrateLocalStorage } from "../storage/migrate_local_storage";
import { migrateRemoteRulesCache } from "../runtime/remote_rules_store";
import { readShapePrefs } from "../runtime/shape_prefs";
import type { ShapePrefs } from "../runtime/shape_prefs";
import { readEditorStylePrefs } from "../runtime/editor_style_prefs";
import type { EditorStylePrefs } from "../runtime/editor_style_prefs";
import { readDefaultLayoutPrefs } from "../runtime/default_layout_prefs";
import type { DefaultLayoutPrefs } from "../runtime/default_layout_prefs";
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

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Initialise all application services on mount and return stable service callbacks.
 *
 * Must be called inside the `AppProvider` tree (needs `useAppContext`).
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
    // 1. Consolidate legacy localStorage keys into compound stores (idempotent).
    migrateLocalStorage();
    migrateRemoteRulesCache();

    // 2. Load persisted preferences from the compound shell-prefs store.
    //    In DEV mode, `devPrefsMode` controls whether factory defaults or the
    //    stored user prefs are applied (see bootstrap_prefs.ts / DIY manual).
    const appMode = resolveBuildAppMode(DEFAULT_APP_MODE);
    const devPrefsMode: DevPrefsMode = appMode === "DEV" ? initDevPrefsMode() : "user";
    const prefs = readBootstrapUiPrefs(appMode, devPrefsMode);
    const shellPrefs = readShellPrefsForStartup(devPrefsMode);
    dispatch({ type: "set_dev_tools_enabled", enabled: prefs.isDeveloperToolsEnabled });

    // 3. Resolve locale.
    const locale = resolveInitialLocale(resolveLocale, DEFAULT_LOCALE, devPrefsMode);
    dispatch({ type: "set_locale", locale });

    // 4. Load persisted sound/speed/preview prefs.
    if (!shellPrefs.sound) {
      dispatch({ type: "set_sound_enabled", enabled: false });
    }
    if (Number.isFinite(shellPrefs.moveDelayMs) && shellPrefs.moveDelayMs > 0) {
      dispatch({ type: "set_move_delay_ms", value: shellPrefs.moveDelayMs });
    }
    if (!shellPrefs.positionPreviewOnHover) {
      dispatch({ type: "set_position_preview_on_hover", enabled: false });
    }
    const savedShapePrefs: ShapePrefs = readShapePrefs();
    dispatch({ type: "set_shape_prefs", prefs: savedShapePrefs });
    const savedEditorStylePrefs: EditorStylePrefs = readEditorStylePrefs();
    dispatch({ type: "set_editor_style_prefs", prefs: savedEditorStylePrefs });
    const savedDefaultLayoutPrefs: DefaultLayoutPrefs = readDefaultLayoutPrefs();
    dispatch({ type: "set_default_layout_prefs", prefs: savedDefaultLayoutPrefs });

    // 5. Restore workspace snapshot (sessions + resource tabs) or fall back to
    //    a blank default session when no snapshot exists.
    type LayoutMode = "plain" | "text" | "tree";
    const snapshot = workspaceSnapshotStore.read();

    if (snapshot.sessions.length > 0) {
      // Map old session IDs → new session IDs so we can switch to the right one.
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

      // Restore the previously active session.
      if (snapshot.activeSessionId) {
        const restoredId = idMap.get(snapshot.activeSessionId);
        if (restoredId) bundle.sessionStore.switchToSession(restoredId);
      }

      // Restore resource viewer tabs.
      for (const tabSnap of snapshot.resourceTabs) {
        if (tabSnap.kind && tabSnap.locator) {
          bundle.resourceViewer.upsertTab({
            title: tabSnap.title,
            resourceRef: { kind: tabSnap.kind, locator: tabSnap.locator },
            select: tabSnap.tabId === snapshot.activeResourceTabId,
          });
        }
      }

      // Dispatch active session layout mode to React.
      const activeLayout = bundle.activeSessionRef.current.pgnLayoutMode as LayoutMode;
      if (activeLayout !== "plain") {
        dispatch({ type: "set_layout_mode", mode: activeLayout });
      }
    } else {
      // No saved workspace — open a blank empty session.
      const resolvedLayout: LayoutMode = shellPrefs.pgnLayout;
      try {
        const initialState: GameSessionState =
          bundle.sessionModel.createSessionFromPgnText("");
        initialState.pgnLayoutMode = resolvedLayout;
        bundle.sessionStore.openSession({ ownState: initialState, title: "New Game" });
        if (resolvedLayout !== "plain") {
          dispatch({ type: "set_layout_mode", mode: resolvedLayout });
        }
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        dispatch({ type: "set_error_message", message });
      }
    }

    // 6. Sync PGN/navigation/undo state to React after session setup.
    dispatchInitialSessionState(bundle.activeSessionRef.current, dispatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // ── Return stable orchestrator ─────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => createSessionOrchestrator(bundle, dispatchRef, stateRef), [bundle]);
};
