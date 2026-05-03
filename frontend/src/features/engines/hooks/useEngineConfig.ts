/**
 * useEngineConfig — React hook for engine registry state management.
 *
 * Loads the engine list from `~/.x2chess/config/engines.json` on mount,
 * exposes CRUD operations (add, remove, update, copy), and persists every
 * change back to disk via the `save_engines_config` Tauri command.
 *
 * Integration API:
 * - `const config = useEngineConfig()` — call once at AppShell level.
 *
 * Communication API:
 * - `config.engines`, `config.defaultEngineId` — current registry state.
 * - `config.addEngine(cfg)` / `removeEngine(id)` / `updateEngine(cfg)` /
 *   `copyEngine(id)` / `setDefault(id)` — mutate and persist.
 * - `config.detectEngines()` — probe PATH + known locations.
 * - `config.pickExecutable()` — open native file picker.
 */

import { useState, useEffect, useCallback } from "react";
import type { EngineConfig, EngineRegistry } from "../../../../../parts/engines/src/domain/engine_config";
import {
  parseEngineRegistry,
  serializeEngineRegistry,
} from "../../../../../parts/engines/src/client/engine_manager";
import { isTauri, tauriInvoke } from "../../../platform/desktop/tauri_ipc_bridge";
import { log } from "../../../logger";

// ── Tauri bridge ──────────────────────────────────────────────────────────────
// Feature code uses `tauri_ipc_bridge` only — see `platform/desktop/tauri_ipc_bridge.ts`.

// ── Types ──────────────────────────────────────────────────────────────────────

export type DetectedEngine = { path: string; name: string };

export type EngineConfigState = {
  engines: EngineConfig[];
  defaultEngineId: string | undefined;
  isLoading: boolean;
  addEngine: (cfg: EngineConfig) => void;
  removeEngine: (id: string) => void;
  updateEngine: (cfg: EngineConfig) => void;
  copyEngine: (id: string) => void;
  setDefault: (id: string) => void;
  detectEngines: () => Promise<DetectedEngine[]>;
  pickExecutable: () => Promise<string | null>;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const persistRegistry = (registry: EngineRegistry): void => {
  if (!isTauri()) return;
  const content: string = serializeEngineRegistry(registry);
  void tauriInvoke("save_engines_config", { content }).catch((err: unknown): void => {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else if (typeof err === "string") {
      message = err;
    } else {
      message = JSON.stringify(err);
    }
    log.error("useEngineConfig", "save_engines_config failed — engines.json not updated", {
      message,
    });
  });
};

export const makeEngineId = (): string =>
  `engine_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages the UCI engine registry: load from disk, CRUD operations, auto-save.
 */
export const useEngineConfig = (): EngineConfigState => {
  const [registry, setRegistry] = useState<EngineRegistry>({ engines: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect((): void => {
    if (!isTauri()) { setIsLoading(false); return; }
    void (async (): Promise<void> => {
      try {
        const path = await tauriInvoke<string>("get_app_config_path", { fileName: "engines.json" });
        const json = await tauriInvoke<string>("load_text_file", { filePath: path });
        setRegistry(parseEngineRegistry(json));
      } catch {
        // No existing config — start with empty registry.
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const apply = useCallback(
    (updater: (prev: EngineRegistry) => EngineRegistry): void => {
      setRegistry((prev) => {
        const next = updater(prev);
        persistRegistry(next);
        return next;
      });
    },
    [],
  );

  const addEngine = useCallback(
    (cfg: EngineConfig): void => {
      apply((prev) => ({
        engines: [...prev.engines, cfg],
        defaultEngineId: prev.defaultEngineId ?? cfg.id,
      }));
    },
    [apply],
  );

  const removeEngine = useCallback(
    (id: string): void => {
      apply((prev) => {
        const engines = prev.engines.filter((e) => e.id !== id);
        const defaultEngineId =
          prev.defaultEngineId === id ? engines[0]?.id : prev.defaultEngineId;
        return { engines, defaultEngineId };
      });
    },
    [apply],
  );

  const updateEngine = useCallback(
    (cfg: EngineConfig): void => {
      apply((prev) => ({
        ...prev,
        engines: prev.engines.map((e) => (e.id === cfg.id ? cfg : e)),
      }));
    },
    [apply],
  );

  const copyEngine = useCallback(
    (id: string): void => {
      apply((prev) => {
        const source = prev.engines.find((e) => e.id === id);
        if (!source) return prev;
        const copy: EngineConfig = {
          ...source,
          id: makeEngineId(),
          label: `${source.label} (copy)`,
        };
        return { ...prev, engines: [...prev.engines, copy] };
      });
    },
    [apply],
  );

  const setDefault = useCallback(
    (id: string): void => {
      apply((prev) => ({ ...prev, defaultEngineId: id }));
    },
    [apply],
  );

  const detectEngines = useCallback(async (): Promise<DetectedEngine[]> => {
    log.debug("useEngineConfig", () => `detectEngines: isTauri=${isTauri()}`);
    if (!isTauri()) return [];
    try {
      const result: DetectedEngine[] = await tauriInvoke<DetectedEngine[]>("detect_engines");
      log.info("useEngineConfig", "detectEngines completed", { count: result.length });
      return result;
    } catch (err: unknown) {
      const message: string =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      log.error("useEngineConfig", "detectEngines invoke failed", { message });
      return [];
    }
  }, []);

  const pickExecutable = useCallback(async (): Promise<string | null> => {
    log.debug("useEngineConfig", () => `pickExecutable: isTauri=${isTauri()}`);
    if (!isTauri()) {
      log.warn("useEngineConfig", "pickExecutable: not in Tauri runtime — browse unavailable");
      return null;
    }
    log.info("useEngineConfig", "pickExecutable: invoking pick_engine_executable");
    try {
      const result: string | null = await tauriInvoke<string | null>("pick_engine_executable");
      const hasPath: boolean = Boolean(result && result.length > 0);
      log.info("useEngineConfig", "pickExecutable: invoke returned", {
        cancelledOrEmpty: !hasPath,
      });
      return result ?? null;
    } catch (err: unknown) {
      const message: string =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
      log.error("useEngineConfig", "pickExecutable: pick_engine_executable failed", { message });
      return null;
    }
  }, []);

  return {
    engines: registry.engines,
    defaultEngineId: registry.defaultEngineId,
    isLoading,
    addEngine,
    removeEngine,
    updateEngine,
    copyEngine,
    setDefault,
    detectEngines,
    pickExecutable,
  };
};
