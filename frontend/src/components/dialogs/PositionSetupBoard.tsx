/**
 * PositionSetupBoard — interactive 8×8 board for custom position setup.
 *
 * Renders piece squares as a CSS grid using the same piece images and square
 * colours as the main Chessground board. White piece palette is on the left,
 * black piece palette on the right.
 *
 * Integration API:
 * - `<PositionSetupBoard fen={...} onFenChange={...} t={...} />` — standalone;
 *   no context required.
 *
 * Configuration API:
 * - `fen: string` — current FEN string (board section + rest).
 * - `onFenChange: (fen: string) => void` — emits updated FEN on every change.
 * - `t: (key: string, fallback?: string) => string` — translator function.
 *
 * Communication API:
 * - Outbound: `onFenChange` on every square click, right-click clear, and
 *   "Clear board" / "Standard" button actions.
 * - No inbound context reads; purely prop-driven.
 */

import { useState } from "react";
import type { ReactElement } from "react";
import { STANDARD_STARTING_FEN } from "../../features/editor/model/fen_utils";

// ── Chess960 detection ─────────────────────────────────────────────────────────

const expandRankStr = (rankStr: string): string[] => {
  const result: string[] = [];
  for (const ch of rankStr) {
    if (/[1-8]/.test(ch)) {
      for (let i = 0; i < Number(ch); i++) result.push(".");
    } else {
      result.push(ch);
    }
  }
  return result;
};

const isValidChess960BackRank = (squares: string[], isBlack: boolean): boolean => {
  const K = isBlack ? "k" : "K";
  const R = isBlack ? "r" : "R";
  const B = isBlack ? "b" : "B";
  const counts: Record<string, number> = {};
  for (const sq of squares) counts[sq] = (counts[sq] ?? 0) + 1;
  if (counts[K] !== 1 || counts[R] !== 2 || counts[B] !== 2) return false;
  const kingIdx = squares.indexOf(K);
  const rook1 = squares.indexOf(R);
  const rook2 = squares.lastIndexOf(R);
  if (kingIdx <= rook1 || kingIdx >= rook2) return false;
  const bIdx1 = squares.indexOf(B);
  const bIdx2 = squares.lastIndexOf(B);
  if (bIdx1 === bIdx2) return false;
  if ((bIdx1 % 2) === (bIdx2 % 2)) return false;
  return true;
};

/**
 * Returns the white back-rank string (8 chars) for Chess960 SP number `sp` (0–959).
 * SP 518 yields "RNBQKBNR" (the standard position).
 */
export const chess960SpToBackRank = (sp: number): string => {
  const rank: string[] = new Array<string>(8).fill("");

  // Step 1: One bishop on a dark-indexed file (b/d/f/h = 1/3/5/7)
  rank[(sp % 4) * 2 + 1] = "B";

  // Step 2: Other bishop on a light-indexed file (a/c/e/g = 0/2/4/6)
  rank[(Math.floor(sp / 4) % 4) * 2] = "B";

  // Step 3: Queen on the nth remaining empty file (0–5)
  const queenN: number = Math.floor(sp / 16) % 6;
  let emptyCount: number = 0;
  for (let i = 0; i < 8; i++) {
    if (!rank[i]) {
      if (emptyCount === queenN) { rank[i] = "Q"; break; }
      emptyCount++;
    }
  }

  // Step 4: Knights on a pair of the 5 remaining empty files (pair index 0–9)
  const knightN: number = Math.floor(sp / 96);
  const knightPairs: [number, number][] = [
    [0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4],
  ];
  const [k1, k2]: [number, number] = knightPairs[knightN] ?? [0, 1];
  const slots: number[] = [];
  for (let i = 0; i < 8; i++) { if (!rank[i]) slots.push(i); }
  rank[slots[k1] ?? 0] = "N";
  rank[slots[k2] ?? 1] = "N";

  // Step 5: Remaining 3 squares → R K R (king is forced between the two rooks)
  const remaining: number[] = [];
  for (let i = 0; i < 8; i++) { if (!rank[i]) remaining.push(i); }
  rank[remaining[0] ?? 0] = "R";
  rank[remaining[1] ?? 4] = "K";
  rank[remaining[2] ?? 7] = "R";

  return rank.join("");
};

/**
 * Returns the full starting FEN for Chess960 SP number `sp` (0–959).
 * SP 518 is the standard starting position (RNBQKBNR).
 */
export const chess960Fen = (sp: number): string => {
  const wr: string = chess960SpToBackRank(sp);
  return `${wr.toLowerCase()}/pppppppp/8/8/8/8/PPPPPPPP/${wr} w KQkq - 0 1`;
};

