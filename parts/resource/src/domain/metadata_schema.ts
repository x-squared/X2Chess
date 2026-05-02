/**
 * Canonical PGN metadata schema.
 *
 * Integration API:
 * - Primary exports: key lists, typed metadata value contracts, and schema registry.
 *
 * Configuration API:
 * - Consumers can pass schema keys into metadata extraction functions to control projection.
 *
 * Communication API:
 * - Pure schema/value parsing utilities; no I/O and no runtime state mutation.
 */

/** The key for the X2 chess style metadata. This will hold a value of type `X2StyleValue`.*/
export const X2CHESS_STYLE_METADATA_KEY = "XSqrChessStyle";
/** The value for the X2 chess style metadata. This can be either "plain", "text", or "tree". */
export type X2StyleValue = "plain" | "text" | "tree";
/** The key for the X2 chess style metadata. This will hold a value of type `X2StyleValue`. */
export const LEGACY_XTWOCHESS_STYLE_METADATA_KEY = "XTwoChessStyle";
/** The key for the X2 chess style metadata. This will hold a value of type `X2StyleValue`. */
export const LEGACY_X2_STYLE_METADATA_KEY = "X2Style";

/** A result value. This can be either "1-0", "0-1", "1/2-1/2", or "*". */
export type PgnResultValue = "1-0" | "0-1" | "1/2-1/2" | "*";
/** A date value. This can be either a date in the format "YYYY.MM.DD" or "????.??.??". */
export type PgnDateValue = {
  raw: string;
  year: number | null;
  month: number | null;
  day: number | null;
};

/** A known metadata value. This can be either a string, a number, a date value, or an X2 style value. */
export type PgnMetadataKnownValues = {
  Event?: string;
  Site?: string;
  Round?: string;
  Date?: PgnDateValue;
  White?: string;
  Black?: string;
  Result?: PgnResultValue;
  ECO?: string;
  Opening?: string;
  WhiteElo?: number;
  BlackElo?: number;
  TimeControl?: string;
  Termination?: string;
  Annotator?: string;
  XSqrChessStyle?: X2StyleValue;
  /** Derived material-balance key for position games, e.g. `"KQPPPvKRP"`. */
  Material?: string;
  /** Derived mainline half-moves (move numbers + SAN only) through the XSqr stop rule (filled on save). */
  Head?: string;
};

/** A scalar metadata value. */
export type PgnMetadataScalar = string | number | PgnDateValue;

export type HybridPgnMetadata = PgnMetadataKnownValues & Record<string, PgnMetadataScalar | undefined>;

export type MetadataFieldSchemaEntry = {
  key: string;
  parse: (rawValue: string) => PgnMetadataScalar | undefined;
};

/** Parse a string value. */
const parseStringValue = (rawValue: string): string | undefined => {
  const normalized: string = String(rawValue || "").trim();
  return normalized.length > 0 ? normalized : undefined;
};

