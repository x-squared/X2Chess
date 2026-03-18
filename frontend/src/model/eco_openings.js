/**
 * ECO opening-name lookup helpers.
 *
 * Intent:
 * - Provide a local, deterministic fallback map from ECO code to opening name.
 * - Support UI display when PGN header `Opening` is missing but `ECO` is present.
 *
 * Integration API:
 * - `resolveEcoOpeningName(ecoCode)`
 *
 * Configuration API:
 * - ECO-to-name mapping is defined in `ECO_OPENING_NAME_BY_CODE`.
 * - Keys use canonical uppercase `A00..E99` format.
 *
 * Communication API:
 * - Pure function returning resolved opening name or empty string.
 */

/**
 * Local ECO code to opening-name mapping.
 *
 * Notes:
 * - This table intentionally covers common/representative codes.
 * - Unknown or unmapped codes resolve to an empty string.
 */
const ECO_OPENING_NAME_BY_CODE = {
  A00: "Polish (Sokolsky) opening",
  A02: "Bird opening",
  A04: "Reti opening",
  A06: "Reti opening",
  A10: "English opening",
  A13: "English opening",
  A15: "English opening",
  A20: "English opening",
  A40: "Queen pawn game",
  A43: "Old Benoni defense",
  A45: "Queen pawn game",
  A46: "Queen pawn game",
  A50: "Indian defense",
  A57: "Benko gambit",
  A60: "Benoni defense",
  A80: "Dutch defense",
  A90: "Dutch defense",
  B00: "King pawn opening",
  B01: "Scandinavian defense",
  B06: "Modern defense",
  B07: "Pirc defense",
  B10: "Caro-Kann defense",
  B12: "Caro-Kann defense",
  B20: "Sicilian defense",
  B22: "Sicilian defense: Alapin variation",
  B23: "Sicilian defense: closed variation",
  B30: "Sicilian defense",
  B33: "Sicilian defense: Sveshnikov variation",
  B40: "Sicilian defense",
  B50: "Sicilian defense",
  B70: "Sicilian defense: dragon variation",
  B80: "Sicilian defense: Scheveningen variation",
  B90: "Sicilian defense: Najdorf variation",
  C00: "French defense",
  C10: "French defense",
  C20: "King pawn game",
  C30: "King gambit",
  C40: "King knight opening",
  C41: "Philidor defense",
  C42: "Petrov defense",
  C44: "King pawn game",
  C45: "Scotch game",
  C50: "Italian game",
  C55: "Italian game: two knights defense",
  C60: "Ruy Lopez",
  C65: "Ruy Lopez: Berlin defense",
  C67: "Ruy Lopez: Berlin defense",
  C68: "Ruy Lopez: exchange variation",
  C70: "Ruy Lopez",
  C77: "Ruy Lopez: closed variation",
  C78: "Ruy Lopez",
  C84: "Ruy Lopez: closed variation",
  C88: "Ruy Lopez: closed variation",
  C89: "Ruy Lopez: Marshall attack",
  C95: "Ruy Lopez: closed variation",
  D00: "Queen pawn game",
  D02: "Queen pawn game",
  D06: "Queen gambit",
  D10: "Slav defense",
  D20: "Queen gambit accepted",
  D30: "Queen gambit declined",
  D35: "Queen gambit declined",
  D37: "Queen gambit declined",
  D43: "Semi-Slav defense",
  D45: "Semi-Slav defense",
  D60: "Queen gambit declined: Orthodox defense",
  D70: "Neo-Grunfeld defense",
  D80: "Grunfeld defense",
  D85: "Grunfeld defense",
  E00: "Catalan opening",
  E10: "Queen Indian defense",
  E12: "Queen Indian defense",
  E20: "Nimzo-Indian defense",
  E30: "Nimzo-Indian defense",
  E32: "Nimzo-Indian defense: classical variation",
  E40: "Nimzo-Indian defense",
  E50: "Nimzo-Indian defense",
  E60: "King Indian defense",
  E70: "King Indian defense",
  E80: "King Indian defense: Saemisch variation",
  E90: "King Indian defense",
};

const normalizeEcoCode = (ecoCode) => String(ecoCode ?? "")
  .trim()
  .toUpperCase()
  .replace(/\s+/g, "");

/**
 * Resolve opening name for an ECO code.
 *
 * @param {string} ecoCode - ECO code such as `C65`.
 * @returns {string} Opening name or empty string when unknown.
 */
export const resolveEcoOpeningName = (ecoCode) => {
  const normalizedCode = normalizeEcoCode(ecoCode);
  if (!normalizedCode) return "";
  return ECO_OPENING_NAME_BY_CODE[normalizedCode] ?? "";
};
