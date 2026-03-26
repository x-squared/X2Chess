/**
 * useAppStartup — initialises all application services and wires them to the
 * React reducer.
 *
 * This hook:
 *  1. Creates a mutable `AppState` object (held in a `useRef`) that the
 *     pure-logic service modules can read and write.
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
import { setHeaderValue } from "../model";
import {
  DEFAULT_LOCALE,
  DEFAULT_APP_MODE,
  type AppState,
} from "../app_shell/app_state";
import { resolveLocale } from "../app_shell/i18n";
import { normalizeGameInfoHeaderValue } from "../app_shell/game_info";
import {
  resolveBuildAppMode,
  readBootstrapUiPrefs,
  resolveInitialLocale,
  MODE_STORAGE_KEY,
} from "../runtime/bootstrap_prefs";
import { useAppContext } from "../state/app_context";
import type { AppStartupServices } from "../state/ServiceContext";
import type { AppAction } from "../state/actions";
import type { PgnModel } from "../model/pgn_model";
import type { PgnResourceRef } from "../../../resource/domain/resource_ref";
import type { PositionSearchHit, TextSearchHit } from "../../../resource/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../resource/domain/move_frequency";
import type { Dispatch } from "react";
import {
  createAppServicesBundle,
  type ServicesBundle,
} from "./createAppServices";

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
  if (bundleRef.current === null) {
    bundleRef.current = createAppServicesBundle(dispatchRef);
  }
  const bundle: ServicesBundle = bundleRef.current;

  // Stable sync: delegates to the bundle's render function so there is a
  // single canonical state-to-React dispatcher.
  const syncStateToReact = useCallback((): void => {
    bundle.render();
  }, [bundle]);

  // ── Mount effect: load preferences, initialise PGN, open first session ──
  useEffect((): void => {
    const s: AppState = bundle.legacyState;

    // 1. Load persisted preferences.
    const appMode = resolveBuildAppMode(DEFAULT_APP_MODE);
    const prefs = readBootstrapUiPrefs(appMode);
    s.isDeveloperToolsEnabled = prefs.isDeveloperToolsEnabled;
    s.appMode = appMode;

    // 2. Resolve locale.
    s.locale = resolveInitialLocale(resolveLocale, DEFAULT_LOCALE);

    // 3. Load persisted sound/speed/preview prefs.
    const savedSound = window.localStorage?.getItem("x2chess.sound");
    if (savedSound === "false") s.soundEnabled = false;
    const savedSpeed = Number(window.localStorage?.getItem("x2chess.moveDelayMs"));
    if (Number.isFinite(savedSpeed) && savedSpeed >= 0) s.moveDelayMs = savedSpeed;
    if (window.localStorage?.getItem("x2chess.positionPreviewOnHover") === "false") {
      dispatch({ type: "set_position_preview_on_hover", enabled: false });
    }

    // 4. Load persisted layout mode.
    const savedLayout = window.localStorage?.getItem("x2chess.pgnLayout");
    if (savedLayout === "text" || savedLayout === "tree" || savedLayout === "plain") {
      s.pgnLayoutMode = savedLayout;
    }

    // 5. Initialise with default PGN (creates initial session).
    try {
      bundle.pgnRuntime.initializeWithDefaultPgn();
      const initialSnapshot = bundle.sessionModel.captureActiveSessionSnapshot();
      bundle.sessionStore.openSession({
        snapshot: initialSnapshot,
        title: "Game 1",
      });
    } catch (err: unknown) {
      const message: string = err instanceof Error ? err.message : String(err);
      dispatch({ type: "set_error_message", message });
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
        void bundle.navigation.gotoPly(bundle.legacyState.moves.length);
      },
      gotoMoveById: (moveId: string): void => {
        const pos = bundle.legacyState.movePositionById?.[moveId] as
          | { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null }
          | undefined;
        if (pos && typeof pos.mainlinePly === "number") {
          bundle.legacyState.selectedMoveId = moveId;
          bundle.legacyState.boardPreview = null;
          syncStateToReact();
          void bundle.navigation.gotoPly(pos.mainlinePly, { animate: false });
        } else {
          bundle.legacyState.selectedMoveId = moveId;
          bundle.legacyState.boardPreview = pos?.fen
            ? ({ fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as import("../board/runtime").BoardPreviewLike)
            : null;
          syncStateToReact();
        }
      },
      handleEditorArrowHotkey: (event: KeyboardEvent): boolean =>
        bundle.navigation.handleSelectedMoveArrowHotkey(event),

      // PGN editing
      loadPgnText: (pgnText: string): void => {
        const s: AppState = bundle.legacyState;
        s.pgnText = pgnText;
        s.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(pgnText)) as typeof s.pgnModel;
        s.currentPly = 0;
        s.selectedMoveId = null;
        bundle.pgnRuntime.syncChessParseState(pgnText);
        syncStateToReact();
      },
      insertComment: (moveId: string, position: "before" | "after"): { id: string; rawText: string } | null => {
        const existing = findExistingCommentIdAroundMove(
          bundle.legacyState.pgnModel,
          moveId,
          position,
        );
        if (existing) {
          bundle.legacyState.pendingFocusCommentId = existing;
          bundle.legacyState.selectedMoveId = null;
          syncStateToReact();
          const rawText = getCommentRawById(bundle.legacyState.pgnModel, existing) ?? "";
          return { id: existing, rawText };
        }
        const result = insertCommentAroundMove(
          bundle.legacyState.pgnModel,
          moveId,
          position,
        );
        bundle.legacyState.selectedMoveId = null;
        bundle.applyModelUpdate(result.model, result.insertedCommentId, {
          recordHistory: true,
          preferredLayoutMode: bundle.legacyState.pgnLayoutMode,
        });
        return result.insertedCommentId ? { id: result.insertedCommentId, rawText: "" } : null;
      },
      focusCommentAroundMove: (moveId: string, position: "before" | "after"): void => {
        const existing = findExistingCommentIdAroundMove(
          bundle.legacyState.pgnModel,
          moveId,
          position,
        );
        if (existing) {
          bundle.legacyState.pendingFocusCommentId = existing;
          syncStateToReact();
        }
      },
      saveCommentText: (commentId: string, text: string): void => {
        const newModel = setCommentTextById(
          bundle.legacyState.pgnModel,
          commentId,
          text,
        );
        if (newModel) {
          bundle.applyModelUpdate(newModel, null, {
            recordHistory: false,
            preferredLayoutMode: bundle.legacyState.pgnLayoutMode,
          });
        }
      },
      applyDefaultIndent: (): void => {
        const newModel = applyDefaultIndentDirectives(bundle.legacyState.pgnModel);
        if (newModel) {
          bundle.applyModelUpdate(newModel, null, { recordHistory: true });
        }
      },
      updateGameInfoHeader: (key: string, rawValue: string): void => {
        const normalizedValue: string = normalizeGameInfoHeaderValue(key, rawValue);
        const newModel = setHeaderValue(
          bundle.legacyState.pgnModel as PgnModel,
          key,
          normalizedValue,
        );
        bundle.applyModelUpdate(newModel, null, { recordHistory: true });
      },

      // Move entry
      applyPgnModelEdit: (newModel: PgnModel, targetMoveId: string | null): void => {
        bundle.applyModelUpdate(newModel, null, {
          recordHistory: true,
          preferredLayoutMode: bundle.legacyState.pgnLayoutMode,
        });
        if (targetMoveId) {
          const pos = (bundle.legacyState.movePositionById as Record<string, { mainlinePly?: number | null; fen?: string; lastMove?: [string, string] | null } | undefined> | undefined)?.[targetMoveId];
          if (pos && typeof pos.mainlinePly === "number") {
            bundle.legacyState.selectedMoveId = targetMoveId;
            bundle.legacyState.boardPreview = null;
            void bundle.navigation.gotoPly(pos.mainlinePly, { animate: false });
          } else if (pos?.fen) {
            bundle.legacyState.selectedMoveId = targetMoveId;
            bundle.legacyState.boardPreview = { fen: pos.fen, lastMove: pos.lastMove ?? null } as unknown as import("../board/runtime").BoardPreviewLike;
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
            bundle.pgnRuntime.initializeWithDefaultPgn();
            const snap = bundle.sessionModel.captureActiveSessionSnapshot();
            bundle.sessionStore.openSession({ snapshot: snap, title: "Game 1" });
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
            bundle.resourceViewer.upsertTab({
              title: String(ref.locator ?? "").split("/").filter(Boolean).at(-1) || String(ref.kind ?? "Resource"),
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
      openPgnText: (pgnText: string): void => {
        const s: AppState = bundle.legacyState;
        s.pgnText = pgnText;
        s.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(pgnText)) as typeof s.pgnModel;
        s.currentPly = 0;
        s.selectedMoveId = null;
        bundle.pgnRuntime.syncChessParseState(pgnText);
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
            const s: AppState = bundle.legacyState;
            s.pgnText = result.pgnText;
            s.pgnModel = ensureRequiredPgnHeaders(parsePgnToModel(result.pgnText)) as typeof s.pgnModel;
            s.currentPly = 0;
            s.selectedMoveId = null;
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
          const snap = bundle.sessionModel.createSessionFromPgnText(result.pgnText);
          const title: string = bundle.sessionModel.deriveSessionTitle(snap.pgnModel, recordId);
          bundle.sessionStore.openSession({
            snapshot: snap,
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

      // Shell state
      setMenuOpen: (open: boolean): void => {
        bundle.legacyState.isMenuOpen = open;
        dispatch({ type: "set_is_menu_open", open });
      },
      setDevDockOpen: (open: boolean): void => {
        bundle.legacyState.isDevDockOpen = open;
        dispatch({ type: "set_dev_dock_open", open });
        window.localStorage?.setItem(MODE_STORAGE_KEY, String(open));
      },
      setActiveDevTab: (tab: "ast" | "dom" | "pgn"): void => {
        bundle.legacyState.activeDevTab = tab;
        bundle.legacyState.isDevDockOpen = true;
        dispatch({ type: "set_active_dev_tab", tab });
        dispatch({ type: "set_dev_dock_open", open: true });
      },
      setLayoutMode: (mode: "plain" | "text" | "tree"): void => {
        bundle.legacyState.pgnLayoutMode = mode;
        dispatch({ type: "set_layout_mode", mode });
        window.localStorage?.setItem("x2chess.pgnLayout", mode);
      },
      setLocale: (locale: string): void => {
        const resolved: string = resolveLocale(locale);
        bundle.legacyState.locale = resolved;
        dispatch({ type: "set_locale", locale: resolved });
        window.localStorage?.setItem("x2chess.locale", resolved);
      },
      setMoveDelayMs: (value: number): void => {
        bundle.legacyState.moveDelayMs = value;
        dispatch({ type: "set_move_delay_ms", value });
        window.localStorage?.setItem("x2chess.moveDelayMs", String(value));
      },
      setSoundEnabled: (enabled: boolean): void => {
        bundle.legacyState.soundEnabled = enabled;
        dispatch({ type: "set_sound_enabled", enabled });
        window.localStorage?.setItem("x2chess.sound", String(enabled));
      },
      setPositionPreviewOnHover: (enabled: boolean): void => {
        dispatch({ type: "set_position_preview_on_hover", enabled });
        window.localStorage?.setItem("x2chess.positionPreviewOnHover", String(enabled));
      },
      setDeveloperToolsEnabled: (enabled: boolean): void => {
        bundle.legacyState.isDeveloperToolsEnabled = enabled;
        dispatch({ type: "set_dev_tools_enabled", enabled });
        window.localStorage?.setItem(MODE_STORAGE_KEY, String(enabled));
      },
      setSaveMode: (mode: string): void => {
        const saveMode: "auto" | "manual" = mode === "manual" ? "manual" : "auto";
        bundle.legacyState.defaultSaveMode = saveMode;
        bundle.sessionStore.updateActiveSessionMeta({ saveMode });
        syncStateToReact();
      },
      saveActiveGameNow: (): void => {
        void bundle.sessionPersistence.persistActiveSessionNow();
      },
      saveSessionById: (sessionId: string): void => {
        if (bundle.legacyState.activeSessionId !== sessionId) {
          bundle.sessionStore.switchToSession(sessionId);
          syncStateToReact();
        }
        void bundle.sessionPersistence.persistActiveSessionNow();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle, dispatch, syncStateToReact],
  );
};
