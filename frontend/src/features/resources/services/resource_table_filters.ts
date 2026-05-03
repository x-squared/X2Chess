/**
 * resource_table_filters — type-aware cell-value filter predicates for ResourceTable.
 *
 * Integration API:
 * - `applyFilter(raw, filterVal, fieldDef?, resolvedRefMeta?)` — top-level predicate;
 *   delegates to type-specific helpers based on `fieldDef.type`.
 *
 * Configuration API:
 * - No I/O; all functions are pure.
 *
 * Communication API:
 * - None.
 */

import type { MetadataFieldDefinition } from "../../../../../parts/resource/src/domain/metadata_schema";

/**
 * Filter predicate for `number`-type columns.
 * Supports `>N`, `<N`, `=N` prefix operators; falls back to substring match.
 */
export const applyNumberFilter = (raw: string, filterVal: string): boolean => {
  const trimmed: string = filterVal.trim();
  const op: string = trimmed[0] ?? "";
  if (op === ">" || op === "<" || op === "=") {
    const threshold: number = Number.parseFloat(trimmed.slice(1).trim());
    const cellNum: number = Number.parseFloat(raw);
    if (!Number.isFinite(threshold) || !Number.isFinite(cellNum)) return false;
    if (op === ">") return cellNum > threshold;
    if (op === "<") return cellNum < threshold;
    return cellNum === threshold;
  }
  return raw.toLowerCase().includes(filterVal.toLowerCase());
};

/**
 * Filter predicate for `reference`-type columns.
 * Matches against concatenated game fields from pre-resolved metadata;
 * falls back to the raw `recordId` when metadata has not yet resolved.
 */
export const applyReferenceFilter = (
  recordId: string,
  filterVal: string,
  resolvedRefMeta?: Map<string, Record<string, string>>,
): boolean => {
  const meta: Record<string, string> | undefined = resolvedRefMeta?.get(recordId);
  const searchText: string = meta
    ? [meta["White"], meta["Black"], meta["Result"], meta["Event"], meta["Date"]]
        .filter(Boolean).join(" ")
    : recordId;
  return searchText.toLowerCase().includes(filterVal.toLowerCase());
};

/**
 * Apply a type-aware filter predicate to a raw cell value.
 * - `number`: supports `>N`, `<N`, `=N` prefix operators.
 * - `select`: exact match (case-insensitive); empty = show all.
 * - `reference`: substring on concatenated game fields from `resolvedRefMeta`;
 *   falls back to raw `recordId` when not yet resolved.
 * - `date` / `text`: substring match (case-insensitive).
 */
export const applyFilter = (
  raw: string,
  filterVal: string,
  fieldDef?: MetadataFieldDefinition,
  resolvedRefMeta?: Map<string, Record<string, string>>,
): boolean => {
  if (!filterVal) return true;
  const type: string = fieldDef?.type ?? "text";
  if (type === "number") return applyNumberFilter(raw, filterVal);
  if (type === "select") return raw.toLowerCase() === filterVal.toLowerCase();
  if (type === "reference") return applyReferenceFilter(raw, filterVal, resolvedRefMeta);
  return raw.toLowerCase().includes(filterVal.toLowerCase());
};
