/**
 * useResourceRowReorder — move-up / move-down handlers for the resource table.
 *
 * Integration API:
 * - `useResourceRowReorder(activeTabId, setTabs, reorderGameInResource)` →
 *   `{ handleMoveUp, handleMoveDown }`
 *
 * Communication API:
 * - Optimistically updates tab row order in state.
 * - Calls `reorderGameInResource` to persist the new order.
 */

import { useCallback } from "react";
import type { TabState, ResourceRow } from "../services/viewer_utils";
import { log } from "../../../logger";

const toRecordId = (sourceRef: Record<string, unknown> | null | undefined): string => {
  const rawRecordId: unknown = sourceRef?.recordId;
  return typeof rawRecordId === "string" ? rawRecordId : "";
};

type UseResourceRowReorderResult = {
  handleMoveUp: (row: ResourceRow, afterRow: ResourceRow | null) => void;
  handleMoveDown: (row: ResourceRow, afterRow: ResourceRow) => void;
};

export const useResourceRowReorder = (
  activeTabId: string | null,
  setTabs: React.Dispatch<React.SetStateAction<TabState[]>>,
  reorderGameInResource: (
    sourceRef: Record<string, unknown>,
    afterSourceRef: Record<string, unknown> | null,
  ) => Promise<void>,
): UseResourceRowReorderResult => {
  const handleMoveUp = useCallback((
    row: ResourceRow,
    afterRow: ResourceRow | null,
  ): void => {
    if (!row?.sourceRef) return;
    const sourceRef: Record<string, unknown> = row.sourceRef;
    const moveRecordId: string = toRecordId(sourceRef);
    const afterSourceRef = afterRow?.sourceRef ?? null;
    const afterRecordId: string | null = afterSourceRef ? toRecordId(afterSourceRef) : null;
    setTabs((prev: TabState[]): TabState[] =>
      prev.map((tab: TabState): TabState => {
        if (tab.tabId !== activeTabId) return tab;
        if (tab.loadState.status !== "loaded") return tab;
        const currentRows = tab.loadState.rows;
        const fromIdx: number = currentRows.findIndex(
          (candidate): boolean => toRecordId(candidate.sourceRef) === moveRecordId,
        );
        if (fromIdx < 0) return tab;
        const withoutMoved = currentRows.filter((_, idx: number): boolean => idx !== fromIdx);
        if (afterRecordId === null) {
          return { ...tab, loadState: { ...tab.loadState, rows: [currentRows[fromIdx], ...withoutMoved] } };
        }
        const targetIdx: number = withoutMoved.findIndex(
          (candidate): boolean => toRecordId(candidate.sourceRef) === afterRecordId,
        );
        if (targetIdx < 0) return tab;
        return {
          ...tab,
          loadState: {
            ...tab.loadState,
            rows: [
              ...withoutMoved.slice(0, targetIdx + 1),
              currentRows[fromIdx],
              ...withoutMoved.slice(targetIdx + 1),
            ],
          },
        };
      }),
    );
    void (async (): Promise<void> => {
      try {
        await reorderGameInResource(sourceRef, afterSourceRef);
      } catch (err: unknown) {
        log.error("useResourceRowReorder", "Failed to reorder row upward", {
          recordId: toRecordId(sourceRef),
          afterRecordId: afterSourceRef ? toRecordId(afterSourceRef) : "(front)",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, [activeTabId, setTabs, reorderGameInResource]);

  const handleMoveDown = useCallback((
    row: ResourceRow,
    afterRow: ResourceRow,
  ): void => {
    if (!row?.sourceRef || !afterRow?.sourceRef) return;
    const sourceRef: Record<string, unknown> = row.sourceRef;
    const afterSourceRef: Record<string, unknown> = afterRow.sourceRef;
    const moveRecordId: string = toRecordId(sourceRef);
    const afterRecordId: string = toRecordId(afterSourceRef);
    setTabs((prev: TabState[]): TabState[] =>
      prev.map((tab: TabState): TabState => {
        if (tab.tabId !== activeTabId) return tab;
        if (tab.loadState.status !== "loaded") return tab;
        const currentRows = tab.loadState.rows;
        const fromIdx: number = currentRows.findIndex(
          (candidate): boolean => toRecordId(candidate.sourceRef) === moveRecordId,
        );
        if (fromIdx < 0) return tab;
        const withoutMoved = currentRows.filter((_, idx: number): boolean => idx !== fromIdx);
        const targetIdx: number = withoutMoved.findIndex(
          (candidate): boolean => toRecordId(candidate.sourceRef) === afterRecordId,
        );
        if (targetIdx < 0) return tab;
        return {
          ...tab,
          loadState: {
            ...tab.loadState,
            rows: [
              ...withoutMoved.slice(0, targetIdx + 1),
              currentRows[fromIdx],
              ...withoutMoved.slice(targetIdx + 1),
            ],
          },
        };
      }),
    );
    void (async (): Promise<void> => {
      try {
        await reorderGameInResource(sourceRef, afterSourceRef);
      } catch (err: unknown) {
        log.error("useResourceRowReorder", "Failed to reorder row downward", {
          recordId: toRecordId(sourceRef),
          afterRecordId: toRecordId(afterSourceRef),
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, [activeTabId, setTabs, reorderGameInResource]);

  return { handleMoveUp, handleMoveDown };
};
