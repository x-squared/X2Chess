/**
 * engine_manager — lifecycle manager for configured UCI engines.
 *
 * Reads the engine registry (config/engines.json), lazily initializes engines
 * on first use, and provides a single access point for the rest of the app.
 *
 * Integration API:
 * - `createEngineManager(registry, processFactory)` — creates an EngineManager.
 * - `EngineManager.getSession(engineId?)` — returns an initialized UciSession.
 * - `EngineManager.restartEngine(engineId?)` — kills the process if running and
 *   returns a freshly initialized session (recovery when stop/bestmove hangs).
 * - `EngineManager.listEngines()` — returns all configured engine configs.
 * - `EngineManager.shutdownAll()` — kills all running engines.
 * - `parseEngineRegistry` / `serializeEngineRegistry` — load/save `engines.json` text.
 *
 * Configuration API:
 * - `EngineRegistry` from `engines/domain/engine_config.ts`.
 *
 * Communication API:
 * - `processFactory(config)` — dependency injection point; supply a desktop
 *   `EngineProcess` factory (e.g. `createTauriEngine` from
 *   `frontend/src/platform/desktop/tauri_engine_adapter.ts`) in production or a
 *   mock in tests.
 */

import type { EngineConfig, EngineRegistry } from "../domain/engine_config";
import type { UciSession, EngineProcess } from "../uci/uci_session";
import { createUciSession } from "../uci/uci_session";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ProcessFactory = (
  config: EngineConfig,
) => EngineProcess & { ensureSpawned?(): Promise<void> };

type ManagedEngine = {
  config: EngineConfig;
  process: EngineProcess & { ensureSpawned?(): Promise<void> };
  session: UciSession;
  initialized: boolean;
};

export type EngineManager = {
  /** Return an initialized session for `engineId`, or the default engine. */
  getSession(engineId?: string): Promise<UciSession>;
  /**
   * Kill the engine process for `engineId` (if any) and return a new initialized session.
   * Use when `stop` does not yield `bestmove` (hung native engine).
   */
  restartEngine(engineId?: string): Promise<UciSession>;
  /** List all configured engines. */
  listEngines(): EngineConfig[];
  /** The default engine ID (from registry). */
  readonly defaultEngineId: string | undefined;
  /** Kill all running engine processes. */
  shutdownAll(): Promise<void>;
};

// ── Implementation ─────────────────────────────────────────────────────────────

/**
 * Create an engine manager from a registry and a process factory.
 *
 * @param registry        Engine registry (from config/engines.json).
 * @param processFactory  Dependency-injected factory that wraps engine I/O.
 */
export const createEngineManager = (
  registry: EngineRegistry,
  processFactory: ProcessFactory,
): EngineManager => {
  const managed = new Map<string, ManagedEngine>();

  const getOrCreate = (config: EngineConfig): ManagedEngine => {
    const existing = managed.get(config.id);
    if (existing) return existing;

    const process = processFactory(config);
    const session = createUciSession(process);
    const entry: ManagedEngine = { config, process, session, initialized: false };
    managed.set(config.id, entry);
    return entry;
  };

  const initialize = async (entry: ManagedEngine): Promise<UciSession> => {
    if (entry.initialized) return entry.session;

    if (entry.process.ensureSpawned) {
      await entry.process.ensureSpawned();
    }
    await entry.session.initialize();
    await entry.session.isReady();

    // Apply stored options from the config.
    for (const [name, value] of Object.entries(entry.config.options)) {
      entry.session.setOption(name, String(value));
    }

    entry.initialized = true;
    return entry.session;
  };

  return {
    async getSession(engineId?: string): Promise<UciSession> {
      const id = engineId ?? registry.defaultEngineId;
      const config = registry.engines.find((e) => e.id === id);
      if (!config) {
        throw new Error(
          `Engine "${id ?? "(default)"}" not found in registry. ` +
            `Available: ${registry.engines.map((e) => e.id).join(", ")}`,
        );
      }
      const entry = getOrCreate(config);
      return initialize(entry);
    },

    async restartEngine(engineId?: string): Promise<UciSession> {
      const id = engineId ?? registry.defaultEngineId;
      const config = registry.engines.find((e) => e.id === id);
      if (!config) {
        throw new Error(
          `Engine "${id ?? "(default)"}" not found in registry. ` +
            `Available: ${registry.engines.map((e) => e.id).join(", ")}`,
        );
      }
      const existing = managed.get(config.id);
      if (existing) {
        try {
          await existing.process.kill();
        } catch {
          // Best-effort; proceed with a fresh process entry.
        }
        managed.delete(config.id);
      }
      const entry = getOrCreate(config);
      return initialize(entry);
    },

    listEngines(): EngineConfig[] {
      return [...registry.engines];
    },

    get defaultEngineId(): string | undefined {
      return registry.defaultEngineId;
    },

    async shutdownAll(): Promise<void> {
      await Promise.all(
        [...managed.values()].map(async (entry): Promise<void> => {
          try {
            await entry.session.quit();
          } catch {
            // Best-effort; ignore errors on shutdown.
          }
        }),
      );
      managed.clear();
    },
  };
};

// ── Registry loader ────────────────────────────────────────────────────────────

/**
 * Parse a config/engines.json string into an EngineRegistry.
 * Returns an empty registry on parse errors.
 */
export const parseEngineRegistry = (json: string): EngineRegistry => {
  try {
    const parsed = JSON.parse(json) as Partial<EngineRegistry> & {
      defaultEngineId?: string | null;
    };
    const rawDefault: string | null | undefined = parsed.defaultEngineId;
    const defaultEngineId: string | undefined =
      typeof rawDefault === "string" && rawDefault.length > 0 ? rawDefault : undefined;
    return {
      engines: Array.isArray(parsed.engines) ? parsed.engines : [],
      defaultEngineId,
    };
  } catch {
    return { engines: [] };
  }
};

/**
 * Serialize registry for `engines.json`. When there are no engines, writes `defaultEngineId: null`
 * so a removed default cannot linger on disk.
 *
 * @param registry Current user registry.
 * @returns Pretty-printed JSON string.
 */
export const serializeEngineRegistry = (registry: EngineRegistry): string => {
  const defaultEngineId: string | null =
    registry.engines.length === 0 ? null : registry.defaultEngineId ?? null;
  return JSON.stringify({ engines: registry.engines, defaultEngineId }, null, 2);
};
