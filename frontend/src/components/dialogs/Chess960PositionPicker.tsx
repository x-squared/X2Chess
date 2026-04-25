/**
 * Chess960PositionPicker — interactive back-rank picker for Chess960 starting positions.
 *
 * Integration API:
 * - `<Chess960PositionPicker backRank={...} onBackRankChange={...} t={...} />`
 *
 * Communication API:
 * - `onBackRankChange(backRank)` — called whenever the back rank changes via
 *   SP navigation, piece swap, or the Random button.
 */

import { useState, useCallback, type ReactElement } from "react";
import {
  chess960SpToBackRank,
  chess960SpFromBackRank,
} from "./PositionSetupBoard";

// ── Chess960Board ─────────────────────────────────────────────────────────────

type Chess960BoardProps = {
  backRank: string;
  selectedFile: number | null;
  onFileClick: (file: number) => void;
};

/**
 * 8×8 board for Chess960 position selection.
 * Only the bottom row (rank 1, white back rank) is interactive.
 */
const Chess960Board = ({ backRank, selectedFile, onFileClick }: Chess960BoardProps): ReactElement => {
  const squares: string[] = new Array<string>(64).fill("");
  for (let f = 0; f < 8; f++) {
    squares[f]      = (backRank[f] ?? "").toLowerCase();
    squares[8 + f]  = "p";
    squares[48 + f] = "P";
    squares[56 + f] = backRank[f] ?? "";
  }

  return (
    <div className="newgame-chess960-preview-board">
      {squares.map((piece, idx) => {
        const rankIdx: number = Math.floor(idx / 8);
        const fileIdx: number = idx % 8;
        const isLight: boolean   = (rankIdx + fileIdx) % 2 === 0;
        const interactive: boolean = rankIdx === 7;
        const selected: boolean    = interactive && fileIdx === selectedFile;
        const cls: string = [
          "position-setup-square",
          isLight ? "light" : "dark",
          interactive ? "chess960-interactive" : "chess960-static",
          selected    ? "chess960-selected"    : "",
        ].filter(Boolean).join(" ");
        return (
          <div
            key={`${rankIdx}-${fileIdx}`}
            className={cls}
            onClick={interactive ? (): void => { onFileClick(fileIdx); } : undefined}
          >
            {piece && (
              <div
                className="position-setup-piece"
                style={{
                  backgroundImage: `var(--piece-${piece === piece.toUpperCase() ? "w" : "b"}${piece.toLowerCase()}-image)`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Chess960PositionPicker ────────────────────────────────────────────────────

type Chess960PositionPickerProps = {
  backRank: string;
  onBackRankChange: (backRank: string) => void;
  t: (key: string, fallback?: string) => string;
};

/** SP navigator + interactive board for picking a Chess960 starting position. */
export const Chess960PositionPicker = ({
  backRank,
  onBackRankChange,
  t,
}: Chess960PositionPickerProps): ReactElement => {
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const currentSp = chess960SpFromBackRank(backRank);

  const handleFileClick = useCallback((file: number): void => {
    if (selectedFile === null) {
      setSelectedFile(file);
    } else if (selectedFile === file) {
      setSelectedFile(null);
    } else {
      const arr: string[] = backRank.split("");
      const a: string = arr[selectedFile] ?? "";
      const b: string = arr[file] ?? "";
      arr[selectedFile] = b;
      arr[file] = a;
      onBackRankChange(arr.join(""));
      setSelectedFile(null);
    }
  }, [selectedFile, backRank, onBackRankChange]);

  return (
    <div className="newgame-chess960-picker">
      <div className="newgame-chess960-sp-row">
        <button
          type="button"
          className="x2-dialog-btn x2-dialog-btn--ghost newgame-chess960-nav-btn"
          onClick={(): void => {
            if (currentSp !== null && currentSp > 0) {
              onBackRankChange(chess960SpToBackRank(currentSp - 1));
              setSelectedFile(null);
            }
          }}
          aria-label={t("newgame.chess960.prev", "Previous position")}
          disabled={currentSp === null || currentSp === 0}
        >
          ←
        </button>
        <span className={`newgame-chess960-sp-label${currentSp === null ? " invalid" : ""}`}>
          {currentSp !== null
            ? `${t("newgame.chess960.sp", "SP")} ${currentSp}`
            : t("newgame.chess960.spInvalid", "— invalid —")}
        </span>
        <button
          type="button"
          className="x2-dialog-btn x2-dialog-btn--ghost newgame-chess960-nav-btn"
          onClick={(): void => {
            if (currentSp !== null && currentSp < 959) {
              onBackRankChange(chess960SpToBackRank(currentSp + 1));
              setSelectedFile(null);
            }
          }}
          aria-label={t("newgame.chess960.next", "Next position")}
          disabled={currentSp === null || currentSp === 959}
        >
          →
        </button>
        <button
          type="button"
          className="x2-dialog-btn x2-dialog-btn--ghost"
          onClick={(): void => {
            onBackRankChange(chess960SpToBackRank(Math.floor(Math.random() * 960)));
            setSelectedFile(null);
          }}
        >
          {t("newgame.chess960.random", "Random")}
        </button>
      </div>

      <p className="newgame-chess960-hint">
        {t("newgame.chess960.hint",
          "Click a piece on the bottom row to select it, then click another to swap.")}
      </p>

      <Chess960Board
        backRank={backRank}
        selectedFile={selectedFile}
        onFileClick={handleFileClick}
      />
    </div>
  );
};

/** Current SP number for the given back rank, or null if invalid. */
export { chess960SpFromBackRank };
