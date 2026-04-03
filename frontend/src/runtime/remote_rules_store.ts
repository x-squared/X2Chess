/**
 * remote_rules_store — versioned store for the cached remote web-import rules.
 *
 * Integration API:
 * - `remoteRulesCacheStore` — call `.read()` to load the cache, `.write()` to persist.
 * - `RemoteRulesCache` — the stored shape (version + rules array).
 *
 * Configuration API:
 * - Storage key: `"x2chess.webImportRules"` (replaces the legacy pair of keys
 *   `x2chess.webImportRules.v1` and `x2chess.webImportRules.version`).
 * - Version 1 — initial versioned form.
 *
 * Communication API:
 * - Pure module; no React, no DOM.
 */

import { createVersionedStore } from "../storage";
import type { VersionedStore } from "../storage";
import type { WebImportRule } from "../resources/web_import/web_import_types";

/** Cached remote rules with their server-side version number. */
export type RemoteRulesCache = {
  /** Server-side version counter used to detect staleness. */
  version: number;
  /** The downloaded rules. */
  rules: WebImportRule[];
};

export const REMOTE_RULES_KEY = "x2chess.webImportRules";

/**
 * Versioned store for the remote rules cache.
 *
 * The two legacy keys (`x2chess.webImportRules.v1` and
 * `x2chess.webImportRules.version`) are merged into a single compound value.
 * Migration of those keys is handled in `migrateRemoteRulesCache` below.
 */
export const remoteRulesCacheStore: VersionedStore<RemoteRulesCache | null> =
  createVersionedStore<RemoteRulesCache | null>({
    key: REMOTE_RULES_KEY,
    version: 1,
    defaultValue: null,
    migrations: [],
    // No v0→v1 migration: the legacy keys use different key names entirely,
    // so there is no raw value to migrate here. Legacy consolidation is
    // one-directional (read + delete legacy keys on first write) and is
    // handled by migrateRemoteRulesCache below.
  });

// ── Legacy key constants (read-once consolidation) ────────────────────────────

const LEGACY_RULES_KEY = "x2chess.webImportRules.v1";
const LEGACY_VERSION_KEY = "x2chess.webImportRules.version";

/**
 * One-shot consolidation of the legacy two-key remote rules cache.
 *
 * Idempotent: if the compound key already exists, returns immediately.
 * Should be called once at startup before `remoteRulesCacheStore.read()`.
 */
export const migrateRemoteRulesCache = (): void => {
  const storage = globalThis.localStorage;
  if (!storage) return;

  // Already migrated.
  if (storage.getItem(REMOTE_RULES_KEY) !== null) return;

  const rawRules = storage.getItem(LEGACY_RULES_KEY);
  const rawVersion = storage.getItem(LEGACY_VERSION_KEY);

  if (rawRules === null && rawVersion === null) {
    // No legacy data — nothing to consolidate.
    return;
  }

  try {
    const rules: WebImportRule[] = rawRules ? (JSON.parse(rawRules) as WebImportRule[]) : [];
    const version = Number(rawVersion ?? "0");
    remoteRulesCacheStore.write({
      version: Number.isFinite(version) ? version : 0,
      rules: Array.isArray(rules) ? rules : [],
    });
  } catch {
    // Corrupt legacy data — leave the compound key absent; store will use null default.
  }

  try { storage.removeItem(LEGACY_RULES_KEY); } catch { /* ignore */ }
  try { storage.removeItem(LEGACY_VERSION_KEY); } catch { /* ignore */ }
};
