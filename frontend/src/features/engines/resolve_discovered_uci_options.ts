/**
 * resolve_discovered_uci_options — tie cached UCI option lists to an engine row for the GUI.
 *
 * `useEngineAnalysis` stores discovered options per engine id after `uci` runs. Copied engines
 * reuse the source executable path but receive a new id, so the cache must fall back to any
 * sibling registry entry with the same path that was already probed.
 *
 * Integration API:
 * - `resolveDiscoveredUciOptionsForEngine(engine, enginesList, byId)` — pure helper for panels.
 */

import type { EngineConfig } from "../../../../parts/engines/src/domain/engine_config";
import type { UciOption } from "../../../../parts/engines/src/domain/uci_types";

const EMPTY_UCI_OPTIONS: UciOption[] = [];

/**
 * Returns UCI option metadata for rendering controls in `EngineConfigDialog`.
 *
 * @param engine Engine row currently being edited.
 * @param enginesList Full configured engine list (same-path lookup).
 * @param byId Map from engine id to options array filled when that id was probed.
 * @returns Non-empty options when this id or any same-path sibling was probed; otherwise `[]`.
 */
export const resolveDiscoveredUciOptionsForEngine = (
  engine: EngineConfig,
  enginesList: readonly EngineConfig[],
  byId: Map<string, UciOption[]>,
): UciOption[] => {
  const direct: UciOption[] | undefined = byId.get(engine.id);
  if (direct !== undefined && direct.length > 0) {
    return direct;
  }
  const pathNorm: string = engine.path;
  for (const other of enginesList) {
    if (other.path !== pathNorm) {
      continue;
    }
    const opts: UciOption[] | undefined = byId.get(other.id);
    if (opts !== undefined && opts.length > 0) {
      return opts;
    }
  }
  return EMPTY_UCI_OPTIONS;
};
