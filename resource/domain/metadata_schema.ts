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
]);

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
});
