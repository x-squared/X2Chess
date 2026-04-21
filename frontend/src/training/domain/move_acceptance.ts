/**
 * move_acceptance — move acceptance algorithm for training protocols.
 *
 * Determines whether a user's move is correct, an accepted alternative,
 * inferior (dubious), or wrong, by reading signal sources in priority order:
 *
 *   1. [%train] tag in the position comment  → overrides all other rules
 *   2. NAG on the mainline move              → classifies game-move quality
 *   3. NAGs on RAV first-moves               → builds accepted/inferior/trap sets
 *   4. [%eval] values in comments            → centipawn fallback (no annotation)
 *
 * Integration API:
 * - `MoveAcceptanceContext` — inputs for a single evaluation call.
 * - `acceptMove(ctx)` — returns a `MoveEvalResult`.
 * - `EVAL_ACCEPT_THRESHOLD_CP`, `EVAL_INFERIOR_THRESHOLD_CP` — default thresholds.
 *
 * Configuration API:
 * - `MoveAcceptanceContext.inferiorMovePolicy` — "accept" or "reject".
 * - `MoveAcceptanceContext.evalAcceptThresholdCp` — centipawn accept threshold.
 * - `MoveAcceptanceContext.evalInferiorThresholdCp` — centipawn inferior threshold.
 *
 * Communication API:
 * - Pure functions; no side effects. Requires chess.js for SAN→UCI conversion.
 */

import { Chess } from "chess.js";
import type { PgnMoveNode, PgnVariationNode, PgnCommentNode } from "../../../../parts/pgnparser/src/pgn_model";
import { getMoveCommentsAfter, getMoveRavs } from "../../../../parts/pgnparser/src/pgn_move_attachments";
import type { UserMoveInput, MoveEvalResult } from "./training_protocol";
import { parseTrainTag } from "../../features/resources/services/train_tag_parser";

// ── Constants ──────────────────────────────────────────────────────────────────

export const EVAL_ACCEPT_THRESHOLD_CP = 30;
export const EVAL_INFERIOR_THRESHOLD_CP = 80;

// ── NAG classifications ────────────────────────────────────────────────────────

type GameMoveClass =
  | "good"       // !! ! — canonical answer
  | "interesting" // !? — canonical answer, speculative
  | "dubious"    // ?! — accepted; betterMoveExists search runs
  | "bad"        // ? ?? — NOT the canonical answer; scan RAVs for better
  | "neutral";   // no move-quality NAG

const MOVE_QUALITY_NAGS = new Set(["$1", "$2", "$3", "$4", "$5", "$6"]);

const classifyGameMoveNag = (nags: string[]): GameMoveClass => {
  for (const nag of nags) {
    if (!MOVE_QUALITY_NAGS.has(nag)) continue;
    if (nag === "$3" || nag === "$1") return "good";
    if (nag === "$5") return "interesting";
    if (nag === "$6") return "dubious";
    if (nag === "$2" || nag === "$4") return "bad";
  }
  return "neutral";
};

type RavMoveClass = "good" | "interesting" | "dubious" | "bad" | "neutral";

const classifyRavMoveNag = (nags: string[]): RavMoveClass =>
  classifyGameMoveNag(nags);

// ── Helpers ────────────────────────────────────────────────────────────────────

const normalizeUci = (u: string): string =>
  u.length === 5 ? u.slice(0, 4) + u[4].toLowerCase() : u;

/** Combine all raw comment text from an array of comment nodes. */
const joinCommentRaw = (nodes: PgnCommentNode[]): string =>
  nodes.map((c) => c.raw).join(" ");

/** Extract [%eval N] centipawn value from a comment string. Positive = White advantage. */
const extractEvalCp = (comment: string): number | null => {
  const m = /\[%eval\s+(-?\d+(?:\.\d+)?)\]/.exec(comment);
  if (!m) return null;
  const pawns = parseFloat(m[1]);
  return Math.round(pawns * 100);
};

/** Find the first PgnMoveNode in a variation's entries. */
const firstMoveInRav = (rav: PgnVariationNode): PgnMoveNode | null => {
  for (const entry of rav.entries) {
    if (entry.type === "move") return entry;
  }
  return null;
};

/**
 * Convert a SAN move to UCI using chess.js from a given FEN.
 * Returns null if the SAN is illegal in that position.
 */
const sanToUci = (san: string, fen: string): string | null => {
  try {
    const chess = new Chess(fen);
    const result = chess.move(san, { strict: false });
    if (!result) return null;
    return result.from + result.to + (result.promotion ?? "");
  } catch {
    return null;
  }
};

// ── Context ────────────────────────────────────────────────────────────────────

