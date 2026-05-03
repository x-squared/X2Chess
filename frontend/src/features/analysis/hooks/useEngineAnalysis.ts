/**
 * useEngineAnalysis — React hook for UCI engine analysis state.
 *
 * Manages the engine manager lifecycle, exposes engine variations, and allows
 * runtime configuration of multiPv, threads, and active engine. Gracefully
 * degrades when no engine is configured or Tauri is unavailable.
 *
 * Integration API:
 * - `const analysis = useEngineAnalysis(registry?)`
 *
 * Communication API:
 * - Returns `{ variations, isAnalyzing, engineName, activeEngineId, multiPv,
 *     threads, discoveredOptions, startAnalysis, stopAnalysis, findBestMove,
 *     setMultiPv, setThreads, setActiveEngine }`
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  EngineVariation,
  EngineBestMove,
  MoveSearchOptions,
  EnginePosition,
} from "../../../../../parts/engines/src/domain/analysis_types";
import type { UciOption } from "../../../../../parts/engines/src/domain/uci_types";
import type { EngineManager } from "../../../../../parts/engines/src/client/engine_manager";
import type { EngineRegistry } from "../../../../../parts/engines/src/domain/engine_config";
import { createEngineManager } from "../../../../../parts/engines/src/client/engine_manager";
import { createTauriEngine } from "../../../platform/desktop/tauri_engine_adapter";
import { sanitizeEnginePositionForUci } from "../../../model/fen_sanitization";
import { pvUciMovesToSan } from "../../../board/move_position";
import { log } from "../../../logger";

/** Max time to wait for `bestmove` after `stop` before killing and restarting the engine process. */
const ENGINE_STOP_TIMEOUT_MS: number = 2500;

/**
 * Waits for the current search to end via UCI `stop` → `bestmove`. If the native
 * engine is hung (no `bestmove`), restarts the process so a new analysis can run.
 *
 * @param manager Active engine manager.
 * @param engineId Registry engine id or undefined for default.
 */
const awaitStopOrTimeoutRestart = async (
  manager: EngineManager,
  engineId: string | undefined,
): Promise<void> => {
  try {
    const session = await manager.getSession(engineId);
    const stoppedInTime: boolean = await Promise.race<boolean>([
      session.stopAnalysis().then((): boolean => true),
      new Promise<boolean>((resolve): void => {
        setTimeout((): void => {
          resolve(false);
        }, ENGINE_STOP_TIMEOUT_MS);
      }),
    ]);
    if (!stoppedInTime) {
      log.warn(
        "useEngineAnalysis",
        "stopAnalysis timed out — restarting engine process",
        { engineId: engineId ?? null },
      );
      await manager.restartEngine(engineId);
    }
  } catch (err) {
    log.error("useEngineAnalysis", "awaitStopOrTimeoutRestart failed — restarting engine", {
      engineId: engineId ?? null,
      message: String(err),
    });
    await manager.restartEngine(engineId);
  }
};

// ── Tauri environment check ───────────────────────────────────────────────────

type TauriGlobal = typeof globalThis & {
  __TAURI__?: { core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } };
  __TAURI_INTERNALS__?: unknown;
};

