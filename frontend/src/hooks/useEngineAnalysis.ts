/**
 * useEngineAnalysis — React hook for UCI engine analysis state.
 *
 * Initializes the engine manager from `config/engines.json` (via Tauri FS),
 * manages analysis lifecycle, and exposes engine variations to the UI.
 * Gracefully degrades when no engine is configured or Tauri is unavailable.
 *
 * Integration API:
 * - `const analysis = useEngineAnalysis(position)` — pass the current board
 *   position; the hook manages analysis start/stop against it.
 *
 * Communication API:
 * - Returns `{ variations, isAnalyzing, engineName, startAnalysis, stopAnalysis }`
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { EngineVariation, EngineBestMove, MoveSearchOptions } from "../../../parts/engines/src/domain/analysis_types";
import type { EngineManager } from "../../../parts/engines/src/client/engine_manager";
import {
  createEngineManager,
  parseEngineRegistry,
} from "../../../parts/engines/src/client/engine_manager";
import { createTauriEngine } from "../../../parts/engines/src/adapters/tauri_engine";
import type { EnginePosition } from "../../../parts/engines/src/domain/analysis_types";

// ── Tauri FS helpers (mirrors source_gateway.ts pattern) ────────────────────

type TauriWindowLike = typeof window & {
  __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } };
  __TAURI_INTERNALS__?: unknown;
};

const isTauriEnvironment = (): boolean => {
  const runtimeWindow = window as TauriWindowLike;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__ || runtimeWindow.__TAURI__);
};

const tauriReadTextFile = async (path: string): Promise<string> => {
  const runtimeWindow = window as TauriWindowLike;
  const invokeFn = runtimeWindow.__TAURI__?.core?.invoke;
  if (typeof invokeFn !== "function") throw new Error("Tauri unavailable");
  return String(await invokeFn("load_text_file", { filePath: path }));
};

const tauriGetConfigPath = async (): Promise<string> => {
  const runtimeWindow = window as TauriWindowLike;
  const invokeFn = runtimeWindow.__TAURI__?.core?.invoke;
  if (typeof invokeFn !== "function") throw new Error("Tauri unavailable");
  return String(await invokeFn("get_app_config_path", { fileName: "engines.json" }));
};

// ── Hook types ───────────────────────────────────────────────────────────────

export type EngineAnalysisState = {
  variations: EngineVariation[];
  isAnalyzing: boolean;
  engineName: string | null;
  startAnalysis: (position: EnginePosition) => void;
  stopAnalysis: () => void;
  findBestMove: (position: EnginePosition, opts: MoveSearchOptions) => Promise<EngineBestMove | null>;
};

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages engine analysis lifecycle for a given board position.
 * Safe to render when no engine is configured — returns inert state.
 *
 * @returns Engine analysis state with `variations`, `isAnalyzing`, `engineName`, `startAnalysis`, `stopAnalysis`, and `findBestMove`.
 */
export const useEngineAnalysis = (): EngineAnalysisState => {
  const [variations, setVariations] = useState<EngineVariation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [engineName, setEngineName] = useState<string | null>(null);
  const managerRef = useRef<EngineManager | null>(null);

  // Initialize engine manager from config on mount.
  useEffect((): (() => void) => {
    if (!isTauriEnvironment()) return (): void => undefined;

    let cancelled = false;
    const init = async (): Promise<void> => {
      try {
        const configPath = await tauriGetConfigPath();
        const json = await tauriReadTextFile(configPath);
        if (cancelled) return;
        const registry = parseEngineRegistry(json);
        if (!registry.defaultEngineId || registry.engines.length === 0) return;
        const manager = createEngineManager(registry, (config) =>
          createTauriEngine({ config }),
        );
        managerRef.current = manager;
        const defaultCfg = registry.engines.find(
          (e) => e.id === registry.defaultEngineId,
        );
        if (defaultCfg) setEngineName(defaultCfg.label ?? defaultCfg.id);
      } catch {
        // No engine config — silent; engineName stays null.
      }
    };
    void init();
    return (): void => {
      cancelled = true;
      void managerRef.current?.shutdownAll().catch(() => undefined);
    };
  }, []);

  const stopAnalysis = useCallback((): void => {
    setIsAnalyzing(false);
    void managerRef.current
      ?.getSession()
      .then((session) => session.stopAnalysis())
      .catch(() => undefined);
  }, []);

  const startAnalysis = useCallback((position: EnginePosition): void => {
    const manager = managerRef.current;
    if (!manager) return;

    stopAnalysis();
    setVariations([]);
    setIsAnalyzing(true);

    manager
      .getSession()
      .then((session) => {
        session.startAnalysis(
          position,
          { infinite: true, multiPv: 3 },
          (v: EngineVariation): void => {
            setVariations((prev) => {
              const next = [...prev];
              const idx = next.findIndex((x) => x.multipvIndex === v.multipvIndex);
              if (idx >= 0) next[idx] = v; else next.push(v);
              return next.sort((a, b) => a.multipvIndex - b.multipvIndex);
            });
          },
        );
      })
      .catch(() => {
        setIsAnalyzing(false);
      });
  }, [stopAnalysis]);

  const findBestMove = useCallback(
    async (position: EnginePosition, opts: MoveSearchOptions): Promise<EngineBestMove | null> => {
      const manager = managerRef.current;
      if (!manager) return null;
      try {
        const session = await manager.getSession();
        return await session.findBestMove(position, opts);
      } catch {
        return null;
      }
    },
    [],
  );

  return { variations, isAnalyzing, engineName, startAnalysis, stopAnalysis, findBestMove };
};
