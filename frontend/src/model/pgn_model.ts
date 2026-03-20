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

const isMoveNumber = (value: string): boolean => /^\d+\.(\.\.)?$|^\d+\.\.\.$/.test(value);
const isResult = (value: string): boolean => /^(1-0|0-1|1\/2-1\/2|\*)$/.test(value);
const isNag = (value: string): boolean => /^\$\d+$/.test(value);

export type CommentRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  underline?: boolean;
};

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

export type PgnCommentNode = {
  id: string;
  type: "comment";
  raw: string;
  runs: CommentRun[];
};

export type PgnPostItem =
  | { type: "comment"; comment: PgnCommentNode }
  | { type: "rav"; rav: PgnVariationNode };

export type PgnMoveNode = {
  id: string;
  type: "move";
  san: string;
  nags: string[];
  commentsBefore: PgnCommentNode[];
  commentsAfter: PgnCommentNode[];
  ravs: PgnVariationNode[];
  postItems: PgnPostItem[];
};

export type PgnMoveNumberNode = {
  id: string;
  type: "move_number";
  text: string;
};

export type PgnResultNode = {
  id: string;
  type: "result";
  text: string;
};

export type PgnNagNode = {
  id: string;
  type: "nag";
  text: string;
};

export type PgnVariationNode = {
  id: string;
  type: "variation";
  depth: number;
  parentMoveId: string | null;
  entries: PgnEntryNode[];
  trailingComments: PgnCommentNode[];
};

export type PgnEntryNode =
  | PgnMoveNode
  | PgnMoveNumberNode
  | PgnResultNode
  | PgnNagNode
  | PgnCommentNode
  | PgnVariationNode;

export type PgnModel = {
  id: string;
  type: "game";
  headers: PgnHeader[];
  root: PgnVariationNode;
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
        text: symbol,
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
