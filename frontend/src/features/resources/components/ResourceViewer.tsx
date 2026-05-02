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
  useCallback,
  useEffect,
  useRef,
  useId,
  useMemo,
  type ReactElement,
} from "react";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import {
  selectResourceViewerTabs,
  selectActiveResourceTabId,
} from "../../../core/state/selectors";
import type { ResourceTabSnapshot } from "../../../core/state/app_reducer";
import { useTranslator } from "../../../app/hooks/useTranslator";
import { useServiceContext } from "../../../app/providers/ServiceProvider";
import {
  persistTabPrefs,
  reconcileColumns,
  insertMetadataColumnFromSchema,
  listAddableMetadataFields,
  removeMetadataColumnFromTab,
  DEFAULT_METADATA_KEYS,
  readPrefsMap,
  writePrefsMap,
  type TabState,
  type SortConfig,
  tabRows,
  tabAvailableKeys,
} from "../services/viewer_utils";
import { useColumnInteraction } from "../hooks/useColumnInteraction";
import { useGroupBy } from "../hooks/useGroupBy";
import { useResourceTabs } from "../hooks/useResourceTabs";
import { useSchemaManagement } from "../hooks/useSchemaManagement";
import { useResourceRowReorder } from "../hooks/useResourceRowReorder";
import { UI_IDS } from "../../../core/model/ui_ids";
import { ResourceTabBar } from "./ResourceTabBar";
import { ResourceTable } from "./ResourceTable";
import { ResourceMetadataDialog } from "./ResourceMetadataDialog";
import { ResourceToolbar } from "./ResourceToolbar";
import {
  BUILT_IN_SCHEMA,
  type MetadataFieldDefinition,
} from "../../../../../parts/resource/src/domain/metadata_schema";
import { log } from "../../../logger";
import { mirrorResourceSchemaIdToLocalStorage } from "../services/schema_storage";
import { loadBadgesForRefs } from "../../../training/transcript_storage";
import type { TrainingBadge } from "../../../training/transcript_storage";

/** Renders the resource viewer: tab bar, group-by toolbar, game table, and metadata dialog. */
export const resolveDeleteGameConfirmNext = (
  isDeleteGameConfirmArmed: boolean,
): { nextArmed: boolean; shouldDelete: boolean } => {
  if (!isDeleteGameConfirmArmed) {
    return { nextArmed: true, shouldDelete: false };
  }
  return { nextArmed: false, shouldDelete: true };
};

type ResourceViewerProps = {
  /** Navigate to the Metadata tab (used by the missing-schema notice). */
  onOpenMetadataTab?: () => void;
};

