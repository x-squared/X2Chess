import { useEffect } from "react";
import type { RefObject } from "react";
import { createIngressEventHandlers } from "../game_sessions/ingress_handlers";
import type { OpenGameOptions } from "../game_sessions/ingress_handlers";

/**
 * useGameIngress — binds drag/drop and paste event handlers for PGN game ingress.
 *
 * Attaches dragenter/dragover/dragleave/drop listeners to the given panel element
 * and a paste listener to `window`. All listeners are cleaned up on unmount.
 *
 * Integration API:
 * - `useGameIngress(deps)` — call once inside `AppShell` with stable refs and callbacks.
 *
 * Configuration API:
 * - `appPanelRef`: ref to the element that receives drag events.
 * - `overlayRef`: ref to the drop-overlay element whose `hidden` attribute is toggled.
 * - `isLikelyPgnText`: pure predicate for detecting PGN content.
 * - `openPgnText`: callback invoked with validated PGN text to open a game.
 * - `resolveUrl`: optional callback invoked when pasted/dropped text is an HTTP URL.
 *
 * Communication API:
 * - Outbound: calls `openPgnText` and `resolveUrl` on user drop/paste.
 * - Inbound: reads `appPanelRef.current` and `overlayRef.current` at effect mount.
 */

type OpenPgnOptions = {
  preferredTitle?: string;
  sourceRef?: { kind: string; locator: string; recordId?: string } | null;
};

type UseGameIngressDeps = {
  appPanelRef: RefObject<Element | null>;
  overlayRef: RefObject<HTMLElement | null>;
  isLikelyPgnText: (value: string) => boolean;
  openPgnText: (pgnText: string, options?: OpenPgnOptions) => void;
  resolveUrl?: ((url: string) => Promise<void>) | undefined;
};

/**
 * Bind drag-and-drop and paste event handlers for PGN game ingress.
 *
 * @param deps.appPanelRef Ref to the element that receives drag events.
 * @param deps.overlayRef Ref to the drop-overlay element whose `hidden` attribute is toggled.
 * @param deps.isLikelyPgnText Predicate returning `true` when a string looks like PGN.
 * @param deps.openPgnText Callback invoked with validated PGN text on drop or paste.
 * @param deps.resolveUrl Optional callback invoked when pasted or dropped text is an HTTP URL.
 */
export const useGameIngress = ({
  appPanelRef,
  overlayRef,
  isLikelyPgnText,
  openPgnText,
  resolveUrl,
}: UseGameIngressDeps): void => {
  useEffect((): (() => void) => {
    const appPanelEl: Element | null = appPanelRef.current;

    const { handleDragEnter, handleDragOver, handleDragLeave, handleDrop, handlePaste, handleDocumentDragLeave } =
      createIngressEventHandlers({
        isLikelyPgnText,
        openGameFromIncomingText: (pgnText: string, options?: OpenGameOptions): void => {
          openPgnText(pgnText, {
            preferredTitle: options?.preferredTitle,
            sourceRef: options?.sourceRef ?? null,
          });
        },
        setDropOverlayVisible: (visible: boolean): void => {
          if (overlayRef.current) overlayRef.current.hidden = !visible;
        },
        resolveUrl,
      });

    if (appPanelEl) {
      appPanelEl.addEventListener("dragenter", handleDragEnter);
      appPanelEl.addEventListener("dragover", handleDragOver);
      appPanelEl.addEventListener("dragleave", handleDragLeave);
      appPanelEl.addEventListener("drop", handleDrop);
    }
    document.addEventListener("dragleave", handleDocumentDragLeave);
    globalThis.addEventListener("paste", handlePaste);

    return (): void => {
      if (appPanelEl) {
        appPanelEl.removeEventListener("dragenter", handleDragEnter);
        appPanelEl.removeEventListener("dragover", handleDragOver);
        appPanelEl.removeEventListener("dragleave", handleDragLeave);
        appPanelEl.removeEventListener("drop", handleDrop);
      }
      document.removeEventListener("dragleave", handleDocumentDragLeave);
      globalThis.removeEventListener("paste", handlePaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
