/**
 * versioned_store — factory for versioned localStorage stores.
 *
 * Integration API:
 * - `createVersionedStore(config)` — create a `VersionedStore<T>`.
 * - `VersionedStore<T>` — read / write / reset a single typed store.
 *
 * Configuration API:
 * - Each store declares its `key`, `version`, `defaultValue`, and `migrations`.
 * - `migrations[i]` upgrades data from version `i` to version `i+1`.
 *   Length must be `version - 1` (version 1 needs 0 steps).
 * - An optional `storage` backend can be injected for testing.
 *
 * Communication API:
 * - Pure module; no React, no DOM globals.  The default storage backend
 *   (`window.localStorage`) is resolved lazily at call time, not at import time,
 *   so server-side environments that import this module without `window` do not
 *   throw at module load.
 *
 * Envelope format (stored JSON):
 * - `{ "v": <number>, "data": <T> }`
 * - Legacy values (raw JSON written before versioning was adopted) are treated
 *   as version 0 and passed through the migration chain starting at step 0.
 */

// ── Storage backend ───────────────────────────────────────────────────────────

/** Minimal subset of the Web Storage API used by this module. */
export type StorageBackend = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

// ── Envelope ──────────────────────────────────────────────────────────────────

/** The JSON shape persisted to storage for every versioned store. */
export type StoredEnvelope<T> = {
  /** Schema version of the stored data. */
  v: number;
  /** The payload value. */
  data: T;
};

// ── Migration steps ───────────────────────────────────────────────────────────

/**
 * A single migration step: given data shaped like version N−1, return data
 * shaped like version N.  Return `null` to signal that the data is
 * unrecoverable (triggers a reset to the store's `defaultValue`).
 */
export type MigrationStep = (from: unknown) => unknown;

// ── Store config ──────────────────────────────────────────────────────────────

/** Configuration for a single versioned store. */
export type VersionedStoreConfig<T> = {
  /** The localStorage key. */
  key: string;
  /**
   * Current schema version.  Start at 1.  Increment when the stored shape
   * changes incompatibly and add a corresponding migration step.
   */
  version: number;
  /** Value used when storage is absent, corrupt, or unrecoverable. */
  defaultValue: T;
  /**
   * Ordered migration steps.  Entry at index `i` upgrades data from version
   * `i` to version `i + 1`.  Length must equal `version - 1`.
   */
  migrations: ReadonlyArray<MigrationStep>;
  /**
   * Optional storage backend.  Defaults to `window.localStorage` at runtime.
   * Inject a stub in tests.
   */
  storage?: StorageBackend;
};

// ── Store API ─────────────────────────────────────────────────────────────────

/** Read / write / reset API for a single versioned localStorage store. */
export type VersionedStore<T> = {
  /**
   * Read the current value.
   *
   * - If the key is absent, returns `defaultValue` without writing.
   * - If the stored version is older than `config.version`, applies the
   *   migration chain and writes the upgraded envelope back.
   * - If the stored version is newer (data from a future build), returns
   *   `defaultValue` without overwriting (preserves data for that build).
   * - If the JSON is corrupt or any migration step returns `null`, resets
   *   the key to `defaultValue` and logs a warning.
   */
  read(): T;
  /**
   * Write a value at the current schema version.
   * Silently ignores quota / availability errors.
   */
  write(value: T): void;
  /** Remove the key and reset to `defaultValue`. */
  reset(): void;
};

// ── Factory ───────────────────────────────────────────────────────────────────

const resolveStorage = (injected: StorageBackend | undefined): StorageBackend | null => {
  if (injected) return injected;
  // Resolve lazily; `window` may be absent in SSR/test environments.
  if (globalThis.window !== undefined && globalThis.localStorage) return globalThis.localStorage;
  return null;
};

/**
 * Create a versioned localStorage store.
 *
 * Safe to call in pure-logic modules — no React or DOM imports required.
 *
 * @param config Store configuration.
 * @returns A `VersionedStore<T>` with `read`, `write`, and `reset`.
 */
export const createVersionedStore = <T>(config: VersionedStoreConfig<T>): VersionedStore<T> => {
  const { key, version, defaultValue, migrations } = config;

  const getStorage = (): StorageBackend | null => resolveStorage(config.storage);

  const writeEnvelope = (storage: StorageBackend, data: T): void => {
    try {
      const envelope: StoredEnvelope<T> = { v: version, data };
      storage.setItem(key, JSON.stringify(envelope));
    } catch {
      // Quota exceeded or private browsing — silently ignore.
    }
  };

  const resetToDefault = (storage: StorageBackend): T => {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore.
    }
    return defaultValue;
  };

  const read = (): T => {
    const storage = getStorage();
    if (!storage) return defaultValue;

    const raw = storage.getItem(key);
    if (!raw) return defaultValue;

    // Parse the stored JSON.
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(`[versioned_store] Corrupt JSON at key "${key}" — resetting to default.`);
      return resetToDefault(storage);
    }

    // Detect whether this is already an envelope or a legacy raw value (v = 0).
    let storedVersion: number;
    let data: unknown;

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "v" in parsed &&
      "data" in parsed &&
      typeof (parsed as Record<string, unknown>)["v"] === "number"
    ) {
      const envelope = parsed as StoredEnvelope<unknown>;
      storedVersion = envelope.v;
      data = envelope.data;
    } else {
      // Pre-versioned raw payload — treat as version 0.
      storedVersion = 0;
      data = parsed;
    }

    // Future version: do not overwrite; return default.
    if (storedVersion > version) {
      console.warn(
        `[versioned_store] Key "${key}" has future version ${storedVersion} (current: ${version}). ` +
          `Returning default without overwriting.`,
      );
      return defaultValue;
    }

    // Current version: return directly.
    if (storedVersion === version) {
      return data as T;
    }

    // Older version: apply migration chain.
    let migrated: unknown = data;
    for (let step = storedVersion; step < version; step++) {
      const migrateFn = migrations[step];
      if (!migrateFn) {
        console.warn(
          `[versioned_store] No migration step ${step} for key "${key}" — resetting to default.`,
        );
        return resetToDefault(storage);
      }
      const result = migrateFn(migrated);
      if (result === null) {
        console.warn(
          `[versioned_store] Migration step ${step} returned null for key "${key}" — resetting to default.`,
        );
        return resetToDefault(storage);
      }
      migrated = result;
    }

    // Write back the migrated value at the current version.
    writeEnvelope(storage, migrated as T);
    return migrated as T;
  };

  const write = (value: T): void => {
    const storage = getStorage();
    if (!storage) return;
    writeEnvelope(storage, value);
  };

  const reset = (): void => {
    const storage = getStorage();
    if (!storage) return;
    resetToDefault(storage);
  };

  return { read, write, reset };
};
