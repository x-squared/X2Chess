# update-server

This directory is deployed to GitHub Pages at:
**https://x-squared.github.io/X2Chess/**

It serves two purposes:

## 1. App update manifest (`latest.json`)

`latest.json` is **not committed here** — it is generated automatically by the
release workflow (`.github/workflows/release.yml`) every time a new version tag
is pushed. The installed X2Chess app checks this file at startup to see if a
newer version is available.

## 2. Rules server (`rules/`)

JSON rule files that the app downloads at runtime to keep adapters current
without requiring a full app update. These ARE committed to this repo —
updating a rule is just a normal commit + push.

### Updating a rule

1. Edit or add a file in `rules/web-import/`, `rules/board-profiles/`, etc.
2. Bump the `version` field for that rule set in `rules/manifest.json`.
3. Commit and push to `main`.
4. GitHub Pages redeploys automatically within ~60 seconds.

### Adding a new rule set

1. Create the directory and first version file, e.g. `rules/my-feature/v1.json`.
2. Add an entry to `rules/manifest.json`:
   ```json
   "myFeature": { "version": 1, "url": "rules/my-feature/v1.json" }
   ```
3. Commit and push.
