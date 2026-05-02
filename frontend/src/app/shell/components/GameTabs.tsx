/**
 * GameTabs component — renders the session tab bar.
 *
 * Displays one tab per open game session with title, dirty marker (dot),
 * unsaved badge, and a close button.
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
import type { SessionItemState } from "../../../core/state/app_reducer";
import { useTranslator } from "../../hooks/useTranslator";
import {
  buildSessionTabPrimaryLabel,
  buildSessionTabSecondaryLabel,
} from "../session_tab_labels";

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

/** Build a tooltip string for a session tab showing player names and source. */
const buildTooltip = (session: SessionItemState): string => {
  const parts: string[] = [];
  const { white, black, event, date } = session;
  if (white && white !== "?") parts.push(`White: ${white}`);
  if (black && black !== "?") parts.push(`Black: ${black}`);
  if (event && event !== "?" && event !== "Sample") parts.push(`Event: ${event}`);
  if (date && date !== "?" && date !== "????.??.??") parts.push(`Date: ${date}`);
  if (session.sourceLocator) parts.push(`File: ${session.sourceLocator}`);
  else parts.push("(unsaved)");
  return parts.join("\n");
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
          const primary: string = buildSessionTabPrimaryLabel(session);
          const secondary: string = buildSessionTabSecondaryLabel(session, t("game.unsaved", "unsaved"));
          const dirtyDot: boolean = session.dirtyState === "dirty";
          const modifiedSuffix: string = dirtyDot ? " (modified)" : "";
          const secondarySuffix: string = secondary ? `, ${secondary}` : "";
          const ariaLabel: string = `${primary}${modifiedSuffix}${secondarySuffix}`;
          const tooltip: string = buildTooltip(session);

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
              title={tooltip}
            >
              <button
                type="button"
                className="game-tab-select"
                onClick={(): void => { onSelect(session.sessionId); }}
                aria-label={ariaLabel}
              >
                <span className="game-tab-primary">
                  {dirtyDot && <span className="game-tab-dirty" aria-hidden="true" />}
                  {primary}
                </span>
                {secondary && (
                  <span className="game-tab-secondary">{secondary}</span>
                )}
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
