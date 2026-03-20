import type { ReactElement } from "react";
import { useEditorRuntime } from "../hooks/useEditorRuntime";
import { useAppContext } from "../state/app_context";
import {
  selectIsGameInfoEditorOpen,
  selectLayoutMode,
  selectPendingFocusCommentId,
  selectPgnTextLength,
} from "../state/selectors";

/**
 * React editor boundary (Slice 4 in progress).
 */
export const EditorPanel = (): ReactElement => {
  useEditorRuntime();
  const { state } = useAppContext();
  const layoutMode: "plain" | "text" | "tree" = selectLayoutMode(state);
  const pendingFocusCommentId: string | null = selectPendingFocusCommentId(state);
  const isGameInfoEditorOpen: boolean = selectIsGameInfoEditorOpen(state);
  const pgnTextLength: number = selectPgnTextLength(state);

  return (
    <section
      data-react-slice="editor-panel"
      data-layout-mode={layoutMode}
      data-pending-focus-comment-id={pendingFocusCommentId || ""}
      data-game-info-open={isGameInfoEditorOpen ? "true" : "false"}
      data-pgn-text-length={String(pgnTextLength)}
      hidden
    />
  );
};
