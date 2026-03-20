import { createEditorHistoryCapabilities } from "../editor/history";
import { createPgnRuntimeCapabilities } from "../editor/pgn_runtime";
import { createResourcesCapabilities } from "../resources";
import { createApplyPgnModelUpdate } from "./pgn_model_update";

type PgnDeps = Parameters<typeof createPgnRuntimeCapabilities>[0];
type HistoryDeps = Parameters<typeof createEditorHistoryCapabilities>[0];
type ResourcesDeps = Parameters<typeof createResourcesCapabilities>[0];
type ApplyPgnUpdateDeps = Parameters<typeof createApplyPgnModelUpdate>[0];

type DirtySessionLike = {
  updateActiveSessionMeta: (patch: { dirtyState: string }) => void;
};

type CorePgnBootstrapState = ApplyPgnUpdateDeps["state"] & HistoryDeps["state"] & ResourcesDeps["state"];

type CorePgnBootstrapDeps = {
  state: CorePgnBootstrapState;
  pgnInput: Element | null;
  t: PgnDeps["t"];
  defaultPgn: PgnDeps["defaultPgn"];
  parsePgnToModelFn: PgnDeps["parsePgnToModelFn"];
  serializeModelToPgnFn: PgnDeps["serializeModelToPgnFn"];
  buildMovePositionByIdFn: PgnDeps["buildMovePositionByIdFn"];
  stripAnnotationsForBoardParserFn: PgnDeps["stripAnnotationsForBoardParserFn"];
  onRender: PgnDeps["onRender"];
  getGameSessionStore: () => DirtySessionLike | null;
  onScheduleAutosave: () => void;
  normalizeX2StyleValue: ApplyPgnUpdateDeps["normalizeX2StyleValue"];
  getX2StyleFromModel: ApplyPgnUpdateDeps["getX2StyleFromModel"];
  onSetSaveStatus: ResourcesDeps["onSetSaveStatus"];
  onApplyRuntimeConfig: ResourcesDeps["onApplyRuntimeConfig"];
};

type CorePgnBootstrap = {
  pgnRuntimeCapabilities: ReturnType<typeof createPgnRuntimeCapabilities>;
  applyPgnModelUpdate: ReturnType<typeof createApplyPgnModelUpdate>;
  historyCapabilities: ReturnType<typeof createEditorHistoryCapabilities>;
  resourcesCapabilities: ReturnType<typeof createResourcesCapabilities>;
};

export const initializeCorePgnCapabilities = ({
  state,
  pgnInput,
  t,
  defaultPgn,
  parsePgnToModelFn,
  serializeModelToPgnFn,
  buildMovePositionByIdFn,
  stripAnnotationsForBoardParserFn,
  onRender,
  getGameSessionStore,
  onScheduleAutosave,
  normalizeX2StyleValue,
  getX2StyleFromModel,
  onSetSaveStatus,
  onApplyRuntimeConfig,
}: CorePgnBootstrapDeps): CorePgnBootstrap => {
  let historyCapabilities!: ReturnType<typeof createEditorHistoryCapabilities>;

  const pgnRuntimeCapabilities = createPgnRuntimeCapabilities({
    state,
    pgnInput,
    t,
    defaultPgn,
    parsePgnToModelFn,
    serializeModelToPgnFn,
    buildMovePositionByIdFn,
    stripAnnotationsForBoardParserFn,
    onRender,
    onRecordHistory: (): void => {
      if (!historyCapabilities) return;
      historyCapabilities.pushUndoSnapshot(historyCapabilities.captureEditorSnapshot());
      state.redoStack = [];
      const gameSessionStore = getGameSessionStore();
      if (gameSessionStore) {
        gameSessionStore.updateActiveSessionMeta({ dirtyState: "dirty" });
      }
    },
    onScheduleAutosave,
  });

  const applyPgnModelUpdate = createApplyPgnModelUpdate({
    pgnRuntimeCapabilities,
    state,
    normalizeX2StyleValue,
    getX2StyleFromModel,
  });

  historyCapabilities = createEditorHistoryCapabilities({
    state,
    pgnInput,
    onSyncChessParseState: pgnRuntimeCapabilities.syncChessParseState,
    onRender,
  });

  const resourcesCapabilities = createResourcesCapabilities({
    state,
    t,
    onSetSaveStatus,
    onApplyRuntimeConfig,
    onLoadPgn: pgnRuntimeCapabilities.loadPgn,
    onInitializeWithDefaultPgn: pgnRuntimeCapabilities.initializeWithDefaultPgn,
    pgnInput: pgnInput as { value: string } | null,
  });

  return {
    pgnRuntimeCapabilities,
    applyPgnModelUpdate,
    historyCapabilities,
    resourcesCapabilities,
  };
};
