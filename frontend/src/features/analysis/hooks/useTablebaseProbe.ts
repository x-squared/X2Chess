/**
 * useTablebaseProbe — React hook for endgame tablebase probe state.
 *
 * Probes the Lichess 7-piece tablebase for the current position,
 * debounced 200ms. Only activates when the position has ≤ 7 pieces.
 *
 * Integration API:
 * - `const tb = useTablebaseProbe(fen)` — pass the current board FEN.
 *
 * Communication API:
 * - Returns `{ result, isLoading, enabled, setEnabled }`
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { TbProbeResult } from "../../../resources/ext_databases/endgame_types";
import { LICHESS_TB_ADAPTER } from "../../../resources/ext_databases/lichess_tb";

export type TablebaseProbeState = {
  result: TbProbeResult | null;
  isLoading: boolean;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

/** Count pieces in a FEN string. */
const fenPieceCount = (fen: string): number => {
  const board = fen.split(" ")[0] ?? "";
  let count = 0;
  for (const ch of board) {
    if (/[a-zA-Z]/.test(ch)) count++;
  }
  return count;
};

/**
 * Probe the Lichess 7-piece tablebase for the given board position.
 *
 * Only activates when the position has ≤ 7 pieces; probes are debounced 200 ms.
 *
 * @param fen Current board FEN string.
 * @returns Tablebase probe state with `result`, `isLoading`, `enabled`, and `setEnabled`.
 */
export const useTablebaseProbe = (fen: string): TablebaseProbeState => {
  const [result, setResult] = useState<TbProbeResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResult = useCallback(async (queryFen: string): Promise<void> => {
    setIsLoading(true);
    const data = await LICHESS_TB_ADAPTER.probe(queryFen);
    setResult(data);
    setIsLoading(false);
  }, []);

  useEffect((): (() => void) => {
    if (!enabled) return (): void => {};
    if (fenPieceCount(fen) > 7) {
      setResult(null);
      setIsLoading(false);
      return (): void => {};
    }

    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout((): void => {
      void fetchResult(fen);
    }, 200);

    return (): void => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, [fen, enabled, fetchResult]);

  // Clear result when disabled.
  useEffect((): void => {
    if (!enabled) {
      setResult(null);
      setIsLoading(false);
    }
  }, [enabled]);

  return { result, isLoading, enabled, setEnabled };
};
