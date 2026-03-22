/**
 * engine_manager — lifecycle manager for configured UCI engines.
 *
 * Reads the engine registry (config/engines.json), lazily initializes engines
 * on first use, and provides a single access point for the rest of the app.
 *
 * Integration API:
 * - `createEngineManager(registry, processFactory)` — creates an EngineManager.
 * - `EngineManager.getSession(engineId?)` — returns an initialized UciSession.
 * - `EngineManager.listEngines()` — returns all configured engine configs.
 * - `EngineManager.shutdownAll()` — kills all running engines.
 *
 * Configuration API:
 * - `EngineRegistry` from `engines/domain/engine_config.ts`.
 *
 * Communication API:
 * - `processFactory(config)` — dependency injection point; supply
 *   `createTauriEngine` in production or a mock in tests.
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
    const parsed = JSON.parse(json) as Partial<EngineRegistry>;
    return {
      engines: Array.isArray(parsed.engines) ? parsed.engines : [],
      defaultEngineId: parsed.defaultEngineId,
    };
  } catch {
    return { engines: [] };
  }
};
