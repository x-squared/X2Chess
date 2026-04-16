import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model.js";
import { createSessionOrchestrator } from "../../src/core/services/session_orchestrator.js";
import { createEmptyGameSessionState } from "../../src/features/sessions/services/game_session_state.js";
import type { AppAction } from "../../src/core/state/actions.js";

type DispatchRef = { current: (action: AppAction) => void };

const makeDispatchRef = (): { dispatchRef: DispatchRef; actions: AppAction[] } => {
  const actions: AppAction[] = [];
  const dispatchRef: DispatchRef = {
    current: (action: AppAction): void => {
      actions.push(action);
    },
  };
  return { dispatchRef, actions };
};

test("gotoMoveById catches sync failures and dispatches error message", (): void => {
  const session = createEmptyGameSessionState();
  session.movePositionById = {
    move_main: {
      fen: "8/8/8/8/8/8/8/8 w - - 0 1",
      lastMove: null,
      mainlinePly: 3,
      parentMoveId: null,
      variationFirstMoveIds: [],
    },
  };
  const { dispatchRef, actions } = makeDispatchRef();
  const stateRef = { current: {} as never };
  const bundle = {
    activeSessionRef: { current: session },
    navigation: {
      gotoPly: (): Promise<void> => {
        throw new Error("boom-sync");
      },
      gotoRelativeStep: async (): Promise<void> => {},
      handleSelectedMoveArrowHotkey: (): boolean => false,
    },
    // Unused for this narrow test path:
    applyModelUpdate: () => {},
    history: { performUndo: () => {}, performRedo: () => {} },
    pgnRuntime: { syncChessParseState: () => {} },
    resources: {},
    resourceViewer: {},
    sessionModel: {},
    sessionStore: {},
    sessionPersistence: {},
    moveLookup: {},
  } as unknown as Parameters<typeof createSessionOrchestrator>[0];

  const services = createSessionOrchestrator(bundle, dispatchRef as never, stateRef as never);
  services.gotoMoveById("move_main");
  const errorAction = actions.find((a: AppAction): boolean => a.type === "set_error_message");
  assert.ok(errorAction);
});

test("saveCommentText marks session dirty when comment update succeeds", (): void => {
  const session = createEmptyGameSessionState();
  session.pgnModel = parsePgnToModel("1. e4 {old comment} *");
  const firstMove = session.pgnModel.root?.entries.find((entry) => entry.type === "move");
  assert.ok(firstMove?.type === "move");
  const commentId: string = firstMove.commentsAfter[0]?.id ?? "";
  assert.ok(commentId);

  const { dispatchRef } = makeDispatchRef();
  const stateRef = { current: {} as never };
  const dirtyPatches: Array<Record<string, unknown>> = [];
  const bundle = {
    activeSessionRef: { current: session },
    navigation: {
      gotoPly: async (): Promise<void> => {},
      gotoRelativeStep: async (): Promise<void> => {},
      handleSelectedMoveArrowHotkey: (): boolean => false,
    },
    applyModelUpdate: (): void => {},
    history: { performUndo: (): void => {}, performRedo: (): void => {} },
    pgnRuntime: { syncChessParseState: (): void => {} },
    resources: {},
    resourceViewer: {},
    sessionModel: {},
    sessionStore: {
      updateActiveSessionMeta: (patch: Record<string, unknown>): void => {
        dirtyPatches.push(patch);
      },
    },
    sessionPersistence: {},
    moveLookup: {},
  } as unknown as Parameters<typeof createSessionOrchestrator>[0];

  const services = createSessionOrchestrator(bundle, dispatchRef as never, stateRef as never);
  services.saveCommentText(commentId, "updated comment");
  assert.ok(dirtyPatches.some((patch) => patch.dirtyState === "dirty"));
});

test("openGameFromRef opens a new session instead of replacing active", async (): Promise<void> => {
  const activeSession = createEmptyGameSessionState();
  activeSession.pgnText = "1. e4 *";
  activeSession.pgnModel = parsePgnToModel(activeSession.pgnText);
  const loadedPgn = "1. d4 d5 2. c4 *";
  const openedSessions: Array<{
    ownState: ReturnType<typeof createEmptyGameSessionState>;
    title: string;
    sourceRef: { kind: string; locator: string; recordId?: string } | null | undefined;
  }> = [];
  const { dispatchRef, actions } = makeDispatchRef();
  const stateRef = { current: { boardFlipped: false } as never };
  const bundle = {
    activeSessionRef: { current: activeSession },
    navigation: {
      gotoPly: async (): Promise<void> => {},
      gotoRelativeStep: async (): Promise<void> => {},
      handleSelectedMoveArrowHotkey: (): boolean => false,
    },
    applyModelUpdate: (): void => {},
    history: { performUndo: (): void => {}, performRedo: (): void => {} },
    pgnRuntime: { syncChessParseState: (): void => {} },
    resources: {
      loadGameBySourceRef: async (): Promise<{ pgnText: string }> => ({ pgnText: loadedPgn }),
    },
    resourceViewer: {},
    sessionModel: {
      createSessionFromPgnText: (pgnText: string): ReturnType<typeof createEmptyGameSessionState> => {
        const state = createEmptyGameSessionState();
        state.pgnText = pgnText;
        state.pgnModel = parsePgnToModel(pgnText);
        return state;
      },
      deriveSessionTitle: (): string => "Loaded game",
    },
    sessionStore: {
      listSessions: (): Array<{ sourceRef?: { kind?: string; locator?: string; recordId?: string } }> => [],
      switchToSession: (): boolean => false,
      openSession: (input: {
        ownState: ReturnType<typeof createEmptyGameSessionState>;
        title: string;
        sourceRef?: { kind: string; locator: string; recordId?: string } | null;
      }): void => {
        openedSessions.push(input);
      },
    },
    sessionPersistence: {},
    moveLookup: {},
  } as unknown as Parameters<typeof createSessionOrchestrator>[0];

  const services = createSessionOrchestrator(bundle, dispatchRef as never, stateRef as never);
  services.openGameFromRef({ kind: "file", locator: "/tmp/games", recordId: "game1.pgn" });
  await new Promise<void>((resolve): void => { setTimeout(resolve, 0); });

  assert.equal(openedSessions.length, 1);
  assert.equal(openedSessions[0]?.title, "Loaded game");
  assert.equal(openedSessions[0]?.sourceRef?.recordId, "game1.pgn");
  assert.equal(activeSession.pgnText, "1. e4 *");
  const hasBoardFlipAction = actions.some((action: AppAction): boolean => action.type === "set_board_flipped");
  assert.equal(hasBoardFlipAction, true);
});
