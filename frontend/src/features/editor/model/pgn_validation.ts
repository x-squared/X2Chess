/**
 * pgn_validation — strict PGN quality diagnostics for Developer Dock.
 *
 * Integration API:
 * - `validatePgnQuality(source)` — returns a structured report that classifies
 *   strict chess.js compatibility and captures stage-specific parse failures.
 *
 * Configuration API:
 * - No mutable configuration. The validator always runs three stages:
 *   raw source, normalized source, and normalized+stripped fallback.
 *
 * Communication API:
 * - Pure-logic module with no React/DOM usage.
 * - Uses `normalizeForChessJs` and `stripAnnotationsForBoardParser` to match
 *   the runtime parse bridge behavior.
 */

import { Chess } from "chess.js";
import { normalizeForChessJs } from "../../../../../parts/pgnparser/src/pgn_headers";
import { stripAnnotationsForBoardParser } from "../../../board/move_position";

export type PgnValidationPhase = "strict" | "normalized" | "stripped";

export type PgnValidationIssue = {
  phase: PgnValidationPhase;
  message: string;
  line: number | null;
  column: number | null;
};

export type PgnValidationStatus = "strict_ok" | "normalized_ok" | "stripped_ok" | "failed";

export type PgnValidationReport = {
  status: PgnValidationStatus;
  issues: PgnValidationIssue[];
};

export type PgnAutoFixReport = {
  fixedPgn: string;
  changed: boolean;
  changes: string[];
};

type ChessJsErrorLocation = {
  start?: {
    line?: number;
    column?: number;
  };
};

type ChessJsParseError = Error & {
  location?: ChessJsErrorLocation;
};

type ParseAttemptResult = {
  ok: boolean;
  issue: PgnValidationIssue | null;
};

const parseWithChessJs = (phase: PgnValidationPhase, source: string): ParseAttemptResult => {
  try {
    const parser: Chess = new Chess();
    parser.loadPgn(source);
    return { ok: true, issue: null };
  } catch (err: unknown) {
    const parseError: ChessJsParseError | null = err instanceof Error ? (err as ChessJsParseError) : null;
    const line: number | null = parseError?.location?.start?.line ?? null;
    const column: number | null = parseError?.location?.start?.column ?? null;
    const fallbackMessage: string = err instanceof Error ? err.message : "Unknown chess.js parse error";
    return {
      ok: false,
      issue: {
        phase,
        message: parseError?.message ?? fallbackMessage,
        line,
        column,
      },
    };
  }
};

/**
 * Validate PGN quality against strict chess.js parsing stages.
 *
 * Stage order:
 * 1. `strict` — raw source.
 * 2. `normalized` — source after `normalizeForChessJs`.
 * 3. `stripped` — source after annotation/RAV stripping plus normalization.
 *
 * @param source - Raw PGN source text from the editor.
 * @returns Structured status and parse issues for each failed stage.
 */
export const validatePgnQuality = (source: string): PgnValidationReport => {
  const strictAttempt: ParseAttemptResult = parseWithChessJs("strict", source);
  if (strictAttempt.ok) {
    return { status: "strict_ok", issues: [] };
  }

  const normalizedSource: string = normalizeForChessJs(source);
  const normalizedAttempt: ParseAttemptResult = parseWithChessJs("normalized", normalizedSource);
  if (normalizedAttempt.ok) {
    return {
      status: "normalized_ok",
      issues: strictAttempt.issue ? [strictAttempt.issue] : [],
    };
  }

  const strippedSource: string = normalizeForChessJs(stripAnnotationsForBoardParser(source));
  const strippedAttempt: ParseAttemptResult = parseWithChessJs("stripped", strippedSource);
  if (strippedAttempt.ok) {
    const issues: PgnValidationIssue[] = [];
    if (strictAttempt.issue) issues.push(strictAttempt.issue);
    if (normalizedAttempt.issue) issues.push(normalizedAttempt.issue);
    return { status: "stripped_ok", issues };
  }

  const issues: PgnValidationIssue[] = [];
  if (strictAttempt.issue) issues.push(strictAttempt.issue);
  if (normalizedAttempt.issue) issues.push(normalizedAttempt.issue);
  if (strippedAttempt.issue) issues.push(strippedAttempt.issue);
  return { status: "failed", issues };
};

const LEGACY_STYLE_HEADER = "X2Style";
const LEGACY_ORIENTATION_HEADER = "X2BoardOrientation";
const TRANSITIONAL_STYLE_HEADER = "XTwoChessStyle";
const TRANSITIONAL_ORIENTATION_HEADER = "XTwoChessBoardOrientation";
const CANONICAL_STYLE_HEADER = "XSqrChessStyle";
const CANONICAL_ORIENTATION_HEADER = "XSqrChessBoardOrientation";

const HEADER_LINE_RE = /^\[(\w+)\s+"([^"]*)"\]\s*$/;
const FEN_LINE_RE = /^\[FEN\s+"[^"]*"\]\s*$/i;

type HeaderSplit = {
  headerLines: string[];
  bodyLines: string[];
};

type HeaderNormalizationState = {
  hasFen: boolean;
  hasSetUp: boolean;
  hasCanonicalStyle: boolean;
  hasCanonicalOrientation: boolean;
};

