/**
 * pv_move_tokens — PGN-style move numbers for engine principal-variation display.
 *
 * Expands a flat move list (SAN or UCI long algebraic) into alternating number
 * labels and move segments for the analysis panel, e.g. `1. Nf3 d5 2. d4` when
 * White is to move, or `1… Nf6 2. d4` when Black is to move.
 */

export type PvDisplayToken = {
  /** Stable React key */
  key: string;
  /** Shown text (move text or `N.` / `1…`) */
  label: string;
  /** True for move-number markers; false for clickable move segments */
  isNumber: boolean;
  /** Index into the original `moves` array, or -1 for number tokens */
  moveIndex: number;
};

/**
 * Builds display tokens for a PV prefix: full-move numbers before White moves,
 * and `1…` only when Black has the first move in the line.
 *
 * @param moves Move strings in engine order (first move is for `sideToMove`)
 * @param sideToMove Side to move at the start of the line
 * @returns Tokens interleaving number labels and moves
 */
export const buildPvMoveTokens = (moves: string[], sideToMove: "w" | "b"): PvDisplayToken[] => {
  const tokens: PvDisplayToken[] = [];
  let fullmove: number = 1;
  let side: "w" | "b" = sideToMove;
  let moveIndex: number = 0;
  for (const move of moves) {
    if (side === "w") {
      tokens.push({
        key: `num-w-${fullmove}-at-${moveIndex}`,
        label: `${fullmove}.`,
        isNumber: true,
        moveIndex: -1,
      });
    } else if (moveIndex === 0 && sideToMove === "b") {
      tokens.push({
        key: "num-b-first",
        label: "1…",
        isNumber: true,
        moveIndex: -1,
      });
    }
    tokens.push({
      key: `mv-${moveIndex}`,
      label: move,
      isNumber: false,
      moveIndex,
    });
    if (side === "b") {
      fullmove += 1;
    }
    side = side === "w" ? "b" : "w";
    moveIndex += 1;
  }
  return tokens;
};
