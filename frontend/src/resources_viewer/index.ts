import { createResourceMetadataPrefs } from "./resource_metadata_prefs.js";
import type { SourceRefLike } from "../runtime/bootstrap_shared";

/**
 * Index module.
 *
 * Integration API:
 * - Primary exports from this module: `createResourceViewerCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type ResourceRefLike = SourceRefLike;

type ResourceRow = {
  game: string;
  identifier: string;
  source: string;
  revision: string;
  metadata: Record<string, unknown>;
  sourceRef: ResourceRefLike | null;
};

type ResourceTab = {
  tabId: string;
  title: string;
  resourceRef: ResourceRefLike;
  rows: ResourceRow[];
  availableMetadataKeys: string[];
  visibleMetadataKeys: string[];
  metadataColumnOrder: string[];
  columnWidths: Record<string, number>;
  errorMessage: string;
  isLoading: boolean;
};

type ResourceViewerState = {
  resourceViewerTabs: unknown[];
  resourceViewerDefaultMetadataKeys: string[];
  activeResourceTabId: string | null;
};

type ResourceTabInput = {
  title?: string;
  resourceRef: ResourceRefLike;
  visibleMetadataKeys?: string[];
};

type ResourceViewerDeps = {
  state: ResourceViewerState;
  t: (key: string, fallback?: string) => string;
  btnResourceMetadata: Element | null;
  btnOpenResource: Element | null;
  resourceMetadataDialogEl: Element | null;
  resourceMetadataFieldsEl: Element | null;
  resourceMetadataApplyAllEl: Element | null;
  btnResourceMetadataReset: Element | null;
  btnResourceMetadataCancel: Element | null;
  btnResourceMetadataSave: Element | null;
  resourceTabsEl: Element | null;
  resourceTableWrapEl: Element | null;
  listGamesForResource: (resourceRef: ResourceRefLike) => Promise<unknown[]>;
  onRequestOpenResource?: () => void | Promise<void>;
  onOpenGameBySourceRef?: (sourceRef: ResourceRefLike) => void | Promise<void>;
};

type ColumnResizeState = {
  key: string;
  startClientX: number;
  startWidth: number;
};

const buildResourceTabId = (resourceRef: ResourceRefLike): string => {
  const kind: string = String(resourceRef?.kind || "unknown");
  const locator: string = String(resourceRef?.locator || "default");
  return `resource-${kind}-${locator}`.replace(/[^a-zA-Z0-9_-]/g, "_");
};

const normalizeResourceLocator = (locator: unknown): string => String(locator || "").replaceAll("\\", "/").trim();

const deriveDirectoryLabel = (locator: unknown): string => {
  const normalizedLocator: string = normalizeResourceLocator(locator);
  if (!normalizedLocator || normalizedLocator === "local-files") {
    return "Directory";
  }
  const segments: string[] = normalizedLocator.split("/").filter(Boolean);
  const leaf: string = segments[segments.length - 1] || "";
  return leaf || normalizedLocator;
};

const deriveResourceNameLabel = (locator: string, fallback: string): string => {
  if (!locator) return fallback;
  const segments: string[] = locator.split("/").filter(Boolean);
  const leaf: string = segments[segments.length - 1] || "";
  return leaf || fallback;
};

const resolveTabTitleText = (tab: ResourceTab): { label: string; tooltip: string } => {
  const kind: string = String(tab?.resourceRef?.kind || "");
  const locator: string = normalizeResourceLocator(tab?.resourceRef?.locator || "");
  if (kind === "directory") {
    return {
      label: deriveDirectoryLabel(locator),
      tooltip: locator,
    };
  }
  if (kind === "file" || kind === "db") {
    const fallback: string = String(tab?.title || tab?.resourceRef?.kind || "Resource");
    return {
      label: deriveResourceNameLabel(locator, fallback),
      tooltip: locator,
    };
  }
  return {
    label: String(tab?.title || tab?.resourceRef?.kind || "Resource"),
    tooltip: locator,
  };
};

const toResourceRef = (value: unknown): ResourceRefLike | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    kind: typeof record.kind === "string" ? record.kind : undefined,
    locator: typeof record.locator === "string" ? record.locator : undefined,
    recordId: typeof record.recordId === "string" ? record.recordId : undefined,
  };
};

const toResourceTab = (tab: ResourceTabInput, state: ResourceViewerState): ResourceTab => ({
  tabId: buildResourceTabId(tab.resourceRef),
  title: String(tab.title || tab.resourceRef?.kind || "Resource"),
  resourceRef: tab.resourceRef || { kind: "file", locator: "default" },
  rows: [],
  availableMetadataKeys: [],
  visibleMetadataKeys: Array.isArray(tab.visibleMetadataKeys)
    ? [...tab.visibleMetadataKeys]
    : [...state.resourceViewerDefaultMetadataKeys],
  metadataColumnOrder: ["game"],
  columnWidths: {},
  errorMessage: "",
  isLoading: false,
});

export const createResourceViewerCapabilities = ({
  state,
  t,
  btnResourceMetadata,
  btnOpenResource,
  resourceMetadataDialogEl,
  resourceMetadataFieldsEl,
  resourceMetadataApplyAllEl,
  btnResourceMetadataReset,
  btnResourceMetadataCancel,
  btnResourceMetadataSave,
  resourceTabsEl,
  resourceTableWrapEl,
  listGamesForResource,
  onRequestOpenResource,
  onOpenGameBySourceRef,
}: ResourceViewerDeps) => {
  const metadataPrefs = createResourceMetadataPrefs({
    state: state as Parameters<typeof createResourceMetadataPrefs>[0]["state"],
  });
  let draggedColumnKey = "";

  const getTabs = (): ResourceTab[] =>
    (Array.isArray(getTabs()) ? getTabs() : []) as ResourceTab[];

  const setTabs = (tabs: ResourceTabInput[]): void => {
    const normalized: ResourceTab[] = (Array.isArray(tabs) ? tabs : []).map((tab: ResourceTabInput): ResourceTab =>
      toResourceTab(tab, state),
    );
    normalized.forEach((tab: ResourceTab): void => {
      metadataPrefs.initializeTab(tab);
    });
    state.resourceViewerTabs = normalized;
    if (!normalized.find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId)) {
      state.activeResourceTabId = normalized[0]?.tabId || null;
    }
  };

  const upsertTab = ({
    title,
    resourceRef,
    select,
  }: {
    title: string;
    resourceRef: ResourceRefLike;
    select: boolean;
  }): string | null => {
    if (!resourceRef || typeof resourceRef !== "object") return null;
    const tabId: string = buildResourceTabId(resourceRef);
    const existing: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === tabId);
    if (existing) {
      if (title) existing.title = String(title);
      if (select) state.activeResourceTabId = existing.tabId;
      return existing.tabId;
    }
    const nextTab: ResourceTab = toResourceTab({ title, resourceRef }, state);
    metadataPrefs.initializeTab(nextTab);
    getTabs().push(nextTab);
    if (select || !state.activeResourceTabId) state.activeResourceTabId = nextTab.tabId;
    return nextTab.tabId;
  };

  const selectTab = (tabId: string): void => {
    if (!tabId) return;
    const exists: boolean = getTabs().some((tab: ResourceTab): boolean => tab.tabId === tabId);
    if (!exists) return;
    state.activeResourceTabId = tabId;
  };

  const closeTab = (tabId: string): void => {
    const index: number = getTabs().findIndex((tab: ResourceTab): boolean => tab.tabId === tabId);
    if (index < 0) return;
    getTabs().splice(index, 1);
    if (state.activeResourceTabId !== tabId) return;
    const next: ResourceTab | undefined = getTabs()[Math.min(index, getTabs().length - 1)];
    state.activeResourceTabId = next?.tabId || null;
  };

  const refreshActiveTabRows = async (): Promise<void> => {
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    if (!active) return;
    active.isLoading = true;
    active.errorMessage = "";
    try {
      const entries: unknown[] = await listGamesForResource(active.resourceRef);
      metadataPrefs.hydrateRowsIntoTab(active, entries, t);
    } catch (error: unknown) {
      active.rows = [];
      active.availableMetadataKeys = [];
      const msg: string = error instanceof Error ? error.message : String(error);
      active.errorMessage = msg || t("resources.error", "Unable to load resource games.");
    } finally {
      active.isLoading = false;
    }
  };

  const getActiveResourceRef = (): ResourceRefLike | null => {
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    return active?.resourceRef || null;
  };

  const openActiveRowByIndex = (rowIndex: number): void => {
    if (!Number.isInteger(rowIndex) || rowIndex < 0) return;
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    const row: ResourceRow | undefined = active?.rows?.[rowIndex];
    if (!row?.sourceRef) return;
    if (typeof onOpenGameBySourceRef === "function") {
      void Promise.resolve(onOpenGameBySourceRef(row.sourceRef)).catch((): void => {});
    }
  };

  const render = (): void => {
    if (resourceTabsEl instanceof HTMLElement) {
      resourceTabsEl.innerHTML = "";
      getTabs().forEach((tab: ResourceTab): void => {
        const active: boolean = tab.tabId === state.activeResourceTabId;
        const tabEl: HTMLDivElement = document.createElement("div");
        tabEl.className = `resource-tab${active ? " active" : ""}`;
        tabEl.setAttribute("role", "tab");
        tabEl.setAttribute("aria-selected", active ? "true" : "false");

        const titleBtn: HTMLButtonElement = document.createElement("button");
        titleBtn.type = "button";
        titleBtn.className = "resource-tab-title";
        titleBtn.dataset.resourceAction = "select";
        titleBtn.dataset.resourceTabId = tab.tabId;
        const resolvedTabTitle = resolveTabTitleText(tab);
        titleBtn.textContent = resolvedTabTitle.label;
        if (resolvedTabTitle.tooltip) titleBtn.title = resolvedTabTitle.tooltip;
        tabEl.appendChild(titleBtn);

        const closeBtn: HTMLButtonElement = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "resource-tab-close";
        closeBtn.dataset.resourceAction = "close";
        closeBtn.dataset.resourceTabId = tab.tabId;
        closeBtn.setAttribute("aria-label", t("resources.tab.close", "Close resource tab"));
        closeBtn.textContent = "×";
        tabEl.appendChild(closeBtn);

        resourceTabsEl.appendChild(tabEl);
      });
    }

    if (!(resourceTableWrapEl instanceof HTMLElement)) return;
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    if (!active) {
      resourceTableWrapEl.innerHTML = `<p class="resource-viewer-empty">${t("resources.noTabs", "No resource tab is open.")}</p>`;
      return;
    }
    if (active.errorMessage) {
      resourceTableWrapEl.innerHTML = `<p class="resource-viewer-error">${active.errorMessage}</p>`;
      return;
    }
    if (active.isLoading) {
      resourceTableWrapEl.innerHTML = `<p class="resource-viewer-empty">${t("resources.loading", "Loading resource games...")}</p>`;
      return;
    }
    if (!active.rows.length) {
      resourceTableWrapEl.innerHTML = `<p class="resource-viewer-empty">${t("resources.empty", "No games found in this resource.")}</p>`;
      return;
    }

    const headerGame: string = t("resources.table.game", "Game");
    const resolveMetadataLabel = (fieldKey: string): string => {
      if (fieldKey === "identifier") return t("resources.table.identifier", "Identifier");
      if (fieldKey === "source") return t("resources.table.source", "Source");
      if (fieldKey === "revision") return t("resources.table.revision", "Revision");
      return fieldKey;
    };

    const selectedColumnKeys: string[] = metadataPrefs.reconcileTabColumnState(active);
    const selectedMetadataHeadersMarkup: string = selectedColumnKeys
      .map(
        (fieldKey: string): string =>
          `<th draggable="true" data-resource-col-key="${fieldKey}">
        <span>${fieldKey === "game" ? headerGame : resolveMetadataLabel(fieldKey)}</span>
        <span class="resource-col-resize-handle" data-resource-resize-key="${fieldKey}" aria-hidden="true"></span>
      </th>`,
      )
      .join("");

    const colGroupMarkup: string = selectedColumnKeys
      .map(
        (fieldKey: string): string =>
          `<col data-resource-col-key="${fieldKey}" style="width:${metadataPrefs.clampColumnWidth(active.columnWidths?.[fieldKey])}px;" />`,
      )
      .join("");

    const rowsMarkup: string = active.rows
      .map(
        (row: ResourceRow, index: number): string => `
      <tr data-resource-row-index="${index}" class="resource-game-row">
        ${selectedColumnKeys
          .map((fieldKey: string): string => {
            if (fieldKey === "game") {
              return `
            <td>
              <button class="resource-open-button" type="button" data-resource-row-index="${index}">
                ${row.game}
              </button>
            </td>
          `;
            }
            return `<td>${String(row?.metadata?.[fieldKey] || "-")}</td>`;
          })
          .join("")}
      </tr>
    `,
      )
      .join("");

    resourceTableWrapEl.innerHTML = `
      <table class="resource-games-table">
        <colgroup>
          ${colGroupMarkup}
        </colgroup>
        <thead>
          <tr>
            ${selectedMetadataHeadersMarkup}
          </tr>
        </thead>
        <tbody>
          ${rowsMarkup}
        </tbody>
      </table>
    `;

    resourceTableWrapEl.querySelectorAll("[data-resource-row-index]").forEach((rowEl: Element): void => {
      if (!(rowEl instanceof HTMLElement)) return;
      rowEl.addEventListener("pointerup", (): void => {
        const rowIndex: number = Number(rowEl.dataset.resourceRowIndex);
        openActiveRowByIndex(rowIndex);
      });
    });
  };

  const openMetadataDialogForActiveTab = (): void => {
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    if (!active || !(resourceMetadataDialogEl instanceof HTMLElement) || !(resourceMetadataFieldsEl instanceof HTMLElement)) return;
    const catalog = metadataPrefs.buildAvailableMetadataCatalog(active);
    const selected: Set<string> = new Set<string>(active.visibleMetadataKeys || []);
    resourceMetadataFieldsEl.innerHTML = catalog
      .map(
        (field: { key: string; label: string }): string => `
      <label class="resource-metadata-option">
        <input
          type="checkbox"
          data-resource-metadata-key="${field.key}"
          ${selected.has(field.key) ? "checked" : ""}
        />
        <span>${field.label}</span>
      </label>
    `,
      )
      .join("");
    if (resourceMetadataApplyAllEl instanceof HTMLInputElement) resourceMetadataApplyAllEl.checked = false;
    if (resourceMetadataDialogEl instanceof HTMLDialogElement && typeof resourceMetadataDialogEl.showModal === "function") {
      resourceMetadataDialogEl.showModal();
    } else {
      resourceMetadataDialogEl.setAttribute("open", "");
    }
  };

  const closeMetadataDialog = (): void => {
    if (!(resourceMetadataDialogEl instanceof HTMLElement)) return;
    if (resourceMetadataDialogEl instanceof HTMLDialogElement && typeof resourceMetadataDialogEl.close === "function") {
      resourceMetadataDialogEl.close();
    } else {
      resourceMetadataDialogEl.removeAttribute("open");
    }
  };

  const applyMetadataDialogSelection = (): void => {
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    if (!active || !(resourceMetadataFieldsEl instanceof HTMLElement)) return;
    const selectedKeys: string[] = Array.from(
      resourceMetadataFieldsEl.querySelectorAll("input[data-resource-metadata-key]:checked"),
    ).map((input: Element): string => String(input.getAttribute("data-resource-metadata-key") || ""));
    metadataPrefs.applySelection(active, selectedKeys, Boolean(resourceMetadataApplyAllEl instanceof HTMLInputElement ? resourceMetadataApplyAllEl.checked : false));
    closeMetadataDialog();
    render();
  };

  const resetMetadataColumnsForActiveTab = (): void => {
    const active: ResourceTab | undefined = getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);
    if (!active) return;
    metadataPrefs.resetTabToDefaults(active);
    closeMetadataDialog();
    render();
  };

  const bindEvents = (): void => {
    if (btnResourceMetadata) {
      btnResourceMetadata.addEventListener("click", (): void => {
        openMetadataDialogForActiveTab();
      });
    }

    if (btnOpenResource) {
      btnOpenResource.addEventListener("click", (): void => {
        if (typeof onRequestOpenResource === "function") {
          void Promise.resolve(onRequestOpenResource());
        }
      });
    }

    if (btnResourceMetadataCancel) {
      btnResourceMetadataCancel.addEventListener("click", (): void => {
        closeMetadataDialog();
      });
    }

    if (btnResourceMetadataReset) {
      btnResourceMetadataReset.addEventListener("click", (): void => {
        resetMetadataColumnsForActiveTab();
      });
    }

    if (btnResourceMetadataSave) {
      btnResourceMetadataSave.addEventListener("click", (event: Event): void => {
        event.preventDefault();
        applyMetadataDialogSelection();
      });
    }

    if (!resourceTabsEl) return;

    resourceTabsEl.addEventListener("click", (event: Event): void => {
      const target: EventTarget | null = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action: string = String(target.dataset.resourceAction || "");
      const tabId: string = String(target.dataset.resourceTabId || "");
      if (!action || !tabId) return;
      if (action === "close") {
        closeTab(tabId);
        render();
        return;
      }
      if (action === "select") {
        selectTab(tabId);
        void refreshActiveTabRows().then((): void => render());
      }
    });

    if (resourceTableWrapEl instanceof HTMLElement) {
      let activeColumnResize: ColumnResizeState | null = null;

      const resolveActiveTab = (): ResourceTab | undefined =>
        getTabs().find((tab: ResourceTab): boolean => tab.tabId === state.activeResourceTabId);

      const applyLiveColumnWidth = (columnKey: string, widthPx: number): void => {
        const colEls = resourceTableWrapEl.querySelectorAll("col[data-resource-col-key]");
        colEls.forEach((colEl: Element): void => {
          if (!(colEl instanceof HTMLElement)) return;
          if (String(colEl.dataset.resourceColKey || "") !== String(columnKey || "")) return;
          colEl.style.width = `${metadataPrefs.clampColumnWidth(widthPx)}px`;
        });
      };

      const resolveRowIndexFromEvent = (event: Event): number => {
        const eventWithPath = event as Event & { composedPath?: () => EventTarget[] };
        const path: EventTarget[] = typeof eventWithPath.composedPath === "function" ? eventWithPath.composedPath() : [];
        for (const entry of path) {
          if (!(entry instanceof HTMLElement)) continue;
          const rawIndex: string | undefined = entry.dataset.resourceRowIndex;
          if (rawIndex == null) continue;
          const parsed: number = Number(rawIndex);
          if (Number.isInteger(parsed) && parsed >= 0) return parsed;
        }
        const target: EventTarget | null = event.target;
        if (!(target instanceof HTMLElement)) return -1;
        const rowEl: HTMLElement | null = target.closest("[data-resource-row-index]");
        if (!(rowEl instanceof HTMLElement)) return -1;
        const parsed: number = Number(rowEl.dataset.resourceRowIndex);
        if (!Number.isInteger(parsed) || parsed < 0) return -1;
        return parsed;
      };

      resourceTableWrapEl.addEventListener("dragstart", (event: DragEvent): void => {
        const target: EventTarget | null = event.target;
        if (!(target instanceof HTMLElement)) return;
        const headerEl: HTMLElement | null = target.closest("th[data-resource-col-key]");
        if (!(headerEl instanceof HTMLElement)) return;
        draggedColumnKey = String(headerEl.dataset.resourceColKey || "");
        if (!draggedColumnKey) return;
        if (event.dataTransfer) {
          event.dataTransfer.setData("text/plain", draggedColumnKey);
          event.dataTransfer.effectAllowed = "move";
        }
      });

      resourceTableWrapEl.addEventListener("dragover", (event: DragEvent): void => {
        const target: EventTarget | null = event.target;
        if (!(target instanceof HTMLElement)) return;
        const headerEl: HTMLElement | null = target.closest("th[data-resource-col-key]");
        if (!(headerEl instanceof HTMLElement)) return;
        event.preventDefault();
      });

      resourceTableWrapEl.addEventListener("drop", (event: DragEvent): void => {
        const target: EventTarget | null = event.target;
        if (!(target instanceof HTMLElement)) return;
        const headerEl: HTMLElement | null = target.closest("th[data-resource-col-key]");
        if (!(headerEl instanceof HTMLElement)) return;
        event.preventDefault();
        const targetKey: string = String(headerEl.dataset.resourceColKey || "");
        if (!draggedColumnKey || !targetKey || draggedColumnKey === targetKey) return;
        const activeTab: ResourceTab | undefined = resolveActiveTab();
        if (!activeTab) return;
        const nextOrder: string[] = [...metadataPrefs.reconcileTabColumnState(activeTab)];
        const fromIndex: number = nextOrder.indexOf(draggedColumnKey);
        const toIndex: number = nextOrder.indexOf(targetKey);
        if (fromIndex < 0 || toIndex < 0) return;
        nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, draggedColumnKey);
        activeTab.metadataColumnOrder = nextOrder;
        metadataPrefs.persistTabPrefs(activeTab);
        render();
      });

      resourceTableWrapEl.addEventListener("dragend", (): void => {
        draggedColumnKey = "";
      });

      resourceTableWrapEl.addEventListener("pointerdown", (event: PointerEvent): void => {
        const target: EventTarget | null = event.target;
        if (!(target instanceof HTMLElement)) return;
        const handle: HTMLElement | null = target.closest("[data-resource-resize-key]");
        if (!(handle instanceof HTMLElement)) return;
        const resizeKey: string = String(handle.dataset.resourceResizeKey || "");
        if (!resizeKey) return;
        const activeTab: ResourceTab | undefined = resolveActiveTab();
        if (!activeTab) return;
        event.preventDefault();
        const startWidth: number = metadataPrefs.clampColumnWidth(activeTab.columnWidths?.[resizeKey]);
        activeColumnResize = {
          key: resizeKey,
          startClientX: event.clientX,
          startWidth,
        };
        handle.setPointerCapture?.(event.pointerId);
      });

      window.addEventListener("pointermove", (event: PointerEvent): void => {
        if (!activeColumnResize) return;
        const activeTab: ResourceTab | undefined = resolveActiveTab();
        if (!activeTab) return;
        const delta: number = event.clientX - activeColumnResize.startClientX;
        const widthPx: number = metadataPrefs.clampColumnWidth(activeColumnResize.startWidth + delta);
        activeTab.columnWidths[activeColumnResize.key] = widthPx;
        applyLiveColumnWidth(activeColumnResize.key, widthPx);
      });

      const finishColumnResize = (): void => {
        if (!activeColumnResize) return;
        const activeTab: ResourceTab | undefined = resolveActiveTab();
        if (activeTab) metadataPrefs.persistTabPrefs(activeTab);
        activeColumnResize = null;
      };

      window.addEventListener("pointerup", finishColumnResize);
      window.addEventListener("pointercancel", finishColumnResize);

      resourceTableWrapEl.addEventListener("click", (event: Event): void => {
        const rowIndex: number = resolveRowIndexFromEvent(event);
        openActiveRowByIndex(rowIndex);
      });

      resourceTableWrapEl.addEventListener("dblclick", (event: Event): void => {
        const rowIndex: number = resolveRowIndexFromEvent(event);
        openActiveRowByIndex(rowIndex);
      });

      resourceTableWrapEl.addEventListener("keydown", (event: KeyboardEvent): void => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const rowIndex: number = resolveRowIndexFromEvent(event);
        if (rowIndex < 0) return;
        event.preventDefault();
        openActiveRowByIndex(rowIndex);
      });
    }
  };

  return {
    bindEvents,
    closeTab,
    getActiveResourceRef,
    refreshActiveTabRows,
    render,
    selectTab,
    setTabs,
    upsertTab,
  };
};
