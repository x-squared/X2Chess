/**
 * PGN model: parses a raw PGN string into a structured in-memory tree.
 *
 * Responsibilities:
 * - Tokenise the move-text section of a PGN string (comments, variations,
 *   move symbols, NAGs, results, move numbers).
 * - Build a recursive `PgnModel` tree whose root is a `PgnVariationNode`
 *   containing `PgnEntryNode` children (moves, move-numbers, comments,
 *   nested variations, NAGs, results).
 * - Parse inline markdown-like markup inside comment text into `CommentRun`
 *   spans (bold `**`, italic `*`, underline `__`, code `` ` ``).
 *
 * Primary entry point: `parsePgnToModel(rawPgn)` — call it with a full PGN
 * string (headers + move text) and receive a `PgnModel`.
 *
 * No side effects beyond the module-level `modelIdCounter` that is reset to 0
 * on every `parsePgnToModel` call, so IDs are stable and deterministic for a
 * given input.
 */
let modelIdCounter = 0;

const nextId = (prefix: string): string => `${prefix}_${++modelIdCounter}`;

const decodeCommentLayout = (source: string): string => {
  let out = "";
  for (let i: number = 0; i < source.length; i += 1) {
    const ch: string = source[i];
    if (ch === "\\" && i + 1 < source.length) {
      const next: string = source[i + 1];
      if (next === "n") {
        out += "\n";
        i += 1;
        continue;
      }
      if (next === "t") {
        out += "\t";
        i += 1;
        continue;
      }
      if (next === "\\") {
        out += "\\";
        i += 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
};

type MoveTextToken =
  | { type: "comment"; value: string }
  | { type: "variation_start" }
  | { type: "variation_end" }
  | { type: "symbol"; value: string };

const tokenizeMoveText = (source: string): MoveTextToken[] => {
  const tokens: MoveTextToken[] = [];
  let i: number = 0;
  while (i < source.length) {
    const ch: string = source[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "{") {
      let j: number = i + 1;
      while (j < source.length && source[j] !== "}") j += 1;
      const body: string = decodeCommentLayout(source.slice(i + 1, j));
      tokens.push({ type: "comment", value: body });
      i = Math.min(j + 1, source.length);
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "variation_start" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "variation_end" });
      i += 1;
      continue;
    }
    let j: number = i + 1;
    while (j < source.length && !/[\s{}()]/.test(source[j])) j += 1;
    tokens.push({ type: "symbol", value: source.slice(i, j) });
    i = j;
  }
  return tokens;
};

/** True for white (`12.`), black (`12...` / `12…`), or legacy `12..` move-number tokens. */
const isMoveNumber = (value: string): boolean =>
  /^\d+\.(\.\.)?$|^\d+\.\.\.$|^\d+…$/.test(value);

/** Canonicalise Unicode ellipsis black move numbers to ASCII `N...` for stable round-trips. */
const canonicalMoveNumberText = (symbol: string): string => {
  const m: RegExpMatchArray | null = symbol.match(/^(\d+)…$/);
  if (m) return `${m[1]}...`;
  return symbol;
};
const isResult = (value: string): boolean => /^(1-0|0-1|1\/2-1\/2|\*)$/.test(value);
const isNag = (value: string): boolean => /^\$\d+$/.test(value);

/**
 * A single styled span within a parsed comment string.
 * Exactly one of `bold`, `italic`, `code`, or `underline` is true for a
 * formatted span; all are false for plain text.
 */
export type CommentRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  underline?: boolean;
};

/**
 * Splits a raw comment string into a sequence of `CommentRun` spans by
 * recognising inline markdown-like markup:
 * - `**text**` → bold
 * - `*text*`   → italic
 * - `__text__` → underline
 * - `` `text` `` → code
 *
 * Unformatted regions become plain runs (`bold/italic/code/underline` all
 * false). The entire input is always covered — no characters are dropped.
 *
 * @param raw - Raw comment text, typically the content between `{` and `}` in
 *   a PGN string after escape sequences have been decoded.
 * @returns Ordered array of `CommentRun` values covering `raw` in full.
 */
export const parseCommentRuns = (raw: string): CommentRun[] => {
  const source: string = String(raw ?? "");
  const runs: CommentRun[] = [];
  const pattern: RegExp = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let lastIndex: number = 0;
  let match: RegExpExecArray | null = pattern.exec(source);
  while (match) {
    if (match.index > lastIndex) {
      runs.push({
        text: source.slice(lastIndex, match.index),
        bold: false,
        italic: false,
        code: false,
      });
    }
    const token: string = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      runs.push({ text: token.slice(2, -2), bold: true, italic: false, code: false });
    } else if (token.startsWith("__") && token.endsWith("__")) {
      runs.push({
        text: token.slice(2, -2),
        bold: false,
        italic: false,
        underline: true,
        code: false,
      });
    } else if (token.startsWith("*") && token.endsWith("*")) {
      runs.push({ text: token.slice(1, -1), bold: false, italic: true, code: false });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push({ text: token.slice(1, -1), bold: false, italic: false, code: true });
    } else {
      runs.push({ text: token, bold: false, italic: false, code: false });
    }
    lastIndex = pattern.lastIndex;
    match = pattern.exec(source);
  }
  if (lastIndex < source.length) {
    runs.push({ text: source.slice(lastIndex), bold: false, italic: false, code: false });
  }
  return runs;
};

