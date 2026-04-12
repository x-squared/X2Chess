/**
 * Shared types and infrastructure for the PGN editor render plan.
 *
 * Integration API:
 * - `buildVariationWalker(emitComment)` — creates a variation traversal engine
 *   parameterised by a mode-specific comment emitter; used by `plain_mode` and `text_mode`.
 * - All exported types are consumed by the three mode builders and `index.ts`.
 */

// ── Patterns ──────────────────────────────────────────────────────────────────

import { nagGlyph } from "../../../../parts/pgnparser/src/nag_defs";

/** Matches any break marker variant (canonical + legacy aliases). */
const NEWLINE_PATTERN: RegExp = /(?:\[\[br\]\]|<br\s*\/?>|\\n|\n)/gi;

/** Matches all indent directives (`[[indent]]` and legacy `\i`). */
const INDENT_DIRECTIVE_GLOBAL: RegExp = /\[\[indent\]\]|\\i/gi;
/** Matches all deindent directives (`[[deindent]]` and legacy `\o`). */
const DEINDENT_DIRECTIVE_GLOBAL: RegExp = /\[\[deindent\]\]|\\o/gi;
/** Matches all indent-state directives for visible-text stripping. */
const INDENT_STATE_DIRECTIVE_GLOBAL: RegExp = /\[\[indent\]\]|\[\[deindent\]\]|\\i|\\o/gi;

// ── Public types ──────────────────────────────────────────────────────────────

export type LayoutMode = "plain" | "text" | "tree";

export type TokenDataset = Record<string, string | number | boolean>;

export type InlineToken = {
  key: string;
  kind: "inline";
  text: string;
  className: string;
  /**
   * Recognised tokenTypes: "move", "move_number", "nag", "result", "space", "branch_header".
   * `branch_header` is emitted only in tree mode as the first token of each non-mainline block.
   */
  tokenType: string;
  dataset: TokenDataset;
};

export type CommentToken = {
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
  variationDepth: number;
  text: string;
};

export type PlanToken = InlineToken | CommentToken;

export type PlanBlock = {
  key: string;
  indentDepth: number;
  tokens: PlanToken[];
  /** Set in tree mode only. Path from root: `[0]` = mainline, `[0, 1]` = second RAV. */
  variationPath?: readonly number[];
  /** True for non-mainline blocks in tree mode (may be collapsed). */
  isCollapsible?: boolean;
  /** True for the root mainline block in tree mode. */
  isMainLine?: boolean;
};

// ── Internal PGN model types ──────────────────────────────────────────────────

export type PgnComment = {
  type: "comment";
  id: string;
  raw: string;
};

export type PgnPostItem =
  | { type: "comment"; comment?: PgnComment }
  | { type: "rav"; rav?: PgnVariation };

export type PgnMove = {
  type: "move";
  id: string;
  san: string;
  nags: string[];
  commentsBefore: PgnComment[];
  commentsAfter: PgnComment[];
  ravs: PgnVariation[];
  postItems?: PgnPostItem[];
};

export type PgnMoveNumber = {
  type: "move_number";
  id?: string;
  text: string;
};

export type PgnResult = {
  type: "result";
  id?: string;
  text: string;
};

export type PgnNag = {
  type: "nag";
  id?: string;
  text: string;
};

export type PgnVariation = {
  type: "variation";
  depth: number;
  entries: PgnEntry[];
  trailingComments: PgnComment[];
};

export type PgnEntry = PgnComment | PgnMove | PgnMoveNumber | PgnResult | PgnNag | PgnVariation;

export type PgnModel = {
  root?: PgnVariation;
};

// ── Internal state types ──────────────────────────────────────────────────────

