/**
 * search_coordinator — fans out searches across multiple resource adapters.
 *
 * Integration API:
 * - Primary exports: `searchAcrossResources`, `searchTextAcrossResources`,
 *   `exploreAcrossResources`.
 * - Accepts a list of resource refs and a callback (supplied by the resource
 *   client) so the coordinator itself has no direct adapter dependency.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Pure async functions; all I/O delegated to the caller-supplied callbacks.
 * - Results are merged across resources; individual failures are silent.
 */

import type { PgnGameRef } from "../domain/game_ref";
import type { PgnResourceRef } from "../domain/resource_ref";
import type { MoveFrequencyEntry } from "../domain/move_frequency";

// ── Result type ───────────────────────────────────────────────────────────────

/**
 * A single game found during cross-resource position search.
 * Carries both the canonical game reference and the resource it belongs to.
 */
export type PositionSearchHit = {
  gameRef: PgnGameRef;
  resourceRef: PgnResourceRef;
};

/**
 * A single game found during cross-resource full-text search.
 * Same shape as `PositionSearchHit`; named separately for call-site clarity.
 */
export type TextSearchHit = {
  gameRef: PgnGameRef;
  resourceRef: PgnResourceRef;
};

// ── Coordinator ───────────────────────────────────────────────────────────────

/**
 * Fan out a position hash search across multiple open resources.
 *
 * Results from all resources are merged into a single flat list.
 * Resources that do not support position search return zero hits silently.
 *
 * @param positionHash 16-char hex FNV-1a hash of the first four FEN fields.
 * @param resourceRefs List of canonical resource refs to search.
 * @param searchFn Async function that searches one resource; supplied by the caller
 *   so this module has no direct adapter or I/O dependency.
 * @returns Flat list of all matching game refs across all resources.
 */
export const searchAcrossResources = async (
  positionHash: string,
  resourceRefs: PgnResourceRef[],
  searchFn: (positionHash: string, resourceRef: PgnResourceRef) => Promise<PgnGameRef[]>,
): Promise<PositionSearchHit[]> => {
  const settled = await Promise.allSettled(
    resourceRefs.map(async (resourceRef: PgnResourceRef): Promise<PositionSearchHit[]> => {
      const gameRefs: PgnGameRef[] = await searchFn(positionHash, resourceRef);
      return gameRefs.map((gameRef: PgnGameRef): PositionSearchHit => ({ gameRef, resourceRef }));
    }),
  );

  const hits: PositionSearchHit[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      hits.push(...result.value);
    }
    // Rejected promises are silently ignored — one failing resource should not
    // prevent results from other resources from being returned.
  }
  return hits;
};

/**
 * Fan out a full-text search across multiple open resources.
 *
 * Results from all resources are merged into a single flat list.
 * Resources that do not support text search return zero hits silently.
 *
 * @param query Substring to match against game metadata (White, Black, Event, etc.).
 * @param resourceRefs List of canonical resource refs to search.
 * @param searchFn Async function that searches one resource; supplied by the caller.
 * @returns Flat list of all matching game refs across all resources.
 */
export const searchTextAcrossResources = async (
  query: string,
  resourceRefs: PgnResourceRef[],
  searchFn: (query: string, resourceRef: PgnResourceRef) => Promise<PgnGameRef[]>,
): Promise<TextSearchHit[]> => {
  const settled = await Promise.allSettled(
    resourceRefs.map(async (resourceRef: PgnResourceRef): Promise<TextSearchHit[]> => {
      const gameRefs: PgnGameRef[] = await searchFn(query, resourceRef);
      return gameRefs.map((gameRef: PgnGameRef): TextSearchHit => ({ gameRef, resourceRef }));
    }),
  );

  const hits: TextSearchHit[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      hits.push(...result.value);
    }
  }
  return hits;
};

/**
 * Fan out a position exploration across multiple open resources and merge the
 * per-move frequency counts into a single list sorted by total count descending.
 *
 * Moves with the same UCI from different resources are combined: their counts
 * and result tallies are summed. Resources that do not support exploration
 * return zero entries silently.
 *
 * @param positionHash 16-char hex FNV-1a hash of the position to explore.
 * @param resourceRefs List of canonical resource refs to query.
 * @param exploreFn Async function that queries one resource.
 * @returns Merged move-frequency list sorted by count descending.
 */
export const exploreAcrossResources = async (
  positionHash: string,
  resourceRefs: PgnResourceRef[],
  exploreFn: (positionHash: string, resourceRef: PgnResourceRef) => Promise<MoveFrequencyEntry[]>,
): Promise<MoveFrequencyEntry[]> => {
  const settled = await Promise.allSettled(
    resourceRefs.map((ref: PgnResourceRef) => exploreFn(positionHash, ref)),
  );

  const byUci = new Map<string, MoveFrequencyEntry>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const entry of result.value) {
      const existing = byUci.get(entry.uci);
      if (existing) {
        existing.count      += entry.count;
        existing.whiteWins  += entry.whiteWins;
        existing.draws      += entry.draws;
        existing.blackWins  += entry.blackWins;
      } else {
        byUci.set(entry.uci, { ...entry });
      }
    }
  }

  return [...byUci.values()].sort((a, b) => b.count - a.count);
};
