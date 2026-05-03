/**
 * endgame_types — domain contracts for the endgame tablebase integration (E2).
 *
 * Integration API:
 * - Exports: `TbWdl`, `TbMoveEntry`, `TbProbeResult`, `EndgameTbAdapter`.
 *
 * Communication API:
 * - Pure type definitions; no I/O or side effects.
 */

/** Win/draw/loss classification from tablebase perspective. */
export type TbWdl =
  | "win"
  | "cursed_win"
  | "draw"
  | "blessed_loss"
  | "loss"
  | "unknown";

/** Per-move tablebase result. */
export type TbMoveEntry = {
  /** UCI notation, e.g. "e1e2". */
  uci: string;
  /** SAN notation, e.g. "Ke2". */
  san: string;
  /** WDL classification for this move. */
  wdl: TbWdl;
  /** Distance to zeroing (capture or pawn move). */
  dtz?: number;
  /** Distance to mate (when available). */
  dtm?: number;
  /** True if this move zeroes the 50-move counter. */
  zeroing: boolean;
  /** True if this move is checkmate. */
  checkmate?: boolean;
  /** True if this move leads to stalemate. */
  stalemate?: boolean;
};

/** Result of a tablebase probe for a position. */
export type TbProbeResult = {
  /** WDL for the side to move. */
  wdl: TbWdl;
  /** Distance to zeroing move (from best play). */
  dtz?: number;
  /** Distance to mate (Gaviota only). */
  dtm?: number;
  /** All legal moves with their tablebase classifications. */
  moves: TbMoveEntry[];
  /** True if the position has insufficient material to mate. */
  insufficientMaterial?: boolean;
};

/** A single move in a tablebase main-line continuation. */
export type TbLineMove = {
  san: string;
  uci: string;
  wdl: TbWdl;
  dtz?: number;
};

/** A main-line continuation built by following optimal play from both sides. */
export type TbMainLine = {
  moves: TbLineMove[];
  /** Side to move at the root position ("w" or "b"). */
  startColor: "w" | "b";
  /** Set when the last move in the line is terminal. */
  terminal?: "mate" | "stalemate";
};

/** Contract for an endgame tablebase adapter. */
export type EndgameTbAdapter = {
  readonly id: string;
  readonly label: string;
  /** Maximum piece count this tablebase supports (typically 5, 6, or 7). */
  readonly maxPieces: number;
  /**
   * Probe the tablebase for the given FEN position.
   * Resolves to null when not available (too many pieces, network error, etc.).
   */
  probe(fen: string): Promise<TbProbeResult | null>;
  /**
   * Follow optimal play from both sides to build a main-line continuation.
   * Optional — not all adapters implement this.
   */
  probeLine?(fen: string, maxDepth?: number): Promise<TbMainLine | null>;
};
