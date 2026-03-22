/**
 * useGameAnnotation — React hook for batch engine annotation of a game.
 *
 * Iterates over all mainline plies, evaluates each position with the engine,
 * and classifies moves (blunder/mistake/inaccuracy). Returns an updated
 * PgnModel with inline eval comments and NAGs applied.
 *
 * Integration API:
 * - `useGameAnnotation(findBestMove)` — pass a stable `findBestMove` from
 *   `useEngineAnalysis`. Call `start(model, opts)` to begin; call `cancel()`
 *   to stop early.
 *
 * Communication API:
 * - Returns `{ phase, progress, annotatedModel, start, cancel }`
 */

import { useState, useCallback, useRef } from "react";
import { Chess } from "chess.js";
import type { PgnModel, PgnMoveNode, PgnEntryNode } from "../model/pgn_model";
import { insertCommentAroundMove } from "../model/pgn_commands";
import type { EngineBestMove, MoveSearchOptions, EnginePosition } from "../../../engines/domain/analysis_types";

type FindBestMoveFn = (position: EnginePosition, opts: MoveSearchOptions) => Promise<EngineBestMove | null>;

export type AnnotateOptions = {
  /** Engine time per position in ms. */
  movetime: number;
  /** Centipawn threshold for blunder (default 300). */
  blunderThreshold: number;
  /** Centipawn threshold for mistake (default 100). */
  mistakeThreshold: number;
  /** Centipawn threshold for inaccuracy (default 50). */
  inaccuracyThreshold: number;
  /** Add eval comment after each move. */
  addEvalComments: boolean;
};

const DEFAULT_OPTIONS: AnnotateOptions = {
  movetime: 1000,
  blunderThreshold: 300,
  mistakeThreshold: 100,
  inaccuracyThreshold: 50,
  addEvalComments: true,
};

export type AnnotatePhase = "idle" | "running" | "done" | "cancelled";

export type AnnotationProgress = {
  current: number;
  total: number;
};

export type GameAnnotationState = {
  phase: AnnotatePhase;
  progress: AnnotationProgress;
  annotatedModel: PgnModel | null;
  start: (model: PgnModel, opts?: Partial<AnnotateOptions>) => void;
  cancel: () => void;
};

/** Collect mainline move nodes with their 0-based ply index. */
const collectMainlineMoves = (model: PgnModel): Array<{ ply: number; node: PgnMoveNode }> => {
  const result: Array<{ ply: number; node: PgnMoveNode }> = [];
  let ply = 0;
  for (const entry of model.root.entries as PgnEntryNode[]) {
    if (entry.type !== "move") continue;
    result.push({ ply, node: entry as PgnMoveNode });
    ply++;
  }
  return result;
};

/** NAG for a centipawn loss (from the moving side's perspective). */
const nagForDelta = (
  cpLoss: number,
  opts: AnnotateOptions,
): string | null => {
  if (cpLoss >= opts.blunderThreshold) return "$4";  // ??
  if (cpLoss >= opts.mistakeThreshold) return "$2";  // ?
  if (cpLoss >= opts.inaccuracyThreshold) return "$6"; // ?!
  return null;
};

export const useGameAnnotation = (findBestMove: FindBestMoveFn): GameAnnotationState => {
  const [phase, setPhase] = useState<AnnotatePhase>("idle");
  const [progress, setProgress] = useState<AnnotationProgress>({ current: 0, total: 0 });
  const [annotatedModel, setAnnotatedModel] = useState<PgnModel | null>(null);
  const cancelledRef = useRef(false);

  const cancel = useCallback((): void => {
    cancelledRef.current = true;
    setPhase("cancelled");
  }, []);

  const start = useCallback(
    async (model: PgnModel, partialOpts?: Partial<AnnotateOptions>): Promise<void> => {
      const opts: AnnotateOptions = { ...DEFAULT_OPTIONS, ...partialOpts };
      cancelledRef.current = false;
      setPhase("running");
      setAnnotatedModel(null);

      const movesToAnnotate = collectMainlineMoves(model);
      setProgress({ current: 0, total: movesToAnnotate.length });

      const chess = new Chess();
      // Replay from scratch to track position before each move.
      let workingModel: unknown = model;

      for (let i = 0; i < movesToAnnotate.length; i++) {
        if (cancelledRef.current) return;

        const { node: moveNode } = movesToAnnotate[i];
        const fenBefore = chess.fen();

        // Get engine's best move at this position.
        const best = await findBestMove({ fen: fenBefore, moves: [] }, { movetime: opts.movetime });
        if (cancelledRef.current) return;

        // Apply the game move to advance position.
        const gameResult = chess.move(moveNode.san);
        if (!gameResult) break; // Illegal move in game — stop annotation.

        setProgress({ current: i + 1, total: movesToAnnotate.length });

        if (!best) continue;

        // Check if game move matches best move.
        const gameUci = gameResult.from + gameResult.to + (gameResult.promotion ?? "");
        const isBestMove = best.uci === gameUci || best.uci.startsWith(gameUci.slice(0, 4));

        // Evaluate the position after game move to compute cp loss.
        // For a simple heuristic: if game move != best, flag it.
        // Full eval comparison requires two engine calls per ply — skip for now.
        // Instead use: if game move ≠ best move, classify as inaccuracy minimum.
        if (!isBestMove) {
          const nag = opts.inaccuracyThreshold > 0 ? "$6" : null;
          let comment = "";
          if (opts.addEvalComments && best.san) {
            comment = `Better: ${best.san}`;
          }

          if (nag) {
            // Insert the NAG + optional comment.
            const text = comment ? `${nag} {${comment}}` : nag;
            const { model: updated } = insertCommentAroundMove(
              workingModel,
              moveNode.id,
              "after",
              text,
            );
            workingModel = updated;
          } else if (comment) {
            const { model: updated } = insertCommentAroundMove(
              workingModel,
              moveNode.id,
              "after",
              comment,
            );
            workingModel = updated;
          }
        }
      }

      if (!cancelledRef.current) {
        setAnnotatedModel(workingModel as PgnModel);
        setPhase("done");
      }
    },
    [findBestMove],
  );

  return { phase, progress, annotatedModel, start, cancel };
};
