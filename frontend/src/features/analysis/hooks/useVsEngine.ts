/**
 * useVsEngine — React hook managing a "play vs engine" game session.
 *
 * After each user move the hook calls `findBestMove` and applies the
 * engine response. Game end (checkmate / stalemate / draw) is detected
 * by chess.js and exposed via `gameOver`.
 *
 * Integration API:
 * - `useVsEngine({ findBestMove, playerSide, movetime })` — call with a
 *   stable `findBestMove` from `useEngineAnalysis`.
 *
 * Communication API:
 * - Returns `{ active, fen, lastMove, gameOver, onUserMove, start, stop }`
 */

import { useState, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import type { EngineBestMove, MoveSearchOptions, EnginePosition } from "../../../../../parts/engines/src/domain/analysis_types";

export type VsEngineConfig = {
  /** Side the human plays. */
  playerSide: "white" | "black";
  /** Time per move in milliseconds. */
  movetime: number;
  /** Starting FEN (defaults to standard position). */
  startFen?: string;
};

export type VsEngineState = {
  /** True while a game is in progress. */
  active: boolean;
  /** Current board FEN. */
  fen: string;
  /** Last played UCI move for board highlighting. */
  lastMove: { from: string; to: string } | null;
  /** Non-null when the game is over. */
  gameOver: { reason: string; winner: "white" | "black" | "draw" } | null;
  /** True while waiting for the engine to respond. */
  engineThinking: boolean;
  /** The configured player side. */
  playerSide: "white" | "black";
  /** Call when the user plays a move (from/to squares). Returns false if illegal. */
  onUserMove: (from: string, to: string, promotion?: string) => boolean;
  /** Start a new vs-engine game. */
  start: (config: VsEngineConfig) => void;
  /** Abort the current game. */
  stop: () => void;
};

type FindBestMoveFn = (position: EnginePosition, opts: MoveSearchOptions) => Promise<EngineBestMove | null>;

const STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const detectGameOver = (chess: Chess): { reason: string; winner: "white" | "black" | "draw" } | null => {
  if (chess.isCheckmate()) {
    const winner = chess.turn() === "w" ? "black" : "white";
    return { reason: "checkmate", winner };
  }
  if (chess.isStalemate()) return { reason: "stalemate", winner: "draw" };
  if (chess.isInsufficientMaterial()) return { reason: "insufficient material", winner: "draw" };
  if (chess.isThreefoldRepetition()) return { reason: "threefold repetition", winner: "draw" };
  if (chess.isDraw()) return { reason: "draw", winner: "draw" };
  return null;
};

/**
 * Manage a "play vs engine" game session.
 *
 * @param findBestMove Async engine query function, typically from `useEngineAnalysis`.
 * @returns Active game state and `start`/`stop`/`onUserMove` callbacks.
 */
export const useVsEngine = (findBestMove: FindBestMoveFn): VsEngineState => {
  const [active, setActive] = useState(false);
  const [fen, setFen] = useState(STANDARD_FEN);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [gameOver, setGameOver] = useState<{ reason: string; winner: "white" | "black" | "draw" } | null>(null);
  const [engineThinking, setEngineThinking] = useState(false);
  const [playerSide, setPlayerSide] = useState<"white" | "black">("white");
  const configRef = useRef<VsEngineConfig | null>(null);
  const chessRef = useRef(new Chess());

  const doEngineMove = useCallback(async (chess: Chess, movetime: number): Promise<void> => {
    setEngineThinking(true);
    const position: EnginePosition = { fen: chess.fen(), moves: [] };
    const best = await findBestMove(position, { movetime });
    setEngineThinking(false);

    if (!best) return;
    const uci = best.uci;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? uci[4] : undefined;
    const result = chess.move({ from, to, promotion });
    if (!result) return;

    setFen(chess.fen());
    setLastMove({ from, to });

    const over = detectGameOver(chess);
    if (over) setGameOver(over);
  }, [findBestMove]);

  const start = useCallback((config: VsEngineConfig): void => {
    const chess = new Chess();
    if (config.startFen) {
      try { chess.load(config.startFen); } catch { /* use default */ }
    }
    chessRef.current = chess;
    configRef.current = config;
    setActive(true);
    setFen(chess.fen());
    setLastMove(null);
    setGameOver(null);
    setPlayerSide(config.playerSide);

    // If engine plays first (player is black), trigger engine move.
    const engineTurn = config.playerSide === "white" ? "black" : "white";
    const toMove = chess.turn() === "w" ? "white" : "black";
    if (toMove === engineTurn) {
      void doEngineMove(chess, config.movetime);
    }
  }, [doEngineMove]);

  const stop = useCallback((): void => {
    setActive(false);
    setGameOver(null);
    configRef.current = null;
  }, []);

  const onUserMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    const config = configRef.current;
    if (!active || !config || gameOver) return false;

    const chess = chessRef.current;
    const result = chess.move({ from, to, promotion });
    if (!result) return false;

    setFen(chess.fen());
    setLastMove({ from, to });

    const over = detectGameOver(chess);
    if (over) { setGameOver(over); return true; }

    // Engine's turn.
    void doEngineMove(chess, config.movetime);
    return true;
  }, [active, gameOver, doEngineMove]);

  return {
    active,
    fen,
    lastMove,
    gameOver,
    engineThinking,
    playerSide,
    onUserMove,
    start,
    stop,
  };
};
