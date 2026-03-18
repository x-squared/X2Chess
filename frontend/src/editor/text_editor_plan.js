/**
 * Text editor render planning.
 *
 * Intent:
 * - Convert PGN model structure into normalized editor render blocks/tokens.
 * - Preserve move/comment/variation semantics and inline formatting hints.
 *
 * Integration API:
 * - `buildTextEditorPlan(pgnModel)` returns render blocks consumed by reconcile layer.
 */

const NEWLINE_PATTERN = /(?:\[\[br\]\]|<br\s*\/?>|\\n|\n)/gi;

const createBlock = (index, indentDepth = 0) => ({
  key: `block_${index}`,
  indentDepth,
  tokens: [],
});

const createPlanState = () => ({
  blocks: [createBlock(0, 0)],
  blockIndex: 0,
  tokenIndex: 0,
  indentDepth: 0,
  firstCommentId: null,
});

const currentBlock = (state) => state.blocks[state.blocks.length - 1];

const nextBlock = (state) => {
  state.blockIndex += 1;
  state.blocks.push(createBlock(state.blockIndex, state.indentDepth));
};

const normalizeAtBlockStart = (block, text) => (block.tokens.length === 0 ? text.replace(/^\s+/, "") : text);

const addInlineToken = (state, text, className, tokenType, dataset = {}) => {
  if (text === null || text === undefined) return;
  const block = currentBlock(state);
  const normalized = normalizeAtBlockStart(block, String(text));
  if (!normalized) return;
  if (/^\s+$/.test(normalized) && block.tokens.length === 0) return;
  block.tokens.push({
    key: `token_${state.tokenIndex++}`,
    kind: "inline",
    text: normalized,
    className: className || "",
    tokenType,
    dataset,
  });
};

const addSpace = (state) => {
  const block = currentBlock(state);
  block.tokens.push({
    key: `token_${state.tokenIndex++}`,
    kind: "inline",
    text: "",
    className: "text-editor-space",
    tokenType: "space",
    dataset: {},
  });
};

const splitByBreakHints = (text) => {
  const source = String(text ?? "");
  NEWLINE_PATTERN.lastIndex = 0;
  const chunks = [];
  let last = 0;
  let match = NEWLINE_PATTERN.exec(source);
  while (match) {
    chunks.push({ text: source.slice(last, match.index), hasBreakAfter: true });
    last = match.index + match[0].length;
    match = NEWLINE_PATTERN.exec(source);
  }
  chunks.push({ text: source.slice(last), hasBreakAfter: false });
  return chunks;
};

const addTextWithBreaks = (state, text, className, tokenType, dataset = {}) => {
  const chunks = splitByBreakHints(text);
  chunks.forEach((chunk) => {
    if (chunk.text) addInlineToken(state, chunk.text, className, tokenType, dataset);
    if (chunk.hasBreakAfter) nextBlock(state);
  });
};

const parseMoveNumberToken = (raw) => {
  const text = String(raw ?? "");
  const white = text.match(/^(\d+)\.$/);
  if (white) return { displayText: white[1], side: "white", simplified: true };
  const black = text.match(/^(\d+)\.\.\.?$/);
  if (black) return { displayText: black[1], side: "black", simplified: true };
  return { displayText: text, side: "raw", simplified: false };
};

const addCommentToken = (
  state,
  comment,
  text,
  rawText,
  hasIndentDirective = false,
  indentDirectiveDepth = 0,
  hasIntroDirective = false,
) => {
  const block = currentBlock(state);
  block.tokens.push({
    key: `token_${state.tokenIndex++}`,
    kind: "comment",
    tokenType: "comment",
    commentId: comment.id,
    rawText,
    hasIndentDirective,
    indentDirectiveDepth,
    hasIntroDirective,
    text,
  });
};

const INDENT_BLOCK_DIRECTIVE_PREFIX = /^\s*(?:\\i(?:\s+|$))+/;
const INTRO_DIRECTIVE_PREFIX = /^\s*\\intro(?:\s+|$)/i;
const getIndentDirectiveDepth = (comment) => {
  const raw = String(comment?.raw ?? "");
  const match = raw.match(INDENT_BLOCK_DIRECTIVE_PREFIX);
  if (!match) return 0;
  const tokens = match[0].match(/\\i/g);
  return tokens ? tokens.length : 0;
};
const hasIndentBlockDirective = (comment) => getIndentDirectiveDepth(comment) > 0;
const hasIntroDirective = (comment) => INTRO_DIRECTIVE_PREFIX.test(String(comment?.raw ?? ""));
const stripIntroDirective = (rawText) => String(rawText ?? "")
  .replace(INTRO_DIRECTIVE_PREFIX, "")
  .replace(/^\s+/, "");
const stripIndentDirectives = (rawText) => String(rawText ?? "")
  .replace(INDENT_BLOCK_DIRECTIVE_PREFIX, "")
  .replace(/^\s+/, "");

const addComment = (state, comment) => {
  const rawText = String(comment.raw ?? "");
  const isFirstComment = !state.firstCommentId;
  if (isFirstComment) state.firstCommentId = comment.id;
  const introDirective = isFirstComment && hasIntroDirective(comment);
  const withoutIntro = introDirective ? stripIntroDirective(rawText) : rawText;
  const indentDirectiveDepth = getIndentDirectiveDepth(comment);
  const hasIndentDirective = indentDirectiveDepth > 0;
  const visibleText = hasIndentDirective ? stripIndentDirectives(withoutIntro) : withoutIntro;
  addCommentToken(
    state,
    comment,
    visibleText,
    rawText,
    hasIndentDirective,
    indentDirectiveDepth,
    introDirective,
  );
  addSpace(state);
};

