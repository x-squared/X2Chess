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
      const len = entry.moves.length;
      if (len > gameMoves.length) continue;
      let matched = true;
      for (let i = 0; i < len; i++) {
        if (entry.moves[i] !== gameMoves[i]) {
          matched = false;
          break;
        }
      }
      if (matched && (best === null || len >= best.depth)) {
        best = { eco: entry.eco, name: entry.name, depth: len };
      }
    }

    return best;
  };
};
