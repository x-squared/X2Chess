/**
 * FenHelpDialog — nested modal explaining FEN notation fields.
 *
 * Integration API:
 * - `<FenHelpDialog dialogRef={...} onClose={...} t={...} />`
 * - Caller opens it via `dialogRef.current?.showModal()` and listens to `onClose`.
 *
 * Communication API:
 * - `onClose()` — called when the native `close` event fires on the dialog element.
 */

import { type ReactElement, type RefObject } from "react";
import { UI_IDS } from "../../core/model/ui_ids";

type FenHelpDialogProps = {
  dialogRef: RefObject<HTMLDialogElement | null>;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
};

/** Nested modal that explains each FEN field. */
export const FenHelpDialog = ({ dialogRef, onClose, t }: FenHelpDialogProps): ReactElement => {
  const closeDialog = (): void => {
    const dlg = dialogRef.current;
    if (dlg?.open) dlg.close();
  };

  return (
    <dialog
      id="newgame-fen-help-dialog"
      ref={dialogRef}
      className="newgame-fen-help-dialog x2-dialog"
      data-ui-id={UI_IDS.NEW_GAME_FEN_HELP_DIALOG}
      onClose={onClose}
    >
      <div className="newgame-fen-help-inner">
        <p className="x2-dialog-title newgame-fen-help-title">
          {t("newgame.fenHelp.title", "About FEN")}
        </p>
        <div className="newgame-fen-help-sections">
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.placement", "Piece placement")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.placement.l1", "The board is written rank by rank from the 8th rank to the 1st.")}</li>
              <li>{t("newgame.fenHelp.placement.l2", "Within each rank, files run from a to h.")}</li>
              <li>{t("newgame.fenHelp.placement.l3", "Pieces use letters: uppercase for White, lowercase for Black.")}</li>
              <li>{t("newgame.fenHelp.placement.l4", "Empty squares are compressed as numbers.")}</li>
              <li>{t("newgame.fenHelp.placement.l5", "Slashes separate ranks.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.sideToMove", "Side to move")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.sideToMove.l1", "w means White to move.")}</li>
              <li>{t("newgame.fenHelp.sideToMove.l2", "b means Black to move.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.castling", "Castling rights")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.castling.l1", "K — White can castle kingside.")}</li>
              <li>{t("newgame.fenHelp.castling.l2", "Q — White can castle queenside.")}</li>
              <li>{t("newgame.fenHelp.castling.l3", "k — Black can castle kingside.")}</li>
              <li>{t("newgame.fenHelp.castling.l4", "q — Black can castle queenside.")}</li>
              <li>{t("newgame.fenHelp.castling.l5", "- means no castling is available.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.enPassant", "En passant target square")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.enPassant.l1", "If a pawn just advanced two squares, this field shows the square behind it.")}</li>
              <li>{t("newgame.fenHelp.enPassant.l2", "If no en passant capture is possible, use -.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.halfmove", "Halfmove clock")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.halfmove.l1", "Counts half-moves since the last pawn move or capture.")}</li>
              <li>{t("newgame.fenHelp.halfmove.l2", "Used for the 50-move draw rule.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.fullmove", "Fullmove number")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.fullmove.l1", "Starts at 1 and increases after Black's move.")}</li>
            </ul>
          </section>
        </div>
        <div className="newgame-fen-help-footer">
          <button type="button" className="x2-dialog-btn x2-dialog-btn--primary" onClick={closeDialog}>
            {t("newgame.fenHelp.close", "Close")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
