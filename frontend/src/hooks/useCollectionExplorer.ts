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

import { useState, useEffect } from "react";
import { Chess } from "chess.js";
import { useAppContext } from "../state/app_context";
import { useServiceContext } from "../state/ServiceContext";
import {
  selectMoves,
  selectCurrentPly,
  selectBoardPreview,
  selectResourceViewerTabs,
} from "../state/selectors";
import { hashFen } from "../resources/position_indexer";
import { isPgnResourceRef } from "../../../resource/domain/resource_ref";
import type { MoveFrequencyEntry } from "../../../resource/domain/move_frequency";
import type { PgnResourceRef } from "../../../resource/domain/resource_ref";

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
  }, [positionHash, refsKey]);

  return { entries, loading };
};
