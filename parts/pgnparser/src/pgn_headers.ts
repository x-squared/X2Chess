/**
 * Pgn Headers module.
 *
 * Integration API:
 * - Primary exports from this module: `REQUIRED_PGN_TAG_DEFAULTS`, `X2_STYLE_HEADER_KEY`, `normalizeX2StyleValue`, `getHeaderValue`, `getX2StyleFromModel`, `setHeaderValue`, `ensureRequiredPgnHeaders`, `normalizeForChessJs`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through typed return values and callbacks; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

export type X2StyleValue = "plain" | "text" | "tree";

type PgnHeader = {
  key: string;
  value: string;
};

type PgnModel = {
  headers?: PgnHeader[];
} & Record<string, unknown>;

const cloneModel = <TValue>(model: TValue): TValue => JSON.parse(JSON.stringify(model)) as TValue;

/**
 * Required Seven Tag Roster defaults used when missing in a PGN.
 */
export const REQUIRED_PGN_TAG_DEFAULTS: Record<string, string> = {
  Event: "?",
  Site: "?",
  Round: "?",
  Date: "??.??.????",
  White: "?",
  Black: "?",
  Result: "*",
};

/**
 * Custom tag: editor layout mode for this game (not standard PGN Seven Tag Roster).
 * Values: `plain` | `text` | `tree`. If the tag is missing, treat as `plain`.
 */
export const X2_STYLE_HEADER_KEY = "X2Style";

/**
 * Custom tag: board orientation override for default-position and Chess960 games.
 * Values: `"white"` (white at bottom, default) | `"black"` (black at bottom).
 * Ignored for games that start from a custom position — those always show the
 * side to move first at the bottom.
 */
export const X2_BOARD_ORIENTATION_HEADER_KEY = "X2BoardOrientation";

const X2_STYLE_VALUES: ReadonlySet<string> = new Set<string>(["plain", "text", "tree"]);

/**
 * Normalize a raw header value to a valid X2Style.
 *
 * @param {unknown} raw - Raw header string or unknown.
 * @returns {"plain"|"text"|"tree"} Normalized style; invalid/missing -> `plain`.
 */
export const normalizeX2StyleValue = (raw: unknown): X2StyleValue => {
  const s: string = String(raw ?? "").trim().toLowerCase();
  return X2_STYLE_VALUES.has(s) ? (s as X2StyleValue) : "plain";
};

/**
 * Read a PGN header value by key.
 *
 * @param {object} model - PGN model.
 * @param {string} key - PGN header key, for example `Event`.
 * @param {string} [fallback=""] - Value returned when key is missing.
 * @returns {string} Header value or fallback.
 */
export const getHeaderValue = (model: unknown, key: string, fallback: string = ""): string => {
  const typedModel: PgnModel = (model as PgnModel | null) ?? {};
  const header: PgnHeader | undefined = typedModel.headers?.find((candidate: PgnHeader): boolean => candidate?.key === key);
  return String(header?.value ?? fallback);
};

/**
 * Read X2Style from the PGN model headers.
 *
 * @param {object} model - PGN model.
 * @returns {"plain"|"text"|"tree"} Style; missing/invalid header -> `plain`.
 */
export const getX2StyleFromModel = (model: unknown): X2StyleValue => {
  const raw: string = getHeaderValue(model, X2_STYLE_HEADER_KEY, "");
  return normalizeX2StyleValue(raw);
};

/**
 * Set (or remove) a PGN header value by key.
 *
 * - Existing headers keep their order.
 * - New non-empty values are appended to header list.
 * - Empty values remove the header.
 *
 * @param {object} model - PGN model to update.
 * @param {string} key - PGN header key, for example `White`.
 * @param {string} value - Target header value.
 * @returns {object} Updated PGN model clone.
 */
export const setHeaderValue = (model: unknown, key: string, value: string): PgnModel => {
  const next: PgnModel = cloneModel((model as PgnModel | null) ?? {});
  const normalizedValue: string = String(value ?? "").trim();
  const existingIndex: number = Array.isArray(next.headers)
    ? next.headers.findIndex((header: PgnHeader): boolean => header?.key === key)
    : -1;

  if (!Array.isArray(next.headers)) {
    next.headers = [];
  }

  if (!normalizedValue) {
    if (existingIndex >= 0) next.headers.splice(existingIndex, 1);
    return next;
  }

  if (existingIndex >= 0) {
    next.headers[existingIndex].value = normalizedValue;
    return next;
  }

  next.headers.push({ key, value: normalizedValue });
  return next;
};

