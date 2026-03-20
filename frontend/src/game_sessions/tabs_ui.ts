/**
 * Tabs Ui module.
 *
 * Integration API:
 * - Primary exports from this module: `createGameTabsUi`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type SaveMode = "auto" | "manual";

type DirtyState = "clean" | "dirty" | "saving" | "error" | string;

type GameSessionTab = {
  sessionId: string;
  title: string;
  sourceRef?: unknown | null;
  dirtyState?: DirtyState;
  saveMode?: SaveMode;
};

type GameTabsUiDeps = {
  gameTabsEl: Element | null;
  t: (key: string, fallback?: string) => string;
  getSessions: () => unknown[];
  getActiveSessionId: () => string | null;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
};

export const createGameTabsUi = ({
  gameTabsEl,
  t,
  getSessions,
  getActiveSessionId,
  onSelectSession,
  onCloseSession,
}: GameTabsUiDeps) => {
  const render = (): void => {
    if (!(gameTabsEl instanceof HTMLElement)) return;
    const sessions: GameSessionTab[] = getSessions() as GameSessionTab[];
    const activeSessionId: string | null = getActiveSessionId();
    gameTabsEl.innerHTML = "";
    sessions.forEach((session: GameSessionTab): void => {
      const tab: HTMLDivElement = document.createElement("div");
      const isUnsaved: boolean = !session.sourceRef;
      tab.className = `game-tab${session.sessionId === activeSessionId ? " active" : ""}${isUnsaved ? " unsaved" : ""}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", session.sessionId === activeSessionId ? "true" : "false");
      tab.dataset.sessionId = session.sessionId;

      const selectButton: HTMLButtonElement = document.createElement("button");
      selectButton.type = "button";
      selectButton.className = "game-tab-title";
      selectButton.dataset.gameAction = "select";
      selectButton.dataset.sessionId = session.sessionId;
      const dirtyMarker: string = session.dirtyState === "dirty" ? "*" : "";
      const unsavedMarker: string = isUnsaved ? " (unsaved)" : "";
      const manualMarker: string = session.saveMode === "manual" ? " (M)" : "";
      selectButton.textContent = `${session.title}${dirtyMarker}${unsavedMarker}${manualMarker}`;
      tab.appendChild(selectButton);

      const closeButton: HTMLButtonElement = document.createElement("button");
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

  const bindEvents = (): void => {
    if (!(gameTabsEl instanceof HTMLElement)) return;
    gameTabsEl.addEventListener("click", (event: MouseEvent): void => {
      const target: EventTarget | null = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action: string | undefined = target.dataset.gameAction;
      const sessionId: string | undefined = target.dataset.sessionId;
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
