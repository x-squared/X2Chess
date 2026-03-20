import en from "../../data/i18n/en.json";
import de from "../../data/i18n/de.json";
import fr from "../../data/i18n/fr.json";
import it from "../../data/i18n/it.json";
import es from "../../data/i18n/es.json";

/**
 * I18N module.
 *
 * Integration API:
 * - Primary exports from this module: `DEFAULT_LOCALE`, `SUPPORTED_LOCALES`, `resolveLocale`, `createTranslator`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through browser storage; interactions are explicit in
 *   exported function signatures and typed callback contracts.
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
export const createTranslator = (locale: string = DEFAULT_LOCALE): ((key: string, englishDefault?: string) => string) => {
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
