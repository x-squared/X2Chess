/**
 * Text editor render planning.
 *
 * Intent:
 * - Convert PGN model structure into normalized editor render blocks/tokens.
 * - Preserve move/comment/variation semantics and inline formatting hints.
 *
 * Integration API:
 * - `buildTextEditorPlan(pgnModel, { layoutMode })` returns render blocks consumed by reconcile layer.
 * - `layoutMode`: `plain` (literal comment text), `text` or `tree` (first comment intro styling without `\intro` in source).
 */

const NEWLINE_PATTERN: RegExp = /(?:\[\[br\]\]|<br\s*\/?>|\\n|\n)/gi;

type LayoutMode = "plain" | "text" | "tree";

type TokenDataset = Record<string, string | number | boolean>;

type InlineToken = {
  key: string;
  kind: "inline";
  text: string;
  className: string;
  tokenType: string;
  dataset: TokenDataset;
};

type CommentToken = {
  key: string;
  kind: "comment";
  tokenType: "comment";
  commentId: string;
  rawText: string;
  hasIndentDirective: boolean;
  indentDirectiveDepth: number;
  introStyling: boolean;
  plainLiteralComment: boolean;
  focusFirstCommentAtStart: boolean;
  text: string;
};

type PlanToken = InlineToken | CommentToken;

type PlanBlock = {
  key: string;
  indentDepth: number;
  tokens: PlanToken[];
};

type PlanState = {
  blocks: PlanBlock[];
  blockIndex: number;
  tokenIndex: number;
  indentDepth: number;
  firstCommentId: string | null;
  layoutMode: LayoutMode;
};

type PgnComment = {
  type: "comment";
  id: string;
  raw: string;
};

type PgnPostItem =
  | { type: "comment"; comment?: PgnComment }
  | { type: "rav"; rav?: PgnVariation };

type PgnMove = {
  type: "move";
  id: string;
  san: string;
  nags: string[];
  commentsBefore: PgnComment[];
  commentsAfter: PgnComment[];
  ravs: PgnVariation[];
  postItems?: PgnPostItem[];
};

type PgnMoveNumber = {
  type: "move_number";
  id?: string;
  text: string;
};

type PgnResult = {
  type: "result";
  id?: string;
  text: string;
};

type PgnNag = {
  type: "nag";
  id?: string;
  text: string;
};

type PgnVariation = {
  type: "variation";
  depth: number;
  entries: PgnEntry[];
  trailingComments: PgnComment[];
};

type PgnEntry = PgnComment | PgnMove | PgnMoveNumber | PgnResult | PgnNag | PgnVariation;

type PgnModel = {
  root?: PgnVariation;
};

type MoveNumberInfo = {
  displayText: string;
  side: "white" | "black" | "raw";
  simplified: boolean;
};

type VariationFlow = {
  nextMoveSide: "white" | "black";
  hoistedBeforeCommentMoveIds: Set<string>;
};

type StrategyFn = (
  entry: PgnEntry,
  variation: PgnVariation,
  state: PlanState,
  strategyRegistry: StrategyRegistry,
  flow: VariationFlow,
) => void;

type StrategyRegistry = {
  comment: StrategyFn;
  move_number: StrategyFn;
  result: StrategyFn;
  nag: StrategyFn;
  move: StrategyFn;
};

const createBlock = (index: number, indentDepth: number = 0): PlanBlock => ({
  key: `block_${index}`,
  indentDepth,
  tokens: [],
});

const createPlanState = (layoutMode: LayoutMode = "text"): PlanState => ({
  blocks: [createBlock(0, 0)],
  blockIndex: 0,
  tokenIndex: 0,
  indentDepth: 0,
  firstCommentId: null,
  layoutMode,
});

const currentBlock = (state: PlanState): PlanBlock => state.blocks[state.blocks.length - 1];

const nextBlock = (state: PlanState): void => {
  state.blockIndex += 1;
  state.blocks.push(createBlock(state.blockIndex, state.indentDepth));
};

const normalizeAtBlockStart = (block: PlanBlock, text: string): string => (block.tokens.length === 0 ? text.replace(/^\s+/, "") : text);

