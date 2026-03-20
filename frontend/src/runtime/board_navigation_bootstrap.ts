import { createBoardNavigationCapabilities } from "../board/navigation";

type BoardNavigationDeps = Parameters<typeof createBoardNavigationCapabilities>[0];

type MoveLookupCapabilitiesLike = {
  getMovePositionById: (
    moveId: string | null,
    options: { allowResolve: boolean },
  ) => unknown | null;
};

type SelectionRuntimeCapabilitiesLike = {
  selectMoveById: BoardNavigationDeps["selectMoveById"];
  focusCommentById: BoardNavigationDeps["focusCommentById"];
};

type BoardNavigationBootstrapDeps = {
  state: BoardNavigationDeps["state"];
  pgnModel: unknown;
  moveLookupCapabilities: MoveLookupCapabilitiesLike;
  selectionRuntimeCapabilities: SelectionRuntimeCapabilitiesLike;
  findExistingCommentIdAroundMoveFn: (pgnModel: unknown, moveId: string, position: "before" | "after") => string | null;
  playMoveSound: BoardNavigationDeps["playMoveSound"];
  render: BoardNavigationDeps["render"];
};

export const createBoardNavigationBootstrap = ({
  state,
  pgnModel,
  moveLookupCapabilities,
  selectionRuntimeCapabilities,
  findExistingCommentIdAroundMoveFn,
  playMoveSound,
  render,
}: BoardNavigationBootstrapDeps): ReturnType<typeof createBoardNavigationCapabilities> => {
  return createBoardNavigationCapabilities({
    state,
    getMovePositionById: (
      moveId: string | null,
      options: { allowResolve: boolean },
    ): ReturnType<BoardNavigationDeps["getMovePositionById"]> => {
      const lookupResult: unknown | null = moveLookupCapabilities.getMovePositionById(moveId, options);
      if (!lookupResult || typeof lookupResult !== "object") return null;
      return "variationFirstMoveIds" in lookupResult
        ? (lookupResult as ReturnType<BoardNavigationDeps["getMovePositionById"]>)
        : null;
    },
    selectMoveById: selectionRuntimeCapabilities.selectMoveById,
    findCommentIdAroundMove: (moveId: string, position: "before" | "after"): string | null =>
      findExistingCommentIdAroundMoveFn(pgnModel, moveId, position),
    focusCommentById: selectionRuntimeCapabilities.focusCommentById,
    playMoveSound,
    render,
  });
};
