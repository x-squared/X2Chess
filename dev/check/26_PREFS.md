---
section: PREFS
area: Startup preferences — defaults vs. user-saved
---

## Edit rules
See dev/check/00_README.md. These rules must be strictly adhered to when this file is being edited.

## Key source files
- `frontend/src/runtime/bootstrap_prefs.ts` — `DevPrefsMode`, `initDevPrefsMode`, `readShellPrefsForStartup`
- `frontend/src/runtime/shell_prefs_store.ts` — `ShellPrefs`, `DEFAULT_SHELL_PREFS`, `shellPrefsStore`
- `frontend/src/hooks/useAppStartup.ts` — mount effect that reads `devPrefsMode` and applies prefs
- `doc/diy-manual.qmd` — Quick Start step 2: console commands for switching the mode

## Checklist

- [ ] **PREFS-1** — On a fresh install (no `x2chess.devPrefsMode` key in localStorage), the app starts with factory defaults (`DEFAULT_SHELL_PREFS`): sound ON, moveDelay 0, positionPreview ON, locale follows browser, pgnLayout "plain", developerTools OFF.

- [ ] **PREFS-2** — After running `localStorage.setItem("x2chess.devPrefsMode", "defaults")` in the console and restarting, the app again applies factory defaults regardless of any previously stored user prefs.

- [ ] **PREFS-3** — After running `localStorage.setItem("x2chess.devPrefsMode", "user")` in the console and restarting, the app restores the last user-saved preferences (sound, locale, pgnLayout, etc.).

- [ ] **PREFS-4** — Switching between `"defaults"` and `"user"` modes does not erase the stored user prefs (`x2chess.shellPrefs`); switching back to `"user"` still shows the previously saved values.

- [ ] **PREFS-5** — In a PROD build (`__X2CHESS_MODE__ = "PROD"`), the `x2chess.devPrefsMode` key is ignored and user-saved prefs are always loaded.

- [ ] **PREFS-6** — `localStorage.getItem("x2chess.devPrefsMode")` returns `"defaults"` after the very first launch (key auto-initialised by `initDevPrefsMode`).

## ---------- Completed -----------------------------------------
