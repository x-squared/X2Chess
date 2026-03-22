/**
 * uci_types — raw UCI protocol message types.
 *
 * Integration API:
 * - Exports: all UCI input/output message types used by the parser and writer.
 *
 * Configuration API:
 * - None; purely type declarations.
 *
 * Communication API:
 * - Pure types; no I/O or side effects.
 */

// ── Engine output messages (UCI → host) ───────────────────────────────────────

export type UciIdMessage = {
  type: "id";
  field: "name" | "author";
  value: string;
};

export type UciOkMessage = {
  type: "uciok";
};

export type UciReadyOkMessage = {
  type: "readyok";
};

export type UciOption =
  | { type: "check"; name: string; default: boolean }
  | { type: "spin"; name: string; default: number; min: number; max: number }
  | { type: "combo"; name: string; default: string; vars: string[] }
  | { type: "button"; name: string }
  | { type: "string"; name: string; default: string };

export type UciOptionMessage = {
  type: "option";
  option: UciOption;
};

export type EngineScore =
  | { type: "cp"; value: number }
  | { type: "mate"; value: number };

export type UciInfoMessage = {
  type: "info";
  depth?: number;
  selDepth?: number;
  multipv?: number;
  score?: EngineScore;
  nodes?: number;
  nps?: number;
  hashFull?: number;
  tbHits?: number;
  time?: number;
  pv?: string[];
  currmove?: string;
  currmovenumber?: number;
  string?: string;
};

export type UciBestMoveMessage = {
  type: "bestmove";
  move: string;
  ponder?: string;
};

export type UciOutputMessage =
  | UciIdMessage
  | UciOkMessage
  | UciReadyOkMessage
  | UciOptionMessage
  | UciInfoMessage
  | UciBestMoveMessage;

// ── Host commands (host → engine) ─────────────────────────────────────────────

export type UciCommand =
  | { type: "uci" }
  | { type: "debug"; on: boolean }
  | { type: "isready" }
  | { type: "setoption"; name: string; value?: string }
  | { type: "ucinewgame" }
  | {
      type: "position";
      startpos: boolean;
      fen?: string;
      moves: string[];
    }
  | {
      type: "go";
      searchmoves?: string[];
      ponder?: boolean;
      wtime?: number;
      btime?: number;
      winc?: number;
      binc?: number;
      movestogo?: number;
      depth?: number;
      nodes?: number;
      mate?: number;
      movetime?: number;
      infinite?: boolean;
    }
  | { type: "stop" }
  | { type: "ponderhit" }
  | { type: "quit" };
