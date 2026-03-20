/**
 * Game tabs UI adapter.
 *
 * Integration API:
 * - Create with `createGameTabsUi(deps)`.
 * - Call `bindEvents()` once, then call `render()` whenever session state changes.
 *
 * Configuration API:
 * - Configure by injecting session accessors (`getSessions`, `getActiveSessionId`)
 *   and intent callbacks (`onSelectSession`, `onCloseSession`).
 * - Translation callback `t(...)` configures ARIA labels.
 *
 * Communication API:
 * - Rebuilds tab DOM from current session list.
 * - Emits select/close intents via callbacks; no direct session-state mutation.
 */

/**
 * Create game tabs UI helpers.
 *
 * @param {object} deps - Dependencies.
 * @param {HTMLElement|null} deps.gameTabsEl - Tabs container element.
 * @param {Function} deps.t - Translation callback.
 * @param {Function} deps.getSessions - `() => session[]`.
 * @param {Function} deps.getActiveSessionId - `() => string|null`.
 * @param {Function} deps.onSelectSession - `(sessionId) => void`.
 * @param {Function} deps.onCloseSession - `(sessionId) => void`.
 * @returns {{bindEvents: Function, render: Function}} UI helpers.
 */
export const createGameTabsUi = ({
  gameTabsEl,
  t,
  getSessions,
  getActiveSessionId,
  onSelectSession,
  onCloseSession,
}) => {
  /**
   * Render all session tabs.
   */
  const render = () => {
    if (!gameTabsEl) return;
    const sessions = getSessions();
    const activeSessionId = getActiveSessionId();
    gameTabsEl.innerHTML = "";
    sessions.forEach((session) => {
      const tab = document.createElement("div");
      const isUnsaved = !session.sourceRef;
      tab.className = `game-tab${session.sessionId === activeSessionId ? " active" : ""}${isUnsaved ? " unsaved" : ""}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", session.sessionId === activeSessionId ? "true" : "false");
      tab.dataset.sessionId = session.sessionId;

      const selectButton = document.createElement("button");
      selectButton.type = "button";
      selectButton.className = "game-tab-title";
      selectButton.dataset.gameAction = "select";
      selectButton.dataset.sessionId = session.sessionId;
      const dirtyMarker = session.dirtyState === "dirty" ? "*" : "";
      const unsavedMarker = isUnsaved ? " (unsaved)" : "";
      const manualMarker = session.saveMode === "manual" ? " (M)" : "";
      selectButton.textContent = `${session.title}${dirtyMarker}${unsavedMarker}${manualMarker}`;
      tab.appendChild(selectButton);

      const closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "game-tab-close";
      closeButton.dataset.gameAction = "close";
      closeButton.dataset.sessionId = session.sessionId;
      closeButton.setAttribute("aria-label", t("games.close", "Close game"));
      closeButton.textContent = "×";
      tab.appendChild(closeButton);

      gameTabsEl.appendChild(tab);
    });
  };

  /**
   * Bind click delegation for tab selection and close.
   */
  const bindEvents = () => {
    if (!gameTabsEl) return;
    gameTabsEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.gameAction;
      const sessionId = target.dataset.sessionId;
      if (!action || !sessionId) return;
      if (action === "close") {
        onCloseSession(sessionId);
        return;
      }
      if (action === "select") onSelectSession(sessionId);
    });
  };

  return {
    bindEvents,
    render,
  };
};

