/**
 * useCollectionExplorer — reactive move-frequency explorer for own game collections.
 *
 * Automatically re-queries whenever the board position or open resource tabs
 * change. Results are merged across all open resource tabs that support the
 * move-edge index (DB resources); others contribute nothing silently.
 *
 * Integration API:
 * - `const { entries, loading } = useCollectionExplorer()` — call in any
 *   component that needs live move-frequency data.
 *
 * Configuration API:
 * - None. Reads position from `AppStoreState`.
 *
 * Communication API:
 * - Inbound: calls `services.explorePosition`.
 * - Outbound: `entries` sorted by count descending, `loading` flag.
 */

import { useState, useEffect, useMemo } from "react";
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
import { isPgnResourceRef } from "../../../../../parts/resource/src/domain/resource_ref";
import type { MoveFrequencyEntry } from "../../../../../parts/resource/src/domain/move_frequency";
import type { PgnResourceRef } from "../../../../../parts/resource/src/domain/resource_ref";
import { resourceDomainEvents } from "../../../core/events/resource_domain_events";

export type CollectionExplorerState = {
  entries: MoveFrequencyEntry[];
  loading: boolean;
};

/** Replay `ply` SAN moves and return the resulting FEN. */
const fenAtPly = (moves: string[], ply: number): string => {
  const game = new Chess();
  for (const san of moves.slice(0, ply)) {
    try { game.move(san); } catch { break; }
  }
  return game.fen();
};

/**
 * Subscribe to live move-frequency data for the current board position across all open DB resources.
 *
 * @returns `CollectionExplorerState` with `entries` (sorted by count descending) and `loading` flag.
 */
export const useCollectionExplorer = (): CollectionExplorerState => {
  const { state } = useAppContext();
  const services = useServiceContext();

  const [entries, setEntries] = useState<MoveFrequencyEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);

  const boardPreview = selectBoardPreview(state);
  const moves       = selectMoves(state);
  const ply         = selectCurrentPly(state);
  const tabs        = selectResourceViewerTabs(state);

  const fen: string = boardPreview?.fen ?? fenAtPly(moves, ply);
  const positionHash: string = hashFen(fen);

  const resourceRefs: PgnResourceRef[] = tabs
    .map((tab) => ({ kind: tab.kind, locator: tab.locator }))
    .filter(isPgnResourceRef);

  // Stringify for stable effect dependency.
  const refsKey = resourceRefs.map((r) => `${r.kind}:${r.locator}`).join("|");
  const resourceRefSet: Set<string> = useMemo(
    (): Set<string> =>
      new Set<string>(resourceRefs.map((ref: PgnResourceRef): string => `${ref.kind}:${ref.locator}`)),
    [refsKey],
  );

  useEffect((): (() => void) => {
    const unsubscribe: () => void = resourceDomainEvents.subscribe((event): void => {
      if (event.type !== "resource.resourceChanged") return;
      const hasMatchingRef: boolean = resourceRefSet.has(
        `${event.resourceRef.kind}:${event.resourceRef.locator}`,
      );
      if (!hasMatchingRef) return;
      setRefreshRevision((value: number): number => value + 1);
    });
    return (): void => {
      unsubscribe();
    };
  }, [refsKey, resourceRefSet]);

  useEffect(() => {
    if (resourceRefs.length === 0) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void services.explorePosition(positionHash, resourceRefs).then((hits) => {
      if (!cancelled) {
        setEntries(hits);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionHash, refsKey, refreshRevision]);

  return { entries, loading };
};