/**
 * Ensure required PGN tags exist on the model.
 *
 * @param {object} model - PGN model to normalize.
 * @param {Record<string, string>} [requiredDefaults=REQUIRED_PGN_TAG_DEFAULTS] - Required key/default map.
 * @returns {object} Updated model with all required headers present.
 */
export const ensureRequiredPgnHeaders = (
  model: unknown,
  requiredDefaults: Record<string, string> = REQUIRED_PGN_TAG_DEFAULTS,
): PgnModel => {
  let next: PgnModel = cloneModel((model as PgnModel | null) ?? {});
  Object.entries(requiredDefaults).forEach(([key, fallbackValue]: [string, string]): void => {
    const existing: string = getHeaderValue(next, key, "");
    if (existing.trim()) return;
    next = setHeaderValue(next, key, fallbackValue);
  });
  return next;
};

/**
 * Prepare a PGN string for chess.js's `loadPgn`.
 *
 * Applies two normalizations:
 *
 * 1. **Null-move stripping** — `--` (pass/null move) is used in endgame studies
 *    to demonstrate zugzwang but is not valid chess.js PGN syntax.  All ` --`
 *    tokens are removed so chess.js can parse the preceding moves.
 *
 * 2. **SetUp injection** — chess.js requires `[SetUp "1"]` alongside `[FEN "..."]`
 *    to recognise a custom starting position.  Many PGN producers omit `[SetUp]`
 *    even when a FEN header is present; without it chess.js ignores the FEN,
 *    starts from the standard initial position, and throws on the first move.
 *    This function inserts `[SetUp "1"]` immediately before the `[FEN "..."]`
 *    line when it is absent.
 *
 * The returned string is intended only for chess.js consumption; it is never
 * stored or displayed.
 *
 * @param {string} source - Raw PGN string.
 * @returns {string} PGN string with null moves stripped and `[SetUp "1"]` injected when needed.
 */
export const normalizeForChessJs = (source: string): string => {
  // Strip `--` null/pass moves. They appear as ` --` in the movetext and are
  // never valid inside header values (which are quoted) or FEN strings.
  const stripped = source.replaceAll(" --", "");
  if (/\[SetUp\s+"[^"]*"\]/i.test(stripped)) return stripped;
  if (!/\[FEN\s+"[^"]*"\]/i.test(stripped)) return stripped;
  return stripped.replace(/(\[FEN\s+"[^"]*"\])/i, '[SetUp "1"]\n$1');
};

/**
 * Derive whether the board should be flipped when a game is first opened.
 *
 * - **Custom-position games** (a non-empty `FEN` header is present, not Chess960):
 *   show the side that moves first at the bottom (playing up). Derived from the
 *   FEN's side-to-move field — `"b"` → flipped, `"w"` → not flipped.
 *   `SetUp` is intentionally not checked: many PGN producers omit it even when a
 *   custom position is in use, so the presence of the `FEN` header is the
 *   authoritative signal.
 * - **Default-position and Chess960 games**: honour the `X2BoardOrientation`
 *   header (`"black"` → flipped). If the header is absent, white is at the
 *   bottom (not flipped).
 *
 * @param {unknown} model - PGN model.
 * @returns {boolean} `true` when the board should be flipped (black at bottom).
 */
export const deriveInitialBoardFlipped = (model: unknown): boolean => {
  const isChess960: boolean =
    getHeaderValue(model, "Variant", "").trim().toLowerCase() === "chess960";
  const fen: string = getHeaderValue(model, "FEN", "").trim();

  if (fen && !isChess960) {
    // Custom-position game: the side to move first plays from the bottom.
    const sideToMove: string = fen.split(/\s+/)[1] ?? "w";
    return sideToMove === "b";
  }

  // Default / Chess960: use explicit flag, fallback to white at bottom.
  const orientation: string = getHeaderValue(model, X2_BOARD_ORIENTATION_HEADER_KEY, "")
    .trim()
    .toLowerCase();
  return orientation === "black";
};
