/**
 * useAppStartup — initialises all application services and wires them to the
 * React reducer.
 *
 * This hook:
 *  1. Creates a `ServicesBundle` (held in a `useRef`) containing shared state,
 *     an `ActiveSessionRef`, and all service instances.
 *  2. Wires every service's `onRender` callback to `bundle.render()` which
 *     dispatches the updated state into the React `useReducer` store.
 *  3. Loads persisted preferences from `localStorage` on mount.
 *  4. Initialises the default PGN and creates the first game session.
 *  5. Returns an `AppStartupServices` object consumed by `ServiceContext`.
 *
 * Integration API:
 * - `const services = useAppStartup()` — call once in `AppShell`; pass the
 *   result to `<ServiceContext.Provider value={services}>`.
 *
 * Configuration API:
 * - No props or parameters.  All configuration comes from `localStorage` and
 *   compile-time constants (`DEFAULT_PGN`, `DEFAULT_LOCALE`).
 *
 * Communication API:
 * - Inbound: `dispatch` from `useAppContext()`.
 * - Outbound: `AppStartupServices` callbacks; services call `bundle.render()`
 *   which calls `dispatch()` for each changed field.
 */

import { useRef, useEffect, useCallback, useMemo } from "react";
import {
  parsePgnToModel,
  ensureRequiredPgnHeaders,
  findExistingCommentIdAroundMove,
  getCommentRawById,
  insertCommentAroundMove,
  normalizeX2StyleValue,
  setCommentTextById,
  applyDefaultIndentDirectives,
} from "../editor";
import { setHeaderValue, findMoveNode, toggleMoveNag } from "../model";
import { serializeShapes, stripShapeAnnotations } from "../board/shape_serializer";
import type { BoardShape } from "../board/board_shapes";
import {
  DEFAULT_LOCALE,
  DEFAULT_APP_MODE,
  DEFAULT_PGN,
  type AppState,
  type PlayerRecord,
} from "../app_shell/app_state";
import { resolveLocale } from "../app_shell/i18n";
import { normalizeGameInfoHeaderValue, parsePlayerRecord, buildPlayerNameSuggestions } from "../app_shell/game_info";
import {
  resolveBuildAppMode,
  readBootstrapUiPrefs,
  resolveInitialLocale,
} from "../runtime/bootstrap_prefs";
import { shellPrefsStore } from "../runtime/shell_prefs_store";
import { workspaceSnapshotStore } from "../runtime/workspace_snapshot_store";
import { hasUnsavedSessions } from "../runtime/workspace_persistence";
import { migrateLocalStorage } from "../storage/migrate_local_storage";
import { migrateRemoteRulesCache } from "../runtime/remote_rules_store";
import { readShapePrefs, writeShapePrefs } from "../runtime/shape_prefs";
import type { ShapePrefs } from "../runtime/shape_prefs";
import { useAppContext } from "../state/app_context";
import type { AppStartupServices } from "../state/ServiceContext";
import type { AppAction } from "../state/actions";
import type { PgnModel } from "../model/pgn_model";
import type { GameSessionState } from "../game_sessions/game_session_state";
import type { PgnResourceRef } from "../../../resource/domain/resource_ref";
import type { PositionSearchHit, TextSearchHit } from "../../../resource/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../resource/domain/move_frequency";
import type { Dispatch } from "react";
import {
  createAppServicesBundle,
  type ServicesBundle,
} from "./createAppServices";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the last non-empty path segment of a locator string, or a fallback. */
const lastLocatorSegment = (locator: string | null | undefined, fallback: string): string => {
  const segments: string[] = (locator ?? "").split("/");
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (segments[i]) return segments[i];
  }
  return fallback;
};

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Initialise all application services on mount and return stable service callbacks.
 *
 * Must be called inside the `AppProvider` tree (needs `useAppContext`).
 */
