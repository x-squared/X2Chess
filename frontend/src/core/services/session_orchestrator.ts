/**
 * createSessionOrchestrator — wires all user-facing operation groups into the
 * single `AppStartupServices` object consumed by `ServiceContext`.
 *
 * Integration API:
 * - `createSessionOrchestrator(bundle, dispatchRef, stateRef)` — call once from
 *   `useAppStartup`. Pure factory function; no React imports.
 *
 * Operation groups (each in its own module):
 * - Navigation + board orientation → `session_nav_ops`
 * - PGN editing + history         → `session_editing_ops`
 * - Shell state + preferences     → `session_shell_ops`
 * - Resource opening              → `session_resource_open_ops`
 *
 * Remaining operations handled here:
 * - Session lifecycle (switch, close, openPgnText)
 * - Position/text/exploration search
 * - Persistence (setSaveMode, saveActiveGameNow, saveSessionById)
 * - Player management
 * - Overrideable UI stubs (openCurriculumPanel, openEditorStyleDialog, openDefaultLayoutDialog)
 */

import { deriveInitialBoardFlipped, getHeaderValue } from "../../model";
import { buildPlayerNameSuggestions } from "../../features/editor/model/game_info";
import type { PlayerRecord } from "../../app/shell/model/app_state";
import type { AppStartupServices } from "../contracts/app_services";
import type { AppAction } from "../state/actions";
import type { PgnResourceRef } from "../../../../parts/resource/src/domain/resource_ref";
import type { PositionSearchHit, TextSearchHit } from "../../../../parts/resource/src/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../../parts/resource/src/domain/move_frequency";
import type { AppStoreState } from "../state/app_reducer";
import type { Dispatch } from "react";
import type { ServicesBundle } from "./createAppServices";
import type { GameSessionState } from "../../features/sessions/services/game_session_state";
import { log } from "../../logger";
import { dispatchSessionStateSnapshot } from "../../hooks/session_state_sync";
import { createResourceOpenOps } from "./session_resource_open_ops";
import { createNavOps } from "./session_nav_ops";
import { createEditingOps } from "./session_editing_ops";
import { createShellOps } from "./session_shell_ops";

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create all user-facing operation callbacks wired to the services bundle.
 *
 * @param bundle Fully-wired services bundle (created once from `createAppServicesBundle`).
 * @param dispatchRef Mutable ref carrying the latest React dispatch function.
 * @param stateRef Mutable ref mirroring the latest React state (updated on every render).
 * @returns `AppStartupServices` object consumed by `ServiceContext`.
 */
