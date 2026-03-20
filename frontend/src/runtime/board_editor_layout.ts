/**
 * Sync board-editor pane sizing from current board height.
 */
export const syncBoardEditorPaneMaxHeight = (
  boardEl: Element | null,
  boardEditorPaneEl: Element | null,
): void => {
  const boardHeight = Math.round(boardEl?.getBoundingClientRect?.().height || 0);
  if (boardEditorPaneEl instanceof HTMLElement && boardHeight > 0) {
    boardEditorPaneEl.style.maxHeight = `${boardHeight}px`;
  }
};
