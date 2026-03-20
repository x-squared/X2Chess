/**
 * Eco Openings module.
 *
 * Integration API:
 * - Primary exports from this module: `ECO_OPENING_CODES`, `resolveEcoOpeningName`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through typed return values and callbacks; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

import ecoOpeningsData from "../../data/eco-openings.json";

const normalizeEcoCode = (ecoCode: any): any => String(ecoCode ?? "")
  .trim()
  .toUpperCase()
  .replace(/\s+/g, "");

const normalizeLanguageCode = (languageCode: any): any => String(languageCode ?? "")
  .trim()
  .toUpperCase();

const DEFAULT_LANGUAGE = normalizeLanguageCode(ecoOpeningsData?.defaultLanguage || "EN");
const SUPPORTED_LANGUAGES = new Set((ecoOpeningsData?.supportedLanguages || []).map((lang: any): any => normalizeLanguageCode(lang)));

const ECO_OPENING_NAMES_BY_CODE = new Map(
  (ecoOpeningsData?.openings || [])
    .map((entry: any): any => {
      const code = normalizeEcoCode(entry?.code || "");
      if (!code) return null;
      const names = Object.fromEntries(Object.entries(entry?.names || {})
        .map(([lang, value]: any): any => [normalizeLanguageCode(lang), String(value ?? "").trim()])) as Record<string, string>;
      return [code, names] as [string, Record<string, string>];
    })
    .filter((row: any): row is [string, Record<string, string>] => Boolean(row)),
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
export const resolveEcoOpeningName = (ecoCode: any, language: any = DEFAULT_LANGUAGE): any => {
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
