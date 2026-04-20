/**
 * ResourceViewer — React resource viewer component.
 *
 * Manages tab identity from `AppStoreState` (populated by `useAppStartup`) and
 * loads game rows via the `resource_loader` service registry.  Handles tab
 * selection/close, column resize (pointer capture), column drag-to-reorder
 * (pointer events — not HTML5 DnD to avoid conflict with file-drop), the
 * metadata column selector dialog, multi-level group-by, and column sorting.
 *
 * Integration API:
 * - `<ResourceViewer />` — rendered by `AppShell` as the resource viewer card;
 *   no props required.
 * - DOM inspection: root `data-ui-id="resources.panel"` (`UI_IDS.RESOURCE_VIEWER_PANEL`);
 *   inner regions use `UI_IDS` (`ResourceTabBar`, `ResourceToolbar`, `ResourceTable`).
 *
 * Configuration API:
 * - No props.  Tab list flows from `AppStoreState.resourceViewerTabSnapshots`.
 * - Column preferences persisted to `localStorage` under
 *   `x2chess.resourceViewerColumnPrefs.v1`.
 * - Group-by configuration persisted to `localStorage` under
 *   `x2chess.groupby.<tabId>`.
 *
 * Communication API:
 * - Inbound: re-renders when `resourceViewerTabSnapshots` or
 *   `activeResourceTabId` change via the `AppStoreState`.
 * - Outbound: loads rows via `getResourceLoaderService()` on tab activation;
 *   opens games via `useServiceContext().openGameFromRef()`.
 */

import {
  useState,
  useEffect,
  useCallback,
  useId,
  useMemo,
  type ReactElement,
  type FormEvent,
} from "react";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import {
  selectResourceViewerTabs,
  selectActiveResourceTabId,
} from "../../../core/state/selectors";
import type { ResourceTabSnapshot } from "../../../core/state/app_reducer";
import { useTranslator } from "../../../app/hooks/useTranslator";
import { getResourceLoaderService } from "../../../services/resource_loader";
import { useServiceContext } from "../../../app/providers/ServiceProvider";
import {
  clampWidth,
  readPrefsMap,
  writePrefsMap,
  persistTabPrefs,
  reconcileColumns,
  insertMetadataColumnFromSchema,
  listAddableMetadataFields,
  removeMetadataColumnFromTab,
  DEFAULT_METADATA_KEYS,
  type TabState,
  type TabPrefs,
  type ResourceRef,
  type SortConfig,
} from "../services/viewer_utils";
import { buildResourceTabReloadPlan, collectAffectedResourceTabIds } from "../services/resource_tab_refresh";
import { useColumnInteraction } from "../hooks/useColumnInteraction";
import { useGroupBy } from "../hooks/useGroupBy";
import { UI_IDS } from "../../../core/model/ui_ids";
import { ResourceTabBar } from "./ResourceTabBar";
import { ResourceTable } from "./ResourceTable";
import { ResourceMetadataDialog } from "./ResourceMetadataDialog";
import { MetadataSchemaEditor } from "../metadata/MetadataSchemaEditor";
import { NewGameDialog } from "../../../components/dialogs/NewGameDialog";
import { ResourceToolbar } from "./ResourceToolbar";
import {
  loadSchemas,
  saveSchemas,
  upsertSchema,
} from "../services/schema_storage";
import {
  BUILT_IN_SCHEMA,
  type MetadataFieldDefinition,
  type MetadataSchema,
} from "../../../../../parts/resource/src/domain/metadata_schema";
import { log } from "../../../logger";
import { loadBadgesForRefs } from "../../../training/transcript_storage";
import type { TrainingBadge } from "../../../training/transcript_storage";
import { resourceDomainEvents } from "../../../core/events/resource_domain_events";

// ── Row hydration ─────────────────────────────────────────────────────────────

