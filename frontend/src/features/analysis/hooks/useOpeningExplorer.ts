/**
 * useOpeningExplorer — React hook for opening explorer state.
 *
 * Queries the Lichess opening explorer for the current position,
 * debounced 200ms. Exposes the result and loading state to the UI.
 *
 * Integration API:
 * - `const explorer = useOpeningExplorer(fen, speeds?, ratings?)` — pass the
 *   current board FEN and optional Lichess filter settings from E9.
 *
 * Communication API:
 * - Returns `{ result, isLoading, source, setSource, enabled, setEnabled }`
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { OpeningResult, OpeningQueryOptions } from "../../../resources/ext_databases/opening_types";
import { LICHESS_OPENING_ADAPTER } from "../../../resources/ext_databases/lichess_opening";

export type OpeningExplorerState = {
  result: OpeningResult | null;
  isLoading: boolean;
  source: "masters" | "lichess";
  setSource: (source: "masters" | "lichess") => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

/**
 * Query the Lichess opening explorer for the given board position.
 *
 * Queries are debounced 200 ms and cancelled when the FEN or source changes.
 *
 * @param fen Current board FEN string.
 * @param speeds Lichess time-control filter (e.g. `["blitz", "rapid"]`). Defaults to all speeds.
 * @param ratings Rating bucket filter (e.g. `[2000, 2200]`). Defaults to all rating buckets.
 * @returns Opening explorer state with `result`, `isLoading`, `source`, `setSource`, `enabled`, `setEnabled`.
 */
export const useOpeningExplorer = (
  fen: string,
  speeds: string[] = [],
  ratings: number[] = [],
): OpeningExplorerState => {
  const [result, setResult] = useState<OpeningResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<"masters" | "lichess">("masters");
  const [enabled, setEnabled] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResult = useCallback(
    async (
      queryFen: string,
      querySource: "masters" | "lichess",
      querySpeeds: string[],
      queryRatings: number[],
    ): Promise<void> => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);

      const options: OpeningQueryOptions = {
        source: querySource,
        speeds: querySpeeds.length > 0 ? querySpeeds : undefined,
        ratings: queryRatings.length > 0 ? queryRatings : undefined,
      };
      const data = await LICHESS_OPENING_ADAPTER.query(queryFen, options);

      setResult(data);
      setIsLoading(false);
    },
    [],
  );

  useEffect((): (() => void) => {
    if (!enabled) return (): void => {};

    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout((): void => {
      void fetchResult(fen, source, speeds, ratings);
    }, 200);

    return (): void => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
    // speeds/ratings are arrays — compare by join to avoid unnecessary re-fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, source, enabled, fetchResult, speeds.join(","), ratings.join(",")]);

  // Clear result when disabled.
  useEffect((): void => {
    if (!enabled) {
      setResult(null);
      setIsLoading(false);
    }
  }, [enabled]);

  return { result, isLoading, source, setSource, enabled, setEnabled };
};