type PgnHeader = { key: string; value: string };

/** A single comment node in the PGN tree, produced from text between `{` and `}`. */
export type PgnCommentNode = {
  id: string;
  type: "comment";
  /** Raw text after escape decoding, before markup parsing. */
  raw: string;
  /** Markup-parsed spans derived from `raw`; use these for rendering. */
  runs: CommentRun[];
};

/**
 * An item that follows a move in source order: either a comment or a RAV
 * (Recursive Annotation Variation). Stored on `PgnMoveNode.postItems` to
 * preserve the original interleaving of comments and variations for faithful
 * round-trip rendering.
 */
export type PgnPostItem =
  | { type: "comment"; comment: PgnCommentNode }
  | { type: "rav"; rav: PgnVariationNode };

/** A single half-move (ply) in the PGN tree. */
export type PgnMoveNode = {
  id: string;
  type: "move";
  /** Standard Algebraic Notation string, e.g. `"e4"`, `"Nf3"`, `"O-O"`. */
  san: string;
  /** Numeric Annotation Glyphs attached to this move, e.g. `["$1", "$18"]`. */
  nags: string[];
  /** Comments that appeared in the source immediately before this move. */
  commentsBefore: PgnCommentNode[];
  /** Comments that appeared in the source immediately after this move. */
  commentsAfter: PgnCommentNode[];
  /** Shortcut list of all RAVs attached to this move (subset of `postItems`). */
  ravs: PgnVariationNode[];
  /**
   * All items following this move in source order (comments and RAVs
   * interleaved). Use this for rendering to preserve original layout.
   */
  postItems: PgnPostItem[];
};

/** A move-number token in the PGN tree, e.g. `"1."` or `"3..."`. */
export type PgnMoveNumberNode = {
  id: string;
  type: "move_number";
  /** Raw token text as it appeared in the source, e.g. `"1."` or `"3..."`. */
  text: string;
};

/** A game-result token in the PGN tree: `"1-0"`, `"0-1"`, `"1/2-1/2"`, or `"*"`. */
export type PgnResultNode = {
  id: string;
  type: "result";
  text: string;
};

/**
 * A Numeric Annotation Glyph that appears outside of a move context
 * (unusual in standard PGN, but preserved for round-trip correctness).
 */
export type PgnNagNode = {
  id: string;
  type: "nag";
  /** Raw NAG token, e.g. `"$1"`. */
  text: string;
};

/**
 * A variation (mainline or RAV) in the PGN tree. The root of the game is a
 * `PgnVariationNode` at `depth` 0; each `(…)` in the source adds a nested
 * node at `depth + 1`.
 */
export type PgnVariationNode = {
  id: string;
  type: "variation";
  /** Nesting depth: 0 = mainline, 1 = first-level RAV, etc. */
  depth: number;
  /** ID of the `PgnMoveNode` this variation branches from, or `null` for the root. */
  parentMoveId: string | null;
  /** Ordered child nodes: moves, move-numbers, comments, NAGs, results, nested variations. */
  entries: PgnEntryNode[];
  /** Comments that appeared after the closing `)` of a RAV (or at end of game). */
  trailingComments: PgnCommentNode[];
};

/** Union of all node types that can appear as a direct child of a `PgnVariationNode`. */
export type PgnEntryNode =
  | PgnMoveNode
  | PgnMoveNumberNode
  | PgnResultNode
  | PgnNagNode
  | PgnCommentNode
  | PgnVariationNode;

/**
 * Top-level parsed representation of a single PGN game.
 * Produced by `parsePgnToModel`; consumed by board navigation, tree rendering,
 * and text-editor components.
 */
export type PgnModel = {
  id: string;
  type: "game";
  /** Key/value pairs from the PGN tag-pair section, e.g. `{ key: "White", value: "Carlsen, M." }`. */
  headers: PgnHeader[];
  /** Root variation containing the mainline (depth 0) and all nested RAVs. */
  root: PgnVariationNode;
  /** The original, unmodified PGN string passed to `parsePgnToModel`. */
  rawPgn: string;
};

const parseHeaders = (rawPgn: string): PgnHeader[] => {
  const headers: PgnHeader[] = [];
  const lines: string[] = rawPgn.split("\n");
  for (const line of lines) {
    const match: RegExpMatchArray | null = line.match(/^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/);
    if (match) headers.push({ key: match[1], value: match[2] });
  }
  return headers;
};

const stripHeaders = (rawPgn: string): string => rawPgn
  .split("\n")
  .filter((line: string): boolean => !/^\s*\[[^\]]+\]\s*$/.test(line))
  .join("\n")
  .trim();

