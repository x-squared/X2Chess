/**
 * useOpeningExplorer — React hook for opening explorer state.
 *
 * Queries the Lichess opening explorer for the current position,
 * debounced 200ms. Exposes the result and loading state to the UI.
 *
 * Integration API:
 * - `const explorer = useOpeningExplorer(fen)` — pass the current board FEN.
 *
 * Communication API:
 * - Returns `{ result, isLoading, source, setSource, speeds, setSpeed, enabled, setEnabled }`
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type { OpeningResult, OpeningQueryOptions } from "../resources/ext_databases/opening_types";
import { LICHESS_OPENING_ADAPTER } from "../resources/ext_databases/lichess_opening";

export type OpeningExplorerState = {
  result: OpeningResult | null;
  isLoading: boolean;
  source: "masters" | "lichess";
  setSource: (source: "masters" | "lichess") => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

export const useOpeningExplorer = (fen: string): OpeningExplorerState => {
  const [result, setResult] = useState<OpeningResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<"masters" | "lichess">("masters");
  const [enabled, setEnabled] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchResult = useCallback(
    async (queryFen: string, querySource: "masters" | "lichess"): Promise<void> => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);

      const options: OpeningQueryOptions = { source: querySource };
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
      void fetchResult(fen, source);
    }, 200);

    return (): void => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, [fen, source, enabled, fetchResult]);

  // Clear result when disabled.
  useEffect((): void => {
    if (!enabled) {
      setResult(null);
      setIsLoading(false);
    }
  }, [enabled]);

  return { result, isLoading, source, setSource, enabled, setEnabled };
};
