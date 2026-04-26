/**
 * ECO lookup singleton for the frontend.
 *
 * Integration API:
 * - `lookupEco(gameMoves)` — derive the deepest-matching ECO code for a SAN move list.
 * - `EcoMatch` — result type `{ eco: string; name: string; depth: number }`.
 *
 * Configuration API:
 * - No configuration; the dataset is the committed `eco-data.json`.
 *
 * Communication API:
 * - Pure function; no side effects.
 */

import { buildEcoLookup } from "../../../parts/eco/src/eco_lookup";
import type { EcoMatch } from "../../../parts/eco/src/eco_lookup";
import ecoData from "../../../parts/eco/data/eco-data.json";

export type { EcoMatch };

/**
 * Derive the deepest matching ECO entry for a SAN move list.
 *
 * @param {string[]} gameMoves - Ordered SAN move tokens (main line only).
 * @returns {EcoMatch | null} Best ECO match or null when the opening is unrecognised.
 */
export const lookupEco: (gameMoves: string[]) => EcoMatch | null = buildEcoLookup(
  ecoData as Parameters<typeof buildEcoLookup>[0],
);
