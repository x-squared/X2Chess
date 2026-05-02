/**
 * game_rendering — pure utilities for the game rendering profile (GRP).
 *
 * Integration API:
 * - `resolveDisplay(metadata, profile, slot, schemaFields?)` — finds the matching rule and returns its display;
 *   when a matching conditional rule omits the requested slot, falls back to the default rule’s slot.
 *   With `schemaFields`, **select**-type `when` values match case-insensitively; keys in the metadata map are also resolved case-insensitively (`Type` vs `type`). `getMetadataValueIgnoreKeyCase` is used for rule conditions and for field/date line items.
 * - `resolveDisplayForSessionTab(metadata, profile, schemaFields?)` — session tabs: `display1` then `display2`.
 * - `resolveDisplayForReferenceChip(metadata, profile, schemaFields?)` — reference chips: **compact** (`display1`) then `display2` if compact is unset (same intent as the main Game column).
 * - `renderLine(line, metadata)` — converts a GameRenderingLine to a display string.
 * - `renderDisplayText(display, metadata)` — returns { line1, line2 } strings for a display slot.
 * - `renderDisplayFilterText(display, metadata)` — flat string for substring filtering.
 * - `buildRenderedGameMap(rows, profile, slot, schemaFields?)` — batch-render all rows; returns a Map for O(1) lookup.
 * - `mergeResourceMetadataOverlayForGrp(pgn, overlay)` — merge index row into PGN map for session-tab GRP.
 *
 * Configuration API:
 * - No I/O; all functions are pure.
 *
 * Diagnostics:
 * - `resolveDisplay` / `buildRenderedGameMap` emit `log` entries so release logs can show which GRP
 *   rule matched (debug) and when no slot resolves (info). Use dev build or log level Debug for full trace.
 */

import { log } from "../../../logger";
import type {
  GameRenderingDisplay,
  GameRenderingLine,
  GameRenderingProfile,
  GameRenderingRef,
  MetadataFieldDefinition,
} from "../../../../../parts/resource/src/domain/metadata_schema";

// ── Date formatting ───────────────────────────────────────────────────────────

/**
 * Format a raw date string to the requested precision.
 * Accepts yyyy.mm.dd (PGN standard), dd.mm.yyyy (European), mm.yyyy, or yyyy.
 * Detects yyyy-first vs dd-first by checking whether the first segment is 4 digits.
 * Falls back to the raw value when parsing fails.
 */
const formatDate = (raw: string, format: "full" | "month-year" | "year"): string => {
  const s = raw.trim();
  if (!s) return "";
  if (format === "full") return s;

  const parts = s.split(".");
  if (parts.length === 3) {
    const isYearFirst = (parts[0]?.length ?? 0) === 4;
    const yyyy = isYearFirst ? (parts[0] ?? s) : (parts[2] ?? s);
    const mm = parts[1] ?? "";
    if (format === "year") return yyyy;
    return `${mm}.${yyyy}`;
  }
  if (parts.length === 2) {
    // mm.yyyy
    const [, yyyy] = parts;
    if (format === "year") return yyyy ?? s;
    return s;
  }
  // yyyy only — all formats collapse to the year
  return s;
};

// ── Metadata key alignment (PGN vs schema) ────────────────────────────────────

/**
 * Read a header value when the map key may differ only by case (`Type` vs `type`).
 * Used for GRP rule matching and field/date refs so compact/detail layouts resolve values.
 */
export const getMetadataValueIgnoreKeyCase = (
  metadata: Record<string, string>,
  key: string,
): string => {
  if (key === "") return "";
  if (Object.prototype.hasOwnProperty.call(metadata, key)) {
    return String(metadata[key] ?? "");
  }
  const target = key.toLowerCase();
  for (const [k, v] of Object.entries(metadata)) {
    if (k.toLowerCase() === target) return String(v ?? "");
  }
  return "";
};