/** Renders the resource viewer: tab bar, group-by toolbar, game table, and metadata dialog. */
export const ResourceViewer = ({ onOpenMetadataTab }: ResourceViewerProps): ReactElement => {
  const { state } = useAppContext();
  const services = useServiceContext();
  const tabSnapshots: ResourceTabSnapshot[] = selectResourceViewerTabs(state);
  const activeTabId: string | null = selectActiveResourceTabId(state) ?? tabSnapshots[0]?.tabId ?? null;
  const t: (key: string, fallback?: string) => string = useTranslator();
  const dialogFormId: string = useId();

  // ── Local state ─────────────────────────────────────────────────────────

  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [dialogKey, setDialogKey] = useState<number>(0);
  const [columnFiltersMap, setColumnFiltersMap] = useState<Record<string, Record<string, string>>>({});
  const [sortMap, setSortMap] = useState<Record<string, SortConfig | null>>({});
  const [missingSchemaNotice, setMissingSchemaNotice] = useState<Record<string, boolean>>({});
  const [isDeleteGameConfirmArmed, setIsDeleteGameConfirmArmed] = useState<boolean>(false);

  // ── Schema management ─────────────────────────────────────────────────

  const {
    schemas,
    tabSchemaMap,
    activeSchema,
    initTabSchema,
    handleSchemaSelect,
  } = useSchemaManagement(activeTabId, {
    persistSchemaId: services.persistResourceSchemaId,
  });

  const activeTabResourceRef = useMemo(() => {
    const snap = tabSnapshots.find((t) => t.tabId === activeTabId);
    return snap ? { kind: snap.kind, locator: snap.locator } : null;
  }, [activeTabId, tabSnapshots]);

  useEffect(() => {
    if (!activeTabId || !activeTabResourceRef) return;
    const tabId = activeTabId;
    void services.loadResourceSchemaId(activeTabResourceRef).then((schemaId) => {
      initTabSchema(tabId, schemaId);
      mirrorResourceSchemaIdToLocalStorage(activeTabResourceRef, schemaId);
      services.notifySessionItemsChanged();
      if (schemaId !== null && !schemas.some((s) => s.id === schemaId)) {
        setMissingSchemaNotice((prev) => ({ ...prev, [tabId]: true }));
      }
    });
  }, [activeTabId, activeTabResourceRef?.kind, activeTabResourceRef?.locator]);

  // ── Tab state + row loading + live refresh ────────────────────────────

  const { tabs, setTabs } = useResourceTabs(
    activeTabId,
    tabSnapshots,
    schemas,
    tabSchemaMap,
    t,
  );

  // ── Derived values ───────────────────────────────────────────────────

  const activeTab: TabState | null =
    tabs.find((t: TabState): boolean => t.tabId === activeTabId) ?? null;

  /** Metadata for reference chips must use the **viewed** resource’s index rows, not `fetchGameMetadataByRecordId` (active chess session). */
  const fetchMetadataForViewerResource = useCallback(
    (recordId: string): Promise<Record<string, string> | null> => {
      const ref = activeTab?.resourceRef;
      if (!ref?.kind || !ref?.locator) {
        return Promise.resolve(null);
      }
      return services.fetchGameMetadataByRecordIdInResource(
        { kind: ref.kind, locator: ref.locator },
        recordId,
      );
    },
    [activeTab?.resourceRef?.kind, activeTab?.resourceRef?.locator, services],
  );

  const activeSessionResourceRef: { kind: string; locator: string } | null =
    services.getActiveSessionResourceRef();
  const canDeleteGame: boolean = activeTabId !== null && activeSessionResourceRef?.kind === "db";

  const columnFilters: Record<string, string> = columnFiltersMap[activeTabId ?? ""] ?? {};
  const sortConfig: SortConfig | null = sortMap[activeTabId ?? ""] ?? null;

  // ── Column interaction (resize + pointer drag-to-reorder) ─────────────

  const {
    colDragActiveKey,
    handleResizeStart,
    handleColDragStart,
    handleColDrop,
  } = useColumnInteraction(activeTabId, activeTab, setTabs);

  // ── Group-by state ────────────────────────────────────────────────────

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

  // ── Row reorder ───────────────────────────────────────────────────────

  const { handleMoveUp, handleMoveDown } = useResourceRowReorder(
    activeTabId,
    setTabs,
    services.reorderGameInResource,
  );

  // ── Training badges (T14) ─────────────────────────────────────────────

  const trainingBadges: Map<string, TrainingBadge> = useMemo((): Map<string, TrainingBadge> => {
    const refs = tabRows(activeTab)
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
  }, [activeTab?.loadState]);

  // ── Reference metadata cache (GRP / filter) ───────────────────────────
  // Resolved metadata for all recordIds found in reference-type columns of the
  // active tab. Populated once per tab load; used by ResourceTable for both
  // ReferenceCell rendering and reference-field substring filtering.

  const resolvedRefMeta = useRef<Map<string, Record<string, string>>>(new Map());

  useEffect((): void => {
    const rows = tabRows(activeTab);
    if (rows.length === 0) {
      resolvedRefMeta.current = new Map();
      return;
    }

    // Collect unique recordIds from all reference-type columns.
    const refKeys: string[] = activeSchema.fields
      .filter((f) => f.type === "reference")
      .map((f) => f.key);

    if (refKeys.length === 0) {
      resolvedRefMeta.current = new Map();
      return;
    }

    const unique = new Set<string>();
    for (const row of rows) {
      for (const key of refKeys) {
        const val = row.metadata[key];
        if (val) unique.add(val);
      }
    }

    if (unique.size === 0) {
      resolvedRefMeta.current = new Map();
      return;
    }

    // Batch-fetch; populate cache as results arrive.
    const next = new Map<string, Record<string, string>>();
    resolvedRefMeta.current = next;
    for (const recordId of unique) {
      void fetchMetadataForViewerResource(recordId).then((meta) => {
        if (meta && resolvedRefMeta.current === next) {
          next.set(recordId, meta);
        }
      });
    }
  // Re-run when rows reload or schema changes (refKeys may differ).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.loadState, activeSchema.id, fetchMetadataForViewerResource]);

  // ── Tab handlers ──────────────────────────────────────────────────────

  const handleTabSelect = useCallback((tabId: string): void => {
    services.selectResourceTab(tabId);
  }, [services]);

  const handleTabClose = useCallback((tabId: string): void => {
    setTabs((prev: TabState[]): TabState[] => prev.filter((t: TabState): boolean => t.tabId !== tabId));
    services.closeResourceTab(tabId);
  }, [services, setTabs]);

  const handleRowOpen = useCallback((rowIndex: number): void => {
    if (!activeTab) return;
    const row = tabRows(activeTab)[rowIndex];
    if (!row?.sourceRef) return;
    services.openGameFromRef(row.sourceRef);
  }, [activeTab, services]);

  // ── Sort (UV4) ────────────────────────────────────────────────────────

  const handleSortChange = useCallback((key: string): void => {
    if (!activeTabId) return;
    setSortMap((prev): Record<string, SortConfig | null> => {
      const current: SortConfig | null = prev[activeTabId] ?? null;
      let next: SortConfig | null;
      if (current?.key !== key) {
        next = { key, dir: "asc" };
      } else if (current.dir === "asc") {
        next = { key, dir: "desc" };
      } else {
        next = null;
      }
      return { ...prev, [activeTabId]: next };
    });
  }, [activeTabId]);

  // ── Metadata dialog ───────────────────────────────────────────────────

  const handleMetadataOpen = useCallback((): void => {
    setDialogKey((k: number): number => k + 1);
    setIsDialogOpen(true);
  }, []);

  const handleMetadataClose = useCallback((): void => {
    setIsDialogOpen(false);
  }, []);

  const handleMetadataSave = useCallback(
    (e: import("react").SyntheticEvent<HTMLFormElement>): void => {
      e.preventDefault();
      const form = e.currentTarget;
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
    [activeTabId, setTabs],
  );

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
  }, [activeTabId, setTabs]);

  // ── Column filter handlers ────────────────────────────────────────────

  const handleFilterChange = useCallback((key: string, value: string): void => {
    setColumnFiltersMap((prev: Record<string, Record<string, string>>): Record<string, Record<string, string>> => {
      const tabId: string = activeTabId ?? "";
      const existing: Record<string, string> = prev[tabId] ?? {};
      return { ...prev, [tabId]: { ...existing, [key]: value } };
    });
  }, [activeTabId]);

  const handleClearFilters = useCallback((): void => {
    if (!activeTabId) return;
    setColumnFiltersMap((prev) => ({ ...prev, [activeTabId]: {} }));
  }, [activeTabId]);

  // ── Metadata column handlers ──────────────────────────────────────────

  const handleAddMetadataField = useCallback((fieldKey: string): void => {
    if (!activeTabId || !fieldKey) return;
    setTabs((prev: TabState[]): TabState[] =>
      prev.map((t: TabState): TabState => {
        if (t.tabId !== activeTabId) return t;
        const updated: TabState = insertMetadataColumnFromSchema(
          t,
          fieldKey,
          activeSchema,
          tabAvailableKeys(t),
        );
        if (updated === t) return t;
        log.info("ResourceViewer", "Added metadata column", { fieldKey, schemaId: activeSchema.id });
        persistTabPrefs(updated);
        return updated;
      }),
    );
  }, [activeTabId, activeSchema, setTabs]);

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
      if (cur?.key === fieldKey) return { ...prev, [activeTabId]: null };
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
  }, [activeTabId, setTabs]);

  // ── New game (NG6) ────────────────────────────────────────────────────

  const handleNewGame = useCallback((): void => { services.openNewGameDialog(); }, [services]);

  const handleDeleteGame = useCallback((): void => {
    const next: { nextArmed: boolean; shouldDelete: boolean } =
      resolveDeleteGameConfirmNext(isDeleteGameConfirmArmed);
    if (!next.shouldDelete) {
      // [log: may downgrade to debug once delete-game confirmation UX is stable]
      log.info("ResourceViewer", "Delete game: armed inline confirmation");
      setIsDeleteGameConfirmArmed(next.nextArmed);
      return;
    }
    // [log: may downgrade to debug once delete-game confirmation UX is stable]
    log.info("ResourceViewer", "Delete game: confirmed; deleting active resource game");
    void services.deleteActiveGameInResource();
    setIsDeleteGameConfirmArmed(next.nextArmed);
  }, [isDeleteGameConfirmArmed, services]);

  const handleDeleteGameCancel = useCallback((): void => {
    // [log: may downgrade to debug once delete-game confirmation UX is stable]
    log.info("ResourceViewer", "Delete game: confirmation cancelled");
    setIsDeleteGameConfirmArmed(false);
  }, []);

  useEffect((): void => {
    if (!canDeleteGame && isDeleteGameConfirmArmed) {
      setIsDeleteGameConfirmArmed(false);
    }
  }, [canDeleteGame, isDeleteGameConfirmArmed]);

  // ── MD8: derive effective tab with column order from active schema ─────

  const schemaOrderedKeys: string[] | null =
    activeSchema.id === BUILT_IN_SCHEMA.id
      ? null
      : [...activeSchema.fields]
          .sort((a, b) =>
            a.orderIndex === b.orderIndex
              ? a.key.localeCompare(b.key)
              : a.orderIndex - b.orderIndex,
          )
          .map((f) => f.key);

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

  const availableGroupByFields: string[] = tabAvailableKeys(activeTab).filter(
    (k: string): boolean =>
      k !== "game" && k !== "identifier" && k !== "source" && k !== "revision" &&
      !groupByState.fields.includes(k),
  );

  const hasActiveFilters: boolean = Object.values(columnFilters).some(Boolean);

  const addableSchemaFields: MetadataFieldDefinition[] = useMemo((): MetadataFieldDefinition[] => {
    if (!activeTab) return [];
    return listAddableMetadataFields(
      activeSchema,
      activeTab.metadataColumnOrder,
      tabAvailableKeys(activeTab),
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
        onDeleteGame={handleDeleteGame}
        onDeleteGameCancel={handleDeleteGameCancel}
        isDeleteGameConfirmArmed={isDeleteGameConfirmArmed}
        canDeleteGame={canDeleteGame}
        onMetadataOpen={handleMetadataOpen}
        onOpenResourceFile={(): void => { services.openResourceFile(); }}
        onOpenResourceDatabase={(): void => { services.openResourceDatabase(); }}
        onOpenResourceDirectory={(): void => { services.openResourceDirectory(); }}
        onNewPgnFile={(): void => { services.createResource("file"); }}
        onNewDatabase={(): void => { services.createResource("db"); }}
        onNewDirectory={(): void => { services.createResource("directory"); }}
        t={t}
      />

      {activeTabId && missingSchemaNotice[activeTabId] && (
        <output className="resource-schema-notice">
          <span className="resource-schema-notice__text">
            {t("schema.resource.missingNotice", "This resource uses a metadata schema that is not installed on this device.")}
          </span>
          {onOpenMetadataTab && (
            <button
              type="button"
              className="resource-schema-notice__action"
              onClick={onOpenMetadataTab}
            >
              {t("schema.resource.manageSchemasLink", "Manage schemas\u2026")}
            </button>
          )}
          <button
            type="button"
            className="resource-schema-notice__dismiss"
            aria-label={t("schema.resource.dismissNotice", "Dismiss")}
            onClick={(): void => {
              setMissingSchemaNotice((prev) => ({ ...prev, [activeTabId]: false }));
            }}
          >
            ✕
          </button>
        </output>
      )}

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
          onSchemaSelect={(id): void => { handleSchemaSelect(id, activeTab?.resourceRef ?? null); }}
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
        resolvedRefMeta={resolvedRefMeta.current}
        onFetchMetadata={fetchMetadataForViewerResource}
        onOpenReference={(id): void => { void services.openGameFromRecordId(id); }}
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

    </section>
  );
};
