/**
 * useTranslator hook — returns a locale-aware translation function.
 *
 * Integration API:
 * - `const t = useTranslator();`  then call `t("key", "English default")`.
 * - Re-derives the translator only when the `locale` slice of AppStoreState changes.
 *
 * Configuration API:
 * - Locale is read from AppStoreState; no props needed.
 *
 * Communication API:
 * - No side effects; purely returns a memoized pure function.
 */

import { useMemo } from "react";
import { createTranslator } from "../i18n";
import { useAppContext } from "../providers/AppStateProvider";
import { selectLocale } from "../../core/state/selectors";

/**
 * Return a memoized translation function for the current app locale.
 *
 * @returns `(key: string, englishDefault?: string) => string` — translation resolver.
 */
export const useTranslator = (): ((key: string, englishDefault?: string) => string) => {
  const { state } = useAppContext();
  const locale: string = selectLocale(state);
  return useMemo((): ((key: string, englishDefault?: string) => string) => createTranslator(locale), [locale]);
};