/** Parse a rating value. */
const parseRatingValue = (rawValue: string): number | undefined => {
  const normalized: string = String(rawValue || "").trim();
  if (!normalized) return undefined;
  const parsed: number = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Parse a result value. */
const parseResultValue = (rawValue: string): PgnResultValue | undefined => {
  const normalized: string = String(rawValue || "").trim();
  if (normalized === "1-0" || normalized === "0-1" || normalized === "1/2-1/2" || normalized === "*") {
    return normalized;
  }
  return undefined;
};

/** Parse an X2 style value. */
const parseX2StyleValue = (rawValue: string): X2StyleValue | undefined => {
  const normalized: string = String(rawValue || "").trim().toLowerCase();
  if (normalized === "plain" || normalized === "text" || normalized === "tree") {
    return normalized;
  }
  return undefined;
};

/** Parse a date value. */
const parseDateValue = (rawValue: string): PgnDateValue | undefined => {
  const normalized: string = String(rawValue || "").trim();
  if (!normalized) return undefined;
  const match: RegExpExecArray | null = /^(\d{4}|\?{4})\.(\d{2}|\?{2})\.(\d{2}|\?{2})$/.exec(normalized);
  if (!match) return { raw: normalized, year: null, month: null, day: null };
  const rawYear: string = String(match[1] || "");
  const rawMonth: string = String(match[2] || "");
  const rawDay: string = String(match[3] || "");
  const year: number | null = rawYear.includes("?") ? null : Number.parseInt(rawYear, 10);
  const month: number | null = rawMonth.includes("?") ? null : Number.parseInt(rawMonth, 10);
  const day: number | null = rawDay.includes("?") ? null : Number.parseInt(rawDay, 10);
  return {
    raw: normalized,
    year: Number.isFinite(year) ? year : null,
    month: Number.isFinite(month) ? month : null,
    day: Number.isFinite(day) ? day : null,
  };
};

/**
 * Typed const map of every canonical PGN metadata key.
 * Use `METADATA_KEY.White` instead of the string literal `"White"` so that
 * a key rename in `PgnMetadataKnownValues` immediately produces a TypeScript
 * error at every call site that references the old name.
 */
export const METADATA_KEY = {
  Event: "Event",
  Site: "Site",
  Round: "Round",
  Date: "Date",
  White: "White",
  Black: "Black",
  Result: "Result",
  ECO: "ECO",
  Opening: "Opening",
  WhiteElo: "WhiteElo",
  BlackElo: "BlackElo",
  TimeControl: "TimeControl",
  Termination: "Termination",
  Annotator: "Annotator",
  XSqrChessStyle: X2CHESS_STYLE_METADATA_KEY,
  Material: "Material",
  Head: "Head",
} as const satisfies Readonly<Record<keyof PgnMetadataKnownValues, string>>;

/** Standard PGN metadata keys (Seven Tag Roster plus ECO, Opening). */
export const PGN_STANDARD_METADATA_KEYS = Object.freeze([
  METADATA_KEY.White,
  METADATA_KEY.Black,
  METADATA_KEY.Result,
  METADATA_KEY.ECO,
  METADATA_KEY.Opening,
  METADATA_KEY.Event,
  METADATA_KEY.Site,
  METADATA_KEY.Round,
  METADATA_KEY.Date,
  METADATA_KEY.WhiteElo,
  METADATA_KEY.BlackElo,
  METADATA_KEY.TimeControl,
  METADATA_KEY.Termination,
  METADATA_KEY.Annotator,
]);

/** Default visible columns when no viewer prefs exist (players first; Result before ECO). */
export const DEFAULT_RESOURCE_VIEWER_METADATA_KEYS = Object.freeze([
  METADATA_KEY.White,
  METADATA_KEY.Black,
  METADATA_KEY.Result,
  METADATA_KEY.ECO,
  METADATA_KEY.Opening,
  METADATA_KEY.Date,
  METADATA_KEY.Event,
]);

/** All PGN header keys the app projects by default for hybrid extraction (standard + X2). Legacy style tags still parse via `PGN_METADATA_SCHEMA` but are not listed here. */
export const KNOWN_PGN_METADATA_KEYS = Object.freeze([
  ...PGN_STANDARD_METADATA_KEYS,
  X2CHESS_STYLE_METADATA_KEY,
  METADATA_KEY.Material,
  METADATA_KEY.Head,
]);

// ── User-defined schema types (MD1) ───────────────────────────────────────────

export type MetadataFieldType = "text" | "date" | "select" | "number" | "flag" | "reference" | "link";

/** Whether a metadata field holds at most one value or an ordered list of values. */
export type MetadataValueCardinality = "one" | "many";

/** Separator used to encode multi-value metadata fields as a single string. */
export const MULTI_VALUE_SEP = "|";

/** A metadata field definition. */
export type MetadataFieldDefinition = {
  key: string;
  label: string;
  type: MetadataFieldType;
  required: boolean;
  /** Controls column order; gaps allowed; ties sort by key. */
  orderIndex: number;
  /**
   * How many values the field may hold.
   * `"one"` (default) — at most one value, stored as a plain string.
   * `"many"` — an ordered list of zero or more values of the same type.
   */
  cardinality?: MetadataValueCardinality;
  /** Allowed values — only for type = "select". */
  selectValues?: string[];
  /** Tooltip / help text shown in the definition editor. */
  description?: string;
  /**
   * When true, this field's value is available as a fallback for games that
   * reference this game via a `reference` field. If the referencing game has
   * no local value for this field, the referenced game's value is used instead.
   * Only meaningful on non-`reference` fields.
   */
  referenceable?: true;
};

/** Key identity + cardinality descriptor returned by the DB adapter's key registry. */
export type MetadataKeyInfo = {
  key: string;
  cardinality: MetadataValueCardinality;
};

// ── Game rendering profile (GRP) ─────────────────────────────────────────────

/**
 * One item in a rendering line.
 * - `players` — renders "White — Black" using the game's White/Black metadata.
 * - `field`   — renders the value of any non-select metadata field.
 * - `date`    — renders a date field with a chosen precision.
 */
export type GameRenderingRef =
  | { kind: "players" }
  | { kind: "field"; key: string }
  | { kind: "date"; key: string; format: "full" | "month-year" | "year" };

/** One rendered line: 1 or 2 field refs joined by a user-defined separator. */
export type GameRenderingLine = {
  items: [GameRenderingRef] | [GameRenderingRef, GameRenderingRef];
  /** String placed between the two items when both are non-empty (e.g. " · ", " — ", " / "). */
  separator: string;
};

/** A pair of lines (line1 bold, line2 normal+smaller). */
export type GameRenderingDisplay = {
  line1: GameRenderingLine;
  line2?: GameRenderingLine;
};

/**
 * One conditional rendering rule.
 * `when` maps select-field keys to required values; `{}` = default/fallback rule.
 * Both display slots are optional independently; at least one should be set.
 */
export type GameRenderingRule = {
  when: Record<string, string>;
  display1?: GameRenderingDisplay;
  display2?: GameRenderingDisplay;
};

/**
 * Rendering profile attached to a MetadataSchema.
 * `conditionKeys` must all be select-type fields in the schema.
 * Rules are evaluated in order; first match wins; rule with empty `when` is the fallback.
 */
export type GameRenderingProfile = {
  conditionKeys: string[];
  rules: GameRenderingRule[];
};

export type MetadataSchema = {
  /** Stable UUID. */
  id: string;
  name: string;
  /** Monotonically increasing; incremented on each save. */
  version: number;
  fields: MetadataFieldDefinition[];
  /** Optional game rendering profile — controls how games are displayed in the resource table. */
  rendering?: GameRenderingProfile;
};

/**
 * Built-in read-only schema based on the PGN Seven Tag Roster plus common
 * extensions. Used when no user-defined schema is associated with a resource.
 * Column order (`orderIndex`): White, Black, Result; ECO, Opening; then Event,
 * Site, Round, Date; ratings and remaining tags; X2 fields last.
 */
export const BUILT_IN_SCHEMA: MetadataSchema = Object.freeze({
  id: "builtin",
  name: "Standard PGN",
  version: 1,
  fields: [
    { key: "White",       label: "White",        type: "text",   required: false, orderIndex: 10 },
    { key: "Black",       label: "Black",        type: "text",   required: false, orderIndex: 20 },
    {
      key: "Result",
      label: "Result",
      type: "select",
      required: false,
      orderIndex: 30,
      selectValues: ["1-0", "0-1", "1/2-1/2", "*"],
    },
    { key: "ECO",         label: "ECO",          type: "text",   required: false, orderIndex: 40 },
    { key: "Opening",     label: "Opening",      type: "text",   required: false, orderIndex: 50 },
    { key: "Event",       label: "Event",        type: "text",   required: false, orderIndex: 60 },
    { key: "Site",        label: "Site",         type: "text",   required: false, orderIndex: 70 },
    { key: "Round",       label: "Round",        type: "text",   required: false, orderIndex: 80 },
    { key: "Date",        label: "Date",         type: "date",   required: false, orderIndex: 90 },
    { key: "WhiteElo",    label: "White Elo",    type: "number", required: false, orderIndex: 100 },
    { key: "BlackElo",    label: "Black Elo",    type: "number", required: false, orderIndex: 110 },
    { key: "TimeControl", label: "Time Control", type: "text",   required: false, orderIndex: 120 },
    { key: "Termination", label: "Termination",  type: "text",   required: false, orderIndex: 130 },
    { key: "Annotator",   label: "Annotator",    type: "text",   required: false, orderIndex: 140 },
    { key: "Material",    label: "Material",     type: "text",   required: false, orderIndex: 150 },
    { key: "Head",        label: "Head",         type: "text",   required: false, orderIndex: 160 },
    {
      key: X2CHESS_STYLE_METADATA_KEY,
      label: "XSqr chess style",
      type: "select",
      required: false,
      orderIndex: 170,
      selectValues: ["plain", "text", "tree"],
    },
  ] as MetadataFieldDefinition[],
});

export const PGN_METADATA_SCHEMA: Readonly<Record<string, MetadataFieldSchemaEntry>> = Object.freeze({
  Event: { key: "Event", parse: parseStringValue },
  Site: { key: "Site", parse: parseStringValue },
  Round: { key: "Round", parse: parseStringValue },
  Date: { key: "Date", parse: parseDateValue },
  White: { key: "White", parse: parseStringValue },
  Black: { key: "Black", parse: parseStringValue },
  Result: { key: "Result", parse: parseResultValue },
  ECO: { key: "ECO", parse: parseStringValue },
  Opening: { key: "Opening", parse: parseStringValue },
  WhiteElo: { key: "WhiteElo", parse: parseRatingValue },
  BlackElo: { key: "BlackElo", parse: parseRatingValue },
  TimeControl: { key: "TimeControl", parse: parseStringValue },
  Termination: { key: "Termination", parse: parseStringValue },
  Annotator: { key: "Annotator", parse: parseStringValue },
  XSqrChessStyle: { key: X2CHESS_STYLE_METADATA_KEY, parse: parseX2StyleValue },
  XTwoChessStyle: { key: X2CHESS_STYLE_METADATA_KEY, parse: parseX2StyleValue },
  X2Style: { key: X2CHESS_STYLE_METADATA_KEY, parse: parseX2StyleValue },
  Material: { key: "Material", parse: parseStringValue },
  Head: { key: "Head", parse: parseStringValue },
});