/** Compact snapshot of condition-key values for GRP logs (stable JSON in log fields). */
const pickConditionFieldsForLog = (
  metadata: Record<string, string>,
  conditionKeys: readonly string[],
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of conditionKeys) {
    const v: string = getMetadataValueIgnoreKeyCase(metadata, key);
    if (v !== "") {
      out[key] = v;
    }
  }
  return out;
};

// ── Single ref rendering ──────────────────────────────────────────────────────

const renderRef = (ref: GameRenderingRef, metadata: Record<string, string>): string => {
  if (ref.kind === "players") {
    const white = getMetadataValueIgnoreKeyCase(metadata, "White").trim();
    const black = getMetadataValueIgnoreKeyCase(metadata, "Black").trim();
    if (white && black) return `${white} — ${black}`;
    return white || black;
  }
  if (ref.kind === "date") {
    return formatDate(getMetadataValueIgnoreKeyCase(metadata, ref.key), ref.format);
  }
  return getMetadataValueIgnoreKeyCase(metadata, ref.key).trim();
};

// ── Line rendering ────────────────────────────────────────────────────────────

/** Render a GameRenderingLine to a display string. */
export const renderLine = (line: GameRenderingLine, metadata: Record<string, string>): string => {
  const [ref1, ref2] = line.items;
  const part1 = renderRef(ref1, metadata);
  if (!ref2) return part1;
  const part2 = renderRef(ref2, metadata);
  if (!part1) return part2;
  if (!part2) return part1;
  return `${part1}${line.separator}${part2}`;
};

// ── Metadata merge for GRP (session tabs vs resource index row) ───────────────

/** Values treated as unset so resource-index overlay can replace them (PGN defaults). */
const PLACEHOLDER_VALUES_FOR_GRP_OVERLAY: ReadonlySet<string> = new Set<string>(["", "?"]);

/**
 * Merge resource-list metadata into PGN headers used only for GRP rule matching and rendering.
 * Fills blank tags and replaces `[Tag "?"]`-style placeholders so session chrome matches the
 * resource table when the library row holds Type / … but PGN still has roster placeholders.
 *
 * @param pgnHeaders - Map from `buildMetadataFromPgnModel` or equivalent.
 * @param overlay - Same shape as `listGamesForResource` row metadata (from session open).
 */
export const mergeResourceMetadataOverlayForGrp = (
  pgnHeaders: Record<string, string>,
  overlay: Record<string, string> | null | undefined,
): Record<string, string> => {
  if (!overlay || Object.keys(overlay).length === 0) return pgnHeaders;
  const out: Record<string, string> = { ...pgnHeaders };
  for (const [k, v] of Object.entries(overlay)) {
    if (!k) continue;
    const ov = String(v ?? "").trim();
    if (ov === "") continue;
    const curTrimmed: string = String(out[k] ?? "").trim();
    if (PLACEHOLDER_VALUES_FOR_GRP_OVERLAY.has(curTrimmed)) {
      out[k] = String(v ?? "");
    }
  }
  return out;
};

// ── Rule matching ─────────────────────────────────────────────────────────────

/**
 * Build a lookup map for schema field definitions (GRP condition keys are select fields).
 */
const fieldDefByKey = (
  schemaFields: readonly MetadataFieldDefinition[] | undefined,
): Map<string, MetadataFieldDefinition> | null =>
  schemaFields && schemaFields.length > 0 ? new Map(schemaFields.map((f) => [f.key, f])) : null;

/**
 * True when `metadata` satisfies a rule’s `when` clause.
 * Select-type keys use trim + case-insensitive value match so PGN-sourced tags (e.g. `[Type "Opening"]`)
 * still match rules saved as `opening`.
 *
 * @param metadata - Row or session header map.
 * @param when - Rule conditions (subset of select fields).
 * @param fieldsByKey - Schema fields; when omitted, comparison is strict string equality.
 */
