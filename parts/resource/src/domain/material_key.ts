/**
 * material_key — derives a normalized material-balance key from a FEN position string.
 *
 * Integration API:
 * - Primary export: `materialKeyFromFen`.
 *
 * Configuration API:
 * - No configuration; input is the raw FEN string.
 *
 * Communication API:
 * - Pure function; no I/O or side effects.
 */

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Descending piece value for sorting; ties broken alphabetically (B before N). */
const PIECE_VALUE: Readonly<Record<string, number>> = {
  Q: 9,
  R: 5,
  B: 3,
  N: 3,
  P: 1,
};

const comparePieces = (a: string, b: string): number => {
  const va: number = PIECE_VALUE[a] ?? 0;
  const vb: number = PIECE_VALUE[b] ?? 0;
  if (vb !== va) return vb - va;   // higher value first
  return a.localeCompare(b);       // alpha for ties (B < N)
};

// ── Exports ───────────────────────────────────────────────────────────────────

/**
 * Derive a normalized material-balance key from the piece-placement field of a FEN string.
 *
 * Format: `K<white-pieces>vK<black-pieces>`, where each side's non-king pieces
 * are sorted by descending value (Q=9, R=5, B=3, N=3, P=1) with alphabetical
 * tie-breaking (B before N). The kings are always present and placed first.
 * Examples: `KQPPPvKRP`, `KBNvK`, `KvK`.
 *
 * Suitable for substring search: `"KQv"` matches any position where white has K+Q.
 *
 * @param fen Raw FEN string (only the piece-placement field is examined).
 * @returns Normalized material key, or `""` for empty or non-FEN input.
 */
export const materialKeyFromFen = (fen: string): string => {
  const normalized: string = String(fen || "").trim();
  if (!normalized) return "";

  const placement: string = normalized.split(/\s+/)[0] ?? "";
  if (!placement.includes("/")) return "";

  const whitePieces: string[] = [];
  const blackPieces: string[] = [];

  for (const ch of placement) {
    if (ch === "K") continue;
    if (ch === "k") continue;
    if (ch >= "A" && ch <= "Z") whitePieces.push(ch);
    else if (ch >= "a" && ch <= "z") blackPieces.push(ch.toUpperCase());
  }

  whitePieces.sort(comparePieces);
  blackPieces.sort(comparePieces);

  return `K${whitePieces.join("")}vK${blackPieces.join("")}`;
};
