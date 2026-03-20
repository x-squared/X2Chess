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
