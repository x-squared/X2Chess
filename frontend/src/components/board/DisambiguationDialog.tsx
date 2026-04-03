/**
 * DisambiguationDialog — modal dialog for resolving move-entry forks.
 *
 * Shown when the user plays a move that differs from the existing next move.
 * Presents three choices: Replace, Add as variation, Promote to mainline.
 *
 * Integration API:
 * - `<DisambiguationDialog playedSan={...} existingSan={...} onDecide={...} onCancel={...} />`
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onDecide(choice)` fires with "replace" | "variation" | "promote".
 * - `onCancel()` fires when the user cancels (piece snaps back on the board).
 */

import { useState, useRef, useEffect, useCallback, type ReactElement } from "react";
import { GUIDE_IDS } from "../../guide/guide_ids";

export type ForkChoice = "replace" | "variation" | "promote";

type DisambiguationDialogProps = {
  /** SAN of the move the user just played. */
  playedSan: string;
  /** SAN of the existing next move in the current line. */
  existingSan: string;
  t: (key: string, fallback?: string) => string;
  onDecide: (choice: ForkChoice) => void;
  onCancel: () => void;
};

/**
 * Modal dialog asking the user how to resolve a move-entry fork.
 * Default selection is "Add as variation" (safest — preserves existing content).
 */
export const DisambiguationDialog = ({
  playedSan,
  existingSan,
  t,
  onDecide,
  onCancel,
}: DisambiguationDialogProps): ReactElement => {
  const [choice, setChoice] = useState<ForkChoice>("variation");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleConfirm = useCallback((): void => {
    dialogRef.current?.close();
    onDecide(choice);
  }, [choice, onDecide]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onCancel();
  }, [onCancel]);

  return (
    <dialog
      ref={dialogRef}
      className="disambiguation-dialog"
      data-guide-id={GUIDE_IDS.DISAMBIGUATION_DIALOG}
      onClose={onCancel}
    >
      <div className="disambiguation-dialog-content">
        <p className="disambiguation-dialog-title">
          {t("editor.disambig.title", "Continue or create variation?")}
        </p>

        <p className="disambiguation-dialog-desc">
          {t("editor.disambig.played", "You played")}{" "}
          <strong>{playedSan}</strong>.{" "}
          {t("editor.disambig.existing", "The game continues with")}{" "}
          <strong>{existingSan}</strong>.
        </p>

        <div className="disambiguation-dialog-options">
          <label className="disambiguation-dialog-option">
            <input
              type="radio"
              name="fork-choice"
              value="replace"
              checked={choice === "replace"}
              onChange={(): void => { setChoice("replace"); }}
            />
            <span className="disambiguation-dialog-option-label">
              {t("editor.disambig.replace", "Replace the next move")}{" "}
              <span className="disambiguation-dialog-option-note">
                ({existingSan} {t("editor.disambig.replaceNote", "and all following moves are removed")})
              </span>
            </span>
          </label>

          <label className="disambiguation-dialog-option">
            <input
              type="radio"
              name="fork-choice"
              value="variation"
              checked={choice === "variation"}
              onChange={(): void => { setChoice("variation"); }}
            />
            <span className="disambiguation-dialog-option-label">
              {t("editor.disambig.variation", "Add as a variation")}{" "}
              <span className="disambiguation-dialog-option-note">
                ({playedSan} {t("editor.disambig.variationNote", "becomes an alternative to")}{" "}
                {existingSan})
              </span>
            </span>
          </label>

          <label className="disambiguation-dialog-option">
            <input
              type="radio"
              name="fork-choice"
              value="promote"
              checked={choice === "promote"}
              onChange={(): void => { setChoice("promote"); }}
            />
            <span className="disambiguation-dialog-option-label">
              {t("editor.disambig.promote", "Promote to mainline")}{" "}
              <span className="disambiguation-dialog-option-note">
                ({playedSan} {t("editor.disambig.promoteNote", "becomes the main move")},{" "}
                {existingSan} {t("editor.disambig.promoteNote2", "becomes alt")})
              </span>
            </span>
          </label>
        </div>

        <div className="disambiguation-dialog-actions">
          <button
            type="button"
            className="disambiguation-dialog-btn-cancel"
            onClick={handleCancel}
          >
            {t("editor.disambig.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="disambiguation-dialog-btn-confirm"
            onClick={handleConfirm}
          >
            {t("editor.disambig.confirm", "Confirm")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
