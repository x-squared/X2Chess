/**
 * engine_config — engine configuration types and user registry.
 *
 * Integration API:
 * - Exports: `EngineConfig`, `EngineRegistry`.
 *
 * Configuration API:
 * - Stored in `config/engines.json` in the app data directory.
 *
 * Communication API:
 * - Pure types; no I/O or side effects.
 */

export type EngineConfig = {
  /** Stable identifier used as a key in the engine manager. */
  id: string;
  /** Display label shown in the UI. */
  label: string;
  /** Absolute path to the engine executable. */
  path: string;
  /** UCI option overrides to apply after initialization. */
  options: Record<string, string | number | boolean>;
};

export type EngineRegistry = {
  engines: EngineConfig[];
  defaultEngineId?: string;
};
