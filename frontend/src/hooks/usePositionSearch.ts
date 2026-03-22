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

import { useState, useCallback } from "react";
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
import type { PositionSearchHit } from "../../../resource/client/search_coordinator";
import { isPgnResourceRef, type PgnResourceRef } from "../../../resource/domain/resource_ref";

export type PositionSearchState = {
  results: PositionSearchHit[];
  loading: boolean;
  search: () => void;
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

export const usePositionSearch = (): PositionSearchState => {
  const { state } = useAppContext();
  const services = useServiceContext();

  const [results, setResults] = useState<PositionSearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback((): void => {
    const boardPreview = selectBoardPreview(state);
    const moves = selectMoves(state);
    const ply = selectCurrentPly(state);
    const tabs = selectResourceViewerTabs(state);

    // Determine the FEN to search: use board preview when off main line.
    const fen: string = boardPreview?.fen ?? fenAtPly(moves, ply);

    // Fan out to all open resource tabs (any kind — adapters that do not
    // support position search return an empty array silently).
    const resourceRefs: PgnResourceRef[] = tabs
      .map((tab) => ({ kind: tab.kind, locator: tab.locator }))
      .filter(isPgnResourceRef);

    if (resourceRefs.length === 0) {
      setResults([]);
      return;
    }

    const positionHash: string = hashFen(fen);
    setLoading(true);
    void services.searchByPosition(positionHash, resourceRefs).then((hits) => {
      setResults(hits);
      setLoading(false);
    });
  }, [state, services]);

  return { results, loading, search };
};
