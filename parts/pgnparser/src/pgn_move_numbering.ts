/**
 * pgn_move_numbering — centralized move-number insertion/cleanup logic.
 */
import type { PgnEntryNode, PgnModel, PgnMoveNumberNode, PgnVariationNode } from "./pgn_model";

const countMovesBeforeIdx = (entries: PgnEntryNode[], upToIdx: number): number => {
  let count = 0;
  for (let i = 0; i < upToIdx && i < entries.length; i += 1) {
    if (entries[i].type === "move") count += 1;
  }
  return count;
};

const isWhiteMoveNumberEntry = (entry: PgnEntryNode | undefined): boolean => {
  if (!entry || entry.type !== "move_number") return false;
  const text: string = String(entry.text ?? "").trim();
  return /^\d+\.$/.test(text);
};

const moveSanEmbedsWhiteClockPrefix = (san: string): boolean =>
  /^\d{1,3}\.\S/.test(String(san ?? ""));

const isBlackMoveNumberText = (raw: string): boolean => {
  const text: string = String(raw ?? "");
  return /^(\d+)\.{3,}$/.test(text) || /^(\d+)…$/.test(text);
};

const parseMoveNumberValue = (raw: string): { moveNum: number; side: "white" | "black" } | null => {
  const text: string = String(raw ?? "").trim();
  const white = /^(\d+)\.$/.exec(text);
  if (white) return { moveNum: Number(white[1]), side: "white" };
  const black = /^(\d+)\.{3,}$/.exec(text) ?? /^(\d+)…$/.exec(text);
  if (black) return { moveNum: Number(black[1]), side: "black" };
  return null;
};

const resolveMoveNumberForParentMove = (
  variation: PgnVariationNode,
  parentMoveIdx: number,
): number | null => {
  for (let i = parentMoveIdx; i >= 0; i -= 1) {
    const entry = variation.entries[i];
    if (entry?.type !== "move_number") continue;
    const parsed = parseMoveNumberValue(String(entry.text ?? ""));
    if (parsed && Number.isFinite(parsed.moveNum)) return parsed.moveNum;
  }
  return null;
};

export const maybeInsertMoveNumber = (
  model: PgnModel,
  variation: PgnVariationNode,
  entries: PgnEntryNode[],
  insertIdx: number,
  createMoveNumberId: () => string,
): number => {
  if (variation.parentMoveId !== null) return insertIdx;
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  const startsWhite = fenHeader
    ? (fenHeader.value.trim().split(/\s+/)[1] ?? "w") !== "b"
    : true;
  const preceding = countMovesBeforeIdx(entries, insertIdx);
  const isWhiteTurn = startsWhite ? preceding % 2 === 0 : preceding % 2 !== 0;
  const prevEntry = insertIdx > 0 ? entries[insertIdx - 1] : undefined;
  if (isWhiteTurn && prevEntry?.type !== "move_number") {
    const nextEntry: PgnEntryNode | undefined =
      insertIdx < entries.length ? entries[insertIdx] : undefined;
    if (isWhiteMoveNumberEntry(nextEntry)) return insertIdx;
    if (nextEntry?.type === "move" && moveSanEmbedsWhiteClockPrefix(nextEntry.san)) {
      return insertIdx;
    }
    const moveNum = Math.floor(preceding / 2) + 1;
    entries.splice(insertIdx, 0, { id: createMoveNumberId(), type: "move_number", text: `${moveNum}.` });
    return insertIdx + 1;
  }
  return insertIdx;
};

export const prependMoveNumberToRav = (
  model: PgnModel,
  parentVariation: PgnVariationNode,
  parentMoveIdx: number,
  childVar: PgnVariationNode,
  createMoveNumberId: () => string,
): void => {
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  const startsWhite = fenHeader
    ? (fenHeader.value.trim().split(/\s+/)[1] ?? "w") !== "b"
    : true;
  const preceding = countMovesBeforeIdx(parentVariation.entries, parentMoveIdx);
  const isWhiteTurn = startsWhite ? preceding % 2 === 0 : preceding % 2 !== 0;
  const moveNum = Math.floor(preceding / 2) + 1;
  childVar.entries.unshift({
    id: createMoveNumberId(),
    type: "move_number",
    text: isWhiteTurn ? `${moveNum}.` : `${moveNum}...`,
  });
};

export const insertBlackMoveNumberAfterRav = (
  model: PgnModel,
  variation: PgnVariationNode,
  parentMoveIdx: number,
  createMoveNumberId: () => string,
): void => {
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  const startsWhite = fenHeader
    ? (fenHeader.value.trim().split(/\s+/)[1] ?? "w") !== "b"
    : true;
  const preceding = countMovesBeforeIdx(variation.entries, parentMoveIdx);
  const isWhiteTurn = startsWhite ? preceding % 2 === 0 : preceding % 2 !== 0;
  if (!isWhiteTurn) return;
  let nextMoveIdx = -1;
  for (let i = parentMoveIdx + 1; i < variation.entries.length; i += 1) {
    const e = variation.entries[i];
    if (e.type === "move") { nextMoveIdx = i; break; }
    if (e.type === "move_number" || e.type === "result") break;
  }
  if (nextMoveIdx === -1) return;
  const prevEntry = nextMoveIdx > 0 ? variation.entries[nextMoveIdx - 1] : undefined;
  if (prevEntry?.type === "move_number") return;
  const moveNum = Math.floor(preceding / 2) + 1;
  variation.entries.splice(nextMoveIdx, 0, {
    id: createMoveNumberId(),
    type: "move_number",
    text: `${moveNum}...`,
  });
};

