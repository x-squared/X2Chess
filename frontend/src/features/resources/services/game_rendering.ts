/**
 * game_rendering — pure utilities for the game rendering profile (GRP).
 *
 * Integration API:
 * - `resolveDisplay(metadata, profile, slot, schemaFields?)` — finds the matching rule and returns its display;
 *   when a matching conditional rule omits the requested slot, falls back to the default rule’s slot.
 *   With `schemaFields`, **select**-type `when` values match case-insensitively; keys in the metadata map are also resolved case-insensitively (`Type` vs `type`). `getMetadataValueIgnoreKeyCase` is used for rule conditions and for field/date line items.
 * - `resolveDisplayForSessionTab(metadata, profile, schemaFields?)` — single slot: compact (`display1`) else detail (`display2`).
 * - `renderSessionTabGrpText(metadata, profile, schemaFields?)` — merges **compact + detail** for two-line GRP
 *   (used by session tabs and `buildRenderedGameMap` for the resource table Game column).
 * - `resolveDisplayForReferenceChip(metadata, profile, schemaFields?)` — reference chips: **compact** (`display1`) then `display2` if compact is unset (same intent as the main Game column).
 * - `renderLine(line, metadata)` — converts a GameRenderingLine to a display string.
 * - `renderDisplayText(display, metadata)` — returns { line1, line2 } strings for a display slot.
 * - `renderDisplayFilterText(display, metadata)` — flat string for substring filtering.
 * - `buildRenderedGameMap(rows, profile, schemaFields?)` — batch-render using the same **compact+detail** merge
 *   as `renderSessionTabGrpText` (resource table Game column + filter/sort).
 * - `mergeResourceMetadataOverlayForGrp(pgn, overlay)` — merge index row into PGN map for session-tab GRP.
 * - `buildSessionMetadataForGrp(pgnModel, pgnText, overlay, mainlineMoves?)` — same bracket-header basis as DB
 *   `list` metadata (`extractPgnMetadataFromSource` + in-memory `pgnModel` overwrites + list-row overlay);
 *   optional ECO-tree fill for empty `Opening` via {@link enrichMetadataWithEcoDerivedOpening}.
 * - `enrichMetadataWithEcoDerivedOpening(metadata, mainlineMoves)` — display-only Opening/ECO from SAN list.
 *
 * Configuration API:
 * - No I/O; all functions are pure.
 *
 * Diagnostics:
 * - `resolveDisplay` / `buildRenderedGameMap` emit `log` entries so release logs can show which GRP
 *   rule matched (debug) and when no slot resolves (info). Use dev build or log level Debug for full trace.
 */

import { log } from "../../../logger";
import { lookupEco } from "../../../model/eco_lookup";
import { extractPgnMetadataFromSource } from "../../../../../parts/resource/src/domain/metadata";
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
 * Header key in `map` that matches `preferredKey` with case-insensitive comparison, or
 * `preferredKey` if no collision (new key). Keeps a single canonical casing for writes.
 */
const resolveCanonicalHeaderKey = (
  map: Record<string, string>,
  preferredKey: string,
): string => {
  if (preferredKey === "") return preferredKey;
  if (Object.prototype.hasOwnProperty.call(map, preferredKey)) return preferredKey;
  const targetLower: string = preferredKey.toLowerCase();
  for (const existingKey of Object.keys(map)) {
    if (existingKey.toLowerCase() === targetLower) return existingKey;
  }
  return preferredKey;
};

/**
 * Merge resource-list metadata into PGN headers used only for GRP rule matching and rendering.
 * Fills blank tags and replaces `[Tag "?"]`-style placeholders so session chrome matches the
 * resource table when the library row holds Type / … but PGN still has roster placeholders.
 *
 * Overlay keys are resolved **case-insensitively** against existing PGN keys so a list row
 * value under `Opening` updates `[opening "..."]` / `Opening` without duplicating keys.
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
    const writeKey: string = resolveCanonicalHeaderKey(out, k);
    const curTrimmed: string = String(out[writeKey] ?? "").trim();
    if (PLACEHOLDER_VALUES_FOR_GRP_OVERLAY.has(curTrimmed)) {
      out[writeKey] = String(v ?? "");
    }
  }
  return out;
};

/**
 * Flat header map from `PgnModel.headers` (last duplicate key in the array wins).
 */
const buildMetadataFromPgnModel = (pgnModel: unknown): Record<string, string> => {
  const metadata: Record<string, string> = {};
  const rawHeaders = (pgnModel as { headers?: unknown } | null)?.headers;
  if (!Array.isArray(rawHeaders)) return metadata;
  for (const h of rawHeaders as Array<{ key?: unknown; value?: unknown }>) {
    if (typeof h?.key === "string" && h.key) metadata[h.key] = typeof h.value === "string" ? h.value : "";
  }
  return metadata;
};

/**
 * When `Opening` is still blank after merging bracket tags, model, and overlay, derive it from the
 * ECO opening tree using mainline SAN moves (same dataset as {@link lookupEco} / save-time stamping
 * in `getPgnText`). Does not mutate the PGN model — only the map used for GRP rule rendering.
 *
 * @param metadata - Merged header map.
 * @param mainlineMoves - Session mainline SAN tokens (e.g. `GameSessionState.moves`).
 */
