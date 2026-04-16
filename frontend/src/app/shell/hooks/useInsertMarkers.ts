/**
 * useInsertMarkers — insert `[[indent]]` / `[[deindent]]` markers into the focused
 * contenteditable comment editor.
 *
 * Integration API:
 * - `const { handleInsertIndentMarker, handleInsertDeindentMarker } = useInsertMarkers()`
 * - Pass the callbacks to `<TextEditorSidebar>`.
 *
 * Configuration API:
 * - No parameters.
 *
 * Communication API:
 * - Reads from `globalThis.getSelection()` and mutates the live DOM selection range.
 *   No React state; no context reads.
 */

import { useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UseInsertMarkersReturn = {
  handleInsertIndentMarker: () => void;
  handleInsertDeindentMarker: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const insertMarkerAtCaret = (markerText: string): void => {
  const selection: Selection | null = globalThis.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const anchorNode: Node | null = selection.anchorNode;
  const anchorElement: Element | null =
    anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement ?? null;
  const editableHost: HTMLElement | null = anchorElement?.closest(
    "[contenteditable='true']",
  ) as HTMLElement | null;
  if (!editableHost) return;
  const range: Range = selection.getRangeAt(0);
  range.deleteContents();
  const markerNode: Text = document.createTextNode(markerText);
  range.insertNode(markerNode);
  range.setStartAfter(markerNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Returns stable callbacks for inserting `[[indent]]` and `[[deindent]]` markers. */
export const useInsertMarkers = (): UseInsertMarkersReturn => {
  const handleInsertIndentMarker = useCallback((): void => {
    insertMarkerAtCaret("[[indent]] ");
  }, []);

  const handleInsertDeindentMarker = useCallback((): void => {
    insertMarkerAtCaret("[[deindent]] ");
  }, []);

  return { handleInsertIndentMarker, handleInsertDeindentMarker };
};