const createVariation = (depth: number, parentMoveId: string | null = null): PgnVariationNode => ({
  id: nextId("variation"),
  type: "variation",
  depth,
  parentMoveId,
  entries: [],
  trailingComments: [],
});

const createComment = (raw: string): PgnCommentNode => ({
  id: nextId("comment"),
  type: "comment",
  raw,
  runs: parseCommentRuns(raw),
});

const createMove = (san: string): PgnMoveNode => ({
  id: nextId("move"),
  type: "move",
  san,
  nags: [],
  commentsBefore: [],
  commentsAfter: [],
  ravs: [],
  postItems: [],
});

type ParseStackFrame = {
  variation: PgnVariationNode;
  lastMove: PgnMoveNode | null;
  pendingComments: PgnCommentNode[];
};

/**
 * Parses a full PGN string into a `PgnModel` tree.
 *
 * The function handles the complete PGN grammar:
 * - Tag-pair headers (`[Key "Value"]`) are extracted into `PgnModel.headers`.
 * - The remaining move text is tokenised and transformed into a recursive tree
 *   rooted at `PgnModel.root` (`PgnVariationNode` at depth 0).
 * - Nested `(…)` groups become `PgnVariationNode` children; their
 *   `parentMoveId` points to the `PgnMoveNode` they branch from.
 * - Comments `{…}` are attached as `commentsBefore`/`commentsAfter` on the
 *   nearest move, or as `trailingComments` on the enclosing variation if no
 *   move has been seen yet.
 * - NAGs (`$N`) are attached to the preceding move's `nags` array when inside
 *   a move context; otherwise stored as standalone `PgnNagNode` entries.
 *
 * The module-level `modelIdCounter` is reset to 0 on each call, so IDs are
 * deterministic for a given input string.
 *
 * @param rawPgn - A complete PGN string, optionally including tag-pair headers.
 *   Passing `null` or `undefined` is safe (treated as empty string).
 * @returns A fully populated `PgnModel`. An empty move-text section yields a
 *   model whose `root.entries` is empty.
 */
export const parsePgnToModel = (rawPgn: string): PgnModel => {
  const source: string = String(rawPgn ?? "");
  modelIdCounter = 0;
  const headers: PgnHeader[] = parseHeaders(source);
  const moveText: string = stripHeaders(source);
  const root: PgnVariationNode = createVariation(0, null);
  const model: PgnModel = {
    id: nextId("game"),
    type: "game",
    headers,
    root,
    rawPgn: source,
  };
  if (!moveText) return model;

  const stack: ParseStackFrame[] = [{
    variation: root,
    lastMove: null,
    pendingComments: [],
  }];

  const tokens: MoveTextToken[] = tokenizeMoveText(moveText);
  for (const token of tokens) {
    const frame: ParseStackFrame | undefined = stack[stack.length - 1];
    if (!frame) break;

    if (token.type === "variation_start") {
      const child: PgnVariationNode = createVariation(frame.variation.depth + 1, frame.lastMove?.id ?? null);
      if (frame.lastMove) {
        frame.lastMove.ravs.push(child);
        frame.lastMove.postItems.push({ type: "rav", rav: child });
      } else {
        frame.variation.entries.push(child);
      }
      stack.push({ variation: child, lastMove: null, pendingComments: [] });
      continue;
    }

    if (token.type === "variation_end") {
      const closing: ParseStackFrame | undefined = stack.pop();
      if (closing && closing.pendingComments.length > 0) {
        closing.variation.trailingComments.push(...closing.pendingComments);
      }
      continue;
    }

    if (token.type === "comment") {
      const comment: PgnCommentNode = createComment(token.value);
      if (frame.lastMove) {
        frame.lastMove.commentsAfter.push(comment);
        frame.lastMove.postItems.push({ type: "comment", comment });
      } else {
        frame.pendingComments.push(comment);
      }
      continue;
    }

    const symbol: string = token.value ?? "";
    if (!symbol) continue;
    if (isMoveNumber(symbol)) {
      frame.variation.entries.push({
        id: nextId("move_number"),
        type: "move_number",
        text: canonicalMoveNumberText(symbol),
      });
      continue;
    }
    if (isResult(symbol)) {
      frame.variation.entries.push({
        id: nextId("result"),
        type: "result",
        text: symbol,
      });
      continue;
    }
    if (isNag(symbol)) {
      if (frame.lastMove) {
        frame.lastMove.nags.push(symbol);
      } else {
        frame.variation.entries.push({
          id: nextId("nag"),
          type: "nag",
          text: symbol,
        });
      }
      continue;
    }

    const move: PgnMoveNode = createMove(symbol);
    if (frame.pendingComments.length > 0) {
      move.commentsBefore.push(...frame.pendingComments);
      frame.pendingComments = [];
    }
    frame.variation.entries.push(move);
    frame.lastMove = move;
  }

  while (stack.length > 0) {
    const frame: ParseStackFrame | undefined = stack.pop();
    if (frame && frame.pendingComments.length > 0) {
      frame.variation.trailingComments.push(...frame.pendingComments);
    }
  }

  return model;
};