export type PlanState = {
  blocks: PlanBlock[];
  blockIndex: number;
  tokenIndex: number;
  indentDepth: number;
  firstCommentId: string | null;
  /** True once the first move token has been emitted; used to gate intro styling. */
  firstMoveEmitted: boolean;
  layoutMode: LayoutMode;
  commentLineBreakPolicy: "always" | "mainline_only";
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

// ── Block / token helpers ─────────────────────────────────────────────────────

export const createBlock = (index: number, indentDepth: number = 0): PlanBlock => ({
  key: `block_${index}`,
  indentDepth,
  tokens: [],
});

export const createPlanState = (
  layoutMode: LayoutMode = "text",
  commentLineBreakPolicy: "always" | "mainline_only" = "mainline_only",
): PlanState => ({
  blocks: [createBlock(0, 0)],
  blockIndex: 0,
  tokenIndex: 0,
  indentDepth: 0,
  firstCommentId: null,
  firstMoveEmitted: false,
  layoutMode,
  commentLineBreakPolicy,
});

export const currentBlock = (state: PlanState): PlanBlock => state.blocks[state.blocks.length - 1];

export const nextBlock = (state: PlanState): void => {
  state.blockIndex += 1;
  state.blocks.push(createBlock(state.blockIndex, state.indentDepth));
};

const normalizeAtBlockStart = (block: PlanBlock, text: string): string =>
  block.tokens.length === 0 ? text.replace(/^\s+/, "") : text;

export const addInlineToken = (
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

export const addSpace = (state: PlanState): void => {
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

export const addTextWithBreaks = (
  state: PlanState,
  text: unknown,
  className: string,
  tokenType: string,
  dataset: TokenDataset = {},
): void => {
  const chunks = splitByBreakHints(text);
  chunks.forEach((chunk): void => {
    if (chunk.text) addInlineToken(state, chunk.text, className, tokenType, dataset);
    if (chunk.hasBreakAfter) nextBlock(state);
  });
};

export const parseMoveNumberToken = (raw: unknown): MoveNumberInfo => {
  const text: string = String(raw ?? "");
  const white: RegExpMatchArray | null = text.match(/^(\d+)\.$/);
  if (white) return { displayText: white[1], side: "white", simplified: true };
  const black: RegExpMatchArray | null =
    text.match(/^(\d+)\.{3,}$/) ?? text.match(/^(\d+)…$/);
  if (black) return { displayText: black[1], side: "black", simplified: true };
  return { displayText: text, side: "raw", simplified: false };
};

/**
 * Suppress redundant black move-number tokens when they directly follow a move
 * in the same block (e.g. render `4.Kg5 Nc4` instead of `4.Kg5 4...Nc4`).
 */
export const shouldSuppressMoveNumberToken = (
  state: PlanState,
  parsed: MoveNumberInfo,
): boolean => {
  if (parsed.side !== "black") return false;
  const tokens: PlanToken[] = currentBlock(state).tokens;
  for (let idx: number = tokens.length - 1; idx >= 0; idx -= 1) {
    const token: PlanToken = tokens[idx];
    if (token.kind === "inline" && token.tokenType === "space") continue;
    return token.kind === "inline" && token.tokenType === "move";
  }
  return false;
};

export const addCommentToken = (
  state: PlanState,
  comment: PgnComment,
  text: string,
  rawText: string,
  hasIndentDirective: boolean = false,
  indentDirectiveDepth: number = 0,
  introStyling: boolean = false,
  plainLiteralComment: boolean = false,
  focusFirstCommentAtStart: boolean = false,
  variationDepth: number = 0,
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
    variationDepth,
    text,
  });
};

// ── Indent directive helpers ──────────────────────────────────────────────────

export const getIndentDirectiveDepth = (comment: PgnComment): number => {
  const raw: string = String(comment?.raw ?? "");
  const tokens: RegExpMatchArray | null = raw.match(INDENT_DIRECTIVE_GLOBAL);
  return tokens ? tokens.length : 0;
};

export const getDeindentDirectiveDepth = (comment: PgnComment): number => {
  const raw: string = String(comment?.raw ?? "");
  const tokens: RegExpMatchArray | null = raw.match(DEINDENT_DIRECTIVE_GLOBAL);
  return tokens ? tokens.length : 0;
};

export const getIndentDelta = (comment: PgnComment): number =>
  getIndentDirectiveDepth(comment) - getDeindentDirectiveDepth(comment);

export const hasIndentBlockDirective = (comment: PgnComment): boolean =>
  getIndentDirectiveDepth(comment) > 0;

export const stripIndentDirectives = (rawText: string): string =>
  String(rawText ?? "")
    .replace(INDENT_STATE_DIRECTIVE_GLOBAL, "")
    .replace(/^\s+/, "");

export type RichCommentView = {
  hasIndentDirective: boolean;
  indentDirectiveDepth: number;
  indentDelta: number;
  visibleText: string;
};

/**
 * Build the visible comment payload for rich editor modes (text + tree).
 *
 * - Leading `[[indent]]` markers are removed from visible text but retained in raw text.
 * - `[[br]]` markers are rendered as line breaks in the editor view.
 */
export const buildRichCommentView = (comment: PgnComment, rawText: string): RichCommentView => {
  const indentDelta: number = getIndentDelta(comment);
  const indentDirectiveDepth: number = getIndentDirectiveDepth(comment);
  const hasIndentDirective: boolean = indentDelta !== 0;
  const strippedText: string = hasIndentDirective ? stripIndentDirectives(rawText) : rawText;
  const visibleText: string = strippedText.replace(/\[\[br\]\]/gi, "\n");
  return { hasIndentDirective, indentDirectiveDepth, indentDelta, visibleText };
};

/** Apply persistent indent-state delta for all subsequent content. */
export const applyPersistentIndentDelta = (state: PlanState, delta: number): void => {
  if (!Number.isFinite(delta) || delta === 0) return;
  const nextDepth: number = Math.max(0, state.indentDepth + delta);
  if (nextDepth === state.indentDepth) return;
  state.indentDepth = nextDepth;
  const block: PlanBlock = currentBlock(state);
  if (block.tokens.length === 0) {
    block.indentDepth = state.indentDepth;
  }
};

export const emitIndentedBlock = (state: PlanState, levels: number, emitContent: () => void): void => {
  const previousDepth: number = state.indentDepth;
  state.indentDepth = previousDepth + Math.max(1, Number(levels) || 1);
  nextBlock(state);
  emitContent();
  state.indentDepth = previousDepth;
  nextBlock(state);
};

// ── Variation walker factory ──────────────────────────────────────────────────

/**
 * A mode-specific comment rendering function.
 * Called with the current state, the PGN comment node, its raw text, and whether
 * intro styling should apply (first comment before the first move).
 */
export type CommentEmitter = (
  state: PlanState,
  comment: PgnComment,
  rawText: string,
  applyIntroStyling: boolean,
  variationDepth: number,
) => void;

/**
 * Creates a variation traversal engine bound to a mode-specific comment emitter.
 *
 * Returns `emitVariation` and a matching `strategyRegistry`; both share a
 * single `internalAddComment` closure that tracks intro-styling state and
 * delegates rendering to the injected `emitComment`.
 *
 * Used by `plain_mode` and `text_mode`.  Tree mode has its own traversal.
 */
export const buildVariationWalker = (
  emitComment: CommentEmitter,
): {
  emitVariation: (variation: PgnVariation, state: PlanState, registry: StrategyRegistry) => void;
  strategyRegistry: StrategyRegistry;
} => {
  const internalAddComment = (state: PlanState, comment: PgnComment, variationDepth: number): void => {
    const rawText: string = String(comment.raw ?? "");
    const isFirstComment: boolean = !state.firstCommentId;
    if (isFirstComment) state.firstCommentId = comment.id;
    const applyIntroStyling: boolean = isFirstComment && !state.firstMoveEmitted;
    emitComment(state, comment, rawText, applyIntroStyling, variationDepth);
  };

  // Forward declaration — `emitMove` and `emitVariation` are mutually recursive.
  // Both are fully assigned before any caller can invoke them.
  // eslint-disable-next-line prefer-const
  let emitVariation!: (variation: PgnVariation, state: PlanState, registry: StrategyRegistry) => void;

  const emitMove: StrategyFn = (entry, variation, state, registry, flow): void => {
    if (entry.type !== "move") return;
    const moveSide: "white" | "black" = flow.nextMoveSide === "black" ? "black" : "white";
    const moveClass: string = variation.depth === 0
      ? `text-editor-main-move move-${moveSide}`
      : `text-editor-variation-move move-${moveSide}`;
    if (!flow.hoistedBeforeCommentMoveIds.has(entry.id)) {
      entry.commentsBefore.forEach((c: PgnComment): void => internalAddComment(state, c, variation.depth));
    }
    addTextWithBreaks(state, entry.san, moveClass, "move", {
      nodeId: entry.id,
      variationDepth: variation.depth,
      moveSide,
    });
    state.firstMoveEmitted = true;
    addSpace(state);
    entry.nags.forEach((nag: string): void => {
      addTextWithBreaks(state, nagGlyph(nag), "text-editor-nag", "nag", { moveId: entry.id });
      addSpace(state);
    });

    if (Array.isArray(entry.postItems) && entry.postItems.length > 0) {
      for (let idx: number = 0; idx < entry.postItems.length; idx += 1) {
        const item: PgnPostItem = entry.postItems[idx];
        if (item.type === "comment" && item.comment) {
          internalAddComment(state, item.comment, variation.depth);
          continue;
        }
        if (item.type === "rav" && item.rav) {
          emitVariation(item.rav, state, registry);
        }
      }
    } else {
      entry.commentsAfter.forEach((c: PgnComment): void => internalAddComment(state, c, variation.depth));
      entry.ravs.forEach((child: PgnVariation): void => emitVariation(child, state, registry));
    }
  };

  emitVariation = (variation: PgnVariation, state: PlanState, registry: StrategyRegistry): void => {
    const flow: VariationFlow = {
      nextMoveSide: "white",
      hoistedBeforeCommentMoveIds: new Set<string>(),
    };
    for (let idx: number = 0; idx < variation.entries.length; idx += 1) {
      const entry: PgnEntry = variation.entries[idx];
      if (entry.type === "variation") {
        emitVariation(entry, state, registry);
        continue;
      }
      const nextEntry: PgnEntry | undefined = variation.entries[idx + 1];
      if (entry.type === "move_number") {
        const lookahead: PgnEntry | undefined = variation.entries[idx + 1];
        if (
          lookahead?.type === "move" &&
          Array.isArray(lookahead.commentsBefore) &&
          lookahead.commentsBefore.length > 0
        ) {
          lookahead.commentsBefore.forEach((c: PgnComment): void => internalAddComment(state, c, variation.depth));
          flow.hoistedBeforeCommentMoveIds.add(lookahead.id);
        }
        const parsedForFlow = parseMoveNumberToken(entry.text);
        if (parsedForFlow.side === "white" || parsedForFlow.side === "black") {
          flow.nextMoveSide = parsedForFlow.side;
        }
      }
      const strategy: StrategyFn | undefined = registry[entry.type as keyof StrategyRegistry];
      if (!strategy) continue;
      strategy(entry, variation, state, registry, flow);
      if (entry.type === "move") {
        flow.nextMoveSide = flow.nextMoveSide === "white" ? "black" : "white";
      }
    }
    variation.trailingComments.forEach((c: PgnComment): void => internalAddComment(state, c, variation.depth));
  };

  const strategyRegistry: StrategyRegistry = {
    comment: (entry: PgnEntry, _variation: PgnVariation, state: PlanState): void => {
      if (entry.type !== "comment") return;
      internalAddComment(state, entry, _variation.depth);
    },
    move_number: (entry: PgnEntry, variation: PgnVariation, state: PlanState): void => {
      if (entry.type !== "move_number") return;
      const parsed = parseMoveNumberToken(entry.text);
      if (shouldSuppressMoveNumberToken(state, parsed)) return;
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
      addTextWithBreaks(state, nagGlyph(entry.text), "text-editor-nag", "nag", { nodeId: entry.id || "" });
      addSpace(state);
    },
    move: emitMove,
  };

  return { emitVariation, strategyRegistry };
};
