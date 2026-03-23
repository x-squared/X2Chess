/**
 * web_import_types — Shared types for the web import rule engine.
 *
 * Integration API:
 * - Import from this module in `rule_matcher.ts`, `rule_fetcher.ts`,
 *   `rule_registry.ts`, `built_in_rules.ts`, and `useWebImport.ts`.
 *
 * Configuration API:
 * - No runtime configuration; types only.
 *
 * Communication API:
 * - Pure types; no side effects.
 */

// ── HTML extraction rule variants ─────────────────────────────────────────────

/** Extract the value of an HTML attribute from the first element matching a CSS selector. */
export type HtmlExtractCssAttr = {
  type: "css-attr";
  /** CSS selector to find the target element. */
  selector: string;
  /** Attribute name whose value is extracted. */
  attribute: string;
};

/** Extract the text content of the first element matching a CSS selector. */
export type HtmlExtractCssText = {
  type: "css-text";
  /** CSS selector to find the target element. */
  selector: string;
};

/**
 * Search all `<script>` tag contents for a regex match.
 * The first capture group `(...)` is the extracted value.
 */
export type HtmlExtractScriptRegex = {
  type: "script-regex";
  /** Regex pattern (as a string); first capture group is the result. */
  pattern: string;
};

/** Extract a `<meta name="...">` tag's `content` attribute. */
export type HtmlExtractMeta = {
  type: "meta";
  /** Value of the `name` attribute on the `<meta>` element. */
  name: string;
};

/** Union of all HTML extraction strategies. Tried in array order; first match wins. */
export type HtmlExtractRule =
  | HtmlExtractCssAttr
  | HtmlExtractCssText
  | HtmlExtractScriptRegex
  | HtmlExtractMeta;

// ── Main rule type ─────────────────────────────────────────────────────────────

/**
 * A single web import rule describing how to extract a chess position or game
 * from a URL.
 *
 * The `strategy` field selects the fetch tier:
 * - `"api"` / `"direct"` — Tier 1: browser `fetch()`.
 * - `"native-html"` — Tier 2: Tauri native HTTP GET + HTML parsing (no CORS restriction).
 * - `"webview"` — Tier 3: in-app browser panel + JS capture script.
 */
export type WebImportRule = {
  /** Unique identifier, e.g. `"lichess-game"`. Collisions resolved by user rules winning. */
  id: string;

  /** Human-readable label shown in the import UI. */
  label: string;

  /**
   * Regex pattern matched against the full URL string.
   * Capture groups are available as `$1`, `$2`, … in `fetchUrl` templates.
   */
  urlPattern: string;

  /** Fetch strategy / tier. */
  strategy: "api" | "direct" | "native-html" | "webview";

  /**
   * URL to fetch (Tier 1 + Tier 2).
   * Capture groups from `urlPattern` are substituted: `$1`, `$2`, etc.
   * Omit for `strategy: "webview"` (the original URL is opened in the WebView).
   */
  fetchUrl?: string;

  /**
   * How to interpret the fetch response (Tier 1 + Tier 2).
   * - `"pgn"` — response body is raw PGN text.
   * - `"json.pgn"` — JSON body; extract PGN string at `fieldPaths.pgn` dot-path.
   * - `"json.fen"` — JSON body; extract FEN string at `fieldPaths.fen` dot-path.
   * - `"json.fen+pgn"` — JSON body; prefer `fieldPaths.pgn`, fall back to `fieldPaths.fen`.
   * - `"html.extract"` — HTML body; run `htmlExtract` rules in order, first match wins.
   */
  responseType?: "pgn" | "json.pgn" | "json.fen" | "json.fen+pgn" | "html.extract";

  /**
   * Dot-path overrides for JSON field locations.
   * Default paths: `fen → "fen"`, `pgn → "pgn"`, `title → "title"`.
   */
  fieldPaths?: {
    fen?: string;
    pgn?: string;
    title?: string;
  };

  /** Additional HTTP request headers (Tier 1 + Tier 2). */
  requestHeaders?: Record<string, string>;

  /**
   * HTML extraction rules (Tier 2, `strategy: "native-html"`).
   * Tried in array order; first successful extraction wins.
   */
  htmlExtract?: HtmlExtractRule[];

  /**
   * JS expression evaluated inside the WebView page (Tier 3, `strategy: "webview"`).
   * Must return a FEN or PGN string, or `null`.
   * Keep short and auditable — displayed to the user in the rule editor.
   */
  captureScript?: string;
};

// ── Result type ───────────────────────────────────────────────────────────────

/**
 * The resolved output from a web import rule.
 *
 * - `kind: "pgn"` — `value` is raw PGN text; pass to the PGN import path.
 * - `kind: "fen"` — `value` is a FEN string; open the New Game dialog pre-filled.
 */
export type WebImportResult = {
  kind: "pgn" | "fen";
  /** The extracted PGN text or FEN string. */
  value: string;
  /** Optional title extracted from the response (shown in the session tab). */
  title?: string;
};

// ── Matcher result ────────────────────────────────────────────────────────────

/**
 * The output of `matchRule`: the matched rule plus the regex capture groups
 * extracted from the URL (index 0 = full match, index 1 = first group, …).
 */
export type RuleMatch = {
  rule: WebImportRule;
  /** Capture groups from the URL regex. Index 1 = `$1`, index 2 = `$2`, etc. */
  captures: string[];
};
