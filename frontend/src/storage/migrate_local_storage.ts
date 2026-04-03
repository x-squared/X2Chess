/**
 * migrate_local_storage — one-shot consolidation of legacy localStorage keys.
 *
 * Integration API:
 * - `migrateLocalStorage(storage?)` — call once at app startup before any
 *   store reads.  Idempotent: if the new compound key already exists, the
 *   function returns immediately without reading or writing anything.
 *
 * Configuration API:
 * - Consolidates the following legacy individual keys into `shellPrefsStore`:
 *   - `x2chess.developerTools`         → `developerToolsEnabled`
 *   - `x2chess.locale`                 → `locale`
 *   - `x2chess.sound`                  → `sound`
 *   - `x2chess.moveDelayMs`            → `moveDelayMs`
 *   - `x2chess.positionPreviewOnHover` → `positionPreviewOnHover`
 *   - `x2chess.pgnLayout`              → `pgnLayout`
 *   - `x2chess.resourceViewerHeightPx` → `resourceViewerHeightPx`
 *   - `x2chess.boardColumnWidthPx`     → `boardColumnWidthPx`
 *
 * Communication API:
 * - Pure module; no React, no DOM.  Receives an optional `StorageBackend` for
 *   testability; defaults to `window.localStorage`.
 */

import { createVersionedStore } from "./versioned_store";
import type { StorageBackend } from "./versioned_store";
import { DEFAULT_SHELL_PREFS, SHELL_PREFS_KEY } from "../runtime/shell_prefs_store";
import type { ShellPrefs } from "../runtime/shell_prefs_store";

// ── Legacy key constants ──────────────────────────────────────────────────────

const LEGACY_DEV_TOOLS_KEY = "x2chess.developerTools";
const LEGACY_LOCALE_KEY = "x2chess.locale";
const LEGACY_SOUND_KEY = "x2chess.sound";
const LEGACY_MOVE_DELAY_KEY = "x2chess.moveDelayMs";
const LEGACY_POSITION_PREVIEW_KEY = "x2chess.positionPreviewOnHover";
const LEGACY_PGN_LAYOUT_KEY = "x2chess.pgnLayout";
const LEGACY_RESOURCE_VIEWER_HEIGHT_KEY = "x2chess.resourceViewerHeightPx";
const LEGACY_BOARD_COLUMN_WIDTH_KEY = "x2chess.boardColumnWidthPx";

const LEGACY_KEYS: readonly string[] = [
  LEGACY_DEV_TOOLS_KEY,
  LEGACY_LOCALE_KEY,
  LEGACY_SOUND_KEY,
  LEGACY_MOVE_DELAY_KEY,
  LEGACY_POSITION_PREVIEW_KEY,
  LEGACY_PGN_LAYOUT_KEY,
  LEGACY_RESOURCE_VIEWER_HEIGHT_KEY,
  LEGACY_BOARD_COLUMN_WIDTH_KEY,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const readBool = (s: StorageBackend, key: string, fallback: boolean): boolean => {
  const raw = s.getItem(key);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
};

const readNumber = (s: StorageBackend, key: string): number | null => {
  const raw = s.getItem(key);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const readPgnLayout = (s: StorageBackend): ShellPrefs["pgnLayout"] => {
  const raw = s.getItem(LEGACY_PGN_LAYOUT_KEY);
  if (raw === "text" || raw === "tree" || raw === "plain") return raw;
  return DEFAULT_SHELL_PREFS.pgnLayout;
};

const resolveStorage = (injected: StorageBackend | undefined): StorageBackend | null => {
  if (injected) return injected;
  if (globalThis.window !== undefined && globalThis.localStorage) return globalThis.localStorage;
  return null;
};

// ── Migration ─────────────────────────────────────────────────────────────────

/**
 * Consolidate legacy individual localStorage keys into the compound
 * `shellPrefsStore`.
 *
 * Idempotent: if the new compound key already exists, returns immediately
 * without reading or modifying anything.
 *
 * @param storage Optional storage backend for testing. Defaults to `window.localStorage`.
 */
export const migrateLocalStorage = (storage?: StorageBackend): void => {
  const s = resolveStorage(storage);
  if (!s) return;

  // Idempotency guard: compound key already exists → migration already done.
  if (s.getItem(SHELL_PREFS_KEY) !== null) return;

  // Build a store wired to the (potentially injected) backend.
  const store = createVersionedStore<ShellPrefs>({
    key: SHELL_PREFS_KEY,
    version: 1,
    defaultValue: DEFAULT_SHELL_PREFS,
    migrations: [],
    storage: s,
  });

  // Check whether any legacy key has a value.
  const hasLegacyData = LEGACY_KEYS.some((k) => s.getItem(k) !== null);
  if (!hasLegacyData) {
    // Fresh install: write default so idempotency guard fires on future calls.
    store.write(DEFAULT_SHELL_PREFS);
    return;
  }

  // Consolidate legacy values, falling back to the shipped default per field.
  const consolidated: ShellPrefs = {
    developerToolsEnabled: readBool(s, LEGACY_DEV_TOOLS_KEY, DEFAULT_SHELL_PREFS.developerToolsEnabled),
    locale: s.getItem(LEGACY_LOCALE_KEY) ?? DEFAULT_SHELL_PREFS.locale,
    sound: readBool(s, LEGACY_SOUND_KEY, DEFAULT_SHELL_PREFS.sound),
    moveDelayMs: readNumber(s, LEGACY_MOVE_DELAY_KEY) ?? DEFAULT_SHELL_PREFS.moveDelayMs,
    positionPreviewOnHover: readBool(s, LEGACY_POSITION_PREVIEW_KEY, DEFAULT_SHELL_PREFS.positionPreviewOnHover),
    pgnLayout: readPgnLayout(s),
    resourceViewerHeightPx: readNumber(s, LEGACY_RESOURCE_VIEWER_HEIGHT_KEY),
    boardColumnWidthPx: readNumber(s, LEGACY_BOARD_COLUMN_WIDTH_KEY),
  };

  store.write(consolidated);

  // Remove legacy individual keys.
  for (const legacyKey of LEGACY_KEYS) {
    try {
      s.removeItem(legacyKey);
    } catch {
      // Ignore.
    }
  }
};
