import { createBoardRuntimeCapabilities } from "../board/runtime";
import { createMoveLookupCapabilities } from "../board/move_lookup";
import { createSelectionRuntimeCapabilities } from "../editor/selection_runtime";
import { createRuntimeConfigCapabilities } from "../app_shell/runtime_config";
import type { MainlinePlyByMoveId, PgnModelForMoves } from "../board/move_position";

type BoardRuntimeDeps = Parameters<typeof createBoardRuntimeCapabilities>[0];
type RuntimeConfigDeps = Parameters<typeof createRuntimeConfigCapabilities>[0];
type MoveLookupDeps = Parameters<typeof createMoveLookupCapabilities>[0];
type SelectionDeps = Parameters<typeof createSelectionRuntimeCapabilities>[0];

type RuntimeState = BoardRuntimeDeps["state"] & RuntimeConfigDeps["state"] & MoveLookupDeps["state"] & SelectionDeps["state"];

type CoreRuntimeBootstrapDeps = {
  state: RuntimeState;
  boardEl: BoardRuntimeDeps["boardEl"];
  astWrapEl: RuntimeConfigDeps["astWrapEl"];
  domWrapEl: RuntimeConfigDeps["domWrapEl"];
  textEditorEl: SelectionDeps["textEditorEl"];
  buildMovePositionByIdFn: MoveLookupDeps["buildMovePositionByIdFn"];
  resolveMovePositionByIdFn: MoveLookupDeps["resolveMovePositionByIdFn"];
  buildMainlinePlyByMoveIdFn: (pgnModel: PgnModelForMoves) => MainlinePlyByMoveId;
  findExistingCommentIdAroundMoveFn: (pgnModel: unknown, moveId: string, position: "before" | "after") => string | null;
  insertCommentAroundMoveFn: (pgnModel: unknown, moveId: string, position: "before" | "after", rawText: string) => { model: unknown; insertedCommentId: string | null; created?: boolean };
  removeCommentByIdFn: SelectionDeps["removeCommentByIdFn"];
  setCommentTextByIdFn: SelectionDeps["setCommentTextByIdFn"];
  resolveOwningMoveIdForCommentFn: SelectionDeps["resolveOwningMoveIdForCommentFn"];
  applyPgnModelUpdate: SelectionDeps["applyPgnModelUpdate"];
  onRender: SelectionDeps["onRender"];
};

type CoreRuntimeBootstrap = {
  boardRuntimeCapabilities: ReturnType<typeof createBoardRuntimeCapabilities>;
  runtimeConfigCapabilities: ReturnType<typeof createRuntimeConfigCapabilities>;
  moveLookupCapabilities: ReturnType<typeof createMoveLookupCapabilities>;
  selectionRuntimeCapabilities: ReturnType<typeof createSelectionRuntimeCapabilities>;
};

export const initializeCoreRuntimeCapabilities = ({
  state,
  boardEl,
  astWrapEl,
  domWrapEl,
  textEditorEl,
  buildMovePositionByIdFn,
  resolveMovePositionByIdFn,
  buildMainlinePlyByMoveIdFn,
  findExistingCommentIdAroundMoveFn,
  insertCommentAroundMoveFn,
  removeCommentByIdFn,
  setCommentTextByIdFn,
  resolveOwningMoveIdForCommentFn,
  applyPgnModelUpdate,
  onRender,
}: CoreRuntimeBootstrapDeps): CoreRuntimeBootstrap => {
  const boardRuntimeCapabilities = createBoardRuntimeCapabilities({
    state,
    boardEl,
  });

  const runtimeConfigCapabilities = createRuntimeConfigCapabilities({
    state,
    astWrapEl,
    domWrapEl,
  });

  const moveLookupCapabilities = createMoveLookupCapabilities({
    state,
    buildMovePositionByIdFn,
    resolveMovePositionByIdFn,
  });

  const selectionRuntimeCapabilities = createSelectionRuntimeCapabilities({
    state,
    textEditorEl,
    getMovePositionById: (
      moveId: string | null,
      options: { allowResolve: boolean },
    ): ReturnType<typeof selectionRuntimeCapabilities.getMovePositionById> => {
      const lookupResult = moveLookupCapabilities.getMovePositionById(moveId, options);
      if (!lookupResult) return null;
      return "variationFirstMoveIds" in lookupResult ? lookupResult : null;
    },
    buildMainlinePlyByMoveIdFn,
    findExistingCommentIdAroundMoveFn,
    insertCommentAroundMoveFn,
    removeCommentByIdFn,
    setCommentTextByIdFn,
    resolveOwningMoveIdForCommentFn,
    applyPgnModelUpdate,
    onRender,
  });

  return {
    boardRuntimeCapabilities,
    runtimeConfigCapabilities,
    moveLookupCapabilities,
    selectionRuntimeCapabilities,
  };
};
