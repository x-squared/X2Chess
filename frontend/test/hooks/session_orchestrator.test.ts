import test from "node:test";
import assert from "node:assert/strict";
import { parsePgnToModel } from "../../../parts/pgnparser/src/pgn_model.js";
import { getMoveCommentsAfter } from "../../../parts/pgnparser/src/pgn_move_attachments.js";
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
  if (firstMove?.type !== "move") {
    assert.fail("expected first move node");
  }
  const commentId: string = getMoveCommentsAfter(firstMove)[0]?.id ?? "";
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

test("copyGameToClipboard copies full game and can start from selected move", async (): Promise<void> => {
  const session = createEmptyGameSessionState();
  session.pgnText = "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *";
  session.pgnModel = parsePgnToModel(session.pgnText);
  const mainlineMoveIds: string[] = session.pgnModel.root.entries
    .filter((entry): boolean => entry.type === "move")
    .map((entry) => String((entry as { id?: string }).id ?? ""));
  session.selectedMoveId = mainlineMoveIds[3] ?? null;
  const selectedMoveId: string | null = session.selectedMoveId;
  const previousMoveId: string | null = mainlineMoveIds[2] ?? null;
  if (selectedMoveId && previousMoveId) {
    session.movePositionById = {
      [previousMoveId]: {
        fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        lastMove: ["g1", "f3"],
        mainlinePly: 3,
        parentMoveId: null,
        variationFirstMoveIds: [],
        previousMoveId: mainlineMoveIds[1] ?? null,
      },
      [selectedMoveId]: {
        fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
        lastMove: ["b8", "c6"],
        mainlinePly: 4,
        parentMoveId: null,
        variationFirstMoveIds: [],
        previousMoveId,
      },
    };
  }
  const { dispatchRef } = makeDispatchRef();
  const stateRef = { current: {} as never };
  const copiedTexts: string[] = [];
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: {
      clipboard: {
        writeText: async (text: string): Promise<void> => {
          copiedTexts.push(text);
        },
      },
    },
  });
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
    sessionStore: {},
    sessionPersistence: {},
    moveLookup: {},
    moveSoundPlayer: { playMoveSound: async (): Promise<void> => {} },
  } as unknown as Parameters<typeof createSessionOrchestrator>[0];
  try {
    const services = createSessionOrchestrator(bundle, dispatchRef as never, stateRef as never);
    const copiedFull: boolean = await services.copyGameToClipboard();
    const copiedFromSelected: boolean = await services.copyGameToClipboard(selectedMoveId ?? undefined);
    assert.equal(copiedFull, true);
    assert.equal(copiedFromSelected, true);
    assert.equal(copiedTexts.length, 2);
    assert.match(copiedTexts[0] ?? "", /1\. e4 e5 2\. Nf3 Nc6 3\. Bb5 a6 \*/);
    assert.match(copiedTexts[1] ?? "", /2\.\.\. Nc6 3\. Bb5 a6/);
    assert.ok(!(copiedTexts[1] ?? "").includes("1. e4 e5"));
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: originalNavigator,
    });
  }
});