const emitIndentedBlock = (state, levels, emitContent) => {
  const previousDepth = state.indentDepth;
  state.indentDepth = previousDepth + Math.max(1, Number(levels) || 1);
  nextBlock(state);
  emitContent();
  state.indentDepth = previousDepth;
  nextBlock(state);
};

const emitVariation = (variation, state, strategyRegistry) => {
  const flow = {
    nextMoveSide: "white",
    hoistedBeforeCommentMoveIds: new Set(),
  };
  for (let idx = 0; idx < variation.entries.length; idx += 1) {
    const entry = variation.entries[idx];
    if (entry.type === "variation") {
      emitVariation(entry, state, strategyRegistry);
      continue;
    }
    const nextEntry = variation.entries[idx + 1];
    if (entry.type === "comment" && nextEntry?.type === "variation" && hasIndentBlockDirective(entry)) {
      emitIndentedBlock(state, getIndentDirectiveDepth(entry), () => {
        addComment(state, entry);
        emitVariation(nextEntry, state, strategyRegistry);
      });
      idx += 1;
      continue;
    }
    if (entry.type === "move_number") {
      const nextEntry = variation.entries[idx + 1];
      if (nextEntry?.type === "move" && Array.isArray(nextEntry.commentsBefore) && nextEntry.commentsBefore.length > 0) {
        nextEntry.commentsBefore.forEach((comment) => addComment(state, comment));
        flow.hoistedBeforeCommentMoveIds.add(nextEntry.id);
      }
    }
    if (entry.type === "move_number") {
      const parsed = parseMoveNumberToken(entry.text);
      if (parsed.side === "white" || parsed.side === "black") {
        flow.nextMoveSide = parsed.side;
      }
    }
    const strategy = strategyRegistry[entry.type];
    if (!strategy) continue;
    strategy(entry, variation, state, strategyRegistry, flow);
    if (entry.type === "move") {
      flow.nextMoveSide = flow.nextMoveSide === "white" ? "black" : "white";
    }
  }
  variation.trailingComments.forEach((comment) => addComment(state, comment));
};

const emitMove = (entry, variation, state, strategyRegistry, flow) => {
  const moveSide = flow?.nextMoveSide === "black" ? "black" : "white";
  const moveClass = variation.depth === 0
    ? `text-editor-main-move move-${moveSide}`
    : `text-editor-variation-move move-${moveSide}`;
  if (!flow?.hoistedBeforeCommentMoveIds?.has(entry.id)) {
    entry.commentsBefore.forEach((comment) => addComment(state, comment));
  }
  addTextWithBreaks(
    state,
    entry.san,
    moveClass,
    "move",
    { nodeId: entry.id, variationDepth: variation.depth, moveSide },
  );
  addSpace(state);
  entry.nags.forEach((nag) => {
    addTextWithBreaks(state, nag, "text-editor-nag", "nag", { moveId: entry.id });
    addSpace(state);
  });

  if (Array.isArray(entry.postItems) && entry.postItems.length > 0) {
    for (let idx = 0; idx < entry.postItems.length; idx += 1) {
      const item = entry.postItems[idx];
      if (item.type === "comment" && item.comment) {
        const nextItem = entry.postItems[idx + 1];
        if (nextItem?.type === "rav" && nextItem.rav && hasIndentBlockDirective(item.comment)) {
          emitIndentedBlock(state, getIndentDirectiveDepth(item.comment), () => {
            addComment(state, item.comment);
            emitVariation(nextItem.rav, state, strategyRegistry);
          });
          idx += 1;
          continue;
        }
        addComment(state, item.comment);
        continue;
      }
      if (item.type === "rav" && item.rav) {
        emitVariation(item.rav, state, strategyRegistry);
      }
    }
  } else {
    entry.commentsAfter.forEach((comment) => addComment(state, comment));
    entry.ravs.forEach((child) => emitVariation(child, state, strategyRegistry));
  }
};

const strategyRegistry = {
  comment: (entry, _variation, state) => {
    addComment(state, entry);
  },
  move_number: (entry, variation, state) => {
    const parsed = parseMoveNumberToken(entry.text);
    addTextWithBreaks(
      state,
      parsed.displayText,
      `${variation.depth === 0 ? "text-editor-main-move" : "text-editor-variation-move-number"} text-editor-move-number-token move-number`,
      "move_number",
      { nodeId: entry.id, variationDepth: variation.depth, moveNumberSide: parsed.side },
    );
    if (!parsed.simplified) addSpace(state);
  },
  result: (entry, _variation, state) => {
    addTextWithBreaks(state, entry.text, "text-editor-result", "result", { nodeId: entry.id });
    addSpace(state);
  },
  nag: (entry, _variation, state) => {
    addTextWithBreaks(state, entry.text, "text-editor-nag", "nag", { nodeId: entry.id });
    addSpace(state);
  },
  move: emitMove,
};

export const buildTextEditorPlan = (pgnModel) => {
  const state = createPlanState();
  if (!pgnModel || !pgnModel.root) return state.blocks;
  emitVariation(pgnModel.root, state, strategyRegistry);
  const firstNonEmpty = state.blocks.findIndex((block) => block.tokens.length > 0);
  if (firstNonEmpty === -1) return [createBlock(0, 0)];
  const lastNonEmpty = (() => {
    for (let i = state.blocks.length - 1; i >= 0; i -= 1) {
      if (state.blocks[i].tokens.length > 0) return i;
    }
    return 0;
  })();
  return state.blocks.slice(firstNonEmpty, lastNonEmpty + 1);
};
