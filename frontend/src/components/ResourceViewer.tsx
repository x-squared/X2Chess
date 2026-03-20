/**
 * ResourceViewer — React resource viewer component.
 *
 * Manages tab identity from `AppStoreState` (populated by `useAppStartup`) and
 * loads game rows via the `resource_loader` service registry.  Handles tab
 * selection/close, column resize (pointer capture), column drag-to-reorder
 * (DragEvent), and the metadata column selector dialog.
 *
 * Integration API:
 * - `<ResourceViewer />` — rendered by `AppShell` as the resource viewer card;
 *   no props required.
 *
 * Configuration API:
 * - No props.  Tab list flows from `AppStoreState.resourceViewerTabSnapshots`
 *   (populated by `useAppStartup` via `set_resource_tabs` action).
 * - Column preferences are persisted to `localStorage` under
 *   `x2chess.resourceViewerColumnPrefs.v1`.
 *
 * Communication API:
 * - Inbound: re-renders when `resourceViewerTabSnapshots` or `activeResourceTabId`
 *   change via the `AppStoreState`.
 * - Outbound: loads rows via `getResourceLoaderService()` on tab activation.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
  type ReactElement,
  type FormEvent,
  type DragEvent,
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

// ── Constants ─────────────────────────────────────────────────────────────────

const PREFS_STORAGE_KEY = "x2chess.resourceViewerColumnPrefs.v1";
const DEFAULT_COL_WIDTH_PX = 160;
const MIN_COL_WIDTH_PX = 90;
const MAX_COL_WIDTH_PX = 560;

/** Metadata columns shown when no user preference exists for a tab. */
const DEFAULT_METADATA_KEYS: readonly string[] = ["identifier", "source", "revision"];

// ── Local types ───────────────────────────────────────────────────────────────

type ResourceRef = {
  kind: string;
  locator: string;
};

type ResourceRow = {
  game: string;
  identifier: string;
  source: string;
  revision: string;
  metadata: Record<string, string>;
  sourceRef: Record<string, unknown> | null;
};

type TabState = {
  tabId: string;
  title: string;
  resourceRef: ResourceRef;
  rows: ResourceRow[];
  availableMetadataKeys: string[];
  visibleMetadataKeys: string[];
  metadataColumnOrder: string[];
  columnWidths: Record<string, number>;
  errorMessage: string;
  isLoading: boolean;
};

type TabPrefs = {
  visibleMetadataKeys: string[];
  metadataColumnOrder: string[];
  columnWidths: Record<string, number>;
};

type ColumnResizeState = {
  key: string;
  startX: number;
  startWidth: number;
};

// ── Column-prefs localStorage helpers ────────────────────────────────────────

const readPrefsMap = (): Record<string, TabPrefs> => {
  try {
    const raw: string | null = window.localStorage?.getItem(PREFS_STORAGE_KEY) ?? null;
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, TabPrefs>;
  } catch {
    return {};
  }
};