const hydrateRows = (
  entries: unknown[],
  t: (key: string, fallback?: string) => string,
): { rows: TabState["rows"]; discoveredKeys: string[] } => {
  const discovered = new Set<string>();
  const rows = (Array.isArray(entries) ? entries : []).map((entry: unknown) => {
    const record: Record<string, unknown> =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    const sourceRefRaw: unknown = record.sourceRef ?? record.gameRef;
    const sourceRef: Record<string, unknown> =
      sourceRefRaw && typeof sourceRefRaw === "object"
        ? (sourceRefRaw as Record<string, unknown>)
        : {};
    const identifier: string = String(sourceRef.recordId ?? record.identifier ?? "");
    const metadata: Record<string, string> = {
      identifier,
      source: String(sourceRef.kind ?? ""),
      revision: String(record.revisionToken ?? ""),
    };
    const metaRaw: unknown = record.metadata;
    if (metaRaw && typeof metaRaw === "object") {
      Object.entries(metaRaw as Record<string, unknown>).forEach(
        ([k, v]: [string, unknown]): void => {
          if (!k || k === "game") return;
          metadata[k] = v == null ? "" : String(v);
          discovered.add(k);
        },
      );
    }
    const availRaw: unknown = record.availableMetadataKeys;
    if (Array.isArray(availRaw)) {
      availRaw.forEach((k: unknown): void => {
        if (k && String(k) !== "game") discovered.add(String(k));
      });
    }
    // Build a useful game label: prefer "White vs Black" from metadata, fall back to titleHint.
    const metaWhite: string = String((metaRaw as Record<string, unknown> | null)?.White ?? "").trim();
    const metaBlack: string = String((metaRaw as Record<string, unknown> | null)?.Black ?? "").trim();
    const gameLabel: string =
      metaWhite && metaBlack && metaWhite !== "?" && metaBlack !== "?"
        ? `${metaWhite} \u2013 ${metaBlack}`
        : String(record.titleHint ?? identifier ?? t("resources.table.unknown", "Untitled"));

    // Derive game kind from the entry's gameKind field.
    const rawKind: unknown = record.gameKind;
    const kind: "game" | "position" = rawKind === "position" ? "position" : "game";

    return {
      game: gameLabel,
      kind,
      identifier,
      source: metadata.source,
      revision: metadata.revision,
      metadata,
      sourceRef:
        sourceRefRaw && typeof sourceRefRaw === "object"
          ? (sourceRefRaw as Record<string, unknown>)
          : null,
    };
  });
  return { rows, discoveredKeys: [...discovered] };
};

// ── Tab initialisation ────────────────────────────────────────────────────────

const initTab = (snapshot: ResourceTabSnapshot): TabState => {
  const ref: ResourceRef = { kind: snapshot.kind, locator: snapshot.locator };
  const tabId: string = snapshot.tabId;
  const prefs: TabPrefs | undefined = readPrefsMap()[tabId];
  const visibleMetadataKeys: string[] =
    prefs?.visibleMetadataKeys?.length
      ? [...prefs.visibleMetadataKeys]
      : [...DEFAULT_METADATA_KEYS];
  const metadataColumnOrder: string[] = Array.isArray(prefs?.metadataColumnOrder)
    ? [...prefs.metadataColumnOrder]
    : ["game", ...visibleMetadataKeys];
  const columnWidths: Record<string, number> = {};
  if (prefs?.columnWidths) {
    Object.entries(prefs.columnWidths).forEach(([k, v]: [string, number]): void => {
      columnWidths[k] = clampWidth(v);
    });
  }
  return reconcileColumns({
    tabId,
    title: snapshot.title,
    resourceRef: ref,
    rows: [],
    availableMetadataKeys: [],
    visibleMetadataKeys,
    metadataColumnOrder,
    columnWidths,
    errorMessage: "",
    isLoading: false,
  });
};

// ── ResourceViewer ────────────────────────────────────────────────────────────

