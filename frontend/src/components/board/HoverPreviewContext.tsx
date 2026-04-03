/**
 * HoverPreviewContext — ephemeral position-preview popup state.
 *
 * Intent:
 * - Provide a shared channel so any move-rendering component can trigger a
 *   floating mini-board popup without prop-drilling through the full tree.
 * - State is local `useState` (not reducer) because hover position is volatile
 *   UI feedback with no persistence requirement.
 *
 * Integration API:
 * - Wrap the app tree with `<HoverPreviewProvider>`.
 * - Place `<HoverPositionPopup />` anywhere inside the provider.
 * - Consume with `useHoverPreview()` in any component that renders move tokens.
 *
 * Configuration API:
 * - No configuration.
 *
 * Communication API:
 * - `showPreview(fen, lastMove, anchorRect)` — show popup near `anchorRect`.
 * - `hidePreview()` — dismiss popup.
 * - `previewState` — current popup position/FEN (null when hidden).
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

const POPUP_SIZE = 200;

/** Visible state of the hover preview popup. */
export type HoverPreviewState = {
  fen: string;
  lastMove: [string, string] | null;
  x: number;
  y: number;
};

export type HoverPreviewContextValue = {
  previewState: HoverPreviewState | null;
  showPreview: (
    fen: string,
    lastMove: [string, string] | null,
    anchorRect: DOMRect,
  ) => void;
  hidePreview: () => void;
};

export const HoverPreviewContext = createContext<HoverPreviewContextValue>({
  previewState: null,
  showPreview: () => undefined,
  hidePreview: () => undefined,
});

/** Mount once near the app root to enable position preview on hover. */
export const HoverPreviewProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [previewState, setPreviewState] = useState<HoverPreviewState | null>(null);

  const showPreview = useCallback(
    (fen: string, lastMove: [string, string] | null, anchorRect: DOMRect): void => {
      // Default: below-left of anchor.
      let x = anchorRect.left;
      let y = anchorRect.bottom + 8;

      // Flip above if popup would overflow the viewport bottom.
      if (y + POPUP_SIZE > window.innerHeight) {
        y = anchorRect.top - POPUP_SIZE - 8;
      }

      // Clamp to left edge of viewport.
      if (x + POPUP_SIZE > window.innerWidth) {
        x = window.innerWidth - POPUP_SIZE - 4;
      }
      if (x < 0) x = 0;

      setPreviewState({ fen, lastMove, x, y });
    },
    [],
  );

  const hidePreview = useCallback((): void => {
    setPreviewState(null);
  }, []);

  return (
    <HoverPreviewContext.Provider value={{ previewState, showPreview, hidePreview }}>
      {children}
    </HoverPreviewContext.Provider>
  );
};

/** Access the hover preview context. Must be used inside `HoverPreviewProvider`. */
export const useHoverPreview = (): HoverPreviewContextValue => useContext(HoverPreviewContext);
