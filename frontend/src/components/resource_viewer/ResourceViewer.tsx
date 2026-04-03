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
  useRef,
  useCallback,
  useId,
  useMemo,
  type ReactElement,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAppContext } from "../state/app_context";
import {
  selectResourceViewerTabs,
  selectActiveResourceTabId,
} from "../state/selectors";
import type { ResourceTabSnapshot } from "../state/app_reducer";
import { useTranslator } from "../hooks/useTranslator";
import { getResourceLoaderService } from "../services/resource_loader";
import { useServiceContext } from "../state/ServiceContext";
import {
  clampWidth,
  readPrefsMap,
  writePrefsMap,
  persistTabPrefs,
  reconcileColumns,
  readGroupByState,
  writeGroupByState,
  DEFAULT_METADATA_KEYS,
  type TabState,
  type TabPrefs,
  type ResourceRef,
  type GroupByState,
  type SortConfig,
} from "../resources_viewer/viewer_utils";
import { GUIDE_IDS } from "../guide/guide_ids";
import { ResourceTabBar } from "./ResourceTabBar";
import { ResourceTable } from "./ResourceTable";
import { ResourceMetadataDialog } from "./ResourceMetadataDialog";
import { MetadataSchemaEditor } from "./MetadataSchemaEditor";
import { NewGameDialog } from "./NewGameDialog";
import { ResourceToolbar } from "./ResourceToolbar";
import {
  loadSchemas,
  saveSchemas,
  upsertSchema,
} from "../resources_viewer/schema_storage";
import type { MetadataSchema } from "../../../resource/domain/metadata_schema";
import { BUILT_IN_SCHEMA } from "../../../resource/domain/metadata_schema";
import { loadBadgesForRefs } from "../training/transcript_storage";
import type { TrainingBadge } from "../training/transcript_storage";

// ── Local types ───────────────────────────────────────────────────────────────

type ColumnResizeState = {
  key: string;
  startX: number;
  startWidth: number;
};

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

const buildTabId = (ref: ResourceRef): string =>
  `resource-${ref.kind}-${ref.locator}`.replace(/[^a-zA-Z0-9_-]/g, "_");

