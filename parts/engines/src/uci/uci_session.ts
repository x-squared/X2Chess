/**
 * uci_session — UCI engine session state machine.
 *
 * Integration API:
 * - Exports: `UciSession`, `createUciSession`.
 * - Consumes an `EngineProcess` interface (I/O injected by caller).
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - `UciSession` methods return Promises resolved when the engine acknowledges.
 * - Analysis results are delivered via `onVariation` callbacks.
 * - `UciSession` is not thread-safe; callers must serialize calls.
 */

import { parseUciLine } from "./uci_parser";
import { formatUciCommand } from "./uci_writer";
import type { UciOutputMessage, UciOption } from "../domain/uci_types";
import type {
  EnginePosition,
  AnalysisOptions,
  MoveSearchOptions,
  EngineVariation,
  EngineBestMove,
} from "../domain/analysis_types";

// ── EngineProcess interface (I/O injection point) ─────────────────────────────

export interface EngineProcess {
  send(line: string): Promise<void>;
  onOutput(handler: (line: string) => void): () => void;
  kill(): Promise<void>;
}

// ── Session state ─────────────────────────────────────────────────────────────

type SessionState = "initial" | "ready" | "thinking" | "stopped";

// ── UciSession ────────────────────────────────────────────────────────────────

export type UciSession = {
  readonly engineName: string;
  readonly engineAuthor: string;
  readonly options: ReadonlyMap<string, UciOption>;

  /** Send "uci" and wait for "uciok". */
  initialize(): Promise<void>;

  /** Send "isready" and wait for "readyok". */
  isReady(): Promise<void>;

  /** Send "ucinewgame". Does not wait for acknowledgement. */
  newGame(): void;

  /** Set a UCI option by name. */
  setOption(name: string, value: string): void;

  /** Start infinite/depth/time-limited analysis. Calls `onVariation` as info arrives. */
  startAnalysis(
    position: EnginePosition,
    opts: AnalysisOptions,
    onVariation: (v: EngineVariation) => void,
  ): void;

  /** Send "stop" and wait for "bestmove". */
  stopAnalysis(): Promise<EngineBestMove | null>;

  /** Search for the best move and return when "bestmove" arrives. */
  findBestMove(
    position: EnginePosition,
    opts: MoveSearchOptions,
  ): Promise<EngineBestMove | null>;

  /** Send "quit" and kill the process. */
  quit(): Promise<void>;
};

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a `UciSession` wrapping the given `EngineProcess`.
 * Call `initialize()` before any other methods.
 */