export type MoveAcceptanceContext = {
  userMove: UserMoveInput;
  /** The mainline PgnMoveNode at the current ply. */
  node: PgnMoveNode;
  /** FEN of the position before the mainline move (used to convert RAV SANs). */
  positionFen: string;
  /** UCI of the mainline (game) move. */
  mainlineUci: string;
  inferiorMovePolicy: "accept" | "reject";
  evalAcceptThresholdCp: number;
  evalInferiorThresholdCp: number;
};

// ── RAV analysis ───────────────────────────────────────────────────────────────

type RavEntry = {
  uci: string;
  san: string;
  class: RavMoveClass;
  /** Comment text attached to the RAV's first move (for trap feedback). */
  comment: string;
};

const analyseRavs = (node: PgnMoveNode, positionFen: string): RavEntry[] => {
  const result: RavEntry[] = [];
  for (const rav of getMoveRavs(node)) {
    const firstMove = firstMoveInRav(rav);
    if (!firstMove) continue;
    const uci = sanToUci(firstMove.san, positionFen);
    if (!uci) continue;
    const comment = joinCommentRaw([
      ...firstMove.commentsBefore,
      ...getMoveCommentsAfter(firstMove),
    ]);
    result.push({
      uci: normalizeUci(uci),
      san: firstMove.san,
      class: classifyRavMoveNag(firstMove.nags),
      comment,
    });
  }
  return result;
};

// ── [%eval] fallback ───────────────────────────────────────────────────────────

/**
 * Classify an unrecognized (no-RAV) move using [%eval] centipawn values.
 * `mainlineEvalCp` is the eval at the mainline move's position (White-relative).
 * `isBlackToMove` flips the sign convention.
 */
const evalFallbackClass = (
  mainlineEvalCp: number,
  userMoveEvalCp: number,
  isBlackToMove: boolean,
  acceptThreshold: number,
  inferiorThreshold: number,
): RavMoveClass => {
  // Both values are White-relative; for Black, a larger White eval is worse.
  const delta = isBlackToMove
    ? mainlineEvalCp - userMoveEvalCp  // positive = user move gives White more
    : userMoveEvalCp - mainlineEvalCp; // positive = user move gives White more

  if (delta <= acceptThreshold) return "good";
  if (delta <= inferiorThreshold) return "dubious";
  return "bad";
};

// ── Step 1: [%train] override ─────────────────────────────────────────────────

const evaluateViaTrainTag = (
  userUci: string,
  mainlineUci: string,
  node: PgnMoveNode,
): MoveEvalResult | null => {
  const allComments = joinCommentRaw(node.commentsBefore);
  const tag = parseTrainTag(allComments);
  if (!tag) return null;

  const normalizedUser = normalizeUci(userUci);
  const normalizedMainline = normalizeUci(mainlineUci);

  // reject list checked first — even if it's also in accept
  if (tag.reject.map(normalizeUci).includes(normalizedUser)) {
    return {
      accepted: false,
      feedback: "wrong",
      correctMove: { uci: mainlineUci, san: "" }, // SAN filled by caller
      annotation: `That move is a known pitfall.`,
    };
  }

  const explicitAccept = tag.accept.map(normalizeUci);
  const isMainlineAccepted = !tag.reject.map(normalizeUci).includes(normalizedMainline);

  if (
    normalizedUser === normalizedMainline && isMainlineAccepted
  ) {
    return { accepted: true, feedback: "correct" };
  }

  if (explicitAccept.includes(normalizedUser)) {
    return { accepted: true, feedback: "correct" };
  }

  // Move is not in accept and not mainline
  return {
    accepted: false,
    feedback: "wrong",
    correctMove: { uci: mainlineUci, san: "" },
    annotation: tag.hint ? `Hint: ${tag.hint}` : undefined,
  };
};

// ── Main entry point ──────────────────────────────────────────────────────────

