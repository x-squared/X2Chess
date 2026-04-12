# `resources/web_import`

Lower-level web-import infrastructure shared by the resource feature.

Important files:

- `built_in_rules.ts`: built-in import rules for supported websites.
- `rule_matcher.ts`: URL-to-rule matching.
- `rule_fetcher.ts`: fetch strategies and native HTTP integration contracts.
- `html_extractor.ts`: rule-based extraction from fetched HTML.
- `rule_registry.ts`, `user_rules_storage.ts`, `web_import_types.ts`
- `tauri_http_gateway.ts` and `browser_panel_gateway.ts`: desktop-only integration points.

Feature UI for web import belongs in `features/resources`. This package stays transport- and rule-focused.

Web import infrastructure.

Contains rule definitions, matchers, fetchers, and browser-panel integration used by the resource import workflow. UI entrypoints should remain in `features/resources`.
