import en from "../../data/i18n/en.json";
import de from "../../data/i18n/de.json";
import fr from "../../data/i18n/fr.json";
import it from "../../data/i18n/it.json";
import es from "../../data/i18n/es.json";

/**
 * App shell i18n helpers.
 *
 * Integration API:
 * - Import constants `SUPPORTED_LOCALES` and `DEFAULT_LOCALE` for UI selectors
 *   and startup defaults.
 * - Call `resolveLocale(input)` for browser/localStorage locale hints.
 * - Call `createTranslator(locale?)` once and pass returned `t(key, fallback)`
 *   to layout/render modules.
 *
 * Configuration API:
 * - Translations are configured by JSON bundles in `frontend/data/i18n/*.json`.
 * - Locale fallback order is: requested locale -> language-only locale -> English.
 *
 * Communication API:
 * - Returns read-only lookup functions; this module does not mutate state or DOM.
 */

const BUNDLES_BY_LOCALE = {
  de,
  en,
  es,
  fr,
  it,
};

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = Object.keys(BUNDLES_BY_LOCALE).sort();

/**
 * Resolve requested locale to supported locale key.
 *
 * @param {string} input - Locale hint like `de`, `de-CH`, or `EN`.
 * @returns {string} Supported locale key.
 */
export const resolveLocale = (input) => {
  const normalized = String(input ?? "").trim().toLowerCase();
  if (!normalized) return DEFAULT_LOCALE;
  if (BUNDLES_BY_LOCALE[normalized]) return normalized;
  const languageOnly = normalized.split("-")[0];
  if (BUNDLES_BY_LOCALE[languageOnly]) return languageOnly;
  return DEFAULT_LOCALE;
};

/**
 * Create translation lookup callback.
 *
 * @param {string} [locale=DEFAULT_LOCALE] - Requested locale code.
 * @returns {(key: string, englishDefault?: string) => string} Translation resolver.
 */
export const createTranslator = (locale = DEFAULT_LOCALE) => {
  const effectiveLocale = resolveLocale(locale);
  const localizedBundle = BUNDLES_BY_LOCALE[effectiveLocale] || {};
  const fallbackBundle = BUNDLES_BY_LOCALE[DEFAULT_LOCALE] || {};
  return (key, englishDefault) => (
    localizedBundle[key]
    || fallbackBundle[key]
    || englishDefault
    || key
  );
};
