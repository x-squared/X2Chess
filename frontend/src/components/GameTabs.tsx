/**
 * GameTabs component — renders the session tab bar.
 *
 * Displays one tab per open game session with title, dirty marker (*),
 * unsaved badge, manual-save marker (M), and a close button.
 * Tabs are keyboard-accessible (role="tab", aria-selected).
 *
 * Integration API:
 * - `<GameTabs sessions={sessions} onSelect={fn} onClose={fn} />`
 * - `sessions` comes from `selectSessions(state)`.
 * - `onSelect` / `onClose` are wired to the service layer by the parent panel.
 *
 * Configuration API:
 * - `sessions: SessionItemState[]` — full per-session metadata for rendering.
 * - `onSelect: (sessionId: string) => void` — called when user clicks a tab.
 * - `onClose: (sessionId: string) => void` — called when user clicks ×.
 *
 * Communication API:
 * - Outbound: `onSelect(sessionId)` and `onClose(sessionId)` on user interaction.
 * - Inbound: re-renders automatically when `sessions` prop changes.
 * - No DOM side effects; no shared state.
 */

import type { ReactElement } from "react";
import type { SessionItemState } from "../state/app_reducer";
import { useTranslator } from "../hooks/useTranslator";

/** Props for the GameTabs component. */
type GameTabsProps = {
  /** Ordered list of session items to render as tabs. */
  sessions: SessionItemState[];
  /**
   * Called when the user selects a tab.
   * @param sessionId - ID of the session to activate.
   */
  onSelect: (sessionId: string) => void;
  /**
   * Called when the user closes a tab.
   * @param sessionId - ID of the session to close.
   */
  onClose: (sessionId: string) => void;
};

/**
 * Build the display label for a single tab.
 *
 * @param session - Session item metadata.
 * @param unsavedLabel - Localized "(unsaved)" label.
 * @returns Composed tab title string.
 */
const buildTabLabel = (session: SessionItemState, unsavedLabel: string): string => {
  const dirtyMarker: string = session.dirtyState === "dirty" ? "*" : "";
  const unsavedSuffix: string = session.isUnsaved ? ` ${unsavedLabel}` : "";
  const manualMarker: string = session.saveMode === "manual" ? " (M)" : "";
  return `${session.title}${dirtyMarker}${unsavedSuffix}${manualMarker}`;
};

/** Renders the game session tab bar. */
export const GameTabs = ({ sessions, onSelect, onClose }: GameTabsProps): ReactElement => {
  const t: (key: string, fallback?: string) => string = useTranslator();

  return (
    <div className="game-tabs" role="tablist" aria-label={t("games.open", "Open games")}>
      {sessions.length === 0 ? (
        <p className="game-tabs-empty">{t("games.hint", "Drop .pgn files or paste PGN text to open games.")}</p>
      ) : (
        sessions.map((session: SessionItemState): ReactElement => {
          const isActive: boolean = session.isActive;
          const label: string = buildTabLabel(session, t("game.unsaved", "(unsaved)"));

          return (
            <div
              key={session.sessionId}
              role="tab"
              aria-selected={isActive}
              className={[
                "game-tab",
                isActive ? "active" : "",
                session.isUnsaved ? "unsaved" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-session-id={session.sessionId}
            >
              <button
                type="button"
                className="game-tab-title"
                onClick={(): void => { onSelect(session.sessionId); }}
                aria-label={label}
              >
                {label}
              </button>
              <button
                type="button"
                className="game-tab-close"
                onClick={(): void => { onClose(session.sessionId); }}
                aria-label={t("games.close", "Close game")}
              >
                ×
              </button>
            </div>
          );
        })
      )}
    </div>
  );
};