/** Returns the knight-pair index (0–9) for the two knights in `slots`, or -1 if invalid. */
const knightPairIndex = (slots: number[], rank: string[]): number => {
  const occupied: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (rank[slots[i] ?? -1] === "N") occupied.push(i);
  }
  if (occupied.length !== 2) return -1;
  const PAIRS: [number, number][] = [
    [0,1],[0,2],[0,3],[0,4],[1,2],[1,3],[1,4],[2,3],[2,4],[3,4],
  ];
  return PAIRS.findIndex(
    ([a, b]: [number, number]): boolean => a === occupied[0] && b === occupied[1],
  );
};

/**
 * Returns the SP number (0–959) for a Chess960 back-rank arrangement string,
 * or `null` if the arrangement is not a valid Chess960 starting position.
 *
 * The input must be an 8-character string of uppercase piece letters
 * (e.g. `"RNBQKBNR"` → 518).
 */
export const chess960SpFromBackRank = (rankStr: string): number | null => {
  if (rankStr.length !== 8) return null;
  const rank: string[] = rankStr.split("");

  // Validate piece counts: exactly 1K, 2R, 2B, 2N, 1Q
  const counts: Record<string, number> = {};
  for (const p of rank) counts[p] = (counts[p] ?? 0) + 1;
  if (counts["K"] !== 1 || counts["R"] !== 2 || counts["B"] !== 2 ||
      counts["N"] !== 2 || counts["Q"] !== 1) return null;

  // King must lie between the two rooks
  const kingFile: number = rank.indexOf("K");
  const rook1: number = rank.indexOf("R");
  const rook2: number = rank.lastIndexOf("R");
  if (kingFile <= rook1 || kingFile >= rook2) return null;

  // Bishops must be on opposite-parity files
  const bFiles: number[] = rank.flatMap((p: string, i: number): number[] => p === "B" ? [i] : []);
  const bf0: number = bFiles[0] ?? -1;
  const bf1: number = bFiles[1] ?? -1;
  if (bf0 === -1 || bf1 === -1 || (bf0 % 2) === (bf1 % 2)) return null;

  // n1/n2: bishop positions; n3: queen index among 6 remaining files
  const darkFile: number  = bf0 % 2 === 1 ? bf0 : bf1;
  const lightFile: number = bf0 % 2 === 0 ? bf0 : bf1;
  const n1: number = (darkFile - 1) / 2;
  const n2: number = lightFile / 2;

  const rem6: number[] = [];
  for (let i = 0; i < 8; i++) { if (i !== darkFile && i !== lightFile) rem6.push(i); }
  const n3: number = rem6.findIndex((f: number): boolean => rank[f] === "Q");
  if (n3 === -1) return null;

  // n4: knight pair index among the 5 remaining files (after removing bishops + queen)
  const rem5: number[] = rem6.filter((f: number): boolean => f !== rem6[n3]);
  const n4: number = knightPairIndex(rem5, rank);
  if (n4 === -1) return null;

  return n1 + n2 * 4 + n3 * 16 + n4 * 96;
};

/**
 * Returns true if `fen` represents a legal Chess960 starting position
 * that is not the standard starting position.
 */
export const detectChess960 = (fen: string): boolean => {
  const parts = fen.split(/\s/);
  const board = parts[0] ?? "";
  const ranks = board.split("/");
  if (ranks.length !== 8) return false;
  if (ranks[1] !== "pppppppp") return false;
  if (ranks[6] !== "PPPPPPPP") return false;
  for (let i = 2; i <= 5; i++) {
    if (ranks[i] !== "8") return false;
  }
  const whiteBack = expandRankStr(ranks[7] ?? "");
  const blackBack = expandRankStr(ranks[0] ?? "");
  if (!isValidChess960BackRank(whiteBack, false)) return false;
  if (!isValidChess960BackRank(blackBack, true)) return false;
  if ((ranks[7] ?? "") === "RNBQKBNR" && (ranks[0] ?? "") === "rnbqkbnr") return false;
  return true;
};

// ── Piece image CSS-variable map ───────────────────────────────────────────────

/** Maps a piece code (e.g. "wK") to the CSS variable holding its SVG image. */
const PIECE_IMAGE_VAR: Record<string, string> = {
  wK: "var(--piece-wk-image)",
  wQ: "var(--piece-wq-image)",
  wR: "var(--piece-wr-image)",
  wB: "var(--piece-wb-image)",
  wN: "var(--piece-wn-image)",
  wP: "var(--piece-wp-image)",
  bK: "var(--piece-bk-image)",
  bQ: "var(--piece-bq-image)",
  bR: "var(--piece-br-image)",
  bB: "var(--piece-bb-image)",
  bN: "var(--piece-bn-image)",
  bP: "var(--piece-bp-image)",
};

