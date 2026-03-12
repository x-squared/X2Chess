const NEWLINE_PATTERN = /(?:\[\[br\]\]|<br\s*\/?>|\\n|\n)/gi;

const createBlock = (index) => ({
  key: `block_${index}`,
  tokens: [],
});

const createPlanState = () => ({
  blocks: [createBlock(0)],
  blockIndex: 0,
  tokenIndex: 0,
});

const currentBlock = (state) => state.blocks[state.blocks.length - 1];

const nextBlock = (state) => {
  state.blockIndex += 1;
  state.blocks.push(createBlock(state.blockIndex));
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

const addCommentToken = (state, comment, text) => {
  const block = currentBlock(state);
  block.tokens.push({
    key: `token_${state.tokenIndex++}`,
    kind: "comment",
    tokenType: "comment",
    commentId: comment.id,
    text,
  });
};

const addComment = (state, comment) => {
  addCommentToken(state, comment, comment.raw ?? "");
  addSpace(state);
};

const addInsertCommentControl = (state, moveId, position) => {
  const block = currentBlock(state);
  block.tokens.push({
    key: `token_${state.tokenIndex++}`,
    kind: "control",
    tokenType: "insert_comment",
    text: position === "before" ? "+{before}" : "+{after}",
    className: "text-editor-insert-comment",
    moveId,
    insertPosition: position,
  });
  addSpace(state);
};

const emitVariation = (variation, state, strategyRegistry) => {
  const flow = { nextMoveSide: "white" };
  variation.entries.forEach((entry) => {
    if (entry.type === "variation") {
      emitVariation(entry, state, strategyRegistry);
      return;
    }
    if (entry.type === "move_number") {
      const parsed = parseMoveNumberToken(entry.text);
      if (parsed.side === "white" || parsed.side === "black") {
        flow.nextMoveSide = parsed.side;
      }
    }
    const strategy = strategyRegistry[entry.type];
    if (!strategy) return;
    strategy(entry, variation, state, strategyRegistry, flow);
    if (entry.type === "move") {
      flow.nextMoveSide = flow.nextMoveSide === "white" ? "black" : "white";
    }
  });
  variation.trailingComments.forEach((comment) => addComment(state, comment));
};

const emitMove = (entry, variation, state, strategyRegistry, flow) => {
  const moveSide = flow?.nextMoveSide === "black" ? "black" : "white";
  const moveClass = variation.depth === 0
    ? `text-editor-main-move move-${moveSide}`
    : `text-editor-variation-move move-${moveSide}`;
  addInsertCommentControl(state, entry.id, "before");
  entry.commentsBefore.forEach((comment) => addComment(state, comment));
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
    entry.postItems.forEach((item) => {
      if (item.type === "comment" && item.comment) {
        addComment(state, item.comment);
        return;
      }
      if (item.type === "rav" && item.rav) {
        emitVariation(item.rav, state, strategyRegistry);
      }
    });
  } else {
    entry.commentsAfter.forEach((comment) => addComment(state, comment));
    entry.ravs.forEach((child) => emitVariation(child, state, strategyRegistry));
  }
  addInsertCommentControl(state, entry.id, "after");
};

const strategyRegistry = {
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
  return state.blocks;
};