export const useAppStartup = (): AppStartupServices => {
  const { dispatch } = useAppContext();

  // Keep a mutable ref to dispatch so the stable render callback never goes stale.
  const dispatchRef = useRef<Dispatch<AppAction>>(dispatch);
  dispatchRef.current = dispatch;

  // Lazily create all services once (on first render).
  const bundleRef = useRef<ServicesBundle | null>(null);
  bundleRef.current ??= createAppServicesBundle(dispatchRef);
  const bundle: ServicesBundle = bundleRef.current;

  // Stable sync: delegates to the bundle's render function so there is a
  // single canonical state-to-React dispatcher.
  const syncStateToReact = useCallback((): void => {
    bundle.render();
  }, [bundle]);

  // ── Mount effect: load preferences, initialise PGN, open first session ──
  useEffect((): void => {
    const s: AppState = bundle.sharedState;

    // 1. Consolidate legacy localStorage keys into compound stores (idempotent).
    migrateLocalStorage();
    migrateRemoteRulesCache();

    // 2. Load persisted preferences from the compound shell-prefs store.
    const appMode = resolveBuildAppMode(DEFAULT_APP_MODE);
    const prefs = readBootstrapUiPrefs(appMode);
    const shellPrefs = shellPrefsStore.read();
    s.isDeveloperToolsEnabled = prefs.isDeveloperToolsEnabled;
    s.appMode = appMode;
    dispatch({ type: "set_dev_tools_enabled", enabled: prefs.isDeveloperToolsEnabled });

    // 3. Resolve locale.
    s.locale = resolveInitialLocale(resolveLocale, DEFAULT_LOCALE);
    dispatch({ type: "set_locale", locale: s.locale });

    // 4. Load persisted sound/speed/preview prefs.
    if (!shellPrefs.sound) {
      s.soundEnabled = false;
      dispatch({ type: "set_sound_enabled", enabled: false });
    }
    if (Number.isFinite(shellPrefs.moveDelayMs) && shellPrefs.moveDelayMs > 0) {
      s.moveDelayMs = shellPrefs.moveDelayMs;
      dispatch({ type: "set_move_delay_ms", value: shellPrefs.moveDelayMs });
    }
    if (!shellPrefs.positionPreviewOnHover) {
      dispatch({ type: "set_position_preview_on_hover", enabled: false });
    }
    const savedShapePrefs: ShapePrefs = readShapePrefs();
    dispatch({ type: "set_shape_prefs", prefs: savedShapePrefs });

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
      // No saved workspace — open a blank default session.
      const resolvedLayout: LayoutMode = shellPrefs.pgnLayout;
      try {
        const initialState: GameSessionState =
          bundle.sessionModel.createSessionFromPgnText(DEFAULT_PGN);
        initialState.pgnLayoutMode = resolvedLayout;
        bundle.sessionStore.openSession({ ownState: initialState, title: "Game 1" });
        if (resolvedLayout !== "plain") {
          dispatch({ type: "set_layout_mode", mode: resolvedLayout });
        }
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        dispatch({ type: "set_error_message", message });
      }
    }

    // 6. Sync all computed state to React.
    syncStateToReact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // ── Stable service callbacks ───────────────────────────────────────────
  return useMemo(
    (): AppStartupServices => ({
      // Navigation
      gotoFirst: (): void => {
        void bundle.navigation.gotoPly(0);
      },
      gotoPrev: (): void => {
        void bundle.navigation.gotoRelativeStep(-1);
      },
      gotoNext: (): void => {
        void bundle.navigation.gotoRelativeStep(1);
      },
      gotoLast: (): void => {
        void bundle.navigation.gotoPly(bundle.activeSessionRef.current.moves.length);
      },
      gotoMoveById: (moveId: string): void => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        const pos = g.movePositionById?.[moveId] as
          | { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null }
          | undefined;
        if (pos && typeof pos.mainlinePly === "number") {
          g.selectedMoveId = moveId;
          g.boardPreview = null;
          syncStateToReact();
          void bundle.navigation.gotoPly(pos.mainlinePly, { animate: false });
        } else {
          g.selectedMoveId = moveId;
          g.boardPreview = pos?.fen
            ? ({ fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as import("../board/runtime").BoardPreviewLike)
            : null;
          syncStateToReact();
        }
      },
      handleEditorArrowHotkey: (event: KeyboardEvent): boolean =>
        bundle.navigation.handleSelectedMoveArrowHotkey(event),

      // PGN editing
      loadPgnText: (pgnText: string): void => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        g.pgnText = pgnText;
        g.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(pgnText)) as typeof g.pgnModel;
        g.currentPly = 0;
        g.selectedMoveId = null;
        bundle.pgnRuntime.syncChessParseState(pgnText);
        bundle.sessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
        syncStateToReact();
      },
      insertComment: (moveId: string, position: "before" | "after"): { id: string; rawText: string } | null => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        const existing = findExistingCommentIdAroundMove(g.pgnModel, moveId, position);
        if (existing) {
          g.pendingFocusCommentId = existing;
          g.selectedMoveId = null;
          syncStateToReact();
          const rawText = getCommentRawById(g.pgnModel, existing) ?? "";
          return { id: existing, rawText };
        }
        const result = insertCommentAroundMove(g.pgnModel, moveId, position);
        g.selectedMoveId = null;
        bundle.applyModelUpdate(result.model, result.insertedCommentId, {
          recordHistory: true,
          preferredLayoutMode: g.pgnLayoutMode,
        });
        return result.insertedCommentId ? { id: result.insertedCommentId, rawText: "" } : null;
      },
      focusCommentAroundMove: (moveId: string, position: "before" | "after"): void => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        const existing = findExistingCommentIdAroundMove(g.pgnModel, moveId, position);
        if (existing) {
          g.pendingFocusCommentId = existing;
          syncStateToReact();
        }
      },
      saveCommentText: (commentId: string, text: string): void => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        const newModel = setCommentTextById(g.pgnModel, commentId, text);
        if (newModel) {
          bundle.applyModelUpdate(newModel, null, {
            recordHistory: false,
            preferredLayoutMode: g.pgnLayoutMode,
          });
        }
      },
      applyDefaultIndent: (): void => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        const newModel = applyDefaultIndentDirectives(g.pgnModel);
        if (newModel) {
          bundle.applyModelUpdate(newModel, null, { recordHistory: true });
        }
      },
      saveBoardShapes: (moveId: string, shapes: BoardShape[]): void => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        if (!findMoveNode(g.pgnModel as PgnModel, moveId)) return;

        let commentId: string | null = findExistingCommentIdAroundMove(g.pgnModel, moveId, "after");
        let workingModel: unknown = g.pgnModel;

        if (!commentId) {
          if (shapes.length === 0) return;
          const result = insertCommentAroundMove(workingModel, moveId, "after", "");
          if (!result.insertedCommentId) return;
          commentId = result.insertedCommentId;
          workingModel = result.model;
        }

        const existingRaw: string | null = getCommentRawById(workingModel, commentId);
        const stripped: string = stripShapeAnnotations(existingRaw ?? "");
        const shapePart: string = serializeShapes(shapes);
        const newRaw: string = [stripped, shapePart].filter(Boolean).join(" ");

        const updatedModel = setCommentTextById(workingModel, commentId, newRaw);
        if (updatedModel) {
          bundle.applyModelUpdate(updatedModel, null, {
            recordHistory: true,
            preferredLayoutMode: g.pgnLayoutMode,
          });
        }
      },
      toggleMoveNag: (moveId: string, nag: string): void => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        const newModel = toggleMoveNag(g.pgnModel, moveId, nag);
        bundle.applyModelUpdate(newModel, null, {
          recordHistory: true,
          preferredLayoutMode: g.pgnLayoutMode,
        });
      },
      updateGameInfoHeader: (key: string, rawValue: string): void => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        const s: AppState = bundle.sharedState;
        const normalizedValue: string = normalizeGameInfoHeaderValue(key, rawValue);
        const newModel = setHeaderValue(g.pgnModel as PgnModel, key, normalizedValue);
        if (key === "X2Style") {
          const mode: "plain" | "text" | "tree" = normalizeX2StyleValue(normalizedValue);
          g.pgnLayoutMode = mode;
          shellPrefsStore.write({ ...shellPrefsStore.read(), pgnLayout: mode });
        }
        if (key === "White" || key === "Black") {
          const record: PlayerRecord | null = parsePlayerRecord(normalizedValue);
          if (record) {
            const storeKey: string = `${record.lastName.toLowerCase()}|${record.firstName.toLowerCase()}`;
            const exists: boolean = s.playerStore.some(
              (p: PlayerRecord): boolean =>
                `${p.lastName.toLowerCase()}|${p.firstName.toLowerCase()}` === storeKey,
            );
            if (!exists) {
              s.playerStore.push(record);
            }
          }
        }
        bundle.applyModelUpdate(newModel, null, { recordHistory: true });
      },

      // Move entry
      applyPgnModelEdit: (newModel: PgnModel, targetMoveId: string | null): void => {
        const g: GameSessionState = bundle.activeSessionRef.current;
        bundle.applyModelUpdate(newModel, null, {
          recordHistory: true,
          preferredLayoutMode: g.pgnLayoutMode,
        });
        if (targetMoveId) {
          const pos = (g.movePositionById as Record<string, { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null } | undefined> | undefined)?.[targetMoveId];
          if (pos && typeof pos.mainlinePly === "number") {
            g.selectedMoveId = targetMoveId;
            g.boardPreview = null;
            void bundle.navigation.gotoPly(pos.mainlinePly, { animate: false });
          } else if (pos?.fen) {
            g.selectedMoveId = targetMoveId;
            g.boardPreview = { fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as import("../board/runtime").BoardPreviewLike;
            syncStateToReact();
          }
        }
      },

      // History
      undo: (): void => {
        bundle.history.performUndo();
      },
      redo: (): void => {
        bundle.history.performRedo();
      },

      // Sessions
      switchSession: (sessionId: string): void => {
        const switched: boolean = bundle.sessionStore.switchToSession(sessionId);
        if (switched) syncStateToReact();
      },
      closeSession: (sessionId: string): void => {
        const result = bundle.sessionStore.closeSession(sessionId);
        if (result.closed) {
          if (result.emptyAfterClose) {
            const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText("");
            bundle.sessionStore.openSession({ ownState: newState, title: "New Game" });
          }
          syncStateToReact();
        }
      },

      // Resource rows
      openResource: (): void => {
        void (async (): Promise<void> => {
          try {
            const selected = await bundle.resources.chooseResourceByPicker();
            if (!selected) return;
            const ref = selected.resourceRef;
            const locatorLastSegment: string = lastLocatorSegment(ref.locator, String(ref.kind ?? "Resource"));
            bundle.resourceViewer.upsertTab({
              title: locatorLastSegment,
              resourceRef: ref,
              select: true,
            });
            syncStateToReact();
          } catch (err: unknown) {
            const message: string = err instanceof Error ? err.message : String(err);
            dispatch({ type: "set_error_message", message });
          }
        })();
      },
      openPgnText: (pgnText: string, options?: { preferredTitle?: string; sourceRef?: { kind: string; locator: string; recordId?: string } | null }): void => {
        const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(pgnText);
        const derivedTitle: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, "New Game");
        const title: string = options?.preferredTitle || derivedTitle;
        bundle.sessionStore.openSession({ ownState: newState, title, sourceRef: options?.sourceRef ?? null });
        syncStateToReact();
      },
      reorderGameInResource: async (sourceRef: unknown, neighborSourceRef: unknown): Promise<void> => {
        const ref = sourceRef as { kind?: string; locator?: string; recordId?: unknown } | null;
        const neighbor = neighborSourceRef as { kind?: string; locator?: string; recordId?: unknown } | null;
        await bundle.resources.reorderGameInResource(
          { kind: String(ref?.kind ?? "db"), locator: String(ref?.locator ?? ""), recordId: ref?.recordId == null ? undefined : String(ref.recordId) },
          { kind: String(neighbor?.kind ?? "db"), locator: String(neighbor?.locator ?? ""), recordId: neighbor?.recordId == null ? undefined : String(neighbor.recordId) },
        );
      },
      searchByPosition: async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<PositionSearchHit[]> =>
        bundle.resources.searchByPositionAcross(positionHash, resourceRefs),
      searchByText: async (query: string, resourceRefs: PgnResourceRef[]): Promise<TextSearchHit[]> =>
        bundle.resources.searchTextAcross(query, resourceRefs),
      explorePosition: async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<MoveFrequencyEntry[]> =>
        bundle.resources.explorePositionAcross(positionHash, resourceRefs),
      openGameFromRef: (sourceRef: unknown): void => {
        void (async (): Promise<void> => {
          const ref = sourceRef as { kind?: string; locator?: string; recordId?: unknown } | null;
          try {
            const result = await bundle.resources.loadGameBySourceRef({
              kind: String(ref?.kind ?? "directory"),
              locator: String(ref?.locator ?? ""),
              recordId: ref?.recordId == null ? undefined : String(ref.recordId),
            });
            // Write directly into the active session's state object.
            const g: GameSessionState = bundle.activeSessionRef.current;
            g.pgnText = result.pgnText;
            g.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(result.pgnText)) as typeof g.pgnModel;
            g.currentPly = 0;
            g.selectedMoveId = null;
            bundle.pgnRuntime.syncChessParseState(result.pgnText);
            // Record the source so the session no longer shows as unsaved.
            bundle.sessionStore.updateActiveSessionMeta({
              sourceRef: {
                kind: String(ref?.kind ?? "directory"),
                locator: String(ref?.locator ?? ""),
                recordId: ref?.recordId == null ? undefined : String(ref.recordId),
              },
              dirtyState: "clean",
            });
            syncStateToReact();
          } catch (err: unknown) {
            const message: string = err instanceof Error ? err.message : String(err);
            dispatch({ type: "set_error_message", message });
          }
        })();
      },

      // Game links
      openGameFromRecordId: async (recordId: string): Promise<void> => {
        const activeSession = bundle.sessionStore.getActiveSession();
        const sourceRef = activeSession?.sourceRef;
        if (!sourceRef?.kind || !sourceRef.locator) return;
        try {
          const result = await bundle.resources.loadGameBySourceRef({
            kind: String(sourceRef.kind),
            locator: String(sourceRef.locator),
            recordId,
          });
          const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(result.pgnText);
          const title: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, recordId);
          bundle.sessionStore.openSession({
            ownState: newState,
            title,
            sourceRef: { kind: String(sourceRef.kind), locator: String(sourceRef.locator), recordId },
          });
          syncStateToReact();
        } catch (err: unknown) {
          const message: string = err instanceof Error ? err.message : String(err);
          dispatch({ type: "set_error_message", message });
        }
      },
      fetchGameMetadataByRecordId: async (recordId: string): Promise<Record<string, string> | null> => {
        const activeSession = bundle.sessionStore.getActiveSession();
        const sourceRef = activeSession?.sourceRef;
        if (!sourceRef?.kind || !sourceRef.locator) return null;
        try {
          const resourceRef: { kind: string; locator: string } = {
            kind: String(sourceRef.kind),
            locator: String(sourceRef.locator),
          };
          const rows: unknown[] = await bundle.resources.listGamesForResource(resourceRef);
          const row = (rows as Array<Record<string, unknown>>).find((r: Record<string, unknown>): boolean => {
            const ref = r.sourceRef as Record<string, unknown> | null;
            return (
              String(ref?.recordId ?? "") === recordId ||
              String(r.identifier ?? "") === recordId
            );
          });
          if (!row) return null;
          return (row.metadata as Record<string, string>) ?? null;
        } catch {
          return null;
        }
      },
      getActiveSessionResourceRef: (): { kind: string; locator: string } | null => {
        const activeSession = bundle.sessionStore.getActiveSession();
        const sourceRef = activeSession?.sourceRef;
        if (!sourceRef?.kind || !sourceRef.locator) return null;
        return { kind: String(sourceRef.kind), locator: String(sourceRef.locator) };
      },

      // Shell state — pure React dispatch; sharedState kept in sync for service reads
      setMenuOpen: (open: boolean): void => {
        dispatch({ type: "set_is_menu_open", open });
      },
      setDevDockOpen: (open: boolean): void => {
        if (open && !bundle.sharedState.isDeveloperToolsEnabled) {
          bundle.sharedState.isDeveloperToolsEnabled = true;
          dispatch({ type: "set_dev_tools_enabled", enabled: true });
        }
        dispatch({ type: "set_dev_dock_open", open });
      },
      setActiveDevTab: (_tab: "ast"): void => {
        dispatch({ type: "set_active_dev_tab", tab: "ast" });
        dispatch({ type: "set_dev_dock_open", open: true });
      },
      setLayoutMode: (mode: "plain" | "text" | "tree"): void => {
        bundle.activeSessionRef.current.pgnLayoutMode = mode;
        dispatch({ type: "set_layout_mode", mode });
        shellPrefsStore.write({ ...shellPrefsStore.read(), pgnLayout: mode });
      },
      setShowEvalPills: (show: boolean): void => {
        dispatch({ type: "set_show_eval_pills", show });
      },
      setLocale: (locale: string): void => {
        const resolved: string = resolveLocale(locale);
        bundle.sharedState.locale = resolved;
        dispatch({ type: "set_locale", locale: resolved });
        shellPrefsStore.write({ ...shellPrefsStore.read(), locale: resolved });
      },
      setMoveDelayMs: (value: number): void => {
        bundle.sharedState.moveDelayMs = value;
        dispatch({ type: "set_move_delay_ms", value });
        shellPrefsStore.write({ ...shellPrefsStore.read(), moveDelayMs: value });
      },
      setSoundEnabled: (enabled: boolean): void => {
        bundle.sharedState.soundEnabled = enabled;
        dispatch({ type: "set_sound_enabled", enabled });
        shellPrefsStore.write({ ...shellPrefsStore.read(), sound: enabled });
      },
      setPositionPreviewOnHover: (enabled: boolean): void => {
        dispatch({ type: "set_position_preview_on_hover", enabled });
        shellPrefsStore.write({ ...shellPrefsStore.read(), positionPreviewOnHover: enabled });
      },
      setDeveloperToolsEnabled: (enabled: boolean): void => {
        bundle.sharedState.isDeveloperToolsEnabled = enabled;
        dispatch({ type: "set_dev_tools_enabled", enabled });
        shellPrefsStore.write({ ...shellPrefsStore.read(), developerToolsEnabled: enabled });
      },
      setShapePrefs: (prefs: ShapePrefs): void => {
        writeShapePrefs(prefs);
        dispatch({ type: "set_shape_prefs", prefs });
      },
      setSaveMode: (mode: string): void => {
        const saveMode: "auto" | "manual" = mode === "manual" ? "manual" : "auto";
        bundle.sharedState.defaultSaveMode = saveMode;
        bundle.sessionStore.updateActiveSessionMeta({ saveMode });
        syncStateToReact();
      },
      saveActiveGameNow: (): void => {
        void bundle.sessionPersistence.persistActiveSessionNow();
      },
      saveSessionById: (sessionId: string): void => {
        if (bundle.sharedState.activeSessionId !== sessionId) {
          bundle.sessionStore.switchToSession(sessionId);
          syncStateToReact();
        }
        void bundle.sessionPersistence.persistActiveSessionNow();
      },
      getPlayerNameSuggestions: (query: string): string[] =>
        buildPlayerNameSuggestions(bundle.sharedState.playerStore, query),

      // Overridden by AppShell to open the curriculum panel.
      openCurriculumPanel: (): void => {},
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, dispatch, syncStateToReact],
  );
};
