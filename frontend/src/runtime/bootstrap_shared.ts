/**
 * Shared runtime utility contracts.
 *
 * These type definitions are referenced by pure-logic modules (`session_store`,
 * `session_persistence`, `resources/index`, `resources_viewer/index`) that are
 * kept unchanged through the migration.  The file is preserved so those modules
 * require no edits.
 */

export type SourceRefLike = {
  kind?: string;
  locator?: string;
  recordId?: string | number;
};

export type SessionLike = {
  sessionId: string;
  sourceRef?: SourceRefLike | null;
  pendingResourceRef?: SourceRefLike | null;
  title?: string;
};

export const EMPTY_GAME_PGN = `[Event "?"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "?"]
[Black "?"]
[Result "*"]
`;

/** The canonical FEN for the standard chess starting position. */
export const STANDARD_STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const isLikelyPgnText = (value: unknown): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\s*\[[A-Za-z0-9_]+\s+".*"\]\s*$/m.test(trimmed) || /\d+\.(?:\.\.)?\s*[^\s]+/.test(trimmed);
};

/**
 * Returns true when the string looks like a FEN position string.
 *
 * Matches eight slash-separated ranks of piece characters followed by
 * a side-to-move token (`w` or `b`). Does not validate legal positions.
 *
 * @param value - Value to test.
 * @returns True when the value is a string that resembles a FEN.
 */
export const isLikelyFenText = (value: unknown): boolean => {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  return /^[pnbrqkPNBRQK1-8]{1,8}(?:\/[pnbrqkPNBRQK1-8]{1,8}){7}\s+[wb]\s/.test(trimmed);
};

/**
 * Returns true when `rank` is a structurally valid Chess960 back rank:
 * exactly 1 K, 2 R, 2 B, 2 N, 1 Q; king between the two rooks; bishops on
 * opposite-color files.
 *
 * @param rank - 8-character uppercase piece string, e.g. `"RNBQKBNR"`.
 */
const isValidChess960BackRank = (rank: string): boolean => {
  if (rank.length !== 8) return false;
  const counts: Record<string, number> = {};
  for (const p of rank) counts[p] = (counts[p] ?? 0) + 1;
  if (counts["K"] !== 1 || counts["R"] !== 2 || counts["B"] !== 2 ||
      counts["N"] !== 2 || counts["Q"] !== 1) return false;
  const kingFile: number = rank.indexOf("K");
  const rook1: number = rank.indexOf("R");
  const rook2: number = rank.lastIndexOf("R");
  if (kingFile <= rook1 || kingFile >= rook2) return false;
  const bFiles: number[] = rank.split("").flatMap((p: string, i: number): number[] => p === "B" ? [i] : []);
  const bf0: number = bFiles[0] ?? -1;
  const bf1: number = bFiles[1] ?? -1;
  return bf0 !== -1 && bf1 !== -1 && (bf0 % 2) !== (bf1 % 2);
};

/**
 * Returns true when the FEN represents a Chess960 starting position: pawns on
 * ranks 2 and 7, empty ranks 3–6, white back rank is a valid Chess960
 * arrangement, and the black back rank mirrors it.
 *
 * @param fen - FEN string to test.
 */
export const isChess960StartingFen = (fen: string): boolean => {
  const placement: string = fen.trim().split(" ")[0] ?? "";
  const ranks: string[] = placement.split("/");
  if (ranks.length !== 8) return false;
  if (ranks[1] !== "pppppppp") return false;
  if (ranks[2] !== "8" || ranks[3] !== "8" || ranks[4] !== "8" || ranks[5] !== "8") return false;
  if (ranks[6] !== "PPPPPPPP") return false;
  const whiteBack: string = ranks[7] ?? "";
  if (!isValidChess960BackRank(whiteBack)) return false;
  return ranks[0] === whiteBack.toLowerCase();
};

/**
 * Wrap a FEN string in a minimal PGN so that `openPgnText` can load it.
 *
 * When `fen` is the standard starting position the `SetUp`/`FEN` headers are
 * omitted, yielding a plain new game. Otherwise they are included, and
 * `Variant "Chess960"` is appended when `variant` is `"Chess960"`.
 *
 * @param fen - Valid FEN string.
 * @param title - Optional title used as the `Event` header value.
 * @param variant - Optional variant tag; pass `"Chess960"` for Chess960 games.
 * @returns PGN string representing the given position.
 */
export const fenToPgn = (fen: string, title?: string, variant?: "Chess960"): string => {
  const d = new Date();
  const date = `${d.getFullYear().toString()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const isStandard: boolean = fen.trim() === STANDARD_STARTING_FEN;
  const lines: string[] = [
    `[Event "${title ?? "?"}"]`,
    `[Site "?"]`,
    `[Date "${date}"]`,
    `[Round "?"]`,
    `[White "?"]`,
    `[Black "?"]`,
    `[Result "*"]`,
  ];
  if (!isStandard) {
    lines.push(`[SetUp "1"]`);
    lines.push(`[FEN "${fen}"]`);
    if (variant) lines.push(`[Variant "${variant}"]`);
  }
  lines.push("", "*", "");
  return lines.join("\n");
};
