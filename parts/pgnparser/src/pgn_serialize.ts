/**
 * PGN serialization: full game to PGN text, plus `serializeXsqrHeadMovetext` for
 * the derived mainline-prefix header (`[XSqrHead "..."]`) used on save.
 */
import type {
  PgnCommentNode,
  PgnEntryNode,
  PgnModel,
  PgnMoveNode,
  PgnPostItem,
  PgnVariationNode,
} from "./pgn_model";

const INDENT_DIRECTIVE_PREFIX: RegExp = /^(\s*(?:\\i(?:\s+|$))+)/;

const encodeCommentLayout = (raw: string): string => {
  const source: string = String(raw ?? "");
  const encodeBody = (text: string): string => text
    .replaceAll("\\", "\\\\")
    .replaceAll("\t", "\\t")
    .replaceAll("\n", "\\n");
  const match: RegExpMatchArray | null = source.match(INDENT_DIRECTIVE_PREFIX);
  if (!match) return encodeBody(source);
  const prefix: string = match[1];
  const rest: string = source.slice(prefix.length);
  return `${prefix}${encodeBody(rest)}`;
};

const serializeComment = (comment: PgnCommentNode): string => `{${encodeCommentLayout(comment.raw)}}`;

const serializeVariation = (variation: PgnVariationNode): string => {
  const parts: string[] = [];
  const hoistedBeforeCommentMoveIds: Set<string> = new Set<string>();
  variation.entries.forEach((entry: PgnEntryNode, idx: number): void => {
    if (entry.type === "move_number") {
      const nextEntry: PgnEntryNode | undefined = variation.entries[idx + 1];
      if (nextEntry?.type === "move" && Array.isArray(nextEntry.commentsBefore) && nextEntry.commentsBefore.length > 0) {
        nextEntry.commentsBefore.forEach((comment: PgnCommentNode): void => { parts.push(serializeComment(comment)); });
        hoistedBeforeCommentMoveIds.add(nextEntry.id);
      }
    }
    if (entry.type === "move_number" || entry.type === "result" || entry.type === "nag") {
      parts.push(entry.text);
      return;
    }
    if (entry.type === "comment") {
      parts.push(serializeComment(entry));
      return;
    }
    if (entry.type === "variation") {
      parts.push(`(${serializeVariation(entry)})`);
      return;
    }
    if (entry.type !== "move") return;

    const moveEntry: PgnMoveNode = entry;
    if (!hoistedBeforeCommentMoveIds.has(moveEntry.id)) {
      moveEntry.commentsBefore.forEach((comment: PgnCommentNode): void => { parts.push(serializeComment(comment)); });
    }
    parts.push(moveEntry.san);
    moveEntry.nags.forEach((nag: string): void => { parts.push(nag); });
    (moveEntry.postItems ?? []).forEach((item: PgnPostItem): void => {
      if (item.type === "comment" && item.comment) {
        parts.push(serializeComment(item.comment));
        return;
      }
      if (item.type === "rav" && item.rav) {
        parts.push(`(${serializeVariation(item.rav)})`);
      }
    });
  });
  variation.trailingComments.forEach((comment: PgnCommentNode): void => { parts.push(serializeComment(comment)); });
  return parts
    .map((part: string): string => String(part ?? ""))
    .filter((part: string): boolean => part.length > 0)
    .join(" ")
    .trim();
};

export const serializeModelToPgn = (model: PgnModel): string => {
  const headerLines: string[] = (model.headers || []).map((header: { key: string; value: string }): string => `[${header.key} "${header.value}"]`);
  const moveText: string = model.root ? serializeVariation(model.root) : "";
  if (headerLines.length === 0) return moveText;
  return `${headerLines.join("\n")}\n\n${moveText}`.trim();
};

/** PGN header key for the derived mainline-prefix snapshot (filled on save). */
export const XSQR_HEAD_HEADER_KEY = "XSqrHead";

/**
 * True when `token` is a white move-number prefix (`1.`, `12.`) — not black (`12...`).
 */
const isWhiteMoveNumberToken = (token: string): boolean => /^\d+\.$/.test(String(token ?? "").trim());

/**
 * True when `token` looks like a SAN half-move (not a comment, NAG, or move number).
 */
const looksLikeSanHalfMove = (token: string): boolean => {
  const s: string = String(token ?? "").trim();
  if (!s || s.startsWith("{") || s.startsWith("$")) return false;
  if (/^\d+\./.test(s)) return false;
  return true;
};

/**
 * Join XSqrHead fragments; glue white move numbers to the following SAN
 * (`1.` + `e4` → `1.e4`) with no intervening space.
 *
 * @param parts - Ordered tokens — **move numbers and SAN half-moves only** (no comments or NAGs).
 * @returns Single movetext string for `[XSqrHead "..."]`.
 */
export const joinXsqrHeadParts = (parts: string[]): string => {
  const merged: string[] = [];
  let i: number = 0;
  while (i < parts.length) {
    const cur: string = parts[i];
    const next: string | undefined = parts[i + 1];
    if (next !== undefined && isWhiteMoveNumberToken(cur) && looksLikeSanHalfMove(next)) {
      merged.push(`${cur}${next}`);
      i += 2;
      continue;
    }
    merged.push(cur);
    i += 1;
  }
  return merged
    .map((part: string): string => String(part ?? ""))
    .filter((part: string): boolean => part.length > 0)
    .join(" ")
    .trim();
};

/**
 * Serialize the root mainline through the configured stop rule using **half-moves only**:
 * move-number tokens (`1.`, `12...`) and SAN symbols — no comments, NAGs, or result.
 *
 * **Stop rule (initial):** continue until the end of the main trunk, or until the first
 * nested variation (`( … )`) — either a sibling `variation` entry or the first RAV
 * (`postItems` / `ravs`) after a move.
 *
 * @param model - Parsed `PgnModel`.
 * @returns Movetext fragment only (no headers); empty when there is no root / no moves.
 */
export const serializeXsqrHeadMovetext = (model: PgnModel): string => {
  if (!model.root) return "";
  return serializeXsqrHeadVariation(model.root);
};

const serializeXsqrHeadVariation = (variation: PgnVariationNode): string => {
  const parts: string[] = [];
  let stopped: boolean = false;
  const stop = (): void => {
    stopped = true;
  };

  variation.entries.forEach((entry: PgnEntryNode): void => {
    if (stopped) return;
    if (entry.type === "variation") {
      stop();
      return;
    }
    /** Moves only: omit comments, NAGs, and game result. */
    if (entry.type === "move_number") {
      parts.push(entry.text);
      return;
    }
    if (entry.type === "result" || entry.type === "nag" || entry.type === "comment") {
      return;
    }
    if (entry.type !== "move") return;

    const moveEntry: PgnMoveNode = entry;
    parts.push(moveEntry.san);
    (moveEntry.postItems ?? []).forEach((item: PgnPostItem): void => {
      if (stopped) return;
      if (item.type === "rav" && item.rav) {
        stop();
      }
    });
  });

  return joinXsqrHeadParts(parts);
};