const isTauriEnvironment = (): boolean => {
  const g = globalThis as TauriGlobal;
  return Boolean(g.__TAURI_INTERNALS__ || g.__TAURI__);
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type EngineAnalysisState = {
  variations: EngineVariation[];
  isAnalyzing: boolean;
  engineName: string | null;
  activeEngineId: string | undefined;
  multiPv: number;
  threads: number;
  searchMoves: string[] | null;
  discoveredOptions: Map<string, UciOption[]>;
  startAnalysis: (position: EnginePosition) => void;
  stopAnalysis: () => void;
  findBestMove: (position: EnginePosition, opts: MoveSearchOptions) => Promise<EngineBestMove | null>;
  setMultiPv: (n: number) => void;
  setThreads: (n: number) => void;
  setActiveEngine: (id: string) => void;
  setSearchMoves: (moves: string[] | null) => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages engine analysis lifecycle. Accepts the current engine registry so
 * the manager rebuilds when the user adds/removes/reconfigures engines.
 */
export const useEngineAnalysis = (registry?: EngineRegistry): EngineAnalysisState => {
  const [variations, setVariations] = useState<EngineVariation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [engineName, setEngineName] = useState<string | null>(null);
  const [activeEngineId, setActiveEngineId] = useState<string | undefined>(
    registry?.defaultEngineId,
  );
  const [multiPv, setMultiPv] = useState(3);
  const [threads, setThreads] = useState(4);
  const [searchMoves, setSearchMoves] = useState<string[] | null>(null);
  const [discoveredOptions, setDiscoveredOptions] = useState<Map<string, UciOption[]>>(
    new Map(),
  );

  const managerRef = useRef<EngineManager | null>(null);
  const lastPositionRef = useRef<EnginePosition | null>(null);
  const isAnalyzingRef = useRef(false);
  const activeEngineIdRef = useRef(activeEngineId);
  const multiPvRef = useRef(multiPv);
  const threadsRef = useRef(threads);
  const searchMovesRef = useRef<string[] | null>(null);

  useEffect((): void => { isAnalyzingRef.current = isAnalyzing; }, [isAnalyzing]);
  useEffect((): void => { activeEngineIdRef.current = activeEngineId; }, [activeEngineId]);
  useEffect((): void => { multiPvRef.current = multiPv; }, [multiPv]);
  useEffect((): void => { threadsRef.current = threads; }, [threads]);
  useEffect((): void => { searchMovesRef.current = searchMoves; }, [searchMoves]);

  // Rebuild manager when registry changes.
  useEffect((): (() => void) => {
    if (!registry || registry.engines.length === 0) {
      managerRef.current = null;
      setEngineName(null);
      setActiveEngineId(undefined);
      activeEngineIdRef.current = undefined;
      setDiscoveredOptions(new Map());
      log.info("useEngineAnalysis", "registry empty — manager cleared");
      return (): void => undefined;
    }

    if (!isTauriEnvironment()) {
      log.info("useEngineAnalysis", "not a Tauri environment — engine manager not created");
      return (): void => undefined;
    }

    log.info("useEngineAnalysis", `registry changed — creating manager (${registry.engines.length} engines)`);

    let cancelled = false;
    const manager = createEngineManager(registry, (config) =>
      createTauriEngine({ config }),
    );
    managerRef.current = manager;

    const effectiveId = activeEngineIdRef.current ?? registry.defaultEngineId;
    const activeCfg = registry.engines.find((e) => e.id === effectiveId);
    if (activeCfg) {
      setEngineName(activeCfg.label ?? activeCfg.id);
      setActiveEngineId(activeCfg.id);
      const configuredThreadsRaw: number = Number(activeCfg.options["Threads"]);
      const configuredThreads: number = Number.isFinite(configuredThreadsRaw)
        ? configuredThreadsRaw
        : Number.NaN;
      if (configuredThreads > 0) {
        setThreads(configuredThreads);
        threadsRef.current = configuredThreads;
      }
      log.info("useEngineAnalysis", "active engine set", {
        engineId: activeCfg.id,
        configuredThreads: Number.isFinite(configuredThreads) ? configuredThreads : null,
      });
    } else {
      log.warn("useEngineAnalysis", `no config found for effectiveId="${effectiveId ?? "(none)"}"`);
    }

    void (async (): Promise<void> => {
      try {
        log.info("useEngineAnalysis", "probing session options on registry load", { engineId: effectiveId ?? null });
        const session = await manager.getSession(effectiveId);
        if (cancelled) return;
        const opts = Array.from(session.options.values());
        log.info("useEngineAnalysis", `session options loaded (${opts.length} options)`, { engineId: effectiveId ?? null });
        setDiscoveredOptions((prev) => {
          const next = new Map(prev);
          next.set(effectiveId ?? "", opts);
          return next;
        });
      } catch (err) {
        log.warn("useEngineAnalysis", `session options probe failed — options will appear on first analysis: ${String(err)}`, { engineId: effectiveId ?? null });
      }
    })();

    return (): void => {
      cancelled = true;
      log.info("useEngineAnalysis", "registry effect cleanup — shutting down manager");
      void manager.shutdownAll().catch((err) => {
        log.error("useEngineAnalysis", "shutdownAll failed", { message: String(err) });
      });
      managerRef.current = null;
    };
  // registry identity change is the intended trigger; activeEngineId is read via ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry]);

  // Extracted variation handler — avoids >4 levels of nesting inside startAnalysis.
  const handleVariation = useCallback((v: EngineVariation): void => {
    if (!isAnalyzingRef.current) {
      log.debug("useEngineAnalysis", () => `handleVariation: dropped (isAnalyzingRef=false) multipvIndex=${v.multipvIndex}`);
      return;
    }
    const pos = lastPositionRef.current;
    let enriched: EngineVariation = v;
    if (pos !== null && v.pv.length > 0) {
      const pvSan: string[] = pvUciMovesToSan(pos.fen, v.pv);
      if (pvSan.length === v.pv.length) {
        enriched = { ...v, pvSan };
      }
    }
    log.debug("useEngineAnalysis", () => `handleVariation: multipvIndex=${v.multipvIndex} depth=${v.depth}`);
    setVariations((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => x.multipvIndex === enriched.multipvIndex);
      if (idx >= 0) next[idx] = enriched; else next.push(enriched);
      return next.sort((a, b) => a.multipvIndex - b.multipvIndex);
    });
  }, []);

  const stopAnalysis = useCallback((): void => {
    log.info("useEngineAnalysis", "stopAnalysis called", { engineId: activeEngineIdRef.current ?? null });
    setIsAnalyzing(false);
    isAnalyzingRef.current = false;
    const manager: EngineManager | null = managerRef.current;
    const engineId: string | undefined = activeEngineIdRef.current;
    if (!manager) return;
    void (async (): Promise<void> => {
      try {
        await awaitStopOrTimeoutRestart(manager, engineId);
      } catch (err) {
        log.error("useEngineAnalysis", "stopAnalysis: awaitStopOrTimeoutRestart failed", {
          message: String(err),
        });
      }
    })();
  }, []);

  const startAnalysis = useCallback((position: EnginePosition): void => {
    const manager: EngineManager | null = managerRef.current;
    if (!manager) {
      log.warn("useEngineAnalysis", "startAnalysis: no manager — engine not configured or not Tauri");
      return;
    }

    log.info(
      "useEngineAnalysis",
      `startAnalysis: fen="${position.fen}" engineId="${activeEngineIdRef.current ?? "(default)"}"`,
    );
    setVariations([]);
    setIsAnalyzing(true);
    isAnalyzingRef.current = true;

    const engineId: string | undefined = activeEngineIdRef.current;
    const pvCount: number = multiPvRef.current === 0 ? 500 : multiPvRef.current;
    const threadCount: number = threadsRef.current;
    const smoves: string[] | null = searchMovesRef.current;

    void (async (): Promise<void> => {
      try {
        await awaitStopOrTimeoutRestart(manager, engineId);

        const sanitizedPosition: EnginePosition = sanitizeEnginePositionForUci(position);
        lastPositionRef.current = sanitizedPosition;
        if (
          sanitizedPosition.fen !== position.fen ||
          sanitizedPosition.moves.length !== position.moves.length
        ) {
          log.debug(
            "useEngineAnalysis",
            () =>
              `startAnalysis: sanitized engine position fen="${sanitizedPosition.fen}" (from "${position.fen}")`,
          );
        }

        log.info(
          "useEngineAnalysis",
          `startAnalysis: calling getSession engineId="${engineId ?? "(default)"}" pvCount=${pvCount} threads=${threadCount}`,
        );
        const session = await manager.getSession(engineId);
        log.info(
          "useEngineAnalysis",
          `startAnalysis: session obtained — setting options and starting, engineId="${engineId ?? "(default)"}"`,
        );
        const opts = Array.from(session.options.values());
        setDiscoveredOptions((prev) => {
          const next = new Map(prev);
          next.set(engineId ?? "", opts);
          return next;
        });
        session.setOption("MultiPV", String(pvCount));
        if (session.options.has("Threads")) {
          session.setOption("Threads", String(threadCount));
        }
        log.debug(
          "useEngineAnalysis",
          () => `startAnalysis: calling session.startAnalysis, searchMoves=${JSON.stringify(smoves)}`,
        );
        log.info("useEngineAnalysis", "startAnalysis: session.startAnalysis called");
        session.startAnalysis(
          sanitizedPosition,
          { infinite: true, multiPv: pvCount, searchMoves: smoves ?? undefined },
          handleVariation,
        );
      } catch (err) {
        log.error("useEngineAnalysis", "startAnalysis failed", {
          engineId: engineId ?? null,
          message: String(err),
        });
        setIsAnalyzing(false);
        isAnalyzingRef.current = false;
      }
    })();
  }, [handleVariation]);

  const findBestMove = useCallback(
    async (position: EnginePosition, opts: MoveSearchOptions): Promise<EngineBestMove | null> => {
      if (!managerRef.current) return null;
      try {
        const session = await managerRef.current.getSession(activeEngineIdRef.current);
        const sanitizedPosition: EnginePosition = sanitizeEnginePositionForUci(position);
        return await session.findBestMove(sanitizedPosition, opts);
      } catch {
        return null;
      }
    },
    [],
  );

  // Callbacks that do more than set state use distinct names to avoid shadowing.
  const changeMultiPv = useCallback((n: number): void => {
    setMultiPv(n);
    multiPvRef.current = n;
    if (isAnalyzingRef.current && lastPositionRef.current !== null) {
      const pos: EnginePosition = lastPositionRef.current;
      startAnalysis(pos);
    }
  }, [startAnalysis]);

  const changeThreads = useCallback((n: number): void => {
    setThreads(n);
    threadsRef.current = n;
    if (isAnalyzingRef.current && lastPositionRef.current !== null) {
      const pos: EnginePosition = lastPositionRef.current;
      startAnalysis(pos);
    }
  }, [startAnalysis]);

  const changeSearchMoves = useCallback((moves: string[] | null): void => {
    const prevMoves: string[] | null = searchMovesRef.current;
    setSearchMoves(moves);
    searchMovesRef.current = moves;
    if (prevMoves !== moves && isAnalyzingRef.current && lastPositionRef.current !== null) {
      const pos: EnginePosition = lastPositionRef.current;
      startAnalysis(pos);
    }
  }, [startAnalysis]);

  const changeActiveEngine = useCallback((id: string): void => {
    if (id === activeEngineIdRef.current) return;
    stopAnalysis();
    setActiveEngineId(id);
    activeEngineIdRef.current = id;
    setVariations([]);
    const cfg = registry?.engines.find((e) => e.id === id);
    if (cfg) setEngineName(cfg.label ?? cfg.id);
  }, [stopAnalysis, registry]);

  return {
    variations,
    isAnalyzing,
    engineName,
    activeEngineId,
    multiPv,
    threads,
    searchMoves,
    discoveredOptions,
    startAnalysis,
    stopAnalysis,
    findBestMove,
    setMultiPv: changeMultiPv,
    setThreads: changeThreads,
    setActiveEngine: changeActiveEngine,
    setSearchMoves: changeSearchMoves,
  };
};