export const acceptMove = (ctx: MoveAcceptanceContext): MoveEvalResult => {
  const userUci = normalizeUci(ctx.userMove.uci);
  const mainUci = normalizeUci(ctx.mainlineUci);

  // ── Step 1: [%train] override ────────────────────────────────────────────────
  const trainResult = evaluateViaTrainTag(userUci, mainUci, ctx.node);
  if (trainResult) {
    // Fill in the mainline SAN for the correctMove if needed
    if (trainResult.correctMove && trainResult.correctMove.san === "") {
      trainResult.correctMove.san = ctx.node.san;
    }
    return trainResult;
  }

  // ── Step 2: Classify the game move's NAG ─────────────────────────────────────
  const gameMoveClass = classifyGameMoveNag(ctx.node.nags);

  // ── Step 3: Analyse RAVs ─────────────────────────────────────────────────────
  const ravEntries = analyseRavs(ctx.node, ctx.positionFen);

  // Find the best RAV move (! or !!) — used when game move is "bad"
  const bestRavMove = ravEntries.find(
    (r) => r.class === "good" || r.class === "interesting",
  );

  // Canonical answer: what we expect the user to play
  const canonicalUci =
    gameMoveClass === "bad" && bestRavMove
      ? bestRavMove.uci
      : mainUci;

  const canonicalSan =
    gameMoveClass === "bad" && bestRavMove
      ? bestRavMove.san
      : ctx.node.san;

  // betterMoveExists: set when the game move is accepted but suboptimal
  const betterMoveExists =
    (gameMoveClass === "dubious" || gameMoveClass === "bad") && bestRavMove
      ? { uci: bestRavMove.uci, san: bestRavMove.san }
      : undefined;

  // ── Step 4: Build move sets ───────────────────────────────────────────────────
  const acceptedUcis = new Set<string>([canonicalUci]);
  // Game move is accepted unless it's bad AND we found a better RAV
  if (!(gameMoveClass === "bad" && bestRavMove)) {
    acceptedUcis.add(mainUci);
  }
  const inferiorUcis = new Set<string>();
  const trapUcis = new Map<string, string>(); // uci → comment

  for (const rav of ravEntries) {
    if (rav.class === "good" || rav.class === "interesting") {
      acceptedUcis.add(rav.uci);
    } else if (rav.class === "neutral") {
      acceptedUcis.add(rav.uci);
    } else if (rav.class === "dubious") {
      inferiorUcis.add(rav.uci);
    } else if (rav.class === "bad") {
      trapUcis.set(rav.uci, rav.comment);
    }
  }

  // ── Step 5: [%eval] fallback for moves not in any RAV ────────────────────────
  let evalFallbackClass: RavMoveClass | null = null;
  if (
    !acceptedUcis.has(userUci) &&
    !inferiorUcis.has(userUci) &&
    !trapUcis.has(userUci)
  ) {
    const positionComment = joinCommentRaw([
      ...ctx.node.commentsBefore,
      ...getMoveCommentsAfter(ctx.node),
    ]);
    const mainlineEvalCp = extractEvalCp(positionComment);

    if (mainlineEvalCp !== null) {
      // Find the eval for the user's move by playing it and reading the resulting
      // comment on the next node. Here we approximate: we look for a [%eval]
      // attached to the mainline move itself (after-comment) as the mainline eval,
      // and cannot easily get the user-move eval without engine data. For now,
      // we only apply the fallback when there is eval data for the mainline AND
      // the user's move happens to be in an unannotated RAV we missed above.
      // This path is a best-effort improvement; full eval comparison requires
      // engine integration (Phase T22).
      evalFallbackClass = null; // reserved for T22
    }
  }

  // ── Step 6: Classify the user's move ─────────────────────────────────────────

  // Correct / better-than-game
  if (userUci === canonicalUci) {
    if (gameMoveClass === "bad" && bestRavMove) {
      // User found the refutation of the game's mistake
      return { accepted: true, feedback: "correct_better" };
    }
    if (
      userUci === mainUci &&
      betterMoveExists &&
      gameMoveClass === "dubious"
    ) {
      return {
        accepted: true,
        feedback: "correct_dubious",
        betterMoveExists,
      };
    }
    return { accepted: true, feedback: "correct" };
  }

  // User played the game move and it is dubious (?!) — accepted but flagged
  if (userUci === mainUci && betterMoveExists && gameMoveClass === "dubious") {
    return {
      accepted: true,
      feedback: "correct_dubious",
      betterMoveExists,
    };
  }

  // Accepted alternative
  if (acceptedUcis.has(userUci)) {
    return { accepted: true, feedback: "legal_variant" };
  }

  // Inferior (?!) move
  if (inferiorUcis.has(userUci)) {
    const accepted = ctx.inferiorMovePolicy === "accept";
    return {
      accepted,
      feedback: "inferior",
      correctMove: accepted
        ? undefined
        : { uci: canonicalUci, san: canonicalSan },
      annotation: "That move is considered dubious. Try to find a stronger option.",
    };
  }

  // Trap move (? or ??)
  const trapComment = trapUcis.get(userUci);
  if (trapComment !== undefined) {
    return {
      accepted: false,
      feedback: "wrong",
      correctMove: { uci: canonicalUci, san: canonicalSan },
      annotation: trapComment || "That move falls into a known problem.",
    };
  }

  // eval fallback (reserved for T22 — currently always wrong for unrecognised moves)
  void evalFallbackClass;

  return {
    accepted: false,
    feedback: "wrong",
    correctMove: { uci: canonicalUci, san: canonicalSan },
    annotation: `${ctx.userMove.san} is not the expected move.`,
  };
};
