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
 */

import { useRef, useEffect, useMemo } from "react";
import type { Dispatch } from "react";
import { DEFAULT_LOCALE, DEFAULT_APP_MODE } from "../shell/model/app_state";
import { resolveLocale } from "../i18n";
import {
  resolveBuildAppMode,
  readBootstrapUiPrefs,
  resolveInitialLocale,
  initDevPrefsMode,
  readShellPrefsForStartup,
  type AppMode,
  type DevPrefsMode,
} from "../../runtime/bootstrap_prefs";
import {
  workspaceSnapshotStore,
  type WorkspaceSnapshot,
} from "../../runtime/workspace_snapshot_store";
import { migrateLocalStorage } from "../../storage/migrate_local_storage";
import { migrateRemoteRulesCache } from "../../runtime/remote_rules_store";
import { readShapePrefs } from "../../runtime/shape_prefs";
import { readEditorStylePrefs } from "../../runtime/editor_style_prefs";
import { readDefaultLayoutPrefs } from "../../runtime/default_layout_prefs";
import { useAppContext } from "../providers/AppStateProvider";
import type { AppStartupServices } from "../../core/contracts/app_services";
import type { AppAction } from "../../core/state/actions";
import type { GameSessionState } from "../../features/sessions/services/game_session_state";
import type { LayoutMode } from "../../features/editor/model/plan/types";
import type { AppStoreState } from "../../core/state/app_reducer";
import {
  createAppServicesBundle,
  type ServicesBundle,
} from "../../core/services/createAppServices";
import { createSessionOrchestrator } from "../../core/services/session_orchestrator";
import { dispatchSessionStateSnapshot } from "../../hooks/session_state_sync";
import { useTauriMenu } from "../../hooks/useTauriMenu";
import { log } from "../../logger";
import {
  collectResourceRefsFromWorkspaceSnapshot,
  mirrorCanonicalResourceSchemaIds,
} from "./mirror_resource_schema_ids";
import { refreshResourceMetadataOverlaysAfterWorkspaceRestore } from "./workspace_restore_resource_metadata";

const dispatchInitialSessionState = (g: GameSessionState, dispatch: Dispatch<AppAction>): void => {
  dispatchSessionStateSnapshot(g, dispatch);
};

const applyBootstrapPrefs = (
  dispatch: Dispatch<AppAction>,
  appMode: AppMode,
  devPrefsMode: DevPrefsMode,
): LayoutMode => {
  const prefs = readBootstrapUiPrefs(appMode, devPrefsMode);
  const shellPrefs = readShellPrefsForStartup(devPrefsMode);

  dispatch({ type: "set_dev_tools_enabled", enabled: prefs.isDeveloperToolsEnabled });
  dispatch({ type: "set_locale", locale: resolveInitialLocale(resolveLocale, DEFAULT_LOCALE, devPrefsMode) });

  if (!shellPrefs.sound) {
    dispatch({ type: "set_sound_enabled", enabled: false });
  }
  if (Number.isFinite(shellPrefs.moveDelayMs) && shellPrefs.moveDelayMs > 0) {
    dispatch({ type: "set_move_delay_ms", value: shellPrefs.moveDelayMs });
  }
  if (!shellPrefs.positionPreviewOnHover) {
    dispatch({ type: "set_position_preview_on_hover", enabled: false });
  }

  dispatch({ type: "set_shape_prefs", prefs: readShapePrefs() });
  dispatch({ type: "set_editor_style_prefs", prefs: readEditorStylePrefs() });
  dispatch({ type: "set_default_layout_prefs", prefs: readDefaultLayoutPrefs() });

  return shellPrefs.pgnLayout;
};

const restoreWorkspaceSnapshot = (
  bundle: ServicesBundle,
  snapshot: WorkspaceSnapshot,
  dispatch: Dispatch<AppAction>,
): void => {
  const idMap = new Map<string, string>();
  for (const snap of snapshot.sessions) {
    try {
      const sessionState: GameSessionState =
        bundle.sessionModel.createSessionFromPgnText(snap.pgnText);
      sessionState.pgnLayoutMode = snap.pgnLayoutMode;
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

  if (snapshot.activeSessionId) {
    const restoredId = idMap.get(snapshot.activeSessionId);
    if (restoredId) bundle.sessionStore.switchToSession(restoredId);
  }

  for (const tabSnap of snapshot.resourceTabs) {
    if (tabSnap.kind && tabSnap.locator) {
      bundle.resourceViewer.upsertTab({
        title: tabSnap.title,
        resourceRef: { kind: tabSnap.kind, locator: tabSnap.locator },
        select: tabSnap.tabId === snapshot.activeResourceTabId,
      });
    }
  }

  const activeLayout = bundle.activeSessionRef.current.pgnLayoutMode;
  if (activeLayout !== "plain") {
    dispatch({ type: "set_layout_mode", mode: activeLayout });
  }
};

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
    if (pgnLayout !== "plain") {
      dispatch({ type: "set_layout_mode", mode: pgnLayout });
    }
  } catch (err: unknown) {
    const message: string = err instanceof Error ? err.message : String(err);
    log.error("useAppStartup", message);
    dispatch({ type: "set_error_message", message });
  }
};

export const useAppStartup = (): AppStartupServices => {
  const { dispatch, state } = useAppContext();

  const dispatchRef = useRef<Dispatch<AppAction>>(dispatch);
  dispatchRef.current = dispatch;

  const stateRef = useRef<AppStoreState>(state);
  stateRef.current = state;

  const bundleRef = useRef<ServicesBundle | null>(null);
  bundleRef.current ??= createAppServicesBundle(dispatchRef, stateRef);
  const bundle: ServicesBundle = bundleRef.current;

  const startupRanRef = useRef<boolean>(false);

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
  }, [state.sessions, state.activeSessionId, state.resourceViewerTabSnapshots, state.activeResourceTabId, state.pgnLayoutMode]);

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
      void (async (): Promise<void> => {
        try {
          await mirrorCanonicalResourceSchemaIds(
            bundle,
            collectResourceRefsFromWorkspaceSnapshot(snapshot),
          );
          await refreshResourceMetadataOverlaysAfterWorkspaceRestore(bundle);
        } catch (err: unknown) {
          const message: string = err instanceof Error ? err.message : String(err);
          log.error("useAppStartup", `refreshResourceMetadataOverlaysAfterWorkspaceRestore: ${message}`);
        }
        dispatchInitialSessionState(bundle.activeSessionRef.current, dispatch);
        log.info("useAppStartup", "App ready");
      })();
    } else {
      log.debug("useAppStartup", "No snapshot found — opening fresh session");
      openFreshSession(bundle, pgnLayout, dispatch);
      dispatchInitialSessionState(bundle.activeSessionRef.current, dispatch);
      log.info("useAppStartup", "App ready");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const services = useMemo(() => createSessionOrchestrator(bundle, dispatchRef, stateRef), [bundle]);

  useTauriMenu(services);

  return services;
};
