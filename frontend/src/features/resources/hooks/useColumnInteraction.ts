/**
 * useColumnInteraction — column resize and drag-to-reorder for ResourceViewer.
 *
 * Integration API:
 * - `const ci = useColumnInteraction(activeTabId, activeTab, setTabs)`
 * - Pass `ci.colDragActiveKey`, `ci.colDropTargetKey`, `ci.handleResizeStart`, `ci.handleColDragStart`
 *   to `<ResourceTable>`. Drop is committed on `pointerup` via hit-testing under the cursor.
 *
 * Configuration API:
 * - `activeTabId` — the currently active tab's ID (or null).
 * - `activeTab`   — the currently active `TabState` (or null).
 * - `setTabs`     — the React state setter for the tabs array.
 *
 * Communication API:
 * - No context reads; purely prop-driven.
 * - Attaches `pointermove`/`pointerup`/`pointercancel` to `window` while mounted.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from "react";
import {
  clampWidth,
  clampGameIdColumnWidth,
  persistTabPrefs,
  type TabState,
} from "../services/viewer_utils";
import { log } from "../../../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

type ColumnResizeState = {
  key: string;
  startX: number;
  startWidth: number;
};

const RESOURCE_TABLE_SELECTOR = ".resource-games-table";

const resolveColumnDropKey = (clientX: number, clientY: number): string => {
  const el: Element | null = document.elementFromPoint(clientX, clientY);
  const th: Element | null = el?.closest?.("th[data-resource-col-key]") ?? null;
  if (!th || !th.closest(RESOURCE_TABLE_SELECTOR)) return "";
  const key: string | null = th.getAttribute("data-resource-col-key");
  return key && key.length > 0 ? key : "";
};

export type UseColumnInteractionReturn = {
  colDragActiveKey: string;
  colDropTargetKey: string;
  handleResizeStart: (key: string, e: ReactPointerEvent<HTMLSpanElement>) => void;
  handleColDragStart: (key: string, e: ReactPointerEvent<HTMLSpanElement>) => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages column resize (pointer capture) and pointer-based column drag-to-reorder.
 *
 * Attaches global pointer handlers on `window` to support pointer capture beyond
 * the originating element's bounds. While dragging a column, `colDropTargetKey` tracks
 * the header cell under the cursor for visual feedback; reorder runs on `pointerup`
 * at that cell (or cancels if the cursor is not over a column header).
 */
export const useColumnInteraction = (
  activeTabId: string | null,
  activeTab: TabState | null,
  setTabs: Dispatch<SetStateAction<TabState[]>>,
): UseColumnInteractionReturn => {
  const [colDragActiveKey, setColDragActiveKey] = useState<string>("");
  const [colDropTargetKey, setColDropTargetKey] = useState<string>("");
  const columnResizeRef = useRef<ColumnResizeState | null>(null);
  const colDragKeyRef = useRef<string>("");
  const colDragPointerIdRef = useRef<number>(-1);
  const colDragHandleElRef = useRef<HTMLElement | null>(null);

  // ── Column resize + column drag (window pointer events) ────────────────────

  useEffect((): (() => void) => {
    const onMove = (e: PointerEvent): void => {
      const resize: ColumnResizeState | null = columnResizeRef.current;
      if (resize && activeTabId) {
        const delta: number = e.clientX - resize.startX;
        const raw: number = resize.startWidth + delta;
        const newWidth: number =
          resize.key === "game" ? clampGameIdColumnWidth(raw) : clampWidth(raw);
        setTabs((prev: TabState[]): TabState[] =>
          prev.map((t: TabState): TabState =>
            t.tabId !== activeTabId
              ? t
              : { ...t, columnWidths: { ...t.columnWidths, [resize.key]: newWidth } },
          ),
        );
        return;
      }
      if (colDragKeyRef.current) {
        const under: string = resolveColumnDropKey(e.clientX, e.clientY);
        const from: string = colDragKeyRef.current;
        const next: string = under && under !== from ? under : "";
        setColDropTargetKey((prev: string): string => (prev === next ? prev : next));
      }
    };

    const clearColumnDrag = (): void => {
      colDragKeyRef.current = "";
      colDragPointerIdRef.current = -1;
      colDragHandleElRef.current = null;
      setColDragActiveKey("");
      setColDropTargetKey("");
      document.body.classList.remove("resource-col-dragging");
    };

    const releaseDragCapture = (): void => {
      const handleEl: HTMLElement | null = colDragHandleElRef.current;
      const pid: number = colDragPointerIdRef.current;
      if (handleEl && pid >= 0) {
        try {
          if (handleEl.hasPointerCapture(pid)) {
            handleEl.releasePointerCapture(pid);
          }
        } catch {
          // Pointer already released.
        }
      }
    };

    const onUp = (e: PointerEvent): void => {
      if (columnResizeRef.current) {
        const key: string = columnResizeRef.current.key;
        columnResizeRef.current = null;
        setTabs((prev: TabState[]): TabState[] => {
          const tab: TabState | undefined = prev.find(
            (t: TabState): boolean => t.tabId === activeTabId,
          );
          if (tab && key) persistTabPrefs(tab);
          return prev;
        });
        return;
      }

      if (!colDragKeyRef.current || !activeTabId) {
        return;
      }

      const fromKey: string = colDragKeyRef.current;
      const targetKey: string = resolveColumnDropKey(e.clientX, e.clientY);
      releaseDragCapture();
      clearColumnDrag();

      if (!fromKey || !targetKey || fromKey === targetKey) {
        return;
      }

      setTabs((prev: TabState[]): TabState[] =>
        prev.map((t: TabState): TabState => {
          if (t.tabId !== activeTabId) return t;
          const order: string[] = [...t.metadataColumnOrder];
          const from: number = order.indexOf(fromKey);
          const to: number = order.indexOf(targetKey);
          if (from < 0 || to < 0) return t;
          order.splice(from, 1);
          order.splice(to, 0, fromKey);
          const updated: TabState = { ...t, metadataColumnOrder: order };
          persistTabPrefs(updated);
          log.info("column_interaction", "Column drag reorder committed", {
            fromKey,
            targetKey,
            tabId: activeTabId,
          });
          return updated;
        }),
      );
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return (): void => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [activeTabId, setTabs]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleResizeStart = useCallback(
    (key: string, e: ReactPointerEvent<HTMLSpanElement>): void => {
      if (!activeTab) return;
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      const startWidth: number =
        key === "game"
          ? clampGameIdColumnWidth(activeTab.columnWidths[key])
          : clampWidth(activeTab.columnWidths[key]);
      columnResizeRef.current = {
        key,
        startX: e.clientX,
        startWidth,
      };
    },
    [activeTab],
  );

  const handleColDragStart = useCallback((key: string, e: ReactPointerEvent<HTMLSpanElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    colDragKeyRef.current = key;
    colDragPointerIdRef.current = e.pointerId;
    colDragHandleElRef.current = e.currentTarget;
    e.currentTarget.setPointerCapture(e.pointerId);
    setColDragActiveKey(key);
    setColDropTargetKey("");
    document.body.classList.add("resource-col-dragging");
  }, []);

  useEffect((): (() => void) => {
    return (): void => {
      document.body.classList.remove("resource-col-dragging");
    };
  }, []);

  return { colDragActiveKey, colDropTargetKey, handleResizeStart, handleColDragStart };
};
