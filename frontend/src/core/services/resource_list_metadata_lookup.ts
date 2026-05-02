/**
 * resource_list_metadata_lookup — normalize `listGamesForResource` row metadata and
 * find the row for a given `recordId`.
 *
 * Used when opening games from a resource and when re-attaching list metadata after
 * workspace restore (see `workspace_restore_resource_metadata.ts`).
 */

import { normalizeOptionalRecordId } from "./session_helpers";

/**
 * Normalize a resource `metadata` object to string values for rendering rules and hydration.
 *
 * @param raw - Row `metadata` from `listGamesForResource`, shape may vary by adapter.
 * @returns Flat string map.
 */
export const normalizeResourceMetadataRow = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (raw == null || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") {
      out[k] = v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = String(v);
    } else if (typeof v === "boolean") {
      out[k] = v ? "true" : "false";
    } else if (Array.isArray(v)) {
      const first: unknown = v.find(
        (item: unknown): boolean => typeof item === "string" && String(item).trim() !== "",
      );
      if (typeof first === "string") {
        out[k] = first;
      }
    }
  }
  return out;
};

/**
 * Find normalized metadata for the list row whose `sourceRef.recordId` or `identifier`
 * matches `recordId`.
 *
 * @param rows - Entries returned from `listGamesForResource`.
 * @param recordId - Game id within the resource.
 * @returns Normalized metadata, or `null` if no row matches.
 */
export const findResourceRowMetadataByRecordId = (
  rows: readonly unknown[],
  recordId: string,
): Record<string, string> | null => {
  const id: string = String(recordId ?? "").trim();
  if (!id) return null;
  const row = (rows as Array<Record<string, unknown>>).find((r: Record<string, unknown>): boolean => {
    const ref = r.sourceRef as Record<string, unknown> | null | undefined;
    const rowRecordId: string = normalizeOptionalRecordId(ref?.recordId) ?? "";
    const rowIdentifier: string = normalizeOptionalRecordId(r.identifier) ?? "";
    return rowRecordId === id || rowIdentifier === id;
  });
  if (!row) return null;
  return normalizeResourceMetadataRow(row.metadata);
};
