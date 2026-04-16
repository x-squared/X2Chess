/**
 * useGroupBy — per-tab group-by state management for ResourceViewer.
 *
 * Integration API:
 * - `const gb = useGroupBy(activeTabId)`
 * - Read `gb.groupByState` for the active tab's current group-by configuration.
 * - Pass `gb.handle*` callbacks to `<ResourceToolbar>` and `<ResourceTable>`.
 *
 * Configuration API:
 * - `activeTabId` — the currently active tab's ID (or null).
 *
 * Communication API:
 * - Persists group-by state to `localStorage` via `writeGroupByState`.
 * - Loads group-by state from `localStorage` via `readGroupByState` on first activation.
 * - No other side effects; no context reads.
 */

import { useState, useEffect, useCallback } from "react";
import {
  readGroupByState,
  writeGroupByState,
  type GroupByState,
} from "../services/viewer_utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UseGroupByReturn = {
  groupByMap: Record<string, GroupByState>;
  groupByState: GroupByState;
  handleGroupByAdd: (field: string) => void;
  handleGroupByRemove: (field: string) => void;
  handleGroupByMoveUp: (field: string) => void;
  handleGroupByClear: () => void;
  handleToggleGroup: (groupKey: string) => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/** Manages group-by fields, ordering, and collapse state per tab. */
export const useGroupBy = (activeTabId: string | null): UseGroupByReturn => {
  const [groupByMap, setGroupByMap] = useState<Record<string, GroupByState>>({});

  // Load from localStorage when a tab first becomes active.
  useEffect((): void => {
    if (!activeTabId) return;
    setGroupByMap((prev): Record<string, GroupByState> => {
      if (prev[activeTabId]) return prev;
      const loaded = readGroupByState(activeTabId);
      return { ...prev, [activeTabId]: loaded };
    });
  }, [activeTabId]);

  const groupByState: GroupByState = groupByMap[activeTabId ?? ""] ?? {
    fields: [],
    collapsedKeys: [],
  };

  const handleGroupByAdd = useCallback(
    (field: string): void => {
      if (!activeTabId) return;
      setGroupByMap((prev): Record<string, GroupByState> => {
        const current: GroupByState = prev[activeTabId] ?? { fields: [], collapsedKeys: [] };
        if (current.fields.includes(field)) return prev;
        const next: GroupByState = { ...current, fields: [...current.fields, field] };
        writeGroupByState(activeTabId, next);
        return { ...prev, [activeTabId]: next };
      });
    },
    [activeTabId],
  );

  const handleGroupByRemove = useCallback(
    (field: string): void => {
      if (!activeTabId) return;
      setGroupByMap((prev): Record<string, GroupByState> => {
        const current: GroupByState = prev[activeTabId] ?? { fields: [], collapsedKeys: [] };
        const next: GroupByState = {
          ...current,
          fields: current.fields.filter((f) => f !== field),
        };
        writeGroupByState(activeTabId, next);
        return { ...prev, [activeTabId]: next };
      });
    },
    [activeTabId],
  );

  const handleGroupByMoveUp = useCallback(
    (field: string): void => {
      if (!activeTabId) return;
      setGroupByMap((prev): Record<string, GroupByState> => {
        const current: GroupByState = prev[activeTabId] ?? { fields: [], collapsedKeys: [] };
        const idx = current.fields.indexOf(field);
        if (idx <= 0) return prev;
        const fields = [...current.fields];
        [fields[idx - 1], fields[idx]] = [fields[idx], fields[idx - 1]];
        const next: GroupByState = { ...current, fields };
        writeGroupByState(activeTabId, next);
        return { ...prev, [activeTabId]: next };
      });
    },
    [activeTabId],
  );

  const handleGroupByClear = useCallback((): void => {
    if (!activeTabId) return;
    const next: GroupByState = { fields: [], collapsedKeys: [] };
    writeGroupByState(activeTabId, next);
    setGroupByMap((prev) => ({ ...prev, [activeTabId]: next }));
  }, [activeTabId]);

  const handleToggleGroup = useCallback(
    (groupKey: string): void => {
      if (!activeTabId) return;
      setGroupByMap((prev): Record<string, GroupByState> => {
        const current: GroupByState = prev[activeTabId] ?? { fields: [], collapsedKeys: [] };
        const collapsed = new Set(current.collapsedKeys);
        if (collapsed.has(groupKey)) {
          collapsed.delete(groupKey);
        } else {
          collapsed.add(groupKey);
        }
        const next: GroupByState = { ...current, collapsedKeys: [...collapsed] };
        writeGroupByState(activeTabId, next);
        return { ...prev, [activeTabId]: next };
      });
    },
    [activeTabId],
  );

  return {
    groupByMap,
    groupByState,
    handleGroupByAdd,
    handleGroupByRemove,
    handleGroupByMoveUp,
    handleGroupByClear,
    handleToggleGroup,
  };
};
