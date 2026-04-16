/**
 * useColumnInteraction — column resize and drag-to-reorder for ResourceViewer.
 *
 * Integration API:
 * - `const ci = useColumnInteraction(activeTabId, activeTab, setTabs)`
 * - Pass `ci.colDragActiveKey`, `ci.handleResizeStart`, `ci.handleColDragStart`,
 *   `ci.handleColDrop` to `<ResourceTable>`.
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
  persistTabPrefs,
  type TabState,
} from "../services/viewer_utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type ColumnResizeState = {
  key: string;
  startX: number;
  startWidth: number;
};

export type UseColumnInteractionReturn = {
  colDragActiveKey: string;
  handleResizeStart: (key: string, e: ReactPointerEvent<HTMLSpanElement>) => void;
  handleColDragStart: (key: string) => void;
  handleColDrop: (targetKey: string) => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Manages column resize (pointer capture) and pointer-based column drag-to-reorder.
 *
 * Attaches global pointer handlers on `window` to support pointer capture beyond
 * the originating element's bounds.
 */
export const useColumnInteraction = (
  activeTabId: string | null,
  activeTab: TabState | null,
  setTabs: Dispatch<SetStateAction<TabState[]>>,
): UseColumnInteractionReturn => {
  const [colDragActiveKey, setColDragActiveKey] = useState<string>("");
  const columnResizeRef = useRef<ColumnResizeState | null>(null);
  const colDragKeyRef = useRef<string>("");

  // ── Column resize (window pointer events for pointer capture) ─────────────

  useEffect((): (() => void) => {
    const onMove = (e: PointerEvent): void => {
      const resize: ColumnResizeState | null = columnResizeRef.current;
      if (!resize || !activeTabId) return;
      const newWidth: number = clampWidth(resize.startWidth + (e.clientX - resize.startX));
      setTabs((prev: TabState[]): TabState[] =>
        prev.map((t: TabState): TabState =>
          t.tabId !== activeTabId
            ? t
            : { ...t, columnWidths: { ...t.columnWidths, [resize.key]: newWidth } },
        ),
      );
    };

    const onUp = (): void => {
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
      }
      // Also clear any column drag that was in progress.
      if (colDragKeyRef.current) {
        colDragKeyRef.current = "";
        setColDragActiveKey("");
      }
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
      columnResizeRef.current = {
        key,
        startX: e.clientX,
        startWidth: clampWidth(activeTab.columnWidths[key]),
      };
    },
    [activeTab],
  );

  const handleColDragStart = useCallback((key: string): void => {
    colDragKeyRef.current = key;
    setColDragActiveKey(key);
  }, []);

  const handleColDrop = useCallback(
    (targetKey: string): void => {
      const fromKey: string = colDragKeyRef.current;
      colDragKeyRef.current = "";
      setColDragActiveKey("");
      if (!fromKey || fromKey === targetKey || !activeTabId) return;
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
          return updated;
        }),
      );
    },
    [activeTabId, setTabs],
  );

  return { colDragActiveKey, handleResizeStart, handleColDragStart, handleColDrop };
};
