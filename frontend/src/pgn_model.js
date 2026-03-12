let modelIdCounter = 0;

const nextId = (prefix) => `${prefix}_${++modelIdCounter}`;

const tokenizeMoveText = (source) => {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === "{") {
      let j = i + 1;
      while (j < source.length && source[j] !== "}") j += 1;
      const body = source.slice(i + 1, j).trim();
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
    let j = i + 1;
    while (j < source.length && !/[\s{}()]/.test(source[j])) j += 1;
    tokens.push({ type: "symbol", value: source.slice(i, j) });
    i = j;
  }
  return tokens;
};

const isMoveNumber = (value) => /^\d+\.(\.\.)?$|^\d+\.\.\.$/.test(value);
const isResult = (value) => /^(1-0|0-1|1\/2-1\/2|\*)$/.test(value);
const isNag = (value) => /^\$\d+$/.test(value);

export const parseCommentRuns = (raw) => {
  const runs = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match = pattern.exec(raw);
  while (match) {
    if (match.index > lastIndex) {
      runs.push({
        text: raw.slice(lastIndex, match.index),
        bold: false,
        italic: false,
        code: false,
      });
    }
    const token = match[0];
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
    match = pattern.exec(raw);
  }
  if (lastIndex < raw.length) {
    runs.push({ text: raw.slice(lastIndex), bold: false, italic: false, code: false });
  }
  return runs;
};

const parseHeaders = (rawPgn) => {
  const headers = [];
  const lines = rawPgn.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*\[([A-Za-z0-9_]+)\s+"(.*)"\]\s*$/);
    if (match) headers.push({ key: match[1], value: match[2] });
  }
  return headers;
};

const stripHeaders = (rawPgn) => rawPgn
  .split("\n")
  .filter((line) => !/^\s*\[[^\]]+\]\s*$/.test(line))
  .join(" ")
  .replace(/\s+/g, " ")
  .trim();

const createVariation = (depth, parentMoveId = null) => ({
  id: nextId("variation"),
  type: "variation",
  depth,
  parentMoveId,
  entries: [],
  trailingComments: [],
});

const createComment = (raw) => ({
  id: nextId("comment"),
  type: "comment",
  raw,
  runs: parseCommentRuns(raw),
});

const createMove = (san) => ({
  id: nextId("move"),
  type: "move",
  san,
  nags: [],
  commentsBefore: [],
  commentsAfter: [],
  ravs: [],
  postItems: [],
});

export const parsePgnToModel = (rawPgn) => {
  modelIdCounter = 0;
  const headers = parseHeaders(rawPgn);
  const moveText = stripHeaders(rawPgn);
  const root = createVariation(0, null);
  const model = {
    id: nextId("game"),
    type: "game",
    headers,
    root,
    rawPgn,
  };
  if (!moveText) return model;

  const stack = [{
    variation: root,
    lastMove: null,
    pendingComments: [],
  }];

  const tokens = tokenizeMoveText(moveText);
  for (const token of tokens) {
    const frame = stack[stack.length - 1];
    if (!frame) break;

    if (token.type === "variation_start") {
      const child = createVariation(frame.variation.depth + 1, frame.lastMove?.id ?? null);
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
      const closing = stack.pop();
      if (closing && closing.pendingComments.length > 0) {
        closing.variation.trailingComments.push(...closing.pendingComments);
      }
      continue;
    }

    if (token.type === "comment") {
      const comment = createComment(token.value);
      if (frame.lastMove) {
        frame.lastMove.commentsAfter.push(comment);
        frame.lastMove.postItems.push({ type: "comment", comment });
      } else {
        frame.pendingComments.push(comment);
      }
      continue;
    }

    const symbol = token.value;
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
      if (frame.lastMove) frame.lastMove.nags.push(symbol);
      else {
        frame.variation.entries.push({
          id: nextId("nag"),
          type: "nag",
          text: symbol,
        });
      }
      continue;
    }

    const move = createMove(symbol);
    if (frame.pendingComments.length > 0) {
      move.commentsBefore.push(...frame.pendingComments);
      frame.pendingComments = [];
    }
    frame.variation.entries.push(move);
    frame.lastMove = move;
  }

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame && frame.pendingComments.length > 0) {
      frame.variation.trailingComments.push(...frame.pendingComments);
    }
  }

  return model;
};
