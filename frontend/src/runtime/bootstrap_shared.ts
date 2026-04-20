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
 * Wrap a FEN string in a minimal PGN with `SetUp "1"` and `FEN` headers so
 * that `openPgnText` can load it as a position game.
 *
 * @param fen - Valid FEN string.
 * @param title - Optional title used as the `Event` header value.
 * @returns Minimal PGN string representing the given position.
 */
export const fenToPgn = (fen: string, title?: string): string => {
  const d = new Date();
  const date = `${d.getFullYear().toString()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  return [
    `[Event "${title ?? "?"}"]`,
    `[Site "?"]`,
    `[Date "${date}"]`,
    `[Round "?"]`,
    `[White "?"]`,
    `[Black "?"]`,
    `[Result "*"]`,
    `[SetUp "1"]`,
    `[FEN "${fen}"]`,
    "",
    "*",
    "",
  ].join("\n");
};