export const metadataMatchesRenderingWhen = (
  metadata: Record<string, string>,
  when: Record<string, string>,
  fieldsByKey: Map<string, MetadataFieldDefinition> | null,
): boolean => {
  return Object.entries(when).every(([key, expected]: [string, string]): boolean => {
    const actual: string = getMetadataValueIgnoreKeyCase(metadata, key);
    if (actual === expected) return true;
    if (fieldsByKey == null) return false;
    const def: MetadataFieldDefinition | undefined = fieldsByKey.get(key);
    if (def?.type === "select") {
      return actual.trim().toLowerCase() === expected.trim().toLowerCase();
    }
    return false;
  });
};

/**
 * Find the display slot for a given metadata row and profile.
 * Returns null when no profile is set or no rule (including fallback) matches.
 *
 * @param schemaFields - Optional schema `fields` list; enables case-insensitive select `when` matching.
 */
export const resolveDisplay = (
  metadata: Record<string, string>,
  profile: GameRenderingProfile,
  slot: "display1" | "display2",
  schemaFields?: readonly MetadataFieldDefinition[],
): GameRenderingDisplay | null => {
  const fieldsByKey: Map<string, MetadataFieldDefinition> | null = fieldDefByKey(schemaFields);
  let fallback: GameRenderingDisplay | null = null;
  let fallbackRuleIndex: number | null = null;

  for (let ri = 0; ri < profile.rules.length; ri++) {
    const rule = profile.rules[ri];
    const isDefault = Object.keys(rule.when).length === 0;
    if (isDefault) {
      const candidate = rule[slot];
      if (candidate != null) {
        fallback = candidate;
        fallbackRuleIndex = ri;
      }
      continue;
    }
    const matches: boolean = metadataMatchesRenderingWhen(metadata, rule.when, fieldsByKey);
    if (matches) {
      const candidate = rule[slot];
      if (candidate != null) {
        // [log: may downgrade to debug once GRP diagnosis is stable]
        log.debug(
          "game_rendering",
          () =>
            `resolveDisplay: slot=${slot} outcome=conditional ruleIndex=${String(ri)} when=${JSON.stringify(rule.when)} schemaFields=${schemaFields != null && schemaFields.length > 0 ? "yes" : "no"}`,
        );
        return candidate;
      }
      // Rule matched but this slot is unset — keep scanning; use default rule at end.
      log.debug(
        "game_rendering",
        () =>
          `resolveDisplay: slot=${slot} ruleIndex=${String(ri)} matched when=${JSON.stringify(rule.when)} but ${slot} unset on rule`,
      );
    }
  }

  if (fallback != null) {
    log.debug(
      "game_rendering",
      () =>
        `resolveDisplay: slot=${slot} outcome=fallback ruleIndex=${fallbackRuleIndex === null ? "?" : String(fallbackRuleIndex)} Type=${getMetadataValueIgnoreKeyCase(metadata, "Type")} snapshot=${JSON.stringify(pickConditionFieldsForLog(metadata, profile.conditionKeys))}`,
    );
    return fallback;
  }

  log.info("game_rendering", "resolveDisplay: no display for slot (null)", {
    slot,
    ruleCount: profile.rules.length,
    typeValue: getMetadataValueIgnoreKeyCase(metadata, "Type"),
    conditionSnapshot: JSON.stringify(pickConditionFieldsForLog(metadata, profile.conditionKeys)),
    schemaFieldsPresent: schemaFields != null && schemaFields.length > 0,
  });
  return null;
};

/** Which GRP slot supplied the resolved display for a reference chip (resource table). */
export type ReferenceChipDisplaySource = "display1" | "display2" | "none";

/**
 * Resolve rendering for session tab labels and other “same game as the row” chrome.
 * Uses **Table/compact** (`display1`) first to match the resource table’s main Game column;
 * if no rule defines that slot, falls back to **Full/detail** (`display2`).
 *
 * @param metadata - Header map from the session’s `pgnModel`.
 * @param profile - Active schema rendering profile for the resource.
 * @param schemaFields - Schema field defs for select condition matching.
 */
