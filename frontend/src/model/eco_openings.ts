/**
 * Eco Openings module.
 *
 * Integration API:
 * - `ECO_OPENING_CODES` — sorted list of all known ECO codes.
 * - `resolveEcoOpeningName` — canonical English opening name for a code.
 *
 * Configuration API:
 * - No configuration; the dataset is the committed `eco-data.json`.
 *
 * Communication API:
 * - Pure functions; no side effects.
 */

import ecoData from "../../../parts/eco/data/eco-data.json";

type EcoEntry = { eco: string; name: string; moves: string[] };

// eco-data.json is sorted by move-sequence length ascending, so the first
// occurrence of each code is the most general (canonical) name for that code.
const ECO_NAME_BY_CODE: Map<string, string> = new Map<string, string>();
for (const entry of (ecoData as EcoEntry[])) {
  if (!ECO_NAME_BY_CODE.has(entry.eco)) {
    ECO_NAME_BY_CODE.set(entry.eco, entry.name);
  }
}

/**
 * Sorted list of all known ECO codes.
 */
export const ECO_OPENING_CODES: string[] = [...ECO_NAME_BY_CODE.keys()].sort((a, b) => a.localeCompare(b));

/**
 * Canonical English opening name for an ECO code.
 *
 * @param {string} ecoCode - ECO code such as `C65`.
 * @returns {string} Opening name or empty string when unknown.
 */
export const resolveEcoOpeningName = (ecoCode: string): string => {
  const code: string = String(ecoCode ?? "").trim().toUpperCase().replaceAll(/\s+/g, "");
  return ECO_NAME_BY_CODE.get(code) ?? "";
};
