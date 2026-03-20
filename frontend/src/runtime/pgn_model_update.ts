type PgnRuntimeCapabilitiesLike = {
  applyPgnModelUpdate: (
    nextModel: unknown,
    focusCommentId?: string | null,
    options?: Record<string, unknown>,
  ) => void;
};

type PgnModelUpdateState = {
  pgnModel: unknown;
  pgnLayoutMode: string;
};

type ApplyPgnModelUpdateDeps = {
  pgnRuntimeCapabilities: PgnRuntimeCapabilitiesLike;
  state: PgnModelUpdateState;
  normalizeX2StyleValue: (value: unknown) => "plain" | "text" | "tree";
  getX2StyleFromModel: (model: unknown) => "plain" | "text" | "tree";
};

export const createApplyPgnModelUpdate = ({
  pgnRuntimeCapabilities,
  state,
  normalizeX2StyleValue,
  getX2StyleFromModel,
}: ApplyPgnModelUpdateDeps) => {
  return (
    nextModel: unknown,
    focusCommentId: string | null = null,
    options: Record<string, unknown> = {},
  ): void => {
    pgnRuntimeCapabilities.applyPgnModelUpdate(nextModel, focusCommentId, options);
    const preferredLayoutMode = options.preferredLayoutMode;
    const normalizedPreferredLayoutMode = normalizeX2StyleValue(preferredLayoutMode);
    const resolvedLayoutMode = getX2StyleFromModel(state.pgnModel);
    state.pgnLayoutMode = normalizedPreferredLayoutMode !== "plain" || preferredLayoutMode === "plain"
      ? normalizedPreferredLayoutMode
      : resolvedLayoutMode;
  };
};
