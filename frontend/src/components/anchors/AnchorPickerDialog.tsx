/**
 * AnchorPickerDialog — dialog for selecting an anchor when inserting a reference.
 *
 * Integration API:
 * - `<AnchorPickerDialog allAnchors={...} currentId={...} onSelect={...}
 *     onCancel={...} t={...} />`
 *
 * Communication API:
 * - `onSelect(anchorId)` — called when the user picks an anchor row.
 * - `onCancel()` — called when the dialog is dismissed.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactElement,
} from "react";
import type { ResolvedAnchor } from "../editor/resolveAnchors";
import { AnchorList } from "./AnchorList";

// ── Types ─────────────────────────────────────────────────────────────────────

type AnchorPickerDialogProps = {
  /** All resolved anchors available for selection. */
  allAnchors: ResolvedAnchor[];
  /** Pre-selected anchor ID (when editing an existing reference). */
  currentId?: string;
  onSelect: (anchorId: string) => void;
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Modal dialog for picking an anchor when inserting a `[%anchorref ...]`.
 * Shows a searchable list of all anchors in the game.
 */
export const AnchorPickerDialog = ({
  allAnchors,
  currentId,
  onSelect,
  onCancel,
  t,
}: AnchorPickerDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState<string>("");

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleSelect = useCallback(
    (anchor: ResolvedAnchor): void => {
      dialogRef.current?.close();
      onSelect(anchor.id);
    },
    [onSelect],
  );

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onCancel();
  }, [onCancel]);

  return (
    <dialog ref={dialogRef} className="anchor-picker-dialog" onClose={onCancel}>
      <div className="anchor-picker-dialog-inner">
        <p className="anchor-picker-title">
          {t("anchorPicker.title", "Insert anchor reference")}
        </p>

        <input
          className="anchor-picker-search"
          type="search"
          placeholder={t("anchorPicker.search", "Search by label or ID…")}
          value={query}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onChange={(e): void => { setQuery(e.target.value); }}
        />

        <AnchorList
          anchors={allAnchors}
          query={query}
          selectedId={currentId}
          onSelect={handleSelect}
          t={t}
        />

        <div className="anchor-picker-actions">
          <button type="button" className="anchor-picker-btn-cancel" onClick={handleCancel}>
            {t("editor.anchor.cancel", "Cancel")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
