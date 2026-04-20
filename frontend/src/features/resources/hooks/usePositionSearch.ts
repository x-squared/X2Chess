/**
 * usePositionSearch — derives the current board FEN, hashes it, and fans out a
 * cross-resource position search across all open DB resource tabs.
 *
 * Integration API:
 * - `const { results, loading, search } = usePositionSearch()` — call in any
 *   component that needs to trigger or display position search results.
 *
 * Configuration API:
 * - None.  Reads open resource tabs from `AppStoreState` and the current board
 *   position from `moves` + `currentPly`.
 *
 * Communication API:
 * - Inbound: calls `services.searchByPosition` (provided by `ServiceContext`).
 * - Outbound: returns `results` (flat list of hits), `loading` flag, and a
 *   stable `search` callback to trigger a new search.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { Chess } from "chess.js";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import { useServiceContext } from "../../../app/providers/ServiceProvider";
import {
  selectMoves,
  selectCurrentPly,
  selectBoardPreview,
  selectResourceViewerTabs,
} from "../../../core/state/selectors";
import { hashFen } from "../../../resources/position_indexer";
import type { PositionSearchHit } from "../../../../../parts/resource/src/client/search_coordinator";
import { isPgnResourceRef, type PgnResourceRef } from "../../../../../parts/resource/src/domain/resource_ref";
import { resourceDomainEvents } from "../../../core/events/resource_domain_events";
import { matchesResourceRefSet, toResourceKey } from "../services/resource_event_matching";
import { shouldTriggerLiveRefresh } from "../services/resource_live_refresh";

export type PositionSearchState = {
  results: PositionSearchHit[];
  loading: boolean;
  search: () => void;
};

export type PositionSearchOptions = {
  liveRefreshEnabled?: boolean;
};

/** Replay `ply` SAN moves and return the resulting FEN string. */
const fenAtPly = (moves: string[], ply: number): string => {
  const game = new Chess();
  const slice = moves.slice(0, ply);
  for (const san of slice) {
    try {
      game.move(san);
    } catch {
      break;
    }
  }
  return game.fen();
};

/**
 * Fan out a position hash search across all open DB resource tabs.
 *
 * @returns `PositionSearchState` with `results`, `loading` flag, and a stable `search` callback.
 */
export const usePositionSearch = ({ liveRefreshEnabled = true }: PositionSearchOptions = {}): PositionSearchState => {
  const { state } = useAppContext();
  const services = useServiceContext();

  const [results, setResults] = useState<PositionSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);

  const boardPreview = selectBoardPreview(state);
  const moves = selectMoves(state);
  const ply = selectCurrentPly(state);
  const tabs = selectResourceViewerTabs(state);

  const fen: string = boardPreview?.fen ?? fenAtPly(moves, ply);
  const positionHash: string = hashFen(fen);
  const resourceRefs: PgnResourceRef[] = tabs
    .map((tab) => ({ kind: tab.kind, locator: tab.locator }))
    .filter(isPgnResourceRef);
  const refsKey: string = resourceRefs.map((ref: PgnResourceRef): string => `${ref.kind}:${ref.locator}`).join("|");
  const resourceRefSet: Set<string> = useMemo(
    (): Set<string> =>
      new Set<string>(resourceRefs.map((ref: PgnResourceRef): string => toResourceKey(ref.kind, ref.locator))),
    [refsKey],
  );

  const search = useCallback((): void => {
    if (resourceRefs.length === 0) {
      setResults([]);
      setHasSearched(true);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    void services.searchByPosition(positionHash, resourceRefs).then((hits) => {
      setResults(hits);
      setLoading(false);
    });
  }, [positionHash, refsKey, services]);

  useEffect((): (() => void) => {
    const unsubscribe: () => void = resourceDomainEvents.subscribe((event): void => {
      if (event.type !== "resource.resourceChanged") return;
      const hasMatchingRef: boolean = matchesResourceRefSet(event.resourceRef, resourceRefSet);
      const shouldRefresh: boolean = shouldTriggerLiveRefresh({
        liveRefreshEnabled,
        hasSearched,
        isLoading: loading,
        hasMatchingResourceRef: hasMatchingRef,
      });
      if (!shouldRefresh) return;
      setRefreshRevision((value: number): number => value + 1);
    });
    return (): void => {
      unsubscribe();
    };
  }, [hasSearched, liveRefreshEnabled, loading, resourceRefSet]);

  useEffect((): void => {
    if (!liveRefreshEnabled || !hasSearched || refreshRevision === 0) return;
    search();
  }, [liveRefreshEnabled, hasSearched, refreshRevision, search]);

  return { results, loading, search };
};