export const enrichMetadataWithEcoDerivedOpening = (
  metadata: Record<string, string>,
  mainlineMoves: readonly string[] | null | undefined,
): Record<string, string> => {
  const openingTrim: string = getMetadataValueIgnoreKeyCase(metadata, "Opening").trim();
  if (openingTrim !== "") return metadata;
  const moves: readonly string[] = Array.isArray(mainlineMoves) ? mainlineMoves : [];
  if (moves.length === 0) return metadata;
  const match = lookupEco([...moves]);
  if (match == null) return metadata;
  const out: Record<string, string> = { ...metadata };
  const openingWriteKey: string = resolveCanonicalHeaderKey(out, "Opening");
  out[openingWriteKey] = match.name;
  const ecoTrim: string = getMetadataValueIgnoreKeyCase(metadata, "ECO").trim();
  if (ecoTrim === "") {
    const ecoWriteKey: string = resolveCanonicalHeaderKey(out, "ECO");
    out[ecoWriteKey] = match.eco;
  }
  return out;
};

/**
 * Header map for session-tab GRP: same bracket-tag basis as DB `list` metadata
 * (`extractPgnMetadataFromSource` on stored `pgn_text`), then live `pgnModel` values (so edits win),
 * then `resourceMetadataOverlay` from the resource row.
 *
 * @param pgnModel - Parsed model for this session (active or snapshot).
 * @param pgnText - Stored PGN string for the session (matches DB blob for db resources).
 * @param overlay - List-row metadata from open / workspace restore.
 * @param mainlineMoves - Optional SAN list so an empty `Opening` tag can still resolve via ECO lookup.
 */
export const buildSessionMetadataForGrp = (
  pgnModel: unknown,
  pgnText: string,
  overlay: Record<string, string> | null | undefined,
  mainlineMoves?: readonly string[] | null,
): Record<string, string> => {
  const fromBracketTags: Record<string, string> = extractPgnMetadataFromSource(String(pgnText ?? "")).metadata;
  const fromModel: Record<string, string> = buildMetadataFromPgnModel(pgnModel);
  const mergedBeforeOverlay: Record<string, string> = { ...fromBracketTags, ...fromModel };
  let merged: Record<string, string> = mergeResourceMetadataOverlayForGrp(mergedBeforeOverlay, overlay);
  merged = enrichMetadataWithEcoDerivedOpening(merged, mainlineMoves ?? null);
  return merged;
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

export type SessionTabGrpTextResult = {
  line1: string;
  line2: string;
  /** False when neither `display1` nor `display2` resolved for this metadata. */
  matched: boolean;
};

/**
 * Two-line strings for session tabs: combines **Table (display1)** and **Full/detail (display2)**
 * from the same metadata so the tab strip can show a subtitle when the second line lives only
 * on the detail slot (resource table still uses one slot at a time per row).
 *
 * @param metadata - Header map for GRP.
 * @param profile - Schema rendering profile.
 * @param schemaFields - Optional field defs for select matching.
 */
export const renderSessionTabGrpText = (
  metadata: Record<string, string>,
  profile: GameRenderingProfile,
  schemaFields?: readonly MetadataFieldDefinition[],
): SessionTabGrpTextResult => {
  const d1: GameRenderingDisplay | null = resolveDisplay(metadata, profile, "display1", schemaFields);
  const d2: GameRenderingDisplay | null = resolveDisplay(metadata, profile, "display2", schemaFields);
  const hasDisplaySlot: boolean = d1 !== null || d2 !== null;
  if (!hasDisplaySlot) {
    return { line1: "", line2: "", matched: false };
  }
  const t1: { line1: string; line2: string } =
    d1 === null ? { line1: "", line2: "" } : renderDisplayText(d1, metadata);
  const t2: { line1: string; line2: string } =
    d2 === null ? { line1: "", line2: "" } : renderDisplayText(d2, metadata);

  let line1: string = t1.line1.trim();
  if (line1 === "") {
    line1 = t2.line1.trim();
  }

  let line2: string = t1.line2.trim();
  if (line2 === "") {
    const t2l1: string = t2.line1.trim();
    const t2l2: string = t2.line2.trim();
    if (t2l1 !== "" && t2l1 !== line1) {
      line2 = t2l1;
    } else if (t2l2 !== "") {
      line2 = t2l2;
    }
  }
  return { line1, line2, matched: true };
};

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
 * Batch-render GRP lines for resource-table rows using the same **display1 + display2** merge as
 * session tabs (`renderSessionTabGrpText`). Rows with no resolvable GRP display are omitted — callers
 * fall back to `row.game` in the UI.
 */
export const buildRenderedGameMap = <R extends { game: string; metadata: Record<string, string> }>(
  rows: readonly R[],
  profile: GameRenderingProfile,
  schemaFields?: readonly MetadataFieldDefinition[],
): Map<R, RenderedGameDisplay> => {
  const map = new Map<R, RenderedGameDisplay>();
  for (const row of rows) {
    const { line1, line2, matched } = renderSessionTabGrpText(row.metadata, profile, schemaFields);
    if (!matched) {
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
          `buildRenderedGameMap: row omitted (no GRP display) recordId=${rid || "n/a"} Type=${getMetadataValueIgnoreKeyCase(row.metadata, "Type")}`,
      );
      continue;
    }
    const resolved1: string = line1 || row.game;
    const line2Out: string = line2;
    const filterText: string = line2Out ? `${resolved1} ${line2Out}` : resolved1;
    map.set(row, { line1: resolved1, line2: line2Out, filterText });
  }
  return map;
};
