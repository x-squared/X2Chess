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
};

export const createApplyPgnModelUpdate = ({
  pgnRuntimeCapabilities,
  state,
  normalizeX2StyleValue,
}: ApplyPgnModelUpdateDeps) => {
  return (
    nextModel: unknown,
    focusCommentId: string | null = null,
    options: Record<string, unknown> = {},
  ): void => {
    pgnRuntimeCapabilities.applyPgnModelUpdate(nextModel, focusCommentId, options);
    const preferredLayoutMode = options.preferredLayoutMode;
    if (preferredLayoutMode !== undefined) {
      state.pgnLayoutMode = normalizeX2StyleValue(preferredLayoutMode);
    }
  };
};
