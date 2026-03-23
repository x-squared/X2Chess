/**
 * simulator_adapter — In-process chess board simulator.
 *
 * Integration API:
 * - `createBoardSimulator(portOrAddress?)` — create a simulator instance.
 * - `BoardSimulator` — extends `BoardConnection` with test/dev helpers.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure in-memory; no I/O or hardware.
 */

import type {
  BoardConnection,
  BoardState,
  LedCommand,
  LedSignal,
  PieceCode,
  SquareId,
} from "../domain/board_types";

// ── FEN parsing ───────────────────────────────────────────────────────────────

const FEN_PIECE: Record<string, PieceCode> = {
  P: 1, R: 2, N: 3, B: 4, K: 5, Q: 6,
  p: 7, r: 8, n: 9, b: 10, k: 11, q: 12,
};

/**
 * Parse the piece-placement section of a FEN string into a BoardState.
 * Returns `null` on any parse error.
 */
export const parseFenPlacement = (fen: string): BoardState | null => {
  const placement = fen.split(" ")[0];
  if (!placement) return null;

  const ranks = placement.split("/");
  if (ranks.length !== 8) return null;

  const board: PieceCode[] = new Array<PieceCode>(64).fill(0);

  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    const rankStr = ranks[rankIdx]!;
    // FEN rank index 0 = rank 8 = internal rank index 7 (a8=56..h8=63)
    const internalRank = 7 - rankIdx;
    let file = 0;
    for (const ch of rankStr) {
      if (file > 7) return null;
      const empty = parseInt(ch, 10);
      if (!isNaN(empty)) {
        file += empty;
      } else {
        const piece = FEN_PIECE[ch];
        if (piece === undefined) return null;
        board[internalRank * 8 + file] = piece;
        file += 1;
      }
    }
    if (file !== 8) return null;
  }

  return board;
};

// ── BoardSimulator interface ──────────────────────────────────────────────────

/** Extended `BoardConnection` that exposes test/developer helpers. */
export interface BoardSimulator extends BoardConnection {
  /** Set all 64 squares from the piece-placement section of a FEN string. */
  setPositionFromFen(fen: string): void;

  /**
   * Simulate a physical piece move: update internal state and fire all
   * `onStateChange` subscribers.
   */
  simulateMove(from: SquareId, to: SquareId): void;

  /**
   * Return the current set of lit LED squares (from the last `sendSignal`
   * call). Useful for assertions in tests.
   */
  getLeds(): LedCommand[];
}

// ── Implementation ────────────────────────────────────────────────────────────

class SimulatorAdapter implements BoardSimulator {
  readonly boardType = "simulator" as const;
  readonly portOrAddress: string;

  private _state: PieceCode[] = new Array<PieceCode>(64).fill(0);
  private _leds: LedCommand[] = [];
  private _subscribers = new Set<(state: BoardState) => void>();
  private _disconnected = false;

  constructor(portOrAddress: string) {
    this.portOrAddress = portOrAddress;
  }

  getBoardState(): Promise<BoardState> {
    return Promise.resolve([...this._state] as BoardState);
  }

  onStateChange(handler: (state: BoardState) => void): () => void {
    this._subscribers.add(handler);
    return () => {
      this._subscribers.delete(handler);
    };
  }

  sendSignal(signal: LedSignal): Promise<void> {
    if (signal.kind === "static") {
      this._leds = [...signal.leds];
    } else if (signal.kind === "sequence") {
      // For the simulator, apply the first frame's LEDs (good enough for tests).
      this._leds = signal.frames[0] ? [...signal.frames[0].leds] : [];
    } else {
      this._leds = [];
    }
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this._disconnected = true;
    this._subscribers.clear();
    this._leds = [];
    return Promise.resolve();
  }

  // ── BoardSimulator helpers ─────────────────────────────────────────────────

  setPositionFromFen(fen: string): void {
    const board = parseFenPlacement(fen);
    if (board === null) throw new Error(`Invalid FEN: ${fen}`);
    this._state = [...board] as PieceCode[];
    this._notify();
  }

  simulateMove(from: SquareId, to: SquareId): void {
    if (from < 0 || from > 63 || to < 0 || to > 63) {
      throw new RangeError(`Square out of range: from=${from}, to=${to}`);
    }
    this._state[to] = this._state[from]!;
    this._state[from] = 0;
    this._notify();
  }

  getLeds(): LedCommand[] {
    return [...this._leds];
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _notify(): void {
    if (this._disconnected) return;
    const snapshot: BoardState = [...this._state] as BoardState;
    for (const handler of this._subscribers) {
      handler(snapshot);
    }
  }
}

/**
 * Create a new in-process board simulator.
 *
 * @param portOrAddress - Optional label used to identify the instance
 *   (e.g. "simulator-1"). Defaults to "simulator".
 */
export const createBoardSimulator = (
  portOrAddress = "simulator",
): BoardSimulator => new SimulatorAdapter(portOrAddress);