export const createSessionOrchestrator = (
  bundle: ServicesBundle,
  dispatchRef: { current: Dispatch<AppAction> },
  stateRef: { current: AppStoreState },
): AppStartupServices => {
  // Flush PGN/navigation/undo/focus state to React after inline session mutations.
  // Session-list and resource-viewer changes are dispatched by the
  // onSessionsChanged/onTabsChanged service callbacks automatically.
  const flushSessionState = (): void => {
    const g: GameSessionState = bundle.activeSessionRef.current;
    dispatchSessionStateSnapshot(g, dispatchRef.current);
  };

  const summarizeHeaders = (session: GameSessionState): string => {
    const white: string = getHeaderValue(session.pgnModel, "White", "");
    const black: string = getHeaderValue(session.pgnModel, "Black", "");
    const event: string = getHeaderValue(session.pgnModel, "Event", "");
    const date: string = getHeaderValue(session.pgnModel, "Date", "");
    return `White="${white}" Black="${black}" Event="${event}" Date="${date}"`;
  };

  const resourceOpenOps = createResourceOpenOps(bundle, dispatchRef, flushSessionState, summarizeHeaders);
  const navOps = createNavOps(bundle, dispatchRef, stateRef, flushSessionState);
  const editingOps = createEditingOps(bundle, dispatchRef, stateRef, flushSessionState);
  const shellOps = createShellOps(bundle, dispatchRef, stateRef);

  return {
    ...resourceOpenOps,
    ...navOps,
    ...editingOps,
    ...shellOps,

    // ── Session lifecycle ───────────────────────────────────────────────────
    switchSession: (sessionId: string): void => {
      const switched: boolean = bundle.sessionStore.switchToSession(sessionId);
      if (switched) {
        const g: GameSessionState = bundle.activeSessionRef.current;
        log.info("session_orchestrator", `switchSession: activated ${summarizeHeaders(g)}`, { sessionId });
        flushSessionState();
        return;
      }
      log.warn("session_orchestrator", "switchSession: ignored (not found or already active)", { sessionId });
    },

    closeSession: (sessionId: string): void => {
      bundle.sessionPersistence.cancelPendingAutosave();
      const result = bundle.sessionStore.closeSession(sessionId);
      if (result.closed) {
        if (result.emptyAfterClose) {
          const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText("");
          bundle.sessionStore.openSession({ ownState: newState, title: "New Game" });
        }
        flushSessionState();
      }
    },

    openPgnText: (pgnText: string, options?: { preferredTitle?: string; sourceRef?: { kind: string; locator: string; recordId?: string } | null }): void => {
      const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(pgnText);
      const derivedTitle: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, "New Game");
      const title: string = options?.preferredTitle || derivedTitle;
      bundle.sessionStore.openSession({ ownState: newState, title, sourceRef: options?.sourceRef ?? null });
      log.info("session_orchestrator", `openPgnText: opened session ${summarizeHeaders(newState)}`, { title });
      flushSessionState();
      dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel) });
    },

    // ── Search ──────────────────────────────────────────────────────────────
    searchByPosition: async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<PositionSearchHit[]> =>
      bundle.resources.searchByPositionAcross(positionHash, resourceRefs),

    searchByText: async (query: string, resourceRefs: PgnResourceRef[]): Promise<TextSearchHit[]> =>
      bundle.resources.searchTextAcross(query, resourceRefs),

    explorePosition: async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<MoveFrequencyEntry[]> =>
      bundle.resources.explorePositionAcross(positionHash, resourceRefs),

    // ── Persistence ─────────────────────────────────────────────────────────
    setSaveMode: (mode: string): void => {
      bundle.sessionPersistence.setActiveSessionSaveMode(mode);
      flushSessionState();
    },

    saveActiveGameNow: (): void => {
      log.info("session_orchestrator", "saveActiveGameNow: invoked");
      void bundle.sessionPersistence.persistActiveSessionNow();
    },

    discardActiveSessionChanges: async (): Promise<void> => {
      const session = bundle.sessionStore.getActiveSession();
      if (!session) return;
      const sourceRef = session.sourceRef;
      if (!sourceRef?.kind || !sourceRef.locator) {
        bundle.sessionStore.updateActiveSessionMeta({ dirtyState: "clean" });
        flushSessionState();
        return;
      }
      try {
        const result = await bundle.resources.loadGameBySourceRef({
          kind: String(sourceRef.kind),
          locator: String(sourceRef.locator),
          recordId: typeof sourceRef.recordId === "string" ? sourceRef.recordId : undefined,
        });
        const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(result.pgnText);
        bundle.sessionStore.replaceActiveSessionOwnState(newState);
        log.info("session_orchestrator", "discardActiveSessionChanges: reloaded session from source");
        flushSessionState();
        dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel) });
      } catch (err: unknown) {
        log.error(
          "session_orchestrator",
          `discardActiveSessionChanges: reload failed — ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },

    saveSessionById: (sessionId: string): void => {
      if (bundle.sessionStore.getActiveSessionId() !== sessionId) {
        bundle.sessionStore.switchToSession(sessionId);
        flushSessionState();
      }
      void bundle.sessionPersistence.persistActiveSessionNow();
    },

    // ── Player management ───────────────────────────────────────────────────
    getPlayerNameSuggestions: (query: string): string[] =>
      buildPlayerNameSuggestions(bundle.resources.getPlayerStore(), query),

    getPlayers: (): PlayerRecord[] => bundle.resources.getPlayerStore(),

    addPlayer: async (record: PlayerRecord): Promise<void> => {
      bundle.resources.addPlayerRecord(record);
      await bundle.resources.savePlayerStoreToClientData(bundle.resources.getPlayerStore());
    },

    deletePlayer: async (record: PlayerRecord): Promise<void> => {
      bundle.resources.deletePlayerRecord(record);
      await bundle.resources.savePlayerStoreToClientData(bundle.resources.getPlayerStore());
    },

    updatePlayer: async (oldRecord: PlayerRecord, updatedRecord: PlayerRecord): Promise<void> => {
      bundle.resources.updatePlayerRecord(oldRecord, updatedRecord);
      await bundle.resources.savePlayerStoreToClientData(bundle.resources.getPlayerStore());
    },

    // ── Overrideable UI stubs ───────────────────────────────────────────────
    // AppShell replaces these after construction to open panel/dialog components.
    openCurriculumPanel: (): void => {},
    openEditorStyleDialog: (): void => {},
    openDefaultLayoutDialog: (): void => {},
  };
};