test("copyGameToClipboard can start from a variation move", async (): Promise<void> => {
  const session = createEmptyGameSessionState();
  session.pgnText = "1. e4 (1... c5 2. Nf3) e5 2. Nf3 *";
  session.pgnModel = parsePgnToModel(session.pgnText);
  let selectedVariationMoveId: string | null = null;
  const walk = (variation: { entries: Array<{ type: string; id?: string; san?: string; postItems?: unknown[] }> }): void => {
    for (const entry of variation.entries) {
      if (entry.type !== "move") continue;
      if (entry.san === "c5" && entry.id) {
        selectedVariationMoveId = entry.id;
        return;
      }
      const postItems = Array.isArray(entry.postItems) ? entry.postItems : [];
      for (const item of postItems) {
        if (
          typeof item === "object" &&
          item !== null &&
          "type" in item &&
          item.type === "rav" &&
          "rav" in item &&
          typeof item.rav === "object" &&
          item.rav !== null &&
          "entries" in item.rav &&
          Array.isArray(item.rav.entries)
        ) {
          walk(item.rav as { entries: Array<{ type: string; id?: string; san?: string; postItems?: unknown[] }> });
          if (selectedVariationMoveId) return;
        }
      }
    }
  };
  walk(session.pgnModel.root as { entries: Array<{ type: string; id?: string; san?: string; postItems?: unknown[] }> });
  assert.ok(selectedVariationMoveId);
  session.selectedMoveId = selectedVariationMoveId;
  session.movePositionById = {
    [selectedVariationMoveId as string]: {
      fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      lastMove: ["c7", "c5"],
      mainlinePly: null,
      parentMoveId: "m1",
      variationFirstMoveIds: [],
      previousMoveId: "m1",
    },
    m1: {
      fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      lastMove: ["e2", "e4"],
      mainlinePly: 1,
      parentMoveId: null,
      variationFirstMoveIds: [],
      previousMoveId: null,
    },
  };
  const { dispatchRef } = makeDispatchRef();
  const stateRef = { current: {} as never };
  const copiedTexts: string[] = [];
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: {
      clipboard: {
        writeText: async (text: string): Promise<void> => {
          copiedTexts.push(text);
        },
      },
    },
  });
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
    sessionStore: {},
    sessionPersistence: {},
    moveLookup: {},
    moveSoundPlayer: { playMoveSound: async (): Promise<void> => {} },
  } as unknown as Parameters<typeof createSessionOrchestrator>[0];
  try {
    const services = createSessionOrchestrator(bundle, dispatchRef as never, stateRef as never);
    const copied: boolean = await services.copyGameToClipboard(selectedVariationMoveId ?? undefined);
    assert.equal(copied, true);
    assert.equal(copiedTexts.length, 1);
    assert.match(copiedTexts[0] ?? "", /\[FEN "rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b KQkq - 0 1"\]/);
    assert.match(copiedTexts[0] ?? "", /1\.\.\. c5 2\. Nf3/);
    assert.ok(!(copiedTexts[0] ?? "").includes("1. e4"));
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: originalNavigator,
    });
  }
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
      loadResourceSchemaId: async (): Promise<string | null> => null,
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
      notifySessionsChanged: (): void => {},
      openSession: (input: {
        ownState: ReturnType<typeof createEmptyGameSessionState>;
        title: string;
        sourceRef: { kind: string; locator: string; recordId?: string } | null | undefined;
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

// ── loadPgnText ───────────────────────────────────────────────────────────────

test("loadPgnText replaces session model and marks dirty", (): void => {
  const session = createEmptyGameSessionState();
  session.pgnText = "1. e4 *";
  session.pgnModel = parsePgnToModel(session.pgnText);

  const { dispatchRef } = makeDispatchRef();
  const stateRef = { current: {} as never };
  const dirtyPatches: Array<Record<string, unknown>> = [];
  const syncedTexts: string[] = [];

  const bundle = {
    activeSessionRef: { current: session },
    navigation: {
      gotoPly: async (): Promise<void> => {},
      gotoRelativeStep: async (): Promise<void> => {},
      handleSelectedMoveArrowHotkey: (): boolean => false,
    },
    applyModelUpdate: (): void => {},
    history: { performUndo: (): void => {}, performRedo: (): void => {} },
    pgnRuntime: {
      syncChessParseState: (text: string): void => { syncedTexts.push(text); },
    },
    resources: {},
    resourceViewer: {},
    sessionModel: {},
    sessionStore: {
      updateActiveSessionMeta: (patch: Record<string, unknown>): void => { dirtyPatches.push(patch); },
    },
    sessionPersistence: {},
    moveLookup: {},
  } as unknown as Parameters<typeof createSessionOrchestrator>[0];

  const services = createSessionOrchestrator(bundle, dispatchRef as never, stateRef as never);
  const newPgn = "1. d4 d5 *";
  services.loadPgnText(newPgn);

  assert.equal(session.pgnText, newPgn, "pgnText updated on session");
  assert.ok(session.pgnModel !== null, "pgnModel replaced");
  assert.equal(session.currentPly, 0, "currentPly reset to 0");
  assert.equal(session.selectedMoveId, null, "selectedMoveId cleared");
  assert.ok(syncedTexts.includes(newPgn), "pgnRuntime.syncChessParseState called");
  assert.ok(dirtyPatches.some((p) => p.dirtyState === "dirty"), "session marked dirty");
});

// ── flipBoard ─────────────────────────────────────────────────────────────────

test("flipBoard toggles board orientation and dispatches action", (): void => {
  const session = createEmptyGameSessionState();
  session.pgnModel = parsePgnToModel("*");

  const { dispatchRef, actions } = makeDispatchRef();
  // Start with board showing white (not flipped).
  const stateRef = { current: { boardFlipped: false } as never };
  const modelUpdates: unknown[] = [];

  const bundle = {
    activeSessionRef: { current: session },
    navigation: {
      gotoPly: async (): Promise<void> => {},
      gotoRelativeStep: async (): Promise<void> => {},
      handleSelectedMoveArrowHotkey: (): boolean => false,
    },
    applyModelUpdate: (model: unknown): void => { modelUpdates.push(model); },
    history: { performUndo: (): void => {}, performRedo: (): void => {} },
    pgnRuntime: { syncChessParseState: (): void => {} },
    resources: {},
    resourceViewer: {},
    sessionModel: {},
    sessionStore: {},
    sessionPersistence: {},
    moveLookup: {},
  } as unknown as Parameters<typeof createSessionOrchestrator>[0];

  const services = createSessionOrchestrator(bundle, dispatchRef as never, stateRef as never);
  services.flipBoard();

  const flipAction = actions.find((a: AppAction): boolean => a.type === "set_board_flipped");
  assert.ok(flipAction, "set_board_flipped dispatched");
  assert.equal((flipAction as { type: string; flipped: boolean }).flipped, true, "flipped to true");
  // Standard game (no SetUp header) writes orientation header via applyModelUpdate.
  assert.equal(modelUpdates.length, 1, "applyModelUpdate called once for orientation header");
});

// ── switchSession ─────────────────────────────────────────────────────────────

test("switchSession delegates to sessionStore and flushes state", (): void => {
  const session = createEmptyGameSessionState();
  session.pgnModel = parsePgnToModel("*");

  const { dispatchRef } = makeDispatchRef();
  const stateRef = { current: {} as never };
  const switchCalls: string[] = [];

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
      switchToSession: (id: string): boolean => { switchCalls.push(id); return true; },
      getActiveSessionId: (): string => "session-1",
    },
    sessionPersistence: {},
    moveLookup: {},
  } as unknown as Parameters<typeof createSessionOrchestrator>[0];

  const services = createSessionOrchestrator(bundle, dispatchRef as never, stateRef as never);
  services.switchSession("session-2");

  assert.deepEqual(switchCalls, ["session-2"], "switchToSession called with correct id");
});

