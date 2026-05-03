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

import { deriveInitialBoardFlipped, getHeaderValue, serializeModelToPgn } from "../../model";
import { findCursorForMoveId } from "../../../../parts/pgnparser/src/pgn_move_ops";
import type { PgnModel, PgnVariationNode, PgnEntryNode } from "../../../../parts/pgnparser/src/pgn_model";
import { getMoveRavs } from "../../../../parts/pgnparser/src/pgn_move_attachments";
import { buildPlayerNameSuggestions } from "../../features/editor/model/game_info";
import type { PlayerRecord } from "../../app/shell/model/app_state";
import type { AppStartupServices } from "../contracts/app_services";
import type { AppAction } from "../state/actions";
import type { PgnResourceRef } from "../../../../parts/resource/src/domain/resource_ref";
import type { PositionSearchHit, TextSearchHit } from "../../../../parts/resource/src/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../../parts/resource/src/domain/move_frequency";
import type { ChessSoundType } from "../../board/move_sound";
import type { AppStoreState } from "../state/app_reducer";
import type { Dispatch } from "react";
import type { ServicesBundle } from "./createAppServices";
import type { GameSessionState } from "../../features/sessions/services/game_session_state";
import { log } from "../../logger";
import { dispatchSessionStateSnapshot } from "../../hooks/session_state_sync";
import { resourceDomainEvents } from "../events/resource_domain_events";
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
  const locateVariationById = (
    root: PgnVariationNode,
    variationId: string,
  ): PgnVariationNode | null => {
    if (root.id === variationId) return root;
    for (const entry of root.entries) {
      if (entry.type !== "move") continue;
      for (const rav of getMoveRavs(entry)) {
        const found = locateVariationById(rav, variationId);
        if (found) return found;
      }
    }
    return null;
  };

  const buildModelFromMove = (
    model: PgnModel,
    moveId: string,
    fenBeforeMove: string,
  ): PgnModel | null => {
    const cursor = findCursorForMoveId(model, moveId);
    if (!cursor) return null;
    const variation = locateVariationById(model.root, cursor.variationId);
    if (!variation) return null;
    const moveIndex = variation.entries.findIndex(
      (entry: PgnEntryNode): boolean => entry.type === "move" && entry.id === moveId,
    );
    if (moveIndex < 0) return null;
    let startIndex = moveIndex;
    while (startIndex > 0 && variation.entries[startIndex - 1]?.type === "move_number") {
      startIndex -= 1;
    }
    const cloned: PgnModel = structuredClone(model);
    const targetVariation = locateVariationById(cloned.root, cursor.variationId);
    if (!targetVariation) return null;
    targetVariation.parentMoveId = null;
    targetVariation.depth = 0;
    cloned.root = targetVariation;
    cloned.root.entries = targetVariation.entries.slice(startIndex);
    if (
      startIndex === moveIndex &&
      cloned.root.entries[0]?.type === "move"
    ) {
      const fenParts: string[] = fenBeforeMove.trim().split(/\s+/);
      const sideToMove: string = fenParts[1] ?? "w";
      const fullmoveRaw: string = fenParts[5] ?? "1";
      const fullmoveNumber: number = Number.parseInt(fullmoveRaw, 10);
      const safeMoveNumber: number = Number.isFinite(fullmoveNumber) && fullmoveNumber > 0
        ? fullmoveNumber
        : 1;
      const tokenText: string = sideToMove === "b"
        ? `${safeMoveNumber}...`
        : `${safeMoveNumber}.`;
      cloned.root.entries.unshift({
        id: `copy_move_number_${safeMoveNumber}_${sideToMove}`,
        type: "move_number",
        text: tokenText,
      });
    }
    const setupHeader = cloned.headers.find((header) => header.key === "SetUp");
    if (setupHeader) setupHeader.value = "1";
    else cloned.headers.push({ key: "SetUp", value: "1" });
    const fenHeader = cloned.headers.find((header) => header.key === "FEN");
    if (fenHeader) fenHeader.value = fenBeforeMove;
    else cloned.headers.push({ key: "FEN", value: fenBeforeMove });
    return cloned;
  };

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
    playMoveSound: (soundType: ChessSoundType): void => {
      void bundle.moveSoundPlayer.playMoveSound(soundType);
    },

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
      dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel!) });
    },

    // ── Search ──────────────────────────────────────────────────────────────
    searchByPosition: async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<PositionSearchHit[]> =>
      bundle.resources.searchByPositionAcross(positionHash, resourceRefs),

    searchByText: async (query: string, resourceRefs: PgnResourceRef[]): Promise<TextSearchHit[]> =>
      bundle.resources.searchTextAcross(query, resourceRefs),

    explorePosition: async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<MoveFrequencyEntry[]> =>
      bundle.resources.explorePositionAcross(positionHash, resourceRefs),

    notifySessionItemsChanged: (): void => {
      bundle.sessionStore.notifySessionsChanged();
    },

    // ── Persistence ─────────────────────────────────────────────────────────
    setSaveMode: (mode: string): void => {
      bundle.sessionPersistence.setActiveSessionSaveMode(mode);
      flushSessionState();
    },

    copyGameToClipboard: async (fromMoveId?: string): Promise<boolean> => {
      const session = bundle.activeSessionRef.current;
      const model = session.pgnModel;
      if (!model) {
        log.warn("session_orchestrator", "copyGameToClipboard: ignored (no active PGN model)");
        return false;
      }
      let exportModel = model;
      if (typeof fromMoveId === "string" && fromMoveId.length > 0) {
        const startFen: string =
          (() => {
            const movePositionById = session.movePositionById;
            const current = movePositionById?.[fromMoveId];
            const previous = current?.previousMoveId ? movePositionById?.[current.previousMoveId] : undefined;
            if (previous?.fen) {
              return previous.fen;
            }
            return getHeaderValue(model, "FEN") || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
          })();
        const trimmedModel = buildModelFromMove(model, fromMoveId, startFen);
        if (!trimmedModel) {
          log.warn("session_orchestrator", "copyGameToClipboard: move not found", { moveId: fromMoveId });
          return false;
        }
        exportModel = trimmedModel;
      }
      const pgnText: string = serializeModelToPgn(exportModel);
      if (!pgnText.trim()) {
        log.warn("session_orchestrator", "copyGameToClipboard: ignored (empty PGN)");
        return false;
      }
      try {
        await navigator.clipboard.writeText(pgnText);
        log.info("session_orchestrator", "copyGameToClipboard: copied game PGN", {
          fromMoveId: fromMoveId ?? null,
          length: pgnText.length,
        });
        return true;
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        log.error("session_orchestrator", "copyGameToClipboard: clipboard write failed", { message });
        dispatchRef.current({ type: "set_error_message", message });
        return false;
      }
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
        dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel!) });
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

    loadResourceSchemaId: async (resourceRef: { kind: string; locator: string }): Promise<string | null> =>
      bundle.resources.loadResourceSchemaId(resourceRef as PgnResourceRef),

    persistResourceSchemaId: async (resourceRef: { kind: string; locator: string }, schemaId: string | null): Promise<void> =>
      bundle.resources.persistResourceSchemaId(resourceRef as PgnResourceRef, schemaId),

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

    // ── New game in active resource ─────────────────────────────────────────
    newGameInActiveResource: async (pgnText: string): Promise<void> => {
      const activeRef = bundle.resourceViewer.getActiveResourceRef();
      if (!activeRef || !activeRef.locator) {
        const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(pgnText);
        const derivedTitle: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, "New Game");
        bundle.sessionStore.openSession({ ownState: newState, title: derivedTitle });
        log.info("session_orchestrator", `newGameInActiveResource: no active resource, opened floating session ${summarizeHeaders(newState)}`);
        flushSessionState();
        dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel!) });
        return;
      }
      try {
        const parsedForTitle: GameSessionState = bundle.sessionModel.createSessionFromPgnText(pgnText);
        const derivedTitle: string = bundle.sessionModel.deriveSessionTitle(parsedForTitle.pgnModel, "game");
        const titleHint: string = `${derivedTitle}-${String(Date.now())}`;
        const created = await bundle.resources.createGameInResource(
          { kind: String(activeRef.kind || ""), locator: String(activeRef.locator) },
          pgnText,
          titleHint,
        );
        const sourceRef = created.sourceRef;
        const canonicalSourceRef = sourceRef?.kind && sourceRef?.locator
          ? {
              kind: String(sourceRef.kind),
              locator: String(sourceRef.locator),
              recordId: typeof sourceRef.recordId === "string" ? sourceRef.recordId : undefined,
            }
          : null;
        const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(pgnText);
        const title: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, titleHint);
        bundle.sessionStore.openSession({ ownState: newState, title, sourceRef: canonicalSourceRef });
        if (canonicalSourceRef) {
          const resourceRef = { kind: canonicalSourceRef.kind, locator: canonicalSourceRef.locator };
          resourceDomainEvents.emit({ type: "resource.gameCreated", resourceRef, sourceRef: canonicalSourceRef });
          resourceDomainEvents.emit({ type: "resource.resourceChanged", resourceRef, operation: "create", sourceRef: canonicalSourceRef });
        }
        log.info("session_orchestrator", `newGameInActiveResource: created in ${activeRef.kind}:${activeRef.locator}`, {
          recordId: canonicalSourceRef?.recordId ?? "",
        });
        flushSessionState();
        dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel!) });
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        log.error("session_orchestrator", `newGameInActiveResource: ${message}`);
        dispatchRef.current({ type: "set_error_message", message });
      }
    },

    // ── Overrideable UI stubs ───────────────────────────────────────────────
    // AppShell replaces these after construction to open panel/dialog components.
    openCurriculumPanel: (): void => {},
    openEngineManager: (): void => {},
    openEditorStyleDialog: (): void => {},
    openDefaultLayoutDialog: (): void => {},
    openNewGameDialog: (): void => {},
  };
};
