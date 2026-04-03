import type { ActiveSessionRef } from "../game_sessions/game_session_state";

type PgnRuntimeCapabilitiesLike = {
  applyPgnModelUpdate: (
    nextModel: unknown,
    focusCommentId?: string | null,
    options?: Record<string, unknown>,
  ) => void;
};

type ApplyPgnModelUpdateDeps = {
  pgnRuntimeCapabilities: PgnRuntimeCapabilitiesLike;
  sessionRef: ActiveSessionRef;
  normalizeX2StyleValue: (value: unknown) => "plain" | "text" | "tree";
};

export const createApplyPgnModelUpdate = ({
  pgnRuntimeCapabilities,
  sessionRef,
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
      sessionRef.current.pgnLayoutMode = normalizeX2StyleValue(preferredLayoutMode);
    }
  };
};