// ── closeSession ──────────────────────────────────────────────────────────────

test("closeSession opens a fallback session when store becomes empty", (): void => {
  const session = createEmptyGameSessionState();
  session.pgnModel = parsePgnToModel("*");

  const { dispatchRef } = makeDispatchRef();
  const stateRef = { current: {} as never };
  const openedSessions: Array<{ title: string }> = [];

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
    sessionModel: {
      createSessionFromPgnText: (): ReturnType<typeof createEmptyGameSessionState> => {
        const s = createEmptyGameSessionState();
        s.pgnModel = parsePgnToModel("*");
        return s;
      },
    },
    sessionStore: {
      closeSession: (): { closed: boolean; emptyAfterClose: boolean } =>
        ({ closed: true, emptyAfterClose: true }),
      openSession: (input: { title: string }): void => { openedSessions.push(input); },
    },
    sessionPersistence: { cancelPendingAutosave: (): void => {} },
    moveLookup: {},
  } as unknown as Parameters<typeof createSessionOrchestrator>[0];

  const services = createSessionOrchestrator(bundle, dispatchRef as never, stateRef as never);
  services.closeSession("session-1");

  assert.equal(openedSessions.length, 1, "fallback session opened");
  assert.equal(openedSessions[0]?.title, "New Game", "fallback title is 'New Game'");
});
