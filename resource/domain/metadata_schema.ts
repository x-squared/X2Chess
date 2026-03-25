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
  X2Style?: X2StyleValue;
  /** Derived material-balance key for position games, e.g. `"KQPPPvKRP"`. */
  Material?: string;
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
  X2Style: "X2Style",
  Material: "Material",
} as const satisfies Readonly<Record<keyof PgnMetadataKnownValues, string>>;

export const PGN_STANDARD_METADATA_KEYS = Object.freeze([
  "Event",
  "Site",
  "Round",
  "Date",
  "White",
  "Black",
  "Result",
  "ECO",
  "Opening",
  "WhiteElo",
  "BlackElo",
  "TimeControl",
  "Termination",
  "Annotator",
]);

export const DEFAULT_RESOURCE_VIEWER_METADATA_KEYS = Object.freeze([
  "White",
  "Black",
  "Date",
  "Event",
  "ECO",
  "Opening",
  "Result",
]);

export const KNOWN_PGN_METADATA_KEYS = Object.freeze([
  ...PGN_STANDARD_METADATA_KEYS,
  "X2Style",
  "Material",
]);

// ── User-defined schema types (MD1) ───────────────────────────────────────────

export type MetadataFieldType = "text" | "date" | "select" | "number" | "flag";

export type MetadataFieldDefinition = {
  key: string;
  label: string;
  type: MetadataFieldType;
  required: boolean;
  /** Controls column order; gaps allowed; ties sort by key. */
  orderIndex: number;
  /** Allowed values — only for type = "select". */
  selectValues?: string[];
  /** Tooltip / help text shown in the definition editor. */
  description?: string;
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
 */
export const BUILT_IN_SCHEMA: MetadataSchema = Object.freeze({
  id: "builtin",
  name: "Standard PGN",
  version: 1,
  fields: [
    { key: "Event",       label: "Event",        type: "text",   required: false, orderIndex: 10 },
    { key: "Site",        label: "Site",         type: "text",   required: false, orderIndex: 20 },
    { key: "Date",        label: "Date",         type: "date",   required: false, orderIndex: 30 },
    { key: "Round",       label: "Round",        type: "text",   required: false, orderIndex: 40 },
    { key: "White",       label: "White",        type: "text",   required: false, orderIndex: 50 },
    { key: "Black",       label: "Black",        type: "text",   required: false, orderIndex: 60 },
    {
      key: "Result",
      label: "Result",
      type: "select",
      required: false,
      orderIndex: 70,
      selectValues: ["1-0", "0-1", "1/2-1/2", "*"],
    },
    { key: "WhiteElo",    label: "White Elo",    type: "number", required: false, orderIndex: 80 },
    { key: "BlackElo",    label: "Black Elo",    type: "number", required: false, orderIndex: 90 },
    { key: "ECO",         label: "ECO",          type: "text",   required: false, orderIndex: 100 },
    { key: "Opening",     label: "Opening",      type: "text",   required: false, orderIndex: 110 },
    { key: "TimeControl", label: "Time Control", type: "text",   required: false, orderIndex: 120 },
    { key: "Annotator",   label: "Annotator",    type: "text",   required: false, orderIndex: 130 },
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
  X2Style: { key: "X2Style", parse: parseX2StyleValue },
  Material: { key: "Material", parse: parseStringValue },
});
