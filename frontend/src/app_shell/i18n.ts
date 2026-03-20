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

type LocaleBundle = Record<string, string>;
type LocaleCode = keyof typeof BUNDLES_BY_LOCALE;

export const DEFAULT_LOCALE: LocaleCode = "en";
export const SUPPORTED_LOCALES: LocaleCode[] = (Object.keys(BUNDLES_BY_LOCALE) as LocaleCode[]).sort();

/**
 * Resolve requested locale to supported locale key.
 *
 * @param {string} input - Locale hint like `de`, `de-CH`, or `EN`.
 * @returns {string} Supported locale key.
 */
export const resolveLocale = (input: string): LocaleCode => {
  const normalized = String(input ?? "").trim().toLowerCase();
  if (!normalized) return DEFAULT_LOCALE;
  if (normalized in BUNDLES_BY_LOCALE) return normalized as LocaleCode;
  const languageOnly = normalized.split("-")[0];
  if (languageOnly in BUNDLES_BY_LOCALE) return languageOnly as LocaleCode;
  return DEFAULT_LOCALE;
};

/**
 * Create translation lookup callback.
 *
 * @param {string} [locale=DEFAULT_LOCALE] - Requested locale code.
 * @returns {(key: string, englishDefault?: string) => string} Translation resolver.
 */
export const createTranslator = (locale: string = DEFAULT_LOCALE) => {
  const effectiveLocale = resolveLocale(locale);
  const localizedBundle = (BUNDLES_BY_LOCALE[effectiveLocale] ?? {}) as LocaleBundle;
  const fallbackBundle = (BUNDLES_BY_LOCALE[DEFAULT_LOCALE] ?? {}) as LocaleBundle;
  return (key: string, englishDefault?: string): string => (
    localizedBundle[key]
    || fallbackBundle[key]
    || englishDefault
    || key
  );
};
