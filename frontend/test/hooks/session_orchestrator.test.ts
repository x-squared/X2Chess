import test from "node:test";
import assert from "node:assert/strict";
import { createSessionOrchestrator } from "../../src/core/services/session_orchestrator.js";
import { createEmptyGameSessionState } from "../../src/features/sessions/services/game_session_state.js";
import type { AppAction } from "../../src/state/actions.js";

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