const writePrefsMap = (map: Record<string, TabPrefs>): void => {
  try {
    window.localStorage?.setItem(PREFS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage unavailable — keep UI functional.
  }
};

const persistTabPrefs = (tab: TabState): void => {
  const map: Record<string, TabPrefs> = readPrefsMap();
  map[tab.tabId] = {
    visibleMetadataKeys: [...tab.visibleMetadataKeys],
    metadataColumnOrder: [...tab.metadataColumnOrder],
    columnWidths: { ...tab.columnWidths },
  };
  writePrefsMap(map);
};

// ── Column-width clamp ────────────────────────────────────────────────────────

const clampWidth = (value: unknown): number => {
  const n: number = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_COL_WIDTH_PX;
  return Math.max(MIN_COL_WIDTH_PX, Math.min(MAX_COL_WIDTH_PX, Math.round(n)));
};

// ── Column-order normalization ────────────────────────────────────────────────

const reconcileColumns = (tab: TabState): TabState => {
  const visible: string[] =
    tab.visibleMetadataKeys.length > 0
      ? [...tab.visibleMetadataKeys]
      : [...DEFAULT_METADATA_KEYS];
  const allowed: string[] = ["game", ...visible];
  const seen = new Set<string>();
  const order: string[] = [];
  [...tab.metadataColumnOrder, ...allowed].forEach((k: string): void => {
    if (k && !seen.has(k) && allowed.includes(k)) {
      seen.add(k);
      order.push(k);
    }
  });
  const widths: Record<string, number> = {};
  order.forEach((k: string): void => {
    widths[k] = clampWidth(tab.columnWidths[k] ?? DEFAULT_COL_WIDTH_PX);
  });
  return { ...tab, visibleMetadataKeys: visible, metadataColumnOrder: order, columnWidths: widths };
};

// ── Row hydration ─────────────────────────────────────────────────────────────

const hydrateRows = (
  entries: unknown[],
  t: (key: string, fallback?: string) => string,
): { rows: ResourceRow[]; discoveredKeys: string[] } => {
  const discovered = new Set<string>();
  const rows: ResourceRow[] = (Array.isArray(entries) ? entries : []).map(
    (entry: unknown): ResourceRow => {
      const record: Record<string, unknown> =
        entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
      const sourceRefRaw: unknown = record.sourceRef;
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
      return {
        game: String(record.titleHint ?? identifier ?? t("resources.table.unknown", "Untitled")),
        identifier,
        source: metadata.source,
        revision: metadata.revision,
        metadata,
        sourceRef:
          sourceRefRaw && typeof sourceRefRaw === "object"
            ? (sourceRefRaw as Record<string, unknown>)
            : null,
      };
    },
  );
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

// ── Tab-title label helper ────────────────────────────────────────────────────

const resolveTabLabel = (tab: TabState): { label: string; tooltip: string } => {
  const { kind, locator } = tab.resourceRef;
  const norm: string = locator.replaceAll("\\", "/").trim();
  if (kind === "directory") {
    const leaf: string = norm.split("/").filter(Boolean).at(-1) ?? "";
    return {
      label: !norm || norm === "local-files" ? "Directory" : leaf || norm,
      tooltip: norm,
    };
  }
  if (kind === "file" || kind === "db") {
    const leaf: string = norm.split("/").filter(Boolean).at(-1) ?? "";
    return { label: leaf || tab.title || kind, tooltip: norm };
  }
  return { label: tab.title || kind || "Resource", tooltip: norm };
};

// ── Metadata catalog builder ──────────────────────────────────────────────────

const buildMetadataCatalog = (tab: TabState): Array<{ key: string; label: string }> => {
  const builtins: string[] = ["identifier", "source", "revision"];
  const builtinSet = new Set<string>(builtins);
  const dynamic = new Set<string>();
  tab.availableMetadataKeys.forEach((k: string): void => { dynamic.add(k); });
  tab.rows.forEach((row: ResourceRow): void => {
    if (row.metadata) Object.keys(row.metadata).forEach((k: string): void => { dynamic.add(k); });
  });
  const catalog: Array<{ key: string; label: string }> = builtins.map(
    (k: string): { key: string; label: string } => ({ key: k, label: k }),
  );
  [...dynamic]
    .filter((k: string): boolean => Boolean(k) && k !== "game" && !builtinSet.has(k))
    .sort((a: string, b: string): number => a.localeCompare(b))
    .forEach((k: string): void => { catalog.push({ key: k, label: k }); });
  return catalog;
};

// ── ResourceViewer ────────────────────────────────────────────────────────────

/** Renders the resource viewer: tab bar, game table, and metadata dialog. */
export const ResourceViewer = (): ReactElement => {
  const { state } = useAppContext();
  const tabSnapshots: ResourceTabSnapshot[] = selectResourceViewerTabs(state);
  const activeTabIdFromState: string | null = selectActiveResourceTabId(state);
  const t: (key: string, fallback?: string) => string = useTranslator();
  const dialogFormId: string = useId();

  // ── Local state ────────────────────────────────────────────────────────────

  const [tabs, setTabs] = useState<TabState[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  /** Incremented each time the dialog opens to remount the form with fresh `defaultChecked`. */
  const [dialogKey, setDialogKey] = useState<number>(0);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const columnResizeRef = useRef<ColumnResizeState | null>(null);
  const dragKeyRef = useRef<string>("");

  // ── Sync tab list from state snapshot ─────────────────────────────────────

  useEffect((): void => {
    setTabs((prev: TabState[]): TabState[] =>
      tabSnapshots.map((snapshot: ResourceTabSnapshot): TabState => {
        const existing: TabState | undefined = prev.find(
          (t: TabState): boolean => t.tabId === snapshot.tabId,
        );
        // Preserve loaded rows for tabs already known; initialise fresh for new ones.
        return existing ?? initTab(snapshot);
      }),
    );
    setActiveTabId((prev: string | null): string | null => {
      if (activeTabIdFromState) return activeTabIdFromState;
      const first: ResourceTabSnapshot | undefined = tabSnapshots[0];
      return first?.tabId ?? prev;
    });
    // tabSnapshots identity changes only when the snapshot fires — this is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabSnapshots, activeTabIdFromState]);

  // ── Row loading (fires when activeTabId changes) ───────────────────────────

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
          const errorMsg: string = msg || t("resources.error", "Unable to load resource.");
          setTabs((p: TabState[]): TabState[] =>
            p.map((tab: TabState): TabState =>
              tab.tabId === activeTabId
                ? { ...tab, isLoading: false, errorMessage: errorMsg }
                : tab,
            ),
          );
        }
      };

      void loadRows();
      return prev; // setTabs calls inside loadRows handle the update
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId, t]);

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
      if (!columnResizeRef.current) return;
      const key: string = columnResizeRef.current.key;
      columnResizeRef.current = null;
      // Persist the final width on pointer release.
      setTabs((prev: TabState[]): TabState[] => {
        const tab: TabState | undefined = prev.find((t: TabState): boolean => t.tabId === activeTabId);
        if (tab && key) persistTabPrefs(tab);
        return prev;
      });
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

  // ── Dialog open/close sync ────────────────────────────────────────────────

  useEffect((): void => {
    const dialog: HTMLDialogElement | null = dialogRef.current;
    if (!dialog) return;
    if (isDialogOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isDialogOpen && dialog.open) {
      dialog.close();
    }
  }, [isDialogOpen]);

  // ── Derived values ────────────────────────────────────────────────────────

  const activeTab: TabState | null =
    tabs.find((t: TabState): boolean => t.tabId === activeTabId) ?? null;

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  const handleRowOpen = useCallback((_rowIndex: number): void => {
    // TODO: wire to sessionOpenService.openSessionFromSourceRef(row.sourceRef, row.identifier)
  }, []);

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

  const handleDragStart = useCallback(
    (key: string, e: DragEvent<HTMLTableCellElement>): void => {
      dragKeyRef.current = key;
      e.dataTransfer.setData("text/plain", key);
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLTableCellElement>): void => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (targetKey: string, e: DragEvent<HTMLTableCellElement>): void => {
      e.preventDefault();
      const fromKey: string = dragKeyRef.current;
      dragKeyRef.current = "";
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
        const map: Record<string, TabPrefs> = readPrefsMap();
        delete map[t.tabId];
        writePrefsMap(map);
        return updated;
      }),
    );
    setIsDialogOpen(false);
  }, [activeTabId]);

  // ── Column header label helper ────────────────────────────────────────────

  const resolveColLabel = (key: string): string => {
    if (key === "identifier") return t("resources.table.identifier", "Identifier");
    if (key === "source") return t("resources.table.source", "Source");
    if (key === "revision") return t("resources.table.revision", "Revision");
    return key;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="resource-viewer-card">
      {/* Resize handle */}
      <div
        id="resource-viewer-resize-handle"
        className="resource-viewer-resize-handle"
        aria-hidden="true"
      />

      {/* Header row: title + actions */}
      <div className="resource-viewer-header">
        <div>
          <p className="resource-viewer-title">{t("resources.title", "Resources")}</p>
        </div>
        <div className="resource-viewer-actions">
          <button
            id="btn-resource-metadata"
            className="resource-icon-button"
            type="button"
            aria-label={t("resources.metadata.button", "Choose metadata columns")}
            title={t("resources.metadata.button", "Choose metadata columns")}
            onClick={handleMetadataOpen}
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <button
            id="btn-open-resource"
            className="resource-action-button"
            type="button"
          >
            {t("resources.open", "Open resource")}
          </button>
        </div>
      </div>

      {/* Tab bar */}
      {tabs.length > 0 && (
        <div
          className="resource-tabs"
          role="tablist"
          aria-label={t("resources.title", "Resources")}
        >
          {tabs.map((tab: TabState): ReactElement => {
            const isActive: boolean = tab.tabId === activeTabId;
            const { label, tooltip } = resolveTabLabel(tab);
            return (
              <div
                key={tab.tabId}
                role="tab"
                aria-selected={isActive}
                className={["resource-tab", isActive ? "active" : ""].filter(Boolean).join(" ")}
                data-resource-tab-id={tab.tabId}
              >
                <button
                  type="button"
                  className="resource-tab-title"
                  title={tooltip || undefined}
                  onClick={(): void => { handleTabSelect(tab.tabId); }}
                >
                  {label}
                </button>
                <button
                  type="button"
                  className="resource-tab-close"
                  aria-label={t("resources.tab.close", "Close resource tab")}
                  onClick={(): void => { handleTabClose(tab.tabId); }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Table area */}
      <div className="resource-table-wrap">
        {!activeTab ? (
          <p className="resource-viewer-empty">
            {t("resources.noTabs", "No resource tab is open.")}
          </p>
        ) : activeTab.errorMessage ? (
          <p className="resource-viewer-error">{activeTab.errorMessage}</p>
        ) : activeTab.isLoading ? (
          <p className="resource-viewer-empty">
            {t("resources.loading", "Loading resource games...")}
          </p>
        ) : activeTab.rows.length === 0 ? (
          <p className="resource-viewer-empty">
            {t("resources.empty", "No games found in this resource.")}
          </p>
        ) : (
          <table className="resource-games-table">
            <colgroup>
              {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
                <col
                  key={key}
                  data-resource-col-key={key}
                  style={{ width: `${clampWidth(activeTab.columnWidths[key])}px` }}
                />
              ))}
            </colgroup>
            <thead>
              <tr>
                {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
                  <th
                    key={key}
                    draggable
                    data-resource-col-key={key}
                    onDragStart={(e: DragEvent<HTMLTableCellElement>): void => {
                      handleDragStart(key, e);
                    }}
                    onDragOver={handleDragOver}
                    onDrop={(e: DragEvent<HTMLTableCellElement>): void => {
                      handleDrop(key, e);
                    }}
                  >
                    <span>
                      {key === "game"
                        ? t("resources.table.game", "Game")
                        : resolveColLabel(key)}
                    </span>
                    <span
                      className="resource-col-resize-handle"
                      aria-hidden="true"
                      onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>): void => {
                        handleResizeStart(key, e);
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeTab.rows.map((row: ResourceRow, i: number): ReactElement => (
                <tr
                  key={i}
                  className="resource-game-row"
                  onClick={(): void => { handleRowOpen(i); }}
                  onDoubleClick={(): void => { handleRowOpen(i); }}
                  onKeyDown={(e): void => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleRowOpen(i);
                    }
                  }}
                >
                  {activeTab.metadataColumnOrder.map((key: string): ReactElement => (
                    <td key={key}>
                      {key === "game" ? (
                        <button type="button" className="resource-open-button">
                          {row.game}
                        </button>
                      ) : (
                        String(row.metadata[key] ?? "-")
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Metadata column selector dialog.
          Opened programmatically via dialogRef.showModal() in a useEffect.
          A key prop on the form forces remount on each open so defaultChecked
          values reflect the current visibleMetadataKeys. */}
      <dialog
        ref={dialogRef}
        className="resource-metadata-dialog"
        aria-labelledby={`${dialogFormId}-title`}
      >
        <form
          key={dialogKey}
          method="dialog"
          className="resource-metadata-form"
          onSubmit={handleMetadataSave}
        >
          <p id={`${dialogFormId}-title`} className="resource-metadata-title">
            {t("resources.metadata.title", "Select metadata columns")}
          </p>
          <div className="resource-metadata-fields">
            {activeTab &&
              buildMetadataCatalog(activeTab).map(
                (field: { key: string; label: string }): ReactElement => (
                  <label key={field.key} className="resource-metadata-option">
                    <input
                      type="checkbox"
                      data-meta-key={field.key}
                      defaultChecked={activeTab.visibleMetadataKeys.includes(field.key)}
                    />
                    <span>{field.label}</span>
                  </label>
                ),
              )}
          </div>
          <label className="resource-metadata-apply-all">
            <input id="rv-meta-apply-all" type="checkbox" />
            {t("resources.metadata.applyAll", "Apply to all resources")}
          </label>
          <div className="resource-metadata-actions">
            <button
              id="btn-resource-metadata-reset"
              type="button"
              onClick={handleMetadataReset}
            >
              {t("resources.metadata.resetCurrent", "Reset columns for this resource")}
            </button>
            <button type="button" onClick={handleMetadataClose}>
              {t("resources.metadata.cancel", "Cancel")}
            </button>
            <button type="submit">
              {t("resources.metadata.save", "Apply")}
            </button>
          </div>
        </form>
      </dialog>

    </section>
  );
};
