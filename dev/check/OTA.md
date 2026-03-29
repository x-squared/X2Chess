---
section: OTA
area: In-app update notifications (Tauri desktop only)
---

## Key source files
- `frontend/src/components/UpdateBanner.tsx` — update banner in the menu panel
- `dev/plans/ota_updates_8d9e0f1a.plan.md` — OTA update channels: full app updater (Tauri) + rules server (data-only)

## Checklist

- [ ] **OTA-1** — On startup the app silently checks for a new version; no visible UI appears if already up to date.
- [ ] **OTA-2** — When a newer version is found, the Menu panel shows an update banner with the version number.
- [ ] **OTA-3** — Clicking "Update & restart" starts the download; the banner shows a progress bar.
- [ ] **OTA-4** — After download completes the app relaunches automatically.
- [ ] **OTA-5** — Clicking "Later" dismisses the banner for the current session; it does not reappear until the next startup.
- [ ] **OTA-6** — If the update download fails, the banner shows an error message (not a crash).
- [ ] **OTA-7** — The update check is skipped entirely in the browser (non-Tauri) build.
