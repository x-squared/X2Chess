/**
 * GuideInspector — developer tool for identifying component guide IDs in the
 * live UI by hovering and pressing Enter to copy the ID to the clipboard.
 *
 * Only active when developer tools are enabled (`isDeveloperToolsEnabled`).
 * Toggle with Alt+Shift+G.  While active, hovering over any element with a
 * `data-guide-id` attribute shows a highlight ring and label.  Pressing Enter
 * copies the hovered ID to the clipboard.  Escape deactivates.
 *
 * Integration API:
 * - `<GuideInspector />` — mount once in `AppShell` at the root level.
 *   Requires `<AppProvider>` and `<ServiceContextProvider>` in the tree.
 *
 * Configuration API:
 * - No props.  Reads `isDeveloperToolsEnabled` from `AppStoreState`.
 *
 * Communication API:
 * - Outbound: `navigator.clipboard.writeText(guideId)` on Enter key.
 * - Inbound: document `mousemove` and `keydown` listeners while active.
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ReactElement } from "react";
import { useAppContext } from "../../state/app_context";
import { useServiceContext } from "../../state/ServiceContext";
import { selectDevToolsEnabled } from "../../state/selectors";

type HoveredTarget = {
  guideId: string;
  rect: DOMRect;
};

/** Physical key code for the toggle shortcut — works across all keyboard layouts. */
const TOGGLE_CODE = "KeyG";

/** Renders an absolutely-positioned ring and label for the hovered element. */
const HighlightOverlay = ({ target }: { target: HoveredTarget }): ReactElement => {
  const { rect, guideId } = target;
  const labelTop: number = rect.bottom + window.scrollY + 4;
  const labelLeft: number = rect.left + window.scrollX;

  return createPortal(
    <>
      {/* Highlight ring */}
      <div
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          outline: "2px solid #f97316",
          outlineOffset: "1px",
          borderRadius: "3px",
          pointerEvents: "none",
          zIndex: 99998,
          boxSizing: "border-box",
        }}
        aria-hidden="true"
      />
      {/* Label */}
      <div
        style={{
          position: "fixed",
          top: labelTop,
          left: labelLeft,
          background: "rgba(15,15,15,0.92)",
          color: "#f97316",
          padding: "2px 7px",
          fontSize: "11px",
          fontFamily: "monospace",
          fontWeight: 600,
          borderRadius: "4px",
          pointerEvents: "none",
          zIndex: 99999,
          whiteSpace: "nowrap",
          maxWidth: "90vw",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        aria-hidden="true"
      >
        {guideId}
        <span style={{ opacity: 0.6, marginLeft: "0.5em" }}>(↵ copy)</span>
      </div>
    </>,
    document.body,
  );
};

/** Active badge shown in the corner when inspector mode is on. */
const ActiveBadge = (): ReactElement =>
  createPortal(
    <div
      style={{
        position: "fixed",
        bottom: "0.5rem",
        right: "0.5rem",
        background: "#f97316",
        color: "#fff",
        padding: "3px 8px",
        fontSize: "11px",
        fontFamily: "monospace",
        fontWeight: 700,
        borderRadius: "5px",
        pointerEvents: "none",
        zIndex: 99997,
        opacity: 0.9,
      }}
      aria-hidden="true"
    >
      INSPECT ⌥⇧G
    </div>,
    document.body,
  );

/** Developer component inspector — hover any guide-annotated element to identify it. */
export const GuideInspector = (): ReactElement | null => {
  const { state } = useAppContext();
  const services = useServiceContext();
  const devToolsEnabled: boolean = selectDevToolsEnabled(state);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [hovered, setHovered] = useState<HoveredTarget | null>(null);
  const hoveredRef = useRef<HoveredTarget | null>(null);
  hoveredRef.current = hovered;

  // Keyboard: toggle on Alt+Shift+G (uses e.code for cross-platform Mac support).
  // Works even before dev tools are explicitly enabled — first press enables them.
  useEffect((): (() => void) => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const isToggle: boolean = e.code === TOGGLE_CODE && e.altKey && e.shiftKey;
      if (isToggle) {
        e.preventDefault();
        if (!devToolsEnabled) services.setDeveloperToolsEnabled(true);
        setIsActive((prev: boolean): boolean => {
          if (prev) setHovered(null);
          return !prev;
        });
        return;
      }
      if (!isActive) return;
      if (e.key === "Escape") {
        setIsActive(false);
        setHovered(null);
        return;
      }
      if (e.key === "Enter" && hoveredRef.current) {
        void navigator.clipboard.writeText(`{ui-id: ${hoveredRef.current.guideId}}`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return (): void => { window.removeEventListener("keydown", handleKeyDown); };
  }, [devToolsEnabled, isActive, services]);

  // Mouse: find nearest ancestor with data-guide-id on each mousemove.
  useEffect((): (() => void) => {
    if (!isActive) return (): void => {};

    const handleMouseMove = (e: MouseEvent): void => {
      let el: Element | null = e.target as Element | null;
      while (el) {
        const guideId: string | null = el.getAttribute("data-guide-id");
        if (guideId) {
          setHovered({ guideId, rect: el.getBoundingClientRect() });
          return;
        }
        el = el.parentElement;
      }
      setHovered(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    return (): void => { document.removeEventListener("mousemove", handleMouseMove); };
  }, [isActive]);

  // Deactivate when dev tools are turned off.
  useEffect((): void => {
    if (!devToolsEnabled) {
      setIsActive(false);
      setHovered(null);
    }
  }, [devToolsEnabled]);

  if (!devToolsEnabled && !isActive) return null;

  return (
    <>
      {isActive && <ActiveBadge />}
      {isActive && hovered && <HighlightOverlay target={hovered} />}
    </>
  );
};