const splitHeaderAndBody = (source: string): HeaderSplit => {
  const lines: string[] = source.split("\n");
  const headerLines: string[] = [];
  const bodyLines: string[] = [];
  let inHeaderBlock: boolean = true;
  for (const line of lines) {
    const trimmed: string = line.trim();
    const isHeaderLine: boolean = trimmed.startsWith("[");
    if (inHeaderBlock && (trimmed === "" || isHeaderLine)) {
      if (trimmed === "") {
        inHeaderBlock = false;
      } else {
        headerLines.push(line);
      }
      continue;
    }
    inHeaderBlock = false;
    bodyLines.push(line);
  }
  return { headerLines, bodyLines };
};

const applyLegacyHeaderRename = (
  key: string,
  value: string,
  state: HeaderNormalizationState,
  changes: string[],
): string | null => {
  if (key === LEGACY_STYLE_HEADER) {
    if (state.hasCanonicalStyle) {
      changes.push("Removed duplicate legacy X2Style header.");
      return null;
    }
    state.hasCanonicalStyle = true;
    changes.push("Renamed X2Style to XSqrChessStyle.");
    return `[${CANONICAL_STYLE_HEADER} "${value}"]`;
  }
  if (key === TRANSITIONAL_STYLE_HEADER) {
    if (state.hasCanonicalStyle) {
      changes.push("Removed duplicate transitional XTwoChessStyle header.");
      return null;
    }
    state.hasCanonicalStyle = true;
    changes.push("Renamed XTwoChessStyle to XSqrChessStyle.");
    return `[${CANONICAL_STYLE_HEADER} "${value}"]`;
  }
  if (key === LEGACY_ORIENTATION_HEADER) {
    if (state.hasCanonicalOrientation) {
      changes.push("Removed duplicate legacy X2BoardOrientation header.");
      return null;
    }
    state.hasCanonicalOrientation = true;
    changes.push("Renamed X2BoardOrientation to XSqrChessBoardOrientation.");
    return `[${CANONICAL_ORIENTATION_HEADER} "${value}"]`;
  }
  if (key === TRANSITIONAL_ORIENTATION_HEADER) {
    if (state.hasCanonicalOrientation) {
      changes.push("Removed duplicate transitional XTwoChessBoardOrientation header.");
      return null;
    }
    state.hasCanonicalOrientation = true;
    changes.push("Renamed XTwoChessBoardOrientation to XSqrChessBoardOrientation.");
    return `[${CANONICAL_ORIENTATION_HEADER} "${value}"]`;
  }
  return `[${key} "${value}"]`;
};

const normalizeHeaderLines = (headerLines: string[], changes: string[]): { lines: string[]; state: HeaderNormalizationState } => {
  const state: HeaderNormalizationState = {
    hasFen: false,
    hasSetUp: false,
    hasCanonicalStyle: false,
    hasCanonicalOrientation: false,
  };
  const normalizedHeaders: string[] = [];
  for (const line of headerLines) {
    const match: RegExpExecArray | null = HEADER_LINE_RE.exec(line.trim());
    if (!match) {
      normalizedHeaders.push(line);
      continue;
    }
    const key: string = match[1];
    const value: string = match[2];
    if (key === "FEN") state.hasFen = true;
    if (key === "SetUp") state.hasSetUp = true;
    if (key === CANONICAL_STYLE_HEADER) state.hasCanonicalStyle = true;
    if (key === CANONICAL_ORIENTATION_HEADER) state.hasCanonicalOrientation = true;
    const rewritten: string | null = applyLegacyHeaderRename(key, value, state, changes);
    if (rewritten) normalizedHeaders.push(rewritten);
  }
  return { lines: normalizedHeaders, state };
};

const injectSetupIfNeeded = (
  headerLines: string[],
  state: HeaderNormalizationState,
  changes: string[],
): string[] => {
  if (!state.hasFen || state.hasSetUp) return headerLines;
  const out: string[] = [];
  let inserted: boolean = false;
  for (const line of headerLines) {
    if (!inserted && FEN_LINE_RE.test(line.trim())) {
      out.push('[SetUp "1"]');
      inserted = true;
    }
    out.push(line);
  }
  changes.push('Inserted [SetUp "1"] for FEN game.');
  return out;
};

/**
 * Apply safe compatibility fixes to PGN header lines.
 *
 * Current repairs:
 * - Renames legacy X2 headers to canonical letter-only keys.
 * - Removes duplicate legacy/canonical pairs (keeps canonical).
 * - Injects `[SetUp "1"]` before `[FEN "..."]` when FEN exists and SetUp is missing.
 *
 * @param source - Raw PGN source.
 * @returns Fixed PGN text and a list of applied changes.
 */
export const autoFixPgnCompatibility = (source: string): PgnAutoFixReport => {
  const { headerLines, bodyLines }: HeaderSplit = splitHeaderAndBody(source);
  const changes: string[] = [];
  const normalized: { lines: string[]; state: HeaderNormalizationState } = normalizeHeaderLines(
    headerLines,
    changes,
  );
  const withSetUp: string[] = injectSetupIfNeeded(normalized.lines, normalized.state, changes);

  const headerBlock: string = withSetUp.join("\n");
  const bodyBlock: string = bodyLines.join("\n");
  const fixedPgn: string = bodyBlock.length > 0 ? `${headerBlock}\n\n${bodyBlock}` : headerBlock;
  return {
    fixedPgn,
    changed: fixedPgn !== source,
    changes,
  };
};
