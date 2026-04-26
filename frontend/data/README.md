# `frontend/data`

Bundled static data files used by the frontend at startup/build time.

These files are app-facing seed/reference data. Runtime user data is stored in browser/Tauri client storage, not written back into this folder.

---

- `eco-openings.json`: Curated ECO code -> localized opening-name map used by `frontend/src/model/eco_openings.ts` for the game-info ECO dropdown and opening-name resolution.
- `players.json`: Seed player list loaded during app service initialization as `initialPlayerStore`; the active player list is then persisted in client storage (`x2chess.playerList`).
- `i18n/en.json`: English base locale bundle.
- `i18n/de.json`: German locale bundle.
- `i18n/es.json`: Spanish locale bundle.
- `i18n/fr.json`: French locale bundle.
- `i18n/it.json`: Italian locale bundle.

---

## Ownership notes

- Keep this folder limited to small, committed frontend assets.
- Canonical reusable domain datasets stay in `parts/*` when they are package-level logic inputs (for example `parts/eco/data/eco-data.json` for move-sequence ECO matching).
- If you add a new user-facing locale key, update all locale files in `i18n/` in the same change.
