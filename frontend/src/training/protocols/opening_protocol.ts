/**
 * opening_protocol — Opening repertoire trainer protocol (T12).
 *
 * Picks random positions from a PGN repertoire tree (including variations)
 * and asks the user to find the correct continuation. Accepts any move that
 * appears in the repertoire at that position.
 *
 * Integration API:
 * - `OPENING_PROTOCOL` — TrainingProtocol singleton; pass to `useTrainingSession`.
 *
 * Configuration API:
 * - `OpeningProtocolOptions` via `TrainingConfig.protocolOptions`.
 *
 * Communication API:
 * - Pure functions; no side effects.
 */

import { Chess } from "chess.js";
import type {
  TrainingProtocol,
  TrainingConfig,
  TrainingSessionState,
  UserMoveInput,
  MoveEvalResult,
  ResultSummary,
  ResultHighlight,
} from "../domain/training_protocol";
import type { TrainingTranscript } from "../domain/training_transcript";
import { parsePgnToModel } from "../../model/pgn_model";

// ── Options ───────────────────────────────────────────────────────────────────

export type OpeningProtocolOptions = {
  /** If true, randomly shuffle the positions on each run. */
  shuffle: boolean;
  /** Maximum number of positions to train (0 = all). */
  maxPositions: number;
};

const DEFAULT_OPTIONS: OpeningProtocolOptions = {
  shuffle: true,
  maxPositions: 0,
};

// ── Position extraction ───────────────────────────────────────────────────────

type RepertoireLine = {
  /** FEN before the move. */
  fen: string;
  /** All correct move UCIs at this position (from variations). */
  correctUcis: string[];
  /** All correct move SANs. */
  correctSans: string[];
};

/** Recursively extract all positions from the PGN tree that have a next move. */
const extractLines = (pgnText: string): RepertoireLine[] => {
  const model = parsePgnToModel(pgnText);
  const lines: RepertoireLine[] = [];
  // Map from FEN to set of correct moves (merges same position across variations).
  const fenMap = new Map<string, { ucis: Set<string>; sans: string[] }>();

  const walkEntries = (entries: typeof model.root.entries, chess: Chess): void => {
    for (const entry of entries) {
      if (entry.type !== "move") continue;

      const fenBefore = chess.fen();
      const result = chess.move(entry.san, { strict: false });
      if (!result) continue;

      const uci = result.from + result.to + (result.promotion ?? "");
      const existing = fenMap.get(fenBefore);
      if (existing) {
        if (!existing.ucis.has(uci)) {
          existing.ucis.add(uci);
          existing.sans.push(result.san);
        }
      } else {
        fenMap.set(fenBefore, { ucis: new Set([uci]), sans: [result.san] });
      }

      // Walk variations at this move (ravs / postItems).
      if ("ravs" in entry && Array.isArray(entry.ravs)) {
        for (const rav of entry.ravs as { entries: typeof model.root.entries }[]) {
          const ravChess = new Chess();
          try { ravChess.load(fenBefore); } catch { continue; }
          walkEntries(rav.entries, ravChess);
        }
      }
    }
  };

  const startChess = new Chess();
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  if (fenHeader) {
    try { startChess.load(fenHeader.value); } catch { /* ignore */ }
  }
  walkEntries(model.root.entries, startChess);

  for (const [fen, { ucis, sans }] of fenMap) {
    lines.push({ fen, correctUcis: [...ucis], correctSans: sans });
  }

  return lines;
};

const shuffle = <T>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]] as [T, T];
  }
  return out;
};

const gradeLabel = (pct: number): string => {
  if (pct >= 90) return "Excellent";
  if (pct >= 70) return "Good";
  if (pct >= 50) return "Fair";
  return "Needs work";
};

// ── Protocol state ────────────────────────────────────────────────────────────

type OpeningState = {
  lines: RepertoireLine[];
  lineIndex: number;
};

// ── Protocol implementation ───────────────────────────────────────────────────

const initialize = (config: TrainingConfig): TrainingSessionState => {
  const opts: OpeningProtocolOptions = {
    ...DEFAULT_OPTIONS,
    ...(config.protocolOptions as Partial<OpeningProtocolOptions>),
  };

  let lines = extractLines(config.pgnText);
  if (opts.shuffle) lines = shuffle(lines);
  if (opts.maxPositions > 0) lines = lines.slice(0, opts.maxPositions);

  const firstLine = lines[0];
  const openingState: OpeningState = { lines, lineIndex: 0 };

  return {
    phase: "in_progress",
    config,
    position: {
      fen: firstLine?.fen ?? new Chess().fen(),
      moveHistory: [],
      ply: 0,
      totalUserPlies: lines.length,
    },
    correctCount: 0,
    wrongCount: 0,
    skippedCount: 0,
    currentSourcePly: 0,
    hintUsedThisMove: false,
    hintsUsed: 0,
    startedAt: Date.now(),
    protocolState: openingState as unknown as Record<string, unknown>,
  };
};

const evaluateMove = (
  move: UserMoveInput,
  state: TrainingSessionState,
): MoveEvalResult => {
  const ps = state.protocolState as unknown as OpeningState;
  const line = ps.lines[ps.lineIndex];
  if (!line) return { accepted: false, feedback: "wrong" };

  if (line.correctUcis.includes(move.uci)) {
    return { accepted: true, feedback: "correct" };
  }

  const correctUci = line.correctUcis[0];
  const correctSan = line.correctSans[0] ?? correctUci;
  return {
    accepted: false,
    feedback: "wrong",
    correctMove: { uci: correctUci ?? "", san: correctSan },
    annotation: `${move.san} (expected: ${correctSan})`,
  };
};

const advance = (state: TrainingSessionState): TrainingSessionState => {
  const ps = state.protocolState as unknown as OpeningState;
  const nextIndex = ps.lineIndex + 1;
  const nextLine = ps.lines[nextIndex];

  return {
    ...state,
    position: {
      fen: nextLine?.fen ?? state.position.fen,
      moveHistory: [],
      ply: nextIndex,
      totalUserPlies: ps.lines.length,
    },
    currentSourcePly: nextIndex,
    hintUsedThisMove: false,
    protocolState: { ...ps, lineIndex: nextIndex } as unknown as Record<string, unknown>,
  };
};

const isComplete = (state: TrainingSessionState): boolean => {
  const ps = state.protocolState as unknown as OpeningState;
  return ps.lineIndex >= ps.lines.length;
};

const summarize = (
  state: TrainingSessionState,
  _transcript: TrainingTranscript,
): ResultSummary => {
  const total = state.correctCount + state.wrongCount + state.skippedCount;
  const scored = state.correctCount + state.wrongCount;
  const scorePercent = scored > 0 ? Math.round((state.correctCount / scored) * 100) : 0;
  const elapsedMs = Date.now() - state.startedAt;
  const avgTimeMsPerMove = total > 0 ? Math.round(elapsedMs / total) : undefined;
  const highlights: ResultHighlight[] = [];

  return {
    correct: state.correctCount,
    wrong: state.wrongCount,
    skipped: state.skippedCount,
    total,
    scorePercent,
    avgTimeMsPerMove,
    gradeLabel: gradeLabel(scorePercent),
    highlights,
  };
};

export const OPENING_PROTOCOL: TrainingProtocol = {
  id: "opening",
  label: "Opening Trainer",
  description: "Practice your opening repertoire by finding the correct continuation at each position.",
  initialize,
  evaluateMove,
  advance,
  isComplete,
  summarize,
};
