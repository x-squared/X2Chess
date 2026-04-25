/**
 * Metadata inheritance resolution.
 *
 * Integration API:
 * - Primary export: `resolveInheritedMetadata`.
 *
 * Configuration API:
 * - `MAX_INHERITANCE_DEPTH` (3) caps chain traversal depth.
 *
 * Communication API:
 * - Pure synchronous function; no I/O. Operates on an already-loaded
 *   `PgnGameEntry` array — the caller must have fetched all entries first.
 */

import type { PgnGameEntry } from "./game_entry";
import type { MetadataFieldDefinition, MetadataSchema } from "./metadata_schema";

const MAX_INHERITANCE_DEPTH = 3;

const hasValue = (v: string | string[] | undefined): boolean =>
  v !== undefined && (Array.isArray(v) ? v.length > 0 : v !== "");

const fillFromMeta = (
  result: Record<string, string | string[]>,
  missingKeys: readonly string[],
  meta: Record<string, string | string[]>,
): void => {
  for (const key of missingKeys) {
    if (result[key] === undefined) {
      const val = meta[key];
      if (hasValue(val)) result[key] = val!;
    }
  }
};

const nextHopId = (
  meta: Record<string, string | string[]>,
  referenceFields: readonly MetadataFieldDefinition[],
  visited: ReadonlySet<string>,
): string | undefined => {
  for (const refField of referenceFields) {
    const v = meta[refField.key];
    if (typeof v === "string" && v !== "" && !visited.has(v)) return v;
  }
  return undefined;
};

/**
 * Follow one reference chain starting at `startId`, collecting fallback values
 * for `missingKeys`. Stops when all keys are resolved, the chain ends, a cycle
 * is detected, or `MAX_INHERITANCE_DEPTH` hops are exhausted.
 *
 * `ownerId` is pre-added to the visited set so a game cannot reference itself.
 */
const resolveChain = (
  startId: string,
  ownerId: string,
  missingKeys: readonly string[],
  referenceFields: readonly MetadataFieldDefinition[],
  metaMap: ReadonlyMap<string, Record<string, string | string[]>>,
): Record<string, string | string[]> => {
  const result: Record<string, string | string[]> = {};
  const visited = new Set<string>([ownerId]);
  let currentId: string = startId;

  for (let depth = 0; depth < MAX_INHERITANCE_DEPTH; depth++) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const meta = metaMap.get(currentId);
    if (meta === undefined) break;

    fillFromMeta(result, missingKeys, meta);
    if (missingKeys.every((k) => result[k] !== undefined)) break;

    const next = nextHopId(meta, referenceFields, visited);
    if (next === undefined) break;
    currentId = next;
  }

  return result;
};

/**
 * Resolve inherited metadata values for a list of game entries according to
 * the active schema.
 *
 * For each entry that has a `reference`-type field set, fields marked
 * `referenceable` in the schema are filled in from the referenced game when
 * the entry has no local value for those fields. The reference chain is
 * followed up to `MAX_INHERITANCE_DEPTH` hops; cycles are detected via a
 * visited set and silently stopped.
 *
 * Operates entirely in memory on the already-loaded entry array — no I/O.
 * When the schema declares no `reference` fields or no `referenceable` fields
 * the input array is returned unchanged (zero overhead).
 *
 * @param entries Game entries returned by the resource adapter.
 * @param schema Active metadata schema for this resource.
 * @returns New entry array with inherited values merged into metadata where
 *   local values were absent.
 */
export const resolveInheritedMetadata = (
  entries: PgnGameEntry[],
  schema: MetadataSchema,
): PgnGameEntry[] => {
  const referenceFields = schema.fields.filter((f) => f.type === "reference");
  const referenceableKeys = schema.fields
    .filter((f) => f.referenceable === true)
    .map((f) => f.key);

  if (referenceFields.length === 0 || referenceableKeys.length === 0) return entries;

  const hasAnyReference = entries.some((entry) =>
    referenceFields.some((refField) => {
      const v = entry.metadata[refField.key];
      return typeof v === "string" && v !== "" && v !== entry.gameRef.recordId;
    }),
  );
  if (!hasAnyReference) return entries;

  const metaMap = new Map<string, Record<string, string | string[]>>(
    entries
      .filter((e) => e.gameRef.recordId !== "")
      .map((e) => [e.gameRef.recordId, e.metadata]),
  );

  return entries.map((entry): PgnGameEntry => {
    const ownerId = entry.gameRef.recordId;

    let refTargetId: string | undefined;
    for (const refField of referenceFields) {
      const v = entry.metadata[refField.key];
      if (typeof v === "string" && v !== "" && v !== ownerId) {
        refTargetId = v;
        break;
      }
    }
    if (refTargetId === undefined) return entry;

    const missingKeys = referenceableKeys.filter((k) => !hasValue(entry.metadata[k]));
    if (missingKeys.length === 0) return entry;

    const fallbacks = resolveChain(refTargetId, ownerId, missingKeys, referenceFields, metaMap);
    if (Object.keys(fallbacks).length === 0) return entry;

    return { ...entry, metadata: { ...entry.metadata, ...fallbacks } };
  });
};
