/**
 * ECO lookup — pure-logic module.
 *
 * Integration API:
 * - `buildEcoLookup(entries)` — call once with the dataset; returns a fast lookup function.
 * - `EcoEntry`, `EcoMatch` — shared types for data and results.
 *
 * Configuration API:
 * - No configuration; all behaviour is controlled by the dataset passed to `buildEcoLookup`.
 *
 * Communication API:
 * - The returned lookup function is a pure function: same input → same output, no side effects.
 */

/** A single ECO dataset entry (eco code + opening name + SAN move sequence). */
export type EcoEntry = {
  eco: string;
  name: string;
  moves: string[];
};

/** Result returned by the lookup function for the deepest matching prefix. */
export type EcoMatch = {
  eco: string;
  name: string;
  /** Number of game moves that matched this entry's canonical sequence. */
  depth: number;
};

const matchesPrefix = (entry: EcoEntry, gameMoves: string[]): boolean => {
  const len = entry.moves.length;
  if (len > gameMoves.length) return false;
  for (let i = 0; i < len; i++) {
    if (entry.moves[i] !== gameMoves[i]) return false;
  }
  return true;
};

/**
 * Build an ECO lookup function from a dataset of opening entries.
 *
 * The dataset must be sorted by ascending `moves.length` (shallow entries
 * before deep ones) so that a single forward pass always lands on the deepest
 * match. The Lichess-sourced `eco-data.json` satisfies this invariant.
 *
 * The returned function is O(entries × min(entry.moves.length, gameMoves.length))
 * in the worst case — roughly 3 700 × 20 ≈ 74 000 comparisons, negligible for
 * interactive use.
 *
 * @param {EcoEntry[]} entries - ECO dataset, sorted by ascending moves.length.
 * @returns {(gameMoves: string[]) => EcoMatch | null} Lookup function.
 */
export const buildEcoLookup = (entries: EcoEntry[]): ((gameMoves: string[]) => EcoMatch | null) => {
  return (gameMoves: string[]): EcoMatch | null => {
    let best: EcoMatch | null = null;
    for (const entry of entries) {
      if (matchesPrefix(entry, gameMoves) && (best === null || entry.moves.length >= best.depth)) {
        best = { eco: entry.eco, name: entry.name, depth: entry.moves.length };
      }
    }
    return best;
  };
};

/**
 * Build a function that returns all ECO entries whose move sequence is a
 * prefix of the supplied game moves, deduplicated by (eco, name) and sorted
 * deepest-first.
 *
 * @param {EcoEntry[]} entries - ECO dataset.
 * @returns {(gameMoves: string[]) => EcoMatch[]} All-matches function.
 */
export const buildEcoAllMatches = (entries: EcoEntry[]): ((gameMoves: string[]) => EcoMatch[]) => {
  return (gameMoves: string[]): EcoMatch[] => {
    const bestByKey = new Map<string, EcoMatch>();
    for (const entry of entries) {
      if (!matchesPrefix(entry, gameMoves)) continue;
      const key: string = `${entry.eco}|${entry.name}`;
      const existing: EcoMatch | undefined = bestByKey.get(key);
      if (!existing || entry.moves.length > existing.depth) {
        bestByKey.set(key, { eco: entry.eco, name: entry.name, depth: entry.moves.length });
      }
    }
    return [...bestByKey.values()].sort(
      (a, b) => b.depth - a.depth || a.eco.localeCompare(b.eco) || a.name.localeCompare(b.name),
    );
  };
};
