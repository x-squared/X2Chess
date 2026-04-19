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

export type X2StyleValue = "plain" | "text" | "tree";
export const X2CHESS_STYLE_METADATA_KEY = "XSqrChessStyle";
/** Transitional header key from older builds; still recognized when parsing PGN. */
export const LEGACY_XTWOCHESS_STYLE_METADATA_KEY = "XTwoChessStyle";
export const LEGACY_X2_STYLE_METADATA_KEY = "X2Style";

export type PgnResultValue = "1-0" | "0-1" | "1/2-1/2" | "*";

export type PgnDateValue = {
  raw: string;
  year: number | null;
  month: number | null;
  day: number | null;
};

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
  XSqrHead?: string;
};

export type PgnMetadataScalar = string | number | PgnDateValue | X2StyleValue | PgnResultValue;

export type HybridPgnMetadata = PgnMetadataKnownValues & Record<string, PgnMetadataScalar | undefined>;

export type MetadataFieldSchemaEntry = {
  key: string;
  parse: (rawValue: string) => PgnMetadataScalar | undefined;
};

const parseStringValue = (rawValue: string): string | undefined => {
  const normalized: string = String(rawValue || "").trim();
  return normalized.length > 0 ? normalized : undefined;
};

const parseRatingValue = (rawValue: string): number | undefined => {
  const normalized: string = String(rawValue || "").trim();
  if (!normalized) return undefined;
  const parsed: number = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseResultValue = (rawValue: string): PgnResultValue | undefined => {
  const normalized: string = String(rawValue || "").trim();
  if (normalized === "1-0" || normalized === "0-1" || normalized === "1/2-1/2" || normalized === "*") {
    return normalized;
  }
  return undefined;
};

const parseX2StyleValue = (rawValue: string): X2StyleValue | undefined => {
  const normalized: string = String(rawValue || "").trim().toLowerCase();
  if (normalized === "plain" || normalized === "text" || normalized === "tree") {
    return normalized;
  }
  return undefined;
};

const parseDateValue = (rawValue: string): PgnDateValue | undefined => {
  const normalized: string = String(rawValue || "").trim();
  if (!normalized) return undefined;
  const match = normalized.match(/^(\d{4}|\?{4})\.(\d{2}|\?{2})\.(\d{2}|\?{2})$/);
  if (!match) return { raw: normalized, year: null, month: null, day: null };
  const rawYear: string = String(match[1] || "");
  const rawMonth: string = String(match[2] || "");
  const rawDay: string = String(match[3] || "");
  const year: number | null = rawYear.includes("?") ? null : Number.parseInt(rawYear, 10);
  const month: number | null = rawMonth.includes("?") ? null : Number.parseInt(rawMonth, 10);
  const day: number | null = rawDay.includes("?") ? null : Number.parseInt(rawDay, 10);
  return {
    raw: normalized,
    year: Number.isFinite(year as number) ? year : null,
    month: Number.isFinite(month as number) ? month : null,
    day: Number.isFinite(day as number) ? day : null,
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
  XSqrHead: "XSqrHead",
} as const satisfies Readonly<Record<keyof PgnMetadataKnownValues, string>>;

export const PGN_STANDARD_METADATA_KEYS = Object.freeze([
  "White",
  "Black",
  "Result",
  "ECO",
  "Opening",
  "Event",
  "Site",
  "Round",
  "Date",
  "WhiteElo",
  "BlackElo",
  "TimeControl",
  "Termination",
  "Annotator",
]);

/** Default visible columns when no viewer prefs exist (players first; Result before ECO). */
export const DEFAULT_RESOURCE_VIEWER_METADATA_KEYS = Object.freeze([
  "White",
  "Black",
  "Date",
  "Event",
  "Result",
  "ECO",
  "Opening",
]);

/** All PGN header keys the app projects by default for hybrid extraction (standard + X2). Legacy style tags still parse via `PGN_METADATA_SCHEMA` but are not listed here. */
export const KNOWN_PGN_METADATA_KEYS = Object.freeze([
  ...PGN_STANDARD_METADATA_KEYS,
  X2CHESS_STYLE_METADATA_KEY,
  "Material",
  "XSqrHead",
]);

// ── User-defined schema types (MD1) ───────────────────────────────────────────

export type MetadataFieldType = "text" | "date" | "select" | "number" | "flag" | "game_link";

/** Whether a metadata field holds at most one value or an ordered list of values. */
export type MetadataValueCardinality = "one" | "many";

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
};

/** Key identity + cardinality descriptor returned by the DB adapter's key registry. */
export type MetadataKeyInfo = {
  key: string;
  cardinality: MetadataValueCardinality;
};

export type MetadataSchema = {
  /** Stable UUID. */
  id: string;
  name: string;
  /** Monotonically increasing; incremented on each save. */
  version: number;
  fields: MetadataFieldDefinition[];
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
    { key: "Termination", label: "Termination",  type: "text",   required: false, orderIndex: 125 },
    { key: "Annotator",   label: "Annotator",    type: "text",   required: false, orderIndex: 130 },
    {
      key: X2CHESS_STYLE_METADATA_KEY,
      label: "XSqr chess style",
      type: "select",
      required: false,
      orderIndex: 135,
      selectValues: ["plain", "text", "tree"],
    },
    { key: "Material", label: "Material", type: "text", required: false, orderIndex: 140 },
    { key: "XSqrHead", label: "XSqr head", type: "text", required: false, orderIndex: 145 },
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
  XSqrHead: { key: "XSqrHead", parse: parseStringValue },
});