export const resolveDisplayForSessionTab = (
  metadata: Record<string, string>,
  profile: GameRenderingProfile,
  schemaFields?: readonly MetadataFieldDefinition[],
): GameRenderingDisplay | null =>
  resolveDisplay(metadata, profile, "display1", schemaFields) ??
  resolveDisplay(metadata, profile, "display2", schemaFields);

/**
 * Resolve rendering for a **reference** cell (another game’s record).
 * Uses **Table/compact** (`display1`) first — same as the resource table’s main Game column — then
 * falls back to **Full/detail** (`display2`) only when no rule supplies compact for this metadata.
 *
 * @param metadata - Resolved headers for the referenced game.
 * @param profile - Active schema rendering profile.
 * @param schemaFields - Schema field defs for select condition matching.
 * @returns The display to render and which slot was used (`none` if no rule provides either slot).
 */
export const resolveDisplayForReferenceChip = (
  metadata: Record<string, string>,
  profile: GameRenderingProfile,
  schemaFields?: readonly MetadataFieldDefinition[],
): { display: GameRenderingDisplay | null; source: ReferenceChipDisplaySource } => {
  const fromCompact: GameRenderingDisplay | null = resolveDisplay(metadata, profile, "display1", schemaFields);
  if (fromCompact != null) {
    return { display: fromCompact, source: "display1" };
  }
  const fromDetail: GameRenderingDisplay | null = resolveDisplay(metadata, profile, "display2", schemaFields);
  if (fromDetail != null) {
    return { display: fromDetail, source: "display2" };
  }
  return { display: null, source: "none" };
};

// ── Convenience helpers ───────────────────────────────────────────────────────

/** Render both lines of a display slot to plain strings. */
export const renderDisplayText = (
  display: GameRenderingDisplay,
  metadata: Record<string, string>,
): { line1: string; line2: string } => ({
  line1: renderLine(display.line1, metadata),
  line2: display.line2 ? renderLine(display.line2, metadata) : "",
});

/** Flat concatenation of all rendered text — used for substring filter matching. */
export const renderDisplayFilterText = (
  display: GameRenderingDisplay,
  metadata: Record<string, string>,
): string => {
  const { line1, line2 } = renderDisplayText(display, metadata);
  return line2 ? `${line1} ${line2}` : line1;
};

// ── Batch rendering ───────────────────────────────────────────────────────────

/** Pre-rendered strings for a single row — display lines plus a flat filter string. */
export type RenderedGameDisplay = { line1: string; line2: string; filterText: string };

/**
 * Batch-render all rows for a profile slot and return a Map keyed by row object.
 * Rows without a matching display rule are omitted — callers fall back to `row.game`.
 */
export const buildRenderedGameMap = <R extends { game: string; metadata: Record<string, string> }>(
  rows: readonly R[],
  profile: GameRenderingProfile,
  slot: "display1" | "display2",
  schemaFields?: readonly MetadataFieldDefinition[],
): Map<R, RenderedGameDisplay> => {
  const map = new Map<R, RenderedGameDisplay>();
  for (const row of rows) {
    const display = resolveDisplay(row.metadata, profile, slot, schemaFields);
    if (!display) {
      const rid: string =
        row != null &&
        typeof row === "object" &&
        "recordId" in row &&
        typeof (row as { recordId?: unknown }).recordId === "string"
          ? (row as { recordId: string }).recordId
          : "";
      log.debug(
        "game_rendering",
        () =>
          `buildRenderedGameMap: row omitted (no display) slot=${slot} recordId=${rid || "n/a"} Type=${getMetadataValueIgnoreKeyCase(row.metadata, "Type")}`,
      );
      continue;
    }
    const { line1, line2 } = renderDisplayText(display, row.metadata);
    const resolved1 = line1 || row.game;
    const filterText = line2 ? `${resolved1} ${line2}` : resolved1;
    map.set(row, { line1: resolved1, line2, filterText });
  }
  return map;
};