export const createUciSession = (process: EngineProcess): UciSession => {
  let state: SessionState = "initial";
  let engineName = "";
  let engineAuthor = "";
  const options = new Map<string, UciOption>();

  // Pending promise resolvers keyed by the event they await.
  let pendingUciOk: (() => void) | null = null;
  let pendingReadyOk: (() => void) | null = null;
  let pendingBestMove: ((result: EngineBestMove | null) => void) | null = null;

  let variationCallback: ((v: EngineVariation) => void) | null = null;
  // True when the next "bestmove" should reset state and clear variationCallback.
  // Set to false by startAnalysis (infinite) to protect a freshly installed callback
  // from being wiped by a "bestmove" arriving from a concurrent stop command.
  let clearCallbackOnBestMove = false;

  // Subscribe to engine output for the lifetime of the session.
  const unsubscribe = process.onOutput((line: string): void => {
    const msg: UciOutputMessage | null = parseUciLine(line);
    if (!msg) return;

    switch (msg.type) {
      case "id":
        if (msg.field === "name") engineName = msg.value;
        else engineAuthor = msg.value;
        break;

      case "option":
        options.set(msg.option.name, msg.option);
        break;

      case "uciok":
        pendingUciOk?.();
        pendingUciOk = null;
        break;

      case "readyok":
        state = "ready";
        pendingReadyOk?.();
        pendingReadyOk = null;
        break;

      case "info": {
        if (!variationCallback) break;
        if (msg.pv === undefined || msg.depth === undefined) break;
        const score = msg.score;
        if (!score) break;
        const variation: EngineVariation = {
          multipvIndex: msg.multipv ?? 1,
          depth: msg.depth,
          selDepth: msg.selDepth,
          score,
          pv: msg.pv,
          nodes: msg.nodes,
          nps: msg.nps,
          hashFull: msg.hashFull,
          tbHits: msg.tbHits,
        };
        variationCallback(variation);
        break;
      }

      case "bestmove": {
        const result: EngineBestMove = {
          uci: msg.move,
          ponder: msg.ponder,
        };
        if (clearCallbackOnBestMove) {
          state = "ready";
          variationCallback = null;
          clearCallbackOnBestMove = false;
        }
        pendingBestMove?.(result);
        pendingBestMove = null;
        break;
      }

      default:
        break;
    }
  });

  const send = (line: string): void => {
    void process.send(line);
  };

  const setPosition = (position: EnginePosition): void => {
    const isStartPos =
      position.fen === "" ||
      position.fen === "startpos" ||
      position.fen === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    send(
      formatUciCommand({
        type: "position",
        startpos: isStartPos,
        fen: isStartPos ? undefined : position.fen,
        moves: position.moves,
      }),
    );
  };

  return {
    get engineName(): string { return engineName; },
    get engineAuthor(): string { return engineAuthor; },
    get options(): ReadonlyMap<string, UciOption> { return options; },

    initialize(): Promise<void> {
      return new Promise<void>((resolve): void => {
        pendingUciOk = resolve;
        send(formatUciCommand({ type: "uci" }));
      });
    },

    isReady(): Promise<void> {
      return new Promise<void>((resolve): void => {
        pendingReadyOk = resolve;
        send(formatUciCommand({ type: "isready" }));
      });
    },

    newGame(): void {
      send(formatUciCommand({ type: "ucinewgame" }));
    },

    setOption(name: string, value: string): void {
      send(formatUciCommand({ type: "setoption", name, value }));
    },

    startAnalysis(
      position: EnginePosition,
      opts: AnalysisOptions,
      onVariation: (v: EngineVariation) => void,
    ): void {
      const isInfinite = opts.infinite ?? (!opts.depth && !opts.movetime);
      // For infinite analysis the caller will stop explicitly, so the bestmove
      // from a concurrent stop command must NOT clear the freshly installed
      // callback.  For depth/time-limited analysis the engine stops on its own.
      clearCallbackOnBestMove = !isInfinite;
      state = "thinking";
      variationCallback = onVariation;
      setPosition(position);
      send(
        formatUciCommand({
          type: "go",
          depth: opts.depth,
          movetime: opts.movetime,
          searchmoves: opts.searchMoves,
          infinite: isInfinite,
        }),
      );
    },

    stopAnalysis(): Promise<EngineBestMove | null> {
      if (state !== "thinking") return Promise.resolve(null);
      clearCallbackOnBestMove = true;
      return new Promise<EngineBestMove | null>((resolve): void => {
        pendingBestMove = resolve;
        send(formatUciCommand({ type: "stop" }));
      });
    },

    findBestMove(
      position: EnginePosition,
      opts: MoveSearchOptions,
    ): Promise<EngineBestMove | null> {
      clearCallbackOnBestMove = true;
      state = "thinking";
      setPosition(position);
      return new Promise<EngineBestMove | null>((resolve): void => {
        pendingBestMove = resolve;
        send(
          formatUciCommand({
            type: "go",
            movetime: opts.movetime,
            depth: opts.depth,
            wtime: opts.wtime,
            btime: opts.btime,
            winc: opts.winc,
            binc: opts.binc,
          }),
        );
      });
    },

    async quit(): Promise<void> {
      unsubscribe();
      send(formatUciCommand({ type: "quit" }));
      await process.kill();
    },
  };
};
