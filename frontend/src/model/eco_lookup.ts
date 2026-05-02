/**
 * ECO lookup singleton for the frontend.
 *
 * Integration API:
 * - `lookupEco(gameMoves)` — derive the deepest-matching ECO code for a SAN move list.
 * - `allEcoMatches(gameMoves)` — all matching ECO entries, deepest first.
 * - `EcoMatch` — result type `{ eco: string; name: string; depth: number }`.
 *
 * Configuration API:
 * - No configuration; the dataset is the committed `eco-data.json`.
 *
 * Communication API:
 * - Pure functions; no side effects.
 */

import { buildEcoLookup, buildEcoAllMatches } from "../../../parts/eco/src/eco_lookup";
import type { EcoMatch } from "../../../parts/eco/src/eco_lookup";
import ecoData from "../../../parts/eco/data/eco-data.json";

export type { EcoMatch };

type EcoDataset = Parameters<typeof buildEcoLookup>[0];
const dataset: EcoDataset = ecoData as EcoDataset;

/**
 * Derive the deepest matching ECO entry for a SAN move list.
 *
 * @param {string[]} gameMoves - Ordered SAN move tokens (main line only).
 * @returns {EcoMatch | null} Best ECO match or null when the opening is unrecognised.
 */
export const lookupEco: (gameMoves: string[]) => EcoMatch | null = buildEcoLookup(dataset);

/**
 * All ECO entries whose move sequence is a prefix of the supplied game moves,
 * deduplicated by (eco, name) and sorted deepest first.
 *
 * @param {string[]} gameMoves - Ordered SAN move tokens (main line only).
 * @returns {EcoMatch[]} All matching entries, or empty array when none match.
 */
export const allEcoMatches: (gameMoves: string[]) => EcoMatch[] = buildEcoAllMatches(dataset);
