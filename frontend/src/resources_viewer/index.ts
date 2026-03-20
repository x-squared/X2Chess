import { createResourceMetadataPrefs } from "./resource_metadata_prefs.js";

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

/**
 * Build a deterministic tab id from source reference.
 *
 * @param {{kind?: string, locator?: string}} resourceRef - Resource reference.
 * @returns {string} Stable tab id.
 */
const buildResourceTabId = (resourceRef: any): any => {
  const kind = String(resourceRef?.kind || "unknown");
  const locator = String(resourceRef?.locator || "default");
  return `resource-${kind}-${locator}`.replace(/[^a-zA-Z0-9_-]/g, "_");
};

/**
 * Create Resource-Viewer capabilities.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared runtime state.
 * @param {Function} deps.t - Translation callback `(key, fallback) => string`.
 * @param {HTMLElement|null} deps.btnResourceMetadata - Metadata-column picker trigger.
 * @param {HTMLElement|null} deps.btnOpenResource - Resource picker trigger button.
 * @param {HTMLDialogElement|null} deps.resourceMetadataDialogEl - Metadata picker dialog element.
 * @param {HTMLElement|null} deps.resourceMetadataFieldsEl - Metadata checkbox list container.
 * @param {HTMLInputElement|null} deps.resourceMetadataApplyAllEl - Apply-to-all checkbox.
 * @param {HTMLElement|null} deps.btnResourceMetadataReset - Dialog reset button.
 * @param {HTMLElement|null} deps.btnResourceMetadataCancel - Dialog cancel button.
 * @param {HTMLElement|null} deps.btnResourceMetadataSave - Dialog apply button.
 * @param {HTMLElement|null} deps.resourceTabsEl - Tabs container.
 * @param {HTMLElement|null} deps.resourceTableWrapEl - Table container.
 * @param {Function} deps.listGamesForResource - Callback `(resourceRef) => Promise<Array<object>>`.
 * @param {Function} [deps.onRequestOpenResource] - Callback `() => void|Promise<void>`.
 * @param {Function} [deps.onOpenGameBySourceRef] - Callback `(sourceRef) => void|Promise<void>`.
 * @returns {{bindEvents: Function, closeTab: Function, getActiveResourceRef: Function, refreshActiveTabRows: Function, render: Function, selectTab: Function, setTabs: Function, upsertTab: Function}} Capabilities that own resource-tab lifecycle, table rendering, metadata-column UI, and row-open callbacks.
 */
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
}: any): any => {
  const metadataPrefs = createResourceMetadataPrefs({ state });
  let draggedColumnKey = "";

  /**
   * Set resource tabs and ensure active tab exists.
   *
   * @param {Array<{title: string, resourceRef: object}>} tabs - Tab descriptors.
   */
  const setTabs = (tabs: any): any => {
    const normalized = (Array.isArray(tabs) ? tabs : []).map((tab: any): any => ({
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
    }));
    normalized.forEach((tab: any): any => {
      metadataPrefs.initializeTab(tab);
    });
    state.resourceViewerTabs = normalized;
    if (!normalized.find((tab: any): any => tab.tabId === state.activeResourceTabId)) {
      state.activeResourceTabId = normalized[0]?.tabId || null;
    }
  };

  /**
   * Add missing tab for a resource or update an existing one.
   *
   * @param {{title?: string, resourceRef: object, select?: boolean}} input - Tab input.
   * @returns {string|null} Upserted tab id.
   */
  const upsertTab = ({ title = "", resourceRef, select = false }: any): any => {
    if (!resourceRef || typeof resourceRef !== "object") return null;
    const tabId = buildResourceTabId(resourceRef);
    const existing = state.resourceViewerTabs.find((tab: any): any => tab.tabId === tabId);
    if (existing) {
      if (title) existing.title = String(title);
      if (select) state.activeResourceTabId = existing.tabId;
      return existing.tabId;
    }
    const nextTab = {
      tabId,
      title: String(title || resourceRef.kind || "Resource"),
      resourceRef,
      rows: [],
      availableMetadataKeys: [],
      visibleMetadataKeys: [...state.resourceViewerDefaultMetadataKeys],
      metadataColumnOrder: ["game"],
      columnWidths: {},
      errorMessage: "",
      isLoading: false,
    };
    metadataPrefs.initializeTab(nextTab);
    state.resourceViewerTabs.push(nextTab);
    if (select || !state.activeResourceTabId) state.activeResourceTabId = nextTab.tabId;
    return nextTab.tabId;
  };

  /**
   * Select active resource tab.
   *
   * @param {string} tabId - Target tab id.
   */
  const selectTab = (tabId: any): any => {
    if (!tabId) return;
    const exists = state.resourceViewerTabs.some((tab: any): any => tab.tabId === tabId);
    if (!exists) return;
    state.activeResourceTabId = tabId;
  };

  /**
   * Close a resource tab.
   *
   * @param {string} tabId - Tab id to close.
   */
  const closeTab = (tabId: any): any => {
    const index = state.resourceViewerTabs.findIndex((tab: any): any => tab.tabId === tabId);
    if (index < 0) return;
    state.resourceViewerTabs.splice(index, 1);
    if (state.activeResourceTabId !== tabId) return;
    const next = state.resourceViewerTabs[Math.min(index, state.resourceViewerTabs.length - 1)];
    state.activeResourceTabId = next?.tabId || null;
  };

  /**
   * Refresh rows for active tab from host source callback.
   */
  const refreshActiveTabRows = async (): Promise<any> => {
    const active = state.resourceViewerTabs.find((tab: any): any => tab.tabId === state.activeResourceTabId);
    if (!active) return;
    active.isLoading = true;
    active.errorMessage = "";
    try {
      const entries = await listGamesForResource(active.resourceRef);
      metadataPrefs.hydrateRowsIntoTab(active, entries, t);
    } catch (error: unknown) {
      active.rows = [];
      active.availableMetadataKeys = [];
      const msg = error instanceof Error ? error.message : String(error);
      active.errorMessage = msg || t("resources.error", "Unable to load resource games.");
    } finally {
      active.isLoading = false;
    }
  };

  /**
   * Read currently active resource reference.
   *
   * @returns {object|null} Active resource ref.
   */
  const getActiveResourceRef = (): any => {
    const active = state.resourceViewerTabs.find((tab: any): any => tab.tabId === state.activeResourceTabId);
    return active?.resourceRef || null;
  };

  const openActiveRowByIndex = (rowIndex: any): any => {
    if (!Number.isInteger(rowIndex) || rowIndex < 0) return;
    const active = state.resourceViewerTabs.find((tab: any): any => tab.tabId === state.activeResourceTabId);
    const row = active?.rows?.[rowIndex];
    if (!row?.sourceRef) return;
    if (typeof onOpenGameBySourceRef === "function") {
      void Promise.resolve(onOpenGameBySourceRef(row.sourceRef)).catch((): any => {});
    }
  };

  /**
   * Render tabs and table body.
   */
  const render = (): any => {
    if (resourceTabsEl) {
      resourceTabsEl.innerHTML = "";
      state.resourceViewerTabs.forEach((tab: any): any => {
        const active = tab.tabId === state.activeResourceTabId;
        const tabEl = document.createElement("div");
        tabEl.className = `resource-tab${active ? " active" : ""}`;
        tabEl.setAttribute("role", "tab");
        tabEl.setAttribute("aria-selected", active ? "true" : "false");

        const titleBtn = document.createElement("button");
        titleBtn.type = "button";
        titleBtn.className = "resource-tab-title";
        titleBtn.dataset.resourceAction = "select";
        titleBtn.dataset.resourceTabId = tab.tabId;
        titleBtn.textContent = tab.title;
        tabEl.appendChild(titleBtn);

        const closeBtn = document.createElement("button");
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

    if (!resourceTableWrapEl) return;
    const active = state.resourceViewerTabs.find((tab: any): any => tab.tabId === state.activeResourceTabId);
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
    const headerGame = t("resources.table.game", "Game");
    const resolveMetadataLabel = (fieldKey: any): any => {
      if (fieldKey === "identifier") return t("resources.table.identifier", "Identifier");
      if (fieldKey === "source") return t("resources.table.source", "Source");
      if (fieldKey === "revision") return t("resources.table.revision", "Revision");
      return fieldKey;
    };
    const selectedColumnKeys = metadataPrefs.reconcileTabColumnState(active);
    const selectedMetadataHeadersMarkup = selectedColumnKeys.map((fieldKey: any): any => (
      `<th draggable="true" data-resource-col-key="${fieldKey}">
        <span>${fieldKey === "game" ? headerGame : resolveMetadataLabel(fieldKey)}</span>
        <span class="resource-col-resize-handle" data-resource-resize-key="${fieldKey}" aria-hidden="true"></span>
      </th>`
    )).join("");
    const colGroupMarkup = selectedColumnKeys.map((fieldKey: any): any => (
      `<col data-resource-col-key="${fieldKey}" style="width:${metadataPrefs.clampColumnWidth(active.columnWidths?.[fieldKey])}px;" />`
    )).join("");
    const rowsMarkup = active.rows.map((row: any, index: any): any => `
      <tr data-resource-row-index="${index}" class="resource-game-row">
        ${selectedColumnKeys.map((fieldKey: any): any => {
    if (fieldKey === "game") {
      return `
            <td>
              <button class="resource-open-button" type="button" data-resource-row-index="${index}">
                ${row.game}
              </button>
            </td>
          `;
    }
    return `<td>${row?.metadata?.[fieldKey] || "-"}</td>`;
  }).join("")}
      </tr>
    `).join("");
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
    resourceTableWrapEl.querySelectorAll("[data-resource-row-index]").forEach((rowEl: any): any => {
      if (!(rowEl instanceof HTMLElement)) return;
      rowEl.addEventListener("pointerup", (): any => {
        const rowIndex = Number(rowEl.dataset.resourceRowIndex);
        openActiveRowByIndex(rowIndex);
      });
    });
  };

  const openMetadataDialogForActiveTab = (): any => {
    const active = state.resourceViewerTabs.find((tab: any): any => tab.tabId === state.activeResourceTabId);
    if (!active || !resourceMetadataDialogEl || !resourceMetadataFieldsEl) return;
    const catalog = metadataPrefs.buildAvailableMetadataCatalog(active);
    const selected = new Set(active.visibleMetadataKeys || []);
    resourceMetadataFieldsEl.innerHTML = catalog.map((field: any): any => `
      <label class="resource-metadata-option">
        <input
          type="checkbox"
          data-resource-metadata-key="${field.key}"
          ${selected.has(field.key) ? "checked" : ""}
        />
        <span>${field.label}</span>
      </label>
    `).join("");
    if (resourceMetadataApplyAllEl) resourceMetadataApplyAllEl.checked = false;
    if (typeof resourceMetadataDialogEl.showModal === "function") {
      resourceMetadataDialogEl.showModal();
    } else {
      resourceMetadataDialogEl.setAttribute("open", "");
    }
  };

  const closeMetadataDialog = (): any => {
    if (!resourceMetadataDialogEl) return;
    if (typeof resourceMetadataDialogEl.close === "function") {
      resourceMetadataDialogEl.close();
    } else {
      resourceMetadataDialogEl.removeAttribute("open");
    }
  };

  const applyMetadataDialogSelection = (): any => {
    const active = state.resourceViewerTabs.find((tab: any): any => tab.tabId === state.activeResourceTabId);
    if (!active || !resourceMetadataFieldsEl) return;
    const selectedKeys = Array.from(
      resourceMetadataFieldsEl.querySelectorAll("input[data-resource-metadata-key]:checked"),
    ).map((input: any): any => String((input as Element).getAttribute("data-resource-metadata-key") || ""));
    metadataPrefs.applySelection(active, selectedKeys, Boolean(resourceMetadataApplyAllEl?.checked));
    closeMetadataDialog();
    render();
  };

  const resetMetadataColumnsForActiveTab = (): any => {
    const active = state.resourceViewerTabs.find((tab: any): any => tab.tabId === state.activeResourceTabId);
    if (!active) return;
    metadataPrefs.resetTabToDefaults(active);
    closeMetadataDialog();
    render();
  };

  /**
   * Bind tab click events.
   */
  const bindEvents = (): any => {
    if (btnResourceMetadata) {
      btnResourceMetadata.addEventListener("click", (): any => {
        openMetadataDialogForActiveTab();
      });
    }
    if (btnOpenResource) {
      btnOpenResource.addEventListener("click", (): any => {
        if (typeof onRequestOpenResource === "function") {
          void Promise.resolve(onRequestOpenResource());
        }
      });
    }
    if (btnResourceMetadataCancel) {
      btnResourceMetadataCancel.addEventListener("click", (): any => {
        closeMetadataDialog();
      });
    }
    if (btnResourceMetadataReset) {
      btnResourceMetadataReset.addEventListener("click", (): any => {
        resetMetadataColumnsForActiveTab();
      });
    }
    if (btnResourceMetadataSave) {
      btnResourceMetadataSave.addEventListener("click", (event: any): any => {
        event.preventDefault();
        applyMetadataDialogSelection();
      });
    }
    if (!resourceTabsEl) return;
    resourceTabsEl.addEventListener("click", (event: any): any => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.resourceAction;
      const tabId = target.dataset.resourceTabId;
      if (!action || !tabId) return;
      if (action === "close") {
        closeTab(tabId);
        render();
        return;
      }
      if (action === "select") {
        selectTab(tabId);
        void refreshActiveTabRows().then((): any => render());
      }
    });
    if (resourceTableWrapEl) {
      let activeColumnResize: { key: string; startClientX: number; startWidth: number } | null = null;
      const resolveActiveTab = (): any => state.resourceViewerTabs.find((tab: any): any => tab.tabId === state.activeResourceTabId);
      const applyLiveColumnWidth = (columnKey: any, widthPx: any): any => {
        const colEls = resourceTableWrapEl.querySelectorAll("col[data-resource-col-key]");
        colEls.forEach((colEl: any): any => {
          if (!(colEl instanceof HTMLElement)) return;
          if (String(colEl.dataset.resourceColKey || "") !== String(columnKey || "")) return;
          colEl.style.width = `${metadataPrefs.clampColumnWidth(widthPx)}px`;
        });
      };
      const resolveRowIndexFromEvent = (event: any): any => {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        for (const entry of path) {
          if (!(entry instanceof HTMLElement)) continue;
          const rawIndex = entry.dataset.resourceRowIndex;
          if (rawIndex == null) continue;
          const parsed = Number(rawIndex);
          if (Number.isInteger(parsed) && parsed >= 0) return parsed;
        }
        const target = event.target;
        if (!(target instanceof HTMLElement)) return -1;
        const rowEl = target.closest("[data-resource-row-index]");
        if (!(rowEl instanceof HTMLElement)) return -1;
        const parsed = Number(rowEl.dataset.resourceRowIndex);
        if (!Number.isInteger(parsed) || parsed < 0) return -1;
        return parsed;
      };
      resourceTableWrapEl.addEventListener("dragstart", (event: any): any => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const headerEl = target.closest("th[data-resource-col-key]");
        if (!(headerEl instanceof HTMLElement)) return;
        draggedColumnKey = String(headerEl.dataset.resourceColKey || "");
        if (!draggedColumnKey) return;
        if (event.dataTransfer) {
          event.dataTransfer.setData("text/plain", draggedColumnKey);
          event.dataTransfer.effectAllowed = "move";
        }
      });
      resourceTableWrapEl.addEventListener("dragover", (event: any): any => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const headerEl = target.closest("th[data-resource-col-key]");
        if (!(headerEl instanceof HTMLElement)) return;
        event.preventDefault();
      });
      resourceTableWrapEl.addEventListener("drop", (event: any): any => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const headerEl = target.closest("th[data-resource-col-key]");
        if (!(headerEl instanceof HTMLElement)) return;
        event.preventDefault();
        const targetKey = String(headerEl.dataset.resourceColKey || "");
        if (!draggedColumnKey || !targetKey || draggedColumnKey === targetKey) return;
        const activeTab = resolveActiveTab();
        if (!activeTab) return;
        const nextOrder = [...metadataPrefs.reconcileTabColumnState(activeTab)];
        const fromIndex = nextOrder.indexOf(draggedColumnKey);
        const toIndex = nextOrder.indexOf(targetKey);
        if (fromIndex < 0 || toIndex < 0) return;
        nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, draggedColumnKey);
        activeTab.metadataColumnOrder = nextOrder;
        metadataPrefs.persistTabPrefs(activeTab);
        render();
      });
      resourceTableWrapEl.addEventListener("dragend", (): any => {
        draggedColumnKey = "";
      });
      resourceTableWrapEl.addEventListener("pointerdown", (event: any): any => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const handle = target.closest("[data-resource-resize-key]");
        if (!(handle instanceof HTMLElement)) return;
        const resizeKey = String(handle.dataset.resourceResizeKey || "");
        if (!resizeKey) return;
        const activeTab = resolveActiveTab();
        if (!activeTab) return;
        event.preventDefault();
        const startWidth = metadataPrefs.clampColumnWidth(activeTab.columnWidths?.[resizeKey]);
        activeColumnResize = {
          key: resizeKey,
          startClientX: event.clientX,
          startWidth,
        };
        handle.setPointerCapture?.(event.pointerId);
      });
      window.addEventListener("pointermove", (event: any): any => {
        if (!activeColumnResize) return;
        const activeTab = resolveActiveTab();
        if (!activeTab) return;
        const delta = event.clientX - activeColumnResize.startClientX;
        const widthPx = metadataPrefs.clampColumnWidth(activeColumnResize.startWidth + delta);
        activeTab.columnWidths[activeColumnResize.key] = widthPx;
        applyLiveColumnWidth(activeColumnResize.key, widthPx);
      });
      const finishColumnResize = (): any => {
        if (!activeColumnResize) return;
        const activeTab = resolveActiveTab();
        if (activeTab) metadataPrefs.persistTabPrefs(activeTab);
        activeColumnResize = null;
      };
      window.addEventListener("pointerup", finishColumnResize);
      window.addEventListener("pointercancel", finishColumnResize);
      resourceTableWrapEl.addEventListener("click", (event: any): any => {
        const rowIndex = resolveRowIndexFromEvent(event);
        openActiveRowByIndex(rowIndex);
      });
      resourceTableWrapEl.addEventListener("dblclick", (event: any): any => {
        const rowIndex = resolveRowIndexFromEvent(event);
        openActiveRowByIndex(rowIndex);
      });
      resourceTableWrapEl.addEventListener("keydown", (event: any): any => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const rowIndex = resolveRowIndexFromEvent(event);
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

