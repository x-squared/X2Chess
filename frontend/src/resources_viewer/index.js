/**
 * Resource-Viewer component.
 *
 * Integration API:
 * - `createResourceViewerCapabilities(deps)` returns tab + table render/event helpers.
 *
 * Configuration API:
 * - Host provides shared state, i18n callback, DOM refs, and list callback per resource.
 *
 * Communication API:
 * - Mutates `state.resourceViewerTabs` and `state.activeResourceTabId`.
 * - Requests game lists from host via `deps.listGamesForResource`.
 */

/**
 * Build a deterministic tab id from source reference.
 *
 * @param {{kind?: string, locator?: string}} resourceRef - Resource reference.
 * @returns {string} Stable tab id.
 */
const buildResourceTabId = (resourceRef) => {
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
 * @param {HTMLElement|null} deps.resourceTabsEl - Tabs container.
 * @param {HTMLElement|null} deps.resourceTableWrapEl - Table container.
 * @param {Function} deps.listGamesForResource - Callback `(resourceRef) => Promise<Array<object>>`.
 * @returns {{bindEvents: Function, closeTab: Function, refreshActiveTabRows: Function, render: Function, selectTab: Function, setTabs: Function}} Capabilities.
 */
export const createResourceViewerCapabilities = ({
  state,
  t,
  resourceTabsEl,
  resourceTableWrapEl,
  listGamesForResource,
}) => {
  /**
   * Set resource tabs and ensure active tab exists.
   *
   * @param {Array<{title: string, resourceRef: object}>} tabs - Tab descriptors.
   */
  const setTabs = (tabs) => {
    const normalized = (Array.isArray(tabs) ? tabs : []).map((tab) => ({
      tabId: buildResourceTabId(tab.resourceRef),
      title: String(tab.title || tab.resourceRef?.kind || "Resource"),
      resourceRef: tab.resourceRef || { kind: "file", locator: "default" },
      rows: [],
      errorMessage: "",
      isLoading: false,
    }));
    state.resourceViewerTabs = normalized;
    if (!normalized.find((tab) => tab.tabId === state.activeResourceTabId)) {
      state.activeResourceTabId = normalized[0]?.tabId || null;
    }
  };

  /**
   * Select active resource tab.
   *
   * @param {string} tabId - Target tab id.
   */
  const selectTab = (tabId) => {
    if (!tabId) return;
    const exists = state.resourceViewerTabs.some((tab) => tab.tabId === tabId);
    if (!exists) return;
    state.activeResourceTabId = tabId;
  };

  /**
   * Close a resource tab.
   *
   * @param {string} tabId - Tab id to close.
   */
  const closeTab = (tabId) => {
    const index = state.resourceViewerTabs.findIndex((tab) => tab.tabId === tabId);
    if (index < 0) return;
    state.resourceViewerTabs.splice(index, 1);
    if (state.activeResourceTabId !== tabId) return;
    const next = state.resourceViewerTabs[Math.min(index, state.resourceViewerTabs.length - 1)];
    state.activeResourceTabId = next?.tabId || null;
  };

  /**
   * Refresh rows for active tab from host source callback.
   */
  const refreshActiveTabRows = async () => {
    const active = state.resourceViewerTabs.find((tab) => tab.tabId === state.activeResourceTabId);
    if (!active) return;
    active.isLoading = true;
    active.errorMessage = "";
    try {
      const entries = await listGamesForResource(active.resourceRef);
      active.rows = (Array.isArray(entries) ? entries : []).map((entry) => {
        const sourceRef = entry?.sourceRef || {};
        const identifier = String(sourceRef.recordId || entry?.identifier || "");
        return {
          game: String(entry?.titleHint || identifier || t("resources.table.unknown", "Untitled")),
          identifier,
          source: String(sourceRef.kind || active.resourceRef.kind || ""),
          revision: String(entry?.revisionToken || ""),
        };
      });
    } catch (error) {
      active.rows = [];
      active.errorMessage = String(error?.message || t("resources.error", "Unable to load resource games."));
    } finally {
      active.isLoading = false;
    }
  };

  /**
   * Render tabs and table body.
   */
  const render = () => {
    if (resourceTabsEl) {
      resourceTabsEl.innerHTML = "";
      state.resourceViewerTabs.forEach((tab) => {
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
    const active = state.resourceViewerTabs.find((tab) => tab.tabId === state.activeResourceTabId);
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
    const headerIdentifier = t("resources.table.identifier", "Identifier");
    const headerSource = t("resources.table.source", "Source");
    const headerRevision = t("resources.table.revision", "Revision");
    const rowsMarkup = active.rows.map((row) => `
      <tr>
        <td>${row.game}</td>
        <td>${row.identifier || "-"}</td>
        <td>${row.source || "-"}</td>
        <td>${row.revision || "-"}</td>
      </tr>
    `).join("");
    resourceTableWrapEl.innerHTML = `
      <table class="resource-games-table">
        <thead>
          <tr>
            <th>${headerGame}</th>
            <th>${headerIdentifier}</th>
            <th>${headerSource}</th>
            <th>${headerRevision}</th>
          </tr>
        </thead>
        <tbody>
          ${rowsMarkup}
        </tbody>
      </table>
    `;
  };

  /**
   * Bind tab click events.
   */
  const bindEvents = () => {
    if (!resourceTabsEl) return;
    resourceTabsEl.addEventListener("click", (event) => {
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
        void refreshActiveTabRows().then(() => render());
      }
    });
  };

  return {
    bindEvents,
    closeTab,
    refreshActiveTabRows,
    render,
    selectTab,
    setTabs,
  };
};

