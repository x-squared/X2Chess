/**
 * PromotionPicker — overlay for choosing a promotion piece when a pawn reaches
 * the back rank.
 *
 * Integration API:
 * - `<PromotionPicker color="w" onPick={...} onCancel={...} />`
 *   Mount when a promotion is detected; unmount after `onPick` or `onCancel`.
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onPick(piece)` fires with "q" | "r" | "b" | "n".
 * - `onCancel()` fires when Escape is pressed (piece snaps back).
 */

import {
  useEffect,
  useRef,
  useCallback,
  type ReactElement,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { UI_IDS } from "../../core/model/ui_ids";

export type PromotionPiece = "q" | "r" | "b" | "n";

type PromotionPickerProps = {
  /** Side whose pawn is promoting: "w" (white) or "b" (black). */
  color: "w" | "b";
  t: (key: string, fallback?: string) => string;
  onPick: (piece: PromotionPiece) => void;
  onCancel: () => void;
};

// Unicode chess piece symbols by color and type.
const PIECE_SYMBOLS: Record<"w" | "b", Record<PromotionPiece, string>> = {
  w: { q: "♕", r: "♖", b: "♗", n: "♘" },
  b: { q: "♛", r: "♜", b: "♝", n: "♞" },
};

const PIECE_NAMES: Record<PromotionPiece, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

const PIECES: PromotionPiece[] = ["q", "r", "b", "n"];

/**
 * Overlay showing four piece buttons for pawn promotion selection.
 * Queen is highlighted as the default; pressing Enter confirms Queen.
 * Pressing Escape cancels.
 */
export const PromotionPicker = ({
  color,
  t,
  onPick,
  onCancel,
}: PromotionPickerProps): ReactElement => {
  const queenBtnRef = useRef<HTMLButtonElement>(null);

  useEffect((): void => {
    queenBtnRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    },
    [onCancel],
  );

  return (
    <div
      className="promotion-picker-overlay"
      role="dialog"
      aria-label={t("board.promotion.title", "Choose promotion piece")}
      aria-modal="true"
      data-ui-id={UI_IDS.PROMOTION_PICKER}
      onKeyDown={handleKeyDown}
    >
      <div className="promotion-picker-backdrop" onClick={onCancel} />
      <div className="promotion-picker-panel">
        <p className="promotion-picker-title">
          {t("board.promotion.title", "Promote pawn to:")}
        </p>
        <div className="promotion-picker-pieces">
          {PIECES.map((piece): ReactElement => (
            <button
              key={piece}
              ref={piece === "q" ? queenBtnRef : undefined}
              type="button"
              className={`promotion-picker-btn${piece === "q" ? " promotion-picker-btn--default" : ""}`}
              aria-label={t(
                `board.promotion.${piece}`,
                PIECE_NAMES[piece],
              )}
              onClick={(): void => { onPick(piece); }}
            >
              <span className="promotion-picker-symbol">
                {PIECE_SYMBOLS[color][piece]}
              </span>
              <span className="promotion-picker-name">
                {t(`board.promotion.${piece}`, PIECE_NAMES[piece])}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