const addInlineToken = (
  state: PlanState,
  text: unknown,
  className: string,
  tokenType: string,
  dataset: TokenDataset = {},
): void => {
  if (text === null || text === undefined) return;
  const block: PlanBlock = currentBlock(state);
  const normalized: string = normalizeAtBlockStart(block, String(text));
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

const addSpace = (state: PlanState): void => {
  const block: PlanBlock = currentBlock(state);
  block.tokens.push({
    key: `token_${state.tokenIndex++}`,
    kind: "inline",
    text: "",
    className: "text-editor-space",
    tokenType: "space",
    dataset: {},
  });
};

const splitByBreakHints = (text: unknown): Array<{ text: string; hasBreakAfter: boolean }> => {
  const source: string = String(text ?? "");
  NEWLINE_PATTERN.lastIndex = 0;
  const chunks: Array<{ text: string; hasBreakAfter: boolean }> = [];
  let last: number = 0;
  let match: RegExpExecArray | null = NEWLINE_PATTERN.exec(source);
  while (match) {
    chunks.push({ text: source.slice(last, match.index), hasBreakAfter: true });
    last = match.index + match[0].length;
    match = NEWLINE_PATTERN.exec(source);
  }
  chunks.push({ text: source.slice(last), hasBreakAfter: false });
  return chunks;
};

const addTextWithBreaks = (
  state: PlanState,
  text: unknown,
  className: string,
  tokenType: string,
  dataset: TokenDataset = {},
): void => {
  const chunks: Array<{ text: string; hasBreakAfter: boolean }> = splitByBreakHints(text);
  chunks.forEach((chunk: { text: string; hasBreakAfter: boolean }): void => {
    if (chunk.text) addInlineToken(state, chunk.text, className, tokenType, dataset);
    if (chunk.hasBreakAfter) nextBlock(state);
  });
};

const parseMoveNumberToken = (raw: unknown): MoveNumberInfo => {
  const text: string = String(raw ?? "");
  const white: RegExpMatchArray | null = text.match(/^(\d+)\.$/);
  if (white) return { displayText: white[1], side: "white", simplified: true };
  const black: RegExpMatchArray | null = text.match(/^(\d+)\.\.\.?$/);
  if (black) return { displayText: black[1], side: "black", simplified: true };
  return { displayText: text, side: "raw", simplified: false };
};

const addCommentToken = (
  state: PlanState,
  comment: PgnComment,
  text: string,
  rawText: string,
  hasIndentDirective: boolean = false,
  indentDirectiveDepth: number = 0,
  introStyling: boolean = false,
  plainLiteralComment: boolean = false,
  focusFirstCommentAtStart: boolean = false,
): void => {
  const block: PlanBlock = currentBlock(state);
  block.tokens.push({
    key: `token_${state.tokenIndex++}`,
    kind: "comment",
    tokenType: "comment",
    commentId: comment.id,
    rawText,
    hasIndentDirective,
    indentDirectiveDepth,
    introStyling,
    plainLiteralComment,
    focusFirstCommentAtStart,
    text,
  });
};

const INDENT_BLOCK_DIRECTIVE_PREFIX: RegExp = /^\s*(?:\i(?:\s+|$))+/;
const INTRO_DIRECTIVE_PREFIX: RegExp = /^\s*\intro(?:\s+|$)/i;

const getIndentDirectiveDepth = (comment: PgnComment): number => {
  const raw: string = String(comment?.raw ?? "");
  const match: RegExpMatchArray | null = raw.match(INDENT_BLOCK_DIRECTIVE_PREFIX);
  if (!match) return 0;
  const tokens: RegExpMatchArray | null = match[0].match(/\i/g);
  return tokens ? tokens.length : 0;
};

const hasIndentBlockDirective = (comment: PgnComment): boolean => getIndentDirectiveDepth(comment) > 0;
const hasIntroDirective = (comment: PgnComment): boolean => INTRO_DIRECTIVE_PREFIX.test(String(comment?.raw ?? ""));
const stripIntroDirective = (rawText: string): string => String(rawText ?? "")
  .replace(INTRO_DIRECTIVE_PREFIX, "")
  .replace(/^\s+/, "");
const stripIndentDirectives = (rawText: string): string => String(rawText ?? "")
  .replace(INDENT_BLOCK_DIRECTIVE_PREFIX, "")
  .replace(/^\s+/, "");

const addComment = (state: PlanState, comment: PgnComment): void => {
  const layoutMode: LayoutMode = state.layoutMode || "text";
  const rawText: string = String(comment.raw ?? "");
  const isFirstComment: boolean = !state.firstCommentId;
  if (isFirstComment) state.firstCommentId = comment.id;
  const isPlain: boolean = layoutMode === "plain";
  const isStructured: boolean = layoutMode === "text" || layoutMode === "tree";

  if (isPlain) {
    addCommentToken(
      state,
      comment,
      rawText,
      rawText,
      false,
      0,
      false,
      true,
      false,
    );
    addSpace(state);
    return;
  }

  const hadIntroDirective: boolean = hasIntroDirective(comment);
  const withoutIntro: string = hadIntroDirective ? stripIntroDirective(rawText) : rawText;
  const indentDirectiveDepth: number = getIndentDirectiveDepth(comment);
  const hasIndentDirective: boolean = indentDirectiveDepth > 0;
  const visibleText: string = hasIndentDirective ? stripIndentDirectives(withoutIntro) : withoutIntro;
  const introStyling: boolean = isStructured && isFirstComment;
  const focusFirstCommentAtStart: boolean = isStructured && isFirstComment;
  addCommentToken(
    state,
    comment,
    visibleText,
    rawText,
    hasIndentDirective,
    indentDirectiveDepth,
    introStyling,
    false,
    focusFirstCommentAtStart,
  );
  addSpace(state);
};

const emitIndentedBlock = (state: PlanState, levels: number, emitContent: () => void): void => {
  const previousDepth: number = state.indentDepth;
  state.indentDepth = previousDepth + Math.max(1, Number(levels) || 1);
  nextBlock(state);
  emitContent();
  state.indentDepth = previousDepth;
  nextBlock(state);
};

const emitVariation = (variation: PgnVariation, state: PlanState, strategyRegistry: StrategyRegistry): void => {
  const flow: VariationFlow = {
    nextMoveSide: "white",
    hoistedBeforeCommentMoveIds: new Set<string>(),
  };
  for (let idx: number = 0; idx < variation.entries.length; idx += 1) {
    const entry: PgnEntry = variation.entries[idx];
    if (entry.type === "variation") {
      emitVariation(entry, state, strategyRegistry);
      continue;
    }
    const nextEntry: PgnEntry | undefined = variation.entries[idx + 1];
    if (entry.type === "comment" && nextEntry?.type === "variation" && hasIndentBlockDirective(entry)) {
      emitIndentedBlock(state, getIndentDirectiveDepth(entry), (): void => {
        addComment(state, entry);
        emitVariation(nextEntry, state, strategyRegistry);
      });
      idx += 1;
      continue;
    }
    if (entry.type === "move_number") {
      const lookahead: PgnEntry | undefined = variation.entries[idx + 1];
      if (lookahead?.type === "move" && Array.isArray(lookahead.commentsBefore) && lookahead.commentsBefore.length > 0) {
        lookahead.commentsBefore.forEach((comment: PgnComment): void => addComment(state, comment));
        flow.hoistedBeforeCommentMoveIds.add(lookahead.id);
      }
      const parsedForFlow: MoveNumberInfo = parseMoveNumberToken(entry.text);
      if (parsedForFlow.side === "white" || parsedForFlow.side === "black") {
        flow.nextMoveSide = parsedForFlow.side;
      }
    }
    const strategy: StrategyFn | undefined = strategyRegistry[entry.type as keyof StrategyRegistry];
    if (!strategy) continue;
    strategy(entry, variation, state, strategyRegistry, flow);
    if (entry.type === "move") {
      flow.nextMoveSide = flow.nextMoveSide === "white" ? "black" : "white";
    }
  }
  variation.trailingComments.forEach((comment: PgnComment): void => addComment(state, comment));
};

const emitMove: StrategyFn = (entry, variation, state, strategyRegistry, flow): void => {
  if (entry.type !== "move") return;
  const moveSide: "white" | "black" = flow.nextMoveSide === "black" ? "black" : "white";
  const moveClass: string = variation.depth === 0
    ? `text-editor-main-move move-${moveSide}`
    : `text-editor-variation-move move-${moveSide}`;
  if (!flow.hoistedBeforeCommentMoveIds.has(entry.id)) {
    entry.commentsBefore.forEach((comment: PgnComment): void => addComment(state, comment));
  }
  addTextWithBreaks(
    state,
    entry.san,
    moveClass,
    "move",
    { nodeId: entry.id, variationDepth: variation.depth, moveSide },
  );
  addSpace(state);
  entry.nags.forEach((nag: string): void => {
    addTextWithBreaks(state, nag, "text-editor-nag", "nag", { moveId: entry.id });
    addSpace(state);
  });

  if (Array.isArray(entry.postItems) && entry.postItems.length > 0) {
    for (let idx: number = 0; idx < entry.postItems.length; idx += 1) {
      const item: PgnPostItem = entry.postItems[idx];
      if (item.type === "comment" && item.comment) {
        const nextItem: PgnPostItem | undefined = entry.postItems[idx + 1];
        if (nextItem?.type === "rav" && nextItem.rav && hasIndentBlockDirective(item.comment)) {
          emitIndentedBlock(state, getIndentDirectiveDepth(item.comment), (): void => {
            addComment(state, item.comment!);
            emitVariation(nextItem.rav!, state, strategyRegistry);
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
    entry.commentsAfter.forEach((comment: PgnComment): void => addComment(state, comment));
    entry.ravs.forEach((child: PgnVariation): void => emitVariation(child, state, strategyRegistry));
  }
};

const strategyRegistry: StrategyRegistry = {
  comment: (entry: PgnEntry, _variation: PgnVariation, state: PlanState): void => {
    if (entry.type !== "comment") return;
    addComment(state, entry);
  },
  move_number: (entry: PgnEntry, variation: PgnVariation, state: PlanState): void => {
    if (entry.type !== "move_number") return;
    const parsed: MoveNumberInfo = parseMoveNumberToken(entry.text);
    addTextWithBreaks(
      state,
      parsed.displayText,
      `${variation.depth === 0 ? "text-editor-main-move" : "text-editor-variation-move-number"} text-editor-move-number-token move-number`,
      "move_number",
      { nodeId: entry.id || "", variationDepth: variation.depth, moveNumberSide: parsed.side },
    );
    if (!parsed.simplified) addSpace(state);
  },
  result: (entry: PgnEntry, _variation: PgnVariation, state: PlanState): void => {
    if (entry.type !== "result") return;
    addTextWithBreaks(state, entry.text, "text-editor-result", "result", { nodeId: entry.id || "" });
    addSpace(state);
  },
  nag: (entry: PgnEntry, _variation: PgnVariation, state: PlanState): void => {
    if (entry.type !== "nag") return;
    addTextWithBreaks(state, entry.text, "text-editor-nag", "nag", { nodeId: entry.id || "" });
    addSpace(state);
  },
  move: emitMove,
};

export const buildTextEditorPlan = (
  pgnModel: unknown,
  options: { layoutMode?: LayoutMode } = {},
): PlanBlock[] => {
  const layoutMode: LayoutMode = options.layoutMode === "plain" || options.layoutMode === "text" || options.layoutMode === "tree"
    ? options.layoutMode
    : "plain";
  const state: PlanState = createPlanState(layoutMode);
  const model: PgnModel | null = (pgnModel as PgnModel | null) ?? null;
  if (!model || !model.root) return state.blocks;
  emitVariation(model.root, state, strategyRegistry);
  const firstNonEmpty: number = state.blocks.findIndex((block: PlanBlock): boolean => block.tokens.length > 0);
  if (firstNonEmpty === -1) return [createBlock(0, 0)];
  let lastNonEmpty: number = 0;
  for (let i: number = state.blocks.length - 1; i >= 0; i -= 1) {
    if (state.blocks[i].tokens.length > 0) {
      lastNonEmpty = i;
      break;
    }
  }
  return state.blocks.slice(firstNonEmpty, lastNonEmpty + 1);
};