const initTab = (snapshot: ResourceTabSnapshot): TabState => {
  const ref: ResourceRef = { kind: snapshot.kind, locator: snapshot.locator };
  const tabId: string = snapshot.tabId || buildTabId(ref);
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
  const activeTabIdFromState: string | null = selectActiveResourceTabId(state);
  const t: (key: string, fallback?: string) => string = useTranslator();
  const dialogFormId: string = useId();

  // ── Local state ────────────────────────────────────────────────────────

  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [dialogKey, setDialogKey] = useState<number>(0);
  // Per-tab column filter strings; keyed by tabId.
  const [columnFiltersMap, setColumnFiltersMap] = useState<Record<string, Record<string, string>>>({});
  // Per-tab group-by state; keyed by tabId.
  const [groupByMap, setGroupByMap] = useState<Record<string, GroupByState>>({});
  // Per-tab sort config; keyed by tabId.
  const [sortMap, setSortMap] = useState<Record<string, SortConfig | null>>({});
  // Currently-dragged column key (pointer-based, not HTML5 DnD).
  const [colDragActiveKey, setColDragActiveKey] = useState<string>("");
  // User-defined metadata schemas.
  const [schemas, setSchemas] = useState<MetadataSchema[]>(() => loadSchemas());
  // Per-tab selected schema ID (null = built-in).
  const [tabSchemaMap, setTabSchemaMap] = useState<Record<string, string | null>>({});
  const [schemaEditorOpen, setSchemaEditorOpen] = useState<boolean>(false);
  const [editingSchema, setEditingSchema] = useState<MetadataSchema | null>(null);
  const [newGameDialogOpen, setNewGameDialogOpen] = useState<boolean>(false);

  const columnResizeRef = useRef<ColumnResizeState | null>(null);
  const colDragKeyRef = useRef<string>("");

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
    setActiveTabId((prev: string | null): string | null => {
      if (activeTabIdFromState) return activeTabIdFromState;
      const first: ResourceTabSnapshot | undefined = tabSnapshots[0];
      return first?.tabId ?? prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabSnapshots, activeTabIdFromState]);

  // ── Load group-by from localStorage when a tab first becomes active ───

  useEffect((): void => {
    if (!activeTabId) return;
    setGroupByMap((prev): Record<string, GroupByState> => {
      if (prev[activeTabId]) return prev;
      const loaded = readGroupByState(activeTabId);
      return { ...prev, [activeTabId]: loaded };
    });
  }, [activeTabId]);

  // ── Row loading ────────────────────────────────────────────────────────

  useEffect((): void => {
    if (!activeTabId) return;
    setTabs((prev: TabState[]): TabState[] => {
      const tab: TabState | undefined = prev.find((t: TabState): boolean => t.tabId === activeTabId);
      if (!tab || tab.rows.length > 0 || tab.isLoading || tab.errorMessage) return prev;
      const loader = getResourceLoaderService();
      if (!loader) return prev;

      const loadRows = async (): Promise<void> => {
        setTabs((p: TabState[]): TabState[] =>
          p.map((t: TabState): TabState =>
            t.tabId === activeTabId ? { ...t, isLoading: true, errorMessage: "" } : t,
          ),
        );
        try {
          const entries: unknown[] = await loader(tab.resourceRef);
          const { rows, discoveredKeys } = hydrateRows(entries, t);
          setTabs((p: TabState[]): TabState[] =>
            p.map((t: TabState): TabState => {
              if (t.tabId !== activeTabId) return t;
              return reconcileColumns({
                ...t,
                rows,
                availableMetadataKeys: discoveredKeys,
                isLoading: false,
              });
            }),
          );
        } catch (err: unknown) {
          const msg: string = err instanceof Error ? err.message : String(err);
          const errorMessage: string = msg || t("resources.error", "Unable to load resource.");
          setTabs((p: TabState[]): TabState[] =>
            p.map((tab: TabState): TabState =>
              tab.tabId === activeTabId
                ? { ...tab, isLoading: false, errorMessage }
                : tab,
            ),
          );
        }
      };

      void loadRows();
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, t]);

  // ── Column resize (window pointer events for pointer capture) ─────────

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
          const tab: TabState | undefined = prev.find((t: TabState): boolean => t.tabId === activeTabId);
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
  }, [activeTabId]);

  // ── Derived values ────────────────────────────────────────────────────

  const activeTab: TabState | null =
    tabs.find((t: TabState): boolean => t.tabId === activeTabId) ?? null;

  const columnFilters: Record<string, string> = columnFiltersMap[activeTabId ?? ""] ?? {};
  const groupByState: GroupByState = groupByMap[activeTabId ?? ""] ?? { fields: [], collapsedKeys: [] };
  const sortConfig: SortConfig | null = sortMap[activeTabId ?? ""] ?? null;

  const supportsReorder: boolean = activeTab?.resourceRef.kind === "db";

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
    setActiveTabId(tabId);
  }, []);

  const handleTabClose = useCallback((tabId: string): void => {
    setTabs((prev: TabState[]): TabState[] => prev.filter((t: TabState): boolean => t.tabId !== tabId));
    setActiveTabId((prev: string | null): string | null => {
      if (prev !== tabId) return prev;
      setTabs((current: TabState[]): TabState[] => {
        const remaining: TabState[] = current.filter((t: TabState): boolean => t.tabId !== tabId);
        setActiveTabId(remaining[0]?.tabId ?? null);
        return current;
      });
      return prev;
    });
  }, []);

  const handleRowOpen = useCallback((rowIndex: number): void => {
    if (!activeTab) return;
    const row = activeTab.rows[rowIndex];
    if (!row?.sourceRef) return;
    services.openGameFromRef(row.sourceRef);
  }, [activeTab, services]);

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

  // ── Pointer-based column drag (UV1) ───────────────────────────────────

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
    [activeTabId],
  );

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

  // ── Group-by (UV3) ────────────────────────────────────────────────────

  const handleGroupByAdd = useCallback((field: string): void => {
    if (!activeTabId) return;
    setGroupByMap((prev): Record<string, GroupByState> => {
      const current: GroupByState = prev[activeTabId] ?? { fields: [], collapsedKeys: [] };
      if (current.fields.includes(field)) return prev;
      const next: GroupByState = { ...current, fields: [...current.fields, field] };
      writeGroupByState(activeTabId, next);
      return { ...prev, [activeTabId]: next };
    });
  }, [activeTabId]);

  const handleGroupByRemove = useCallback((field: string): void => {
    if (!activeTabId) return;
    setGroupByMap((prev): Record<string, GroupByState> => {
      const current: GroupByState = prev[activeTabId] ?? { fields: [], collapsedKeys: [] };
      const next: GroupByState = { ...current, fields: current.fields.filter((f) => f !== field) };
      writeGroupByState(activeTabId, next);
      return { ...prev, [activeTabId]: next };
    });
  }, [activeTabId]);

  const handleGroupByMoveUp = useCallback((field: string): void => {
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
  }, [activeTabId]);

  const handleGroupByClear = useCallback((): void => {
    if (!activeTabId) return;
    const next: GroupByState = { fields: [], collapsedKeys: [] };
    writeGroupByState(activeTabId, next);
    setGroupByMap((prev) => ({ ...prev, [activeTabId]: next }));
  }, [activeTabId]);

  const handleToggleGroup = useCallback((groupKey: string): void => {
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

  const reloadTab = useCallback((tabId: string | null): void => {
    if (!tabId) return;
    setTabs((prev: TabState[]): TabState[] =>
      prev.map((t: TabState): TabState =>
        t.tabId === tabId ? { ...t, rows: [], isLoading: false, errorMessage: "" } : t,
      ),
    );
  }, []);

  const handleMoveUp = useCallback((
    row: TabState["rows"][number],
    neighborRow: TabState["rows"][number],
  ): void => {
    if (!row?.sourceRef || !neighborRow?.sourceRef) return;
    void (async (): Promise<void> => {
      try {
        await services.reorderGameInResource(row.sourceRef, neighborRow.sourceRef);
        reloadTab(activeTabId);
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        void message;
      }
    })();
  }, [activeTabId, reloadTab, services]);

  const handleMoveDown = useCallback((
    row: TabState["rows"][number],
    neighborRow: TabState["rows"][number],
  ): void => {
    if (!row?.sourceRef || !neighborRow?.sourceRef) return;
    void (async (): Promise<void> => {
      try {
        await services.reorderGameInResource(row.sourceRef, neighborRow.sourceRef);
        reloadTab(activeTabId);
      } catch (err: unknown) {
        const message: string = err instanceof Error ? err.message : String(err);
        void message;
      }
    })();
  }, [activeTabId, reloadTab, services]);

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
    const schemaSet = new Set(schemaOrderedKeys);
    const rest = activeTab.metadataColumnOrder.filter(
      (k: string): boolean => !schemaSet.has(k) && k !== "game",
    );
    const newOrder = ["game", ...schemaOrderedKeys, ...rest];
    return { ...activeTab, metadataColumnOrder: newOrder, visibleMetadataKeys: schemaOrderedKeys };
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

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <section className="resource-viewer-card" data-guide-id={GUIDE_IDS.RESOURCE_VIEWER_PANEL}>
      <ResourceTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        onNewGame={handleNewGame}
        onMetadataOpen={handleMetadataOpen}
        onOpenResource={(): void => { services.openResource(); }}
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
