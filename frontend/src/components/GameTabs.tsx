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
  /**
   * Called when the user clicks the save icon on a tab.
   * @param sessionId - ID of the session to save.
   */
  onSave: (sessionId: string) => void;
};

/** Build a human-readable primary label from PGN headers, falling back to the session title. */
const buildPrimaryLabel = (session: SessionItemState): string => {
  const { white, black } = session;
  if (white && black && white !== "?" && black !== "?") return `${white} — ${black}`;
  if (white && white !== "?") return white;
  return session.title;
};

/** Build a secondary info line from Event/Date/dirty markers. */
const buildSecondaryLabel = (session: SessionItemState, unsavedLabel: string): string => {
  const parts: string[] = [];
  if (session.event && session.event !== "?" && session.event !== "Sample") parts.push(session.event);
  if (session.date && session.date !== "?" && session.date !== "????.??.??") parts.push(session.date);
  if (session.isUnsaved) parts.push(unsavedLabel);
  if (session.saveMode === "manual") parts.push("M");
  return parts.join(" · ");
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
export const GameTabs = ({ sessions, onSelect, onClose, onSave }: GameTabsProps): ReactElement => {
  const t: (key: string, fallback?: string) => string = useTranslator();

  return (
    <div className="game-tabs" role="tablist" aria-label={t("games.open", "Open games")}>
      {sessions.length === 0 ? (
        <p className="game-tabs-empty">{t("games.hint", "Drop .pgn files or paste PGN text to open games.")}</p>
      ) : (
        sessions.map((session: SessionItemState): ReactElement => {
          const isActive: boolean = session.isActive;
          const primary: string = buildPrimaryLabel(session);
          const secondary: string = buildSecondaryLabel(session, t("game.unsaved", "unsaved"));
          const dirtyDot: boolean = session.dirtyState === "dirty";
          const ariaLabel: string = `${primary}${dirtyDot ? " (modified)" : ""}${secondary ? `, ${secondary}` : ""}`;
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
                className={[
                  "game-tab-save",
                  (dirtyDot || session.saveMode === "manual") ? "always-visible" : "",
                ].filter(Boolean).join(" ")}
                onClick={(): void => { onSave(session.sessionId); }}
                aria-label={t("games.save", "Save game")}
                title={t("games.save", "Save game")}
              >
                {/* Floppy disk save icon */}
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="2" y="2" width="12" height="12" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                  <rect x="4.5" y="2" width="7" height="4.5" rx="0.5"/>
                  <rect x="4.5" y="8.5" width="7" height="5" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                  <rect x="6" y="3" width="2.5" height="1.5" rx="0.25" fill="white"/>
                </svg>
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