/**
 * Insert a black move-number token (`N...`) immediately before a newly inserted
 * continuation move when the parent move has one or more RAVs.
 *
 * This covers the case where the mainline reply is appended *after* the RAVs were
 * created. `insertBlackMoveNumberAfterRav` only fixes already-existing replies.
 *
 * No-op when:
 * - the variation is not root
 * - the parent move is not a white move in this line
 * - a move-number token already exists immediately before `insertIdx`
 */
export const insertBlackMoveNumberBeforeRavContinuation = (
  model: PgnModel,
  variation: PgnVariationNode,
  parentMoveIdx: number,
  insertIdx: number,
  createMoveNumberId: () => string,
): void => {
  if (variation.parentMoveId !== null) return;
  if (insertIdx <= 0 || insertIdx > variation.entries.length) return;
  const fenHeader = model.headers.find((h) => h.key === "FEN");
  const startsWhite = fenHeader
    ? (fenHeader.value.trim().split(/\s+/)[1] ?? "w") !== "b"
    : true;
  const preceding = countMovesBeforeIdx(variation.entries, parentMoveIdx);
  const isWhiteTurn = startsWhite ? preceding % 2 === 0 : preceding % 2 !== 0;
  if (!isWhiteTurn) return;
  const prevEntry = variation.entries[insertIdx - 1];
  if (prevEntry?.type === "move_number") return;
  const moveNum: number = resolveMoveNumberForParentMove(variation, parentMoveIdx)
    ?? (Math.floor(preceding / 2) + 1);
  variation.entries.splice(insertIdx, 0, {
    id: createMoveNumberId(),
    type: "move_number",
    text: `${moveNum}...`,
  });
};

export const normalizeAfterNullMoveRemoval = (
  variation: PgnVariationNode,
  joinIndex: number,
): void => {
  if (joinIndex > 0 && joinIndex < variation.entries.length && variation.entries[joinIndex - 1].type === "move") {
    let idx = joinIndex;
    while (idx < variation.entries.length) {
      const entry: PgnEntryNode = variation.entries[idx];
      if (entry.type === "move_number") {
        variation.entries.splice(idx, 1);
        continue;
      }
      if (entry.type === "comment") { idx += 1; continue; }
      break;
    }
  }

  if (joinIndex > 0 && joinIndex < variation.entries.length && variation.entries[joinIndex - 1].type === "move") {
    let idx = joinIndex;
    while (idx < variation.entries.length) {
      const cur: PgnEntryNode = variation.entries[idx];
      if (cur.type === "comment") { idx += 1; continue; }
      if (cur.type === "move_number") {
        if (isBlackMoveNumberText(String(cur.text ?? ""))) variation.entries.splice(idx, 1);
        break;
      }
      if (cur.type === "move" && isBlackMoveNumberText(cur.san)) variation.entries.splice(idx, 1);
      break;
    }
  }

  const withoutDangling: PgnEntryNode[] = [];
  for (let i = 0; i < variation.entries.length; i += 1) {
    const entry: PgnEntryNode = variation.entries[i];
    if (entry.type !== "move_number") {
      withoutDangling.push(entry);
      continue;
    }
    let hasMoveAhead = false;
    for (let j = i + 1; j < variation.entries.length; j += 1) {
      const lookahead: PgnEntryNode = variation.entries[j];
      if (lookahead.type === "move") { hasMoveAhead = true; break; }
      if (lookahead.type === "move_number" || lookahead.type === "result") break;
    }
    if (hasMoveAhead) withoutDangling.push(entry);
  }
  variation.entries = withoutDangling;

  const withoutRedundantBlack: PgnEntryNode[] = [];
  let seenMove = false;
  for (const entry of variation.entries) {
    if (entry.type === "move") {
      seenMove = true;
      withoutRedundantBlack.push(entry);
      continue;
    }
    if (entry.type === "move_number" && seenMove && isBlackMoveNumberText(String((entry as PgnMoveNumberNode).text ?? ""))) {
      continue;
    }
    withoutRedundantBlack.push(entry);
  }
  variation.entries = withoutRedundantBlack;

  const withoutConsecutive: PgnEntryNode[] = [];
  for (const entry of variation.entries) {
    if (entry.type === "move_number") {
      const prev = withoutConsecutive[withoutConsecutive.length - 1];
      if (prev?.type === "move_number") {
        withoutConsecutive[withoutConsecutive.length - 1] = entry;
        continue;
      }
    }
    withoutConsecutive.push(entry);
  }
  variation.entries = withoutConsecutive;
};