/** Renders the resource viewer: tab bar, group-by toolbar, game table, and metadata dialog. */
export const ResourceViewer = (): ReactElement => {
  const { state } = useAppContext();
  const services = useServiceContext();
  const tabSnapshots: ResourceTabSnapshot[] = selectResourceViewerTabs(state);
  const activeTabId: string | null = selectActiveResourceTabId(state) ?? tabSnapshots[0]?.tabId ?? null;
  const t: (key: string, fallback?: string) => string = useTranslator();
  const dialogFormId: string = useId();

  // ── Local state ────────────────────────────────────────────────────────

  const [tabs, setTabs] = useState<TabState[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [dialogKey, setDialogKey] = useState<number>(0);
  // Per-tab column filter strings; keyed by tabId.
  const [columnFiltersMap, setColumnFiltersMap] = useState<Record<string, Record<string, string>>>({});
  // Per-tab sort config; keyed by tabId.
  const [sortMap, setSortMap] = useState<Record<string, SortConfig | null>>({});
  // User-defined metadata schemas.
  const [schemas, setSchemas] = useState<MetadataSchema[]>(() => loadSchemas());
  // Per-tab selected schema ID (null = built-in).
  const [tabSchemaMap, setTabSchemaMap] = useState<Record<string, string | null>>({});
  const [schemaEditorOpen, setSchemaEditorOpen] = useState<boolean>(false);
  const [editingSchema, setEditingSchema] = useState<MetadataSchema | null>(null);
  const [newGameDialogOpen, setNewGameDialogOpen] = useState<boolean>(false);
  const toRecordId = (sourceRef: Record<string, unknown> | null | undefined): string => {
    const rawRecordId: unknown = sourceRef?.recordId;
    return typeof rawRecordId === "string" ? rawRecordId : "";
  };

  const loadRowsForTab = useCallback(
    (tabId: string, resourceRef: ResourceRef): void => {
      const loader = getResourceLoaderService();
      if (!loader) return;
      setTabs((prev: TabState[]): TabState[] =>
        prev.map((tab: TabState): TabState =>
          tab.tabId === tabId ? { ...tab, isLoading: true, errorMessage: "" } : tab,
        ),
      );
      void (async (): Promise<void> => {
        try {
          const entries: unknown[] = await loader(resourceRef);
          const { rows, discoveredKeys } = hydrateRows(entries, t);
          setTabs((prev: TabState[]): TabState[] =>
            prev.map((tab: TabState): TabState => {
              if (tab.tabId !== tabId) return tab;
              return reconcileColumns({
                ...tab,
                rows,
                availableMetadataKeys: discoveredKeys,
                isLoading: false,
              });
            }),
          );
        } catch (error: unknown) {
          const message: string = error instanceof Error ? error.message : String(error);
          const errorMessage: string = message || t("resources.error", "Unable to load resource.");
          setTabs((prev: TabState[]): TabState[] =>
            prev.map((tab: TabState): TabState =>
              tab.tabId === tabId ? { ...tab, isLoading: false, errorMessage } : tab,
            ),
          );
        }
      })();
    },
    [t],
  );

  // ── Sync tab list from state snapshot ─────────────────────────────────

  useEffect((): void => {
    setTabs((prev: TabState[]): TabState[] =>
      tabSnapshots.map((snapshot: ResourceTabSnapshot): TabState => {
        const existing: TabState | undefined = prev.find(
          (t: TabState): boolean => t.tabId === snapshot.tabId,
        );
        return existing ?? initTab(snapshot);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabSnapshots]);

  // ── Row loading ────────────────────────────────────────────────────────

  useEffect((): void => {
    if (!activeTabId) return;
    const tab: TabState | undefined = tabs.find((item: TabState): boolean => item.tabId === activeTabId);
    if (!tab || tab.rows.length > 0 || tab.isLoading || tab.errorMessage) return;
    loadRowsForTab(tab.tabId, tab.resourceRef);
  }, [activeTabId, tabs, loadRowsForTab]);

  // ── Derived values ────────────────────────────────────────────────────

  const activeTab: TabState | null =
    tabs.find((t: TabState): boolean => t.tabId === activeTabId) ?? null;

  const columnFilters: Record<string, string> = columnFiltersMap[activeTabId ?? ""] ?? {};
  const sortConfig: SortConfig | null = sortMap[activeTabId ?? ""] ?? null;

  // ── Column interaction (resize + pointer drag-to-reorder) ─────────────

  const {
    colDragActiveKey,
    handleResizeStart,
    handleColDragStart,
    handleColDrop,
  } = useColumnInteraction(activeTabId, activeTab, setTabs);

  // ── Group-by state ─────────────────────────────────────────────────────

  const {
    groupByState,
    handleGroupByAdd,
    handleGroupByRemove,
    handleGroupByMoveUp,
    handleGroupByClear,
    handleToggleGroup,
  } = useGroupBy(activeTabId);

  const supportsReorder: boolean =
    activeTab?.resourceRef.kind === "db" || activeTab?.resourceRef.kind === "directory";

  // ── Training badges (T14) ─────────────────────────────────────────────

  const trainingBadges: Map<string, TrainingBadge> = useMemo((): Map<string, TrainingBadge> => {
    const rows = activeTab?.rows ?? [];
    const refs = rows
      .map((row): string => {
        const r = row.sourceRef;
        if (!r) return "";
        const kind = typeof r["kind"] === "string" ? r["kind"] : "";
        const locator = typeof r["locator"] === "string" ? r["locator"] : "";
        const recordId = typeof r["recordId"] === "string" ? r["recordId"] : "";
        return `${kind}:${locator}:${recordId}`;
      })
      .filter((ref): boolean => ref !== "");
    return loadBadgesForRefs(refs);
  }, [activeTab?.rows]);

  // ── Handlers ─────────────────────────────────────────────────────────

  const handleTabSelect = useCallback((tabId: string): void => {
    services.selectResourceTab(tabId);
  }, [services]);

  const handleTabClose = useCallback((tabId: string): void => {
    setTabs((prev: TabState[]): TabState[] => prev.filter((t: TabState): boolean => t.tabId !== tabId));
    services.closeResourceTab(tabId);
  }, [services]);

  const handleRowOpen = useCallback((rowIndex: number): void => {
    if (!activeTab) return;
    const row = activeTab.rows[rowIndex];
    if (!row?.sourceRef) return;
    services.openGameFromRef(row.sourceRef);
  }, [activeTab, services]);

  // ── Sort (UV4) ────────────────────────────────────────────────────────

  const handleSortChange = useCallback((key: string): void => {
    if (!activeTabId) return;
    setSortMap((prev): Record<string, SortConfig | null> => {
      const current: SortConfig | null = prev[activeTabId] ?? null;
      let next: SortConfig | null;
      if (!current || current.key !== key) {
        next = { key, dir: "asc" };
      } else if (current.dir === "asc") {
        next = { key, dir: "desc" };
      } else {
        next = null;
      }
      return { ...prev, [activeTabId]: next };
    });
  }, [activeTabId]);

  const handleMetadataOpen = useCallback((): void => {
    setDialogKey((k: number): number => k + 1);
    setIsDialogOpen(true);
  }, []);

  const handleMetadataClose = useCallback((): void => {
    setIsDialogOpen(false);
  }, []);

  const handleMetadataSave = useCallback(
    (e: FormEvent<HTMLFormElement>): void => {
      e.preventDefault();
      const form: HTMLFormElement = e.currentTarget;
      const checked: string[] = Array.from(
        form.querySelectorAll<HTMLInputElement>("input[data-meta-key]:checked"),
      ).map((input: HTMLInputElement): string => String(input.dataset.metaKey ?? "")).filter(Boolean);
      const applyAll: boolean =
        (form.querySelector<HTMLInputElement>("#rv-meta-apply-all")?.checked) ?? false;
      setTabs((prev: TabState[]): TabState[] =>
        prev.map((t: TabState): TabState => {
          if (t.tabId !== activeTabId && !applyAll) return t;
          const updated: TabState = reconcileColumns({ ...t, visibleMetadataKeys: checked });
          persistTabPrefs(updated);
          return updated;
        }),
      );
      setIsDialogOpen(false);
    },
    [activeTabId],
  );

  const handleFilterChange = useCallback((key: string, value: string): void => {
    setColumnFiltersMap((prev: Record<string, Record<string, string>>): Record<string, Record<string, string>> => {
      const tabId: string = activeTabId ?? "";
      const existing: Record<string, string> = prev[tabId] ?? {};
      const updated: Record<string, string> = { ...existing, [key]: value };
      return { ...prev, [tabId]: updated };
    });
  }, [activeTabId]);

  const handleClearFilters = useCallback((): void => {
    if (!activeTabId) return;
    setColumnFiltersMap((prev) => ({ ...prev, [activeTabId]: {} }));
  }, [activeTabId]);

  // Keep resource rows fresh based on explicit domain events.
  useEffect((): (() => void) => {
    const unsubscribe: () => void = resourceDomainEvents.subscribe((event): void => {
      if (event.type !== "resource.resourceChanged") return;
      const changedKind: string = event.resourceRef.kind;
      const changedLocator: string = event.resourceRef.locator;
      const matchingTabIds: string[] = collectAffectedResourceTabIds(
        tabs.map((tab: TabState) => ({
          tabId: tab.tabId,
          kind: tab.resourceRef.kind,
          locator: tab.resourceRef.locator,
        })),
        changedKind,
        changedLocator,
      );
      if (matchingTabIds.length === 0) return;
      const matchingTabIdSet: Set<string> = new Set<string>(matchingTabIds);
      const reloadPlan = buildResourceTabReloadPlan(
        tabs.map((tab: TabState) => ({
          tabId: tab.tabId,
          resourceRef: {
            kind: tab.resourceRef.kind,
            locator: tab.resourceRef.locator,
          },
        })),
        changedKind,
        changedLocator,
      );
      setTabs((prev: TabState[]): TabState[] =>
        prev.map((tab: TabState): TabState => {
          if (!matchingTabIdSet.has(tab.tabId)) return tab;
          return { ...tab, rows: [], isLoading: false, errorMessage: "" };
        }),
      );
      for (const planItem of reloadPlan) {
        loadRowsForTab(planItem.tabId, {
          kind: planItem.resourceRef.kind,
          locator: planItem.resourceRef.locator,
        });
      }
      log.info("ResourceViewer", "Reloading resource tab(s) after resource.resourceChanged", {
        kind: changedKind,
        locator: changedLocator,
        operation: event.operation,
      });
    });
    return (): void => {
      unsubscribe();
    };
  }, [tabs, loadRowsForTab]);

  const handleMoveUp = useCallback((
    row: TabState["rows"][number],
    afterRow: TabState["rows"][number] | null,
  ): void => {
    if (!row?.sourceRef) return;
    const moveRecordId: string = toRecordId(row.sourceRef);
    const afterRecordId: string | null = afterRow?.sourceRef ? toRecordId(afterRow.sourceRef) : null;
    setTabs((prev: TabState[]): TabState[] =>
      prev.map((tab: TabState): TabState => {
        if (tab.tabId !== activeTabId) return tab;
        const currentRows: TabState["rows"] = tab.rows;
        const fromIdx: number = currentRows.findIndex(
          (candidate): boolean => toRecordId(candidate.sourceRef) === moveRecordId,
        );
        if (fromIdx < 0) return tab;
        const withoutMoved: TabState["rows"] = currentRows.filter((_, idx: number): boolean => idx !== fromIdx);
        if (afterRecordId === null) {
          return { ...tab, rows: [currentRows[fromIdx], ...withoutMoved] };
        }
        const targetIdx: number = withoutMoved.findIndex(
          (candidate): boolean => toRecordId(candidate.sourceRef) === afterRecordId,
        );
        if (targetIdx < 0) return tab;
        return {
          ...tab,
          rows: [
            ...withoutMoved.slice(0, targetIdx + 1),
            currentRows[fromIdx],
            ...withoutMoved.slice(targetIdx + 1),
          ],
        };
      }),
    );
    void (async (): Promise<void> => {
      try {
        await services.reorderGameInResource(row.sourceRef, afterRow?.sourceRef ?? null);
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        log.error("ResourceViewer", "Failed to reorder row upward", {
          recordId: toRecordId(row.sourceRef),
          afterRecordId: afterRow?.sourceRef ? toRecordId(afterRow.sourceRef) : "(front)",
          message,
        });
      }
    })();
  }, [activeTabId, services]);

  const handleMoveDown = useCallback((
    row: TabState["rows"][number],
    afterRow: TabState["rows"][number],
  ): void => {
    if (!row?.sourceRef || !afterRow?.sourceRef) return;
    const moveRecordId: string = toRecordId(row.sourceRef);
    const afterRecordId: string = toRecordId(afterRow.sourceRef);
    setTabs((prev: TabState[]): TabState[] =>
      prev.map((tab: TabState): TabState => {
        if (tab.tabId !== activeTabId) return tab;
        const currentRows: TabState["rows"] = tab.rows;
        const fromIdx: number = currentRows.findIndex(
          (candidate): boolean => toRecordId(candidate.sourceRef) === moveRecordId,
        );
        if (fromIdx < 0) return tab;
        const withoutMoved: TabState["rows"] = currentRows.filter((_, idx: number): boolean => idx !== fromIdx);
        const targetIdx: number = withoutMoved.findIndex(
          (candidate): boolean => toRecordId(candidate.sourceRef) === afterRecordId,
        );
        if (targetIdx < 0) return tab;
        return {
          ...tab,
          rows: [
            ...withoutMoved.slice(0, targetIdx + 1),
            currentRows[fromIdx],
            ...withoutMoved.slice(targetIdx + 1),
          ],
        };
      }),
    );
    void (async (): Promise<void> => {
      try {
        await services.reorderGameInResource(row.sourceRef, afterRow.sourceRef);
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        log.error("ResourceViewer", "Failed to reorder row downward", {
          recordId: toRecordId(row.sourceRef),
          afterRecordId: toRecordId(afterRow.sourceRef),
          message,
        });
      }
    })();
  }, [activeTabId, services]);

  const handleMetadataReset = useCallback((): void => {
    if (!activeTabId) return;
    setTabs((prev: TabState[]): TabState[] =>
      prev.map((t: TabState): TabState => {
        if (t.tabId !== activeTabId) return t;
        const updated: TabState = reconcileColumns({
          ...t,
          visibleMetadataKeys: [...DEFAULT_METADATA_KEYS],
          metadataColumnOrder: ["game", ...DEFAULT_METADATA_KEYS],
          columnWidths: {},
        });
        const map = readPrefsMap();
        delete map[t.tabId];
        writePrefsMap(map);
        return updated;
      }),
    );
    setIsDialogOpen(false);
  }, [activeTabId]);

  // ── Schema handlers (MD4) ─────────────────────────────────────────────

  const activeSchemaId: string | null = tabSchemaMap[activeTabId ?? ""] ?? null;
  const activeSchema: MetadataSchema =
    schemas.find((s) => s.id === activeSchemaId) ?? BUILT_IN_SCHEMA;

  const handleSchemaSelect = useCallback((id: string): void => {
    if (!activeTabId) return;
    setTabSchemaMap((prev) => ({ ...prev, [activeTabId]: id === "builtin" ? null : id }));
  }, [activeTabId]);

  const handleSchemaManage = useCallback((): void => {
    setEditingSchema(null);
    setSchemaEditorOpen(true);
  }, []);

  /** Append a column from the active schema’s field list (toolbar “Add metadata”). */
  const handleAddMetadataField = useCallback((fieldKey: string): void => {
    if (!activeTabId || !fieldKey) return;
    setTabs((prev: TabState[]): TabState[] =>
      prev.map((t: TabState): TabState => {
        if (t.tabId !== activeTabId) return t;
        const updated: TabState = insertMetadataColumnFromSchema(
          t,
          fieldKey,
          activeSchema,
          t.availableMetadataKeys,
        );
        if (updated === t) return t;
        log.info("ResourceViewer", "Added metadata column", { fieldKey, schemaId: activeSchema.id });
        persistTabPrefs(updated);
        return updated;
      }),
    );
  }, [activeTabId, activeSchema]);

  /** Header × — drop a metadata column from this resource tab (not `game`). */
  const handleRemoveMetadataColumn = useCallback((fieldKey: string): void => {
    if (!activeTabId || fieldKey === "game") return;
    setColumnFiltersMap((prev: Record<string, Record<string, string>>): Record<string, Record<string, string>> => {
      const tabFilters: Record<string, string> | undefined = prev[activeTabId];
      if (!tabFilters || !(fieldKey in tabFilters)) return prev;
      const nextFilters: Record<string, string> = { ...tabFilters };
      delete nextFilters[fieldKey];
      return { ...prev, [activeTabId]: nextFilters };
    });
    setSortMap((prev: Record<string, SortConfig | null>): Record<string, SortConfig | null> => {
      const cur: SortConfig | null = prev[activeTabId] ?? null;
      if (cur?.key === fieldKey) {
        return { ...prev, [activeTabId]: null };
      }
      return prev;
    });
    setTabs((prev: TabState[]): TabState[] =>
      prev.map((t: TabState): TabState => {
        if (t.tabId !== activeTabId) return t;
        const updated: TabState = removeMetadataColumnFromTab(t, fieldKey);
        log.info("ResourceViewer", "Removed resource table column", { fieldKey });
        persistTabPrefs(updated);
        return updated;
      }),
    );
  }, [activeTabId]);

  const handleSchemaSave = useCallback((saved: MetadataSchema): void => {
    setSchemas((prev) => {
      const next = upsertSchema(prev, saved);
      saveSchemas(next);
      return next;
    });
    setSchemaEditorOpen(false);
    setEditingSchema(null);
  }, []);

  const handleSchemaEditorClose = useCallback((): void => {
    setSchemaEditorOpen(false);
    setEditingSchema(null);
  }, []);

  // ── New game (NG6) ────────────────────────────────────────────────────

  const handleNewGame = useCallback((): void => {
    setNewGameDialogOpen(true);
  }, []);

  const handleNewGameCreate = useCallback((pgn: string): void => {
    setNewGameDialogOpen(false);
    services.openPgnText(pgn);
  }, [services]);

  const handleNewGameClose = useCallback((): void => {
    setNewGameDialogOpen(false);
  }, []);

  // ── MD8: derive effective tab with column order from active schema ────

  const schemaOrderedKeys: string[] | null =
    activeSchema.id !== BUILT_IN_SCHEMA.id
      ? [...activeSchema.fields]
          .sort((a, b) =>
            a.orderIndex !== b.orderIndex
              ? a.orderIndex - b.orderIndex
              : a.key.localeCompare(b.key),
          )
          .map((f) => f.key)
      : null;

  const activeTabForTable: TabState | null = (() => {
    if (!activeTab || !schemaOrderedKeys) return activeTab;
    const schemaSet: Set<string> = new Set<string>(schemaOrderedKeys);
    const stillShownSchemaKeys: string[] = schemaOrderedKeys.filter((k: string): boolean =>
      activeTab.metadataColumnOrder.includes(k),
    );
    const extras: string[] = activeTab.metadataColumnOrder.filter(
      (k: string): boolean => k !== "game" && !schemaSet.has(k),
    );
    const newOrder: string[] = ["game", ...stillShownSchemaKeys, ...extras];
    const newVisible: string[] = [...stillShownSchemaKeys, ...extras];
    return { ...activeTab, metadataColumnOrder: newOrder, visibleMetadataKeys: newVisible };
  })();

  // ── Available fields for group-by (exclude system keys and "game") ────

  const availableGroupByFields: string[] = activeTab
    ? activeTab.availableMetadataKeys.filter(
        (k: string): boolean =>
          k !== "game" &&
          k !== "identifier" &&
          k !== "source" &&
          k !== "revision" &&
          !groupByState.fields.includes(k),
      )
    : [];

  const hasActiveFilters: boolean = Object.values(columnFilters).some((v) => Boolean(v));

  /** Built-in + schema + discovered header tags not yet shown as columns (`game` excluded). */
  const addableSchemaFields: MetadataFieldDefinition[] = useMemo((): MetadataFieldDefinition[] => {
    if (!activeTab) return [];
    return listAddableMetadataFields(
      activeSchema,
      activeTab.metadataColumnOrder,
      activeTab.availableMetadataKeys,
    );
  }, [activeTab, activeSchema]);

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <section className="resource-viewer-card" data-ui-id={UI_IDS.RESOURCE_VIEWER_PANEL}>
      <ResourceTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onNewGame={handleNewGame}
        onMetadataOpen={handleMetadataOpen}
        onOpenResourceFile={(): void => { services.openResourceFile(); }}
        onOpenResourceDirectory={(): void => { services.openResourceDirectory(); }}
        onNewPgnFile={(): void => { services.createResource("file"); }}
        onNewDatabase={(): void => { services.createResource("db"); }}
        onNewDirectory={(): void => { services.createResource("directory"); }}
        t={t}
      />

      {/* Group-by toolbar (UV3) */}
      {activeTab && (
        <ResourceToolbar
          groupByState={groupByState}
          availableGroupByFields={availableGroupByFields}
          hasActiveFilters={hasActiveFilters}
          activeSchema={activeSchema}
          schemas={schemas}
          t={t}
          onGroupByAdd={handleGroupByAdd}
          onGroupByRemove={handleGroupByRemove}
          onGroupByMoveUp={handleGroupByMoveUp}
          onGroupByClear={handleGroupByClear}
          onClearFilters={handleClearFilters}
          onSchemaSelect={handleSchemaSelect}
          onSchemaManage={handleSchemaManage}
          addableSchemaFields={addableSchemaFields}
          onAddMetadataField={handleAddMetadataField}
        />
      )}

      <ResourceTable
        activeTab={activeTabForTable}
        columnFilters={columnFilters}
        groupByState={groupByState}
        sortConfig={sortConfig}
        activeSchema={activeSchema}
        colDragActiveKey={colDragActiveKey}
        supportsReorder={supportsReorder}
        t={t}
        onRowOpen={handleRowOpen}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onResizeStart={handleResizeStart}
        onColDragStart={handleColDragStart}
        onColDrop={handleColDrop}
        onSortChange={handleSortChange}
        onToggleGroup={handleToggleGroup}
        onRemoveMetadataColumn={handleRemoveMetadataColumn}
        trainingBadges={trainingBadges}
      />

      <ResourceMetadataDialog
        isOpen={isDialogOpen}
        dialogKey={dialogKey}
        activeTab={activeTab}
        dialogFormId={dialogFormId}
        t={t}
        onSave={handleMetadataSave}
        onClose={handleMetadataClose}
        onReset={handleMetadataReset}
      />

      {schemaEditorOpen && (
        <MetadataSchemaEditor
          schema={editingSchema}
          t={t}
          onSave={handleSchemaSave}
          onClose={handleSchemaEditorClose}
        />
      )}

      {newGameDialogOpen && (
        <NewGameDialog
          onCreate={handleNewGameCreate}
          onClose={handleNewGameClose}
        />
      )}
    </section>
  );
};
