# `app/i18n`

This package owns application-level localization helpers and the frontend translation bundles.

Important files:

- `index.ts`: exports `DEFAULT_LOCALE`, `SUPPORTED_LOCALES`, `resolveLocale`, and `createTranslator`.

Typical usage:

- `app/startup/useAppStartup.ts` resolves and applies the persisted locale.
- `app/hooks/useTranslator.ts` creates the translation callback used across UI components.
- menu and shell components import `SUPPORTED_LOCALES` or translator helpers when they need locale-aware UI.

Keep locale resolution and translation-bundle concerns here. Feature-specific text formatting helpers should usually stay with the feature unless they are reused app-wide.