const WHITE_PIECES = ["wK", "wQ", "wR", "wB", "wN", "wP"] as const;
const BLACK_PIECES = ["bK", "bQ", "bR", "bB", "bN", "bP"] as const;

/** FEN piece char for a palette piece code. */
const pieceChar = (piece: string): string => {
  const map: Record<string, string> = {
    wK: "K", wQ: "Q", wR: "R", wB: "B", wN: "N", wP: "P",
    bK: "k", bQ: "q", bR: "r", bB: "b", bN: "n", bP: "p",
  };
  return map[piece] ?? "";
};

// ── PositionSetupBoard ─────────────────────────────────────────────────────────

export type PositionSetupBoardProps = {
  fen: string;
  onFenChange: (fen: string) => void;
  t: (key: string, fallback?: string) => string;
};

/** Interactive 8×8 board for position setup. */
export const PositionSetupBoard = ({ fen, onFenChange, t }: PositionSetupBoardProps): ReactElement => {
  const [selectedPiece, setSelectedPiece] = useState<string>("wP");

  const expandRanks = (boardSection: string): string[] => {
    const squares: string[] = [];
    for (const rank of boardSection.split("/")) {
      for (const ch of rank) {
        if (/[1-8]/.test(ch)) {
          for (let i = 0; i < Number(ch); i++) squares.push("");
        } else {
          squares.push(ch);
        }
      }
    }
    return squares;
  };

  const compressRanks = (squares: string[]): string => {
    let result = "";
    for (let rank = 0; rank < 8; rank++) {
      if (rank > 0) result += "/";
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const piece = squares[rank * 8 + file];
        if (!piece) {
          empty++;
        } else {
          if (empty > 0) { result += String(empty); empty = 0; }
          result += piece;
        }
      }
      if (empty > 0) result += String(empty);
    }
    return result;
  };

  const boardSection = fen.split(/\s/)[0] ?? "";
  const restSections = fen.split(/\s/).slice(1).join(" ");
  const squares = expandRanks(boardSection);

  const handleSquareClick = (index: number): void => {
    const next = [...squares];
    if (next[index] === pieceChar(selectedPiece)) {
      next[index] = "";
    } else {
      next[index] = pieceChar(selectedPiece);
    }
    onFenChange(`${compressRanks(next)} ${restSections}`);
  };

  const handleSquareRightClick = (e: React.MouseEvent, index: number): void => {
    e.preventDefault();
    const next = [...squares];
    next[index] = "";
    onFenChange(`${compressRanks(next)} ${restSections}`);
  };

  /** Render a single palette column (white or black pieces). */
  const renderPaletteCol = (pieces: readonly string[]): ReactElement => (
    <div className="position-setup-palette-col">
      {pieces.map((piece) => (
        <button
          key={piece}
          type="button"
          className={`position-setup-palette-btn${selectedPiece === piece ? " selected" : ""}`}
          style={{ backgroundImage: PIECE_IMAGE_VAR[piece] }}
          onClick={(): void => { setSelectedPiece(piece); }}
          aria-label={piece}
          title={piece}
        />
      ))}
    </div>
  );

  return (
    <div className="position-setup-area">
      {/* White piece palette — left */}
      {renderPaletteCol(WHITE_PIECES)}

      {/* Board + action buttons */}
      <div className="position-setup-board-col">
        <div className="position-setup-board" aria-label={t("newgame.board", "Setup board")}>
          {squares.map((piece, idx) => {
            const rank = Math.floor(idx / 8);
            const file = idx % 8;
            const isLight = (rank + file) % 2 === 0;
            return (
              <div
                key={idx}
                className={`position-setup-square${isLight ? " light" : " dark"}`}
                onClick={(): void => { handleSquareClick(idx); }}
                onContextMenu={(e): void => { handleSquareRightClick(e, idx); }}
                role="button"
                tabIndex={0}
                aria-label={`${String.fromCharCode(97 + file)}${8 - rank}`}
                onKeyDown={(e): void => {
                  if (e.key === "Enter" || e.key === " ") handleSquareClick(idx);
                }}
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

        <div className="position-setup-actions">
          <button
            type="button"
            className="x2-dialog-btn x2-dialog-btn--ghost"
            onClick={(): void => {
              onFenChange(`${compressRanks(Array(64).fill(""))} ${restSections}`);
            }}
          >
            {t("newgame.clearBoard", "Clear board")}
          </button>
          <button
            type="button"
            className="x2-dialog-btn x2-dialog-btn--ghost"
            onClick={(): void => { onFenChange(STANDARD_STARTING_FEN); }}
          >
            {t("newgame.standardPosition", "Standard")}
          </button>
        </div>
      </div>

      {/* Black piece palette — right */}
      {renderPaletteCol(BLACK_PIECES)}
    </div>
  );
};
