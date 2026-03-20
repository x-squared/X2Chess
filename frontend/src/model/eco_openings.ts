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

type EcoOpeningsData = {
  defaultLanguage?: string;
  supportedLanguages?: string[];
  openings?: Array<{
    code?: string;
    names?: Record<string, string>;
  }>;
};

const data: EcoOpeningsData = (ecoOpeningsData as EcoOpeningsData) || {};

const normalizeEcoCode = (ecoCode: unknown): string => String(ecoCode ?? "")
  .trim()
  .toUpperCase()
  .replace(/\s+/g, "");

const normalizeLanguageCode = (languageCode: unknown): string => String(languageCode ?? "")
  .trim()
  .toUpperCase();

const DEFAULT_LANGUAGE: string = normalizeLanguageCode(data.defaultLanguage || "EN");
const SUPPORTED_LANGUAGES: Set<string> = new Set<string>((data.supportedLanguages || []).map((lang: string): string => normalizeLanguageCode(lang)));

const ECO_OPENING_NAMES_BY_CODE: Map<string, Record<string, string>> = new Map(
  (data.openings || [])
    .map((entry): [string, Record<string, string>] | null => {
      const code: string = normalizeEcoCode(entry?.code || "");
      if (!code) return null;
      const names: Record<string, string> = Object.fromEntries(
        Object.entries(entry?.names || {}).map(([lang, value]: [string, string]): [string, string] => [
          normalizeLanguageCode(lang),
          String(value ?? "").trim(),
        ]),
      ) as Record<string, string>;
      return [code, names];
    })
    .filter((row): row is [string, Record<string, string>] => Boolean(row)),
);

/**
 * Sorted list of locally supported ECO codes.
 */
export const ECO_OPENING_CODES: string[] = [...ECO_OPENING_NAMES_BY_CODE.keys()].sort();

/**
 * Resolve opening name for an ECO code.
 *
 * @param {string} ecoCode - ECO code such as `C65`.
 * @param {string} [language=DEFAULT_LANGUAGE] - Preferred language code, for example `EN` or `DE`.
 * @returns {string} Opening name or empty string when unknown.
 */
export const resolveEcoOpeningName = (ecoCode: string, language: string = DEFAULT_LANGUAGE): string => {
  const normalizedCode: string = normalizeEcoCode(ecoCode);
  if (!normalizedCode) return "";
  const namesByLanguage: Record<string, string> | undefined = ECO_OPENING_NAMES_BY_CODE.get(normalizedCode);
  if (!namesByLanguage) return "";
  const normalizedLanguage: string = normalizeLanguageCode(language);
  const selectedLanguage: string = SUPPORTED_LANGUAGES.has(normalizedLanguage)
    ? normalizedLanguage
    : DEFAULT_LANGUAGE;
  return namesByLanguage[selectedLanguage]
    || namesByLanguage[DEFAULT_LANGUAGE]
    || namesByLanguage.EN
    || Object.values(namesByLanguage).find(Boolean)
    || "";
};
