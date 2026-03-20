/**
 * ECO opening-name lookup helpers.
 *
 * Intent:
 * - Provide local, deterministic ECO opening names loaded from JSON data.
 * - Support UI display when PGN header `Opening` is missing but `ECO` is present.
 *
 * Integration API:
 * - `resolveEcoOpeningName(ecoCode, language?)`
 * - `ECO_OPENING_CODES`
 *
 * Configuration API:
 * - Data is sourced from `frontend/data/eco-openings.json`.
 * - Supported language codes are declared in JSON (`EN`, `DE`, `FR`, `IT`, `ES`).
 *
 * Communication API:
 * - Pure function returning resolved opening name or empty string.
 */

import ecoOpeningsData from "../../data/eco-openings.json";

const normalizeEcoCode = (ecoCode) => String(ecoCode ?? "")
  .trim()
  .toUpperCase()
  .replace(/\s+/g, "");

const normalizeLanguageCode = (languageCode) => String(languageCode ?? "")
  .trim()
  .toUpperCase();

const DEFAULT_LANGUAGE = normalizeLanguageCode(ecoOpeningsData?.defaultLanguage || "EN");
const SUPPORTED_LANGUAGES = new Set((ecoOpeningsData?.supportedLanguages || []).map((lang) => normalizeLanguageCode(lang)));

const ECO_OPENING_NAMES_BY_CODE = new Map(
  (ecoOpeningsData?.openings || [])
    .map((entry) => {
      const code = normalizeEcoCode(entry?.code || "");
      if (!code) return null;
      const names = Object.fromEntries(Object.entries(entry?.names || {})
        .map(([lang, value]) => [normalizeLanguageCode(lang), String(value ?? "").trim()])) as Record<string, string>;
      return [code, names] as [string, Record<string, string>];
    })
    .filter((row): row is [string, Record<string, string>] => Boolean(row)),
);

/**
 * Sorted list of locally supported ECO codes.
 */
export const ECO_OPENING_CODES = [...ECO_OPENING_NAMES_BY_CODE.keys()].sort();

/**
 * Resolve opening name for an ECO code.
 *
 * @param {string} ecoCode - ECO code such as `C65`.
 * @param {string} [language=DEFAULT_LANGUAGE] - Preferred language code, for example `EN` or `DE`.
 * @returns {string} Opening name or empty string when unknown.
 */
export const resolveEcoOpeningName = (ecoCode, language = DEFAULT_LANGUAGE) => {
  const normalizedCode = normalizeEcoCode(ecoCode);
  if (!normalizedCode) return "";
  const namesByLanguage = ECO_OPENING_NAMES_BY_CODE.get(normalizedCode) as Record<string, string> | undefined;
  if (!namesByLanguage) return "";
  const normalizedLanguage = normalizeLanguageCode(language);
  const selectedLanguage = SUPPORTED_LANGUAGES.has(normalizedLanguage)
    ? normalizedLanguage
    : DEFAULT_LANGUAGE;
  return namesByLanguage[selectedLanguage]
    || namesByLanguage[DEFAULT_LANGUAGE]
    || namesByLanguage.EN
    || Object.values(namesByLanguage).find(Boolean)
    || "";
};
