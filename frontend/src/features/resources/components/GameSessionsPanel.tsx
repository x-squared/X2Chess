/**
 * GameSessionsPanel — renders the game session tab bar.
 *
 * Wires `onSelect`/`onClose` to session service callbacks obtained via
 * `useServiceContext()`.  Session state flows from `AppStoreState` populated
 * by `useAppStartup`.
 *
 * Integration API:
 * - `<GameSessionsPanel />` — rendered inside `game-tabs-card` by `AppShell`.
 *   No props required.
 *
 * Configuration API:
 * - Session data flows through `AppStoreState` context (populated by
 *   `syncToReact()` via `sync_session_snapshot`).
 *
 * Communication API:
 * - Receives: session data from `sync_session_snapshot` dispatched by `syncToReact()`.
 * - Emits: `switchSession` and `closeSession` via `useServiceContext()`.
 */

import type { ReactElement } from "react";
import { useCallback } from "react";
import { useAppContext } from "../../../state/app_context";
import { selectSessions } from "../../../state/selectors";
import { useServiceContext } from "../../../state/ServiceContext";
import type { SessionItemState } from "../../../state/app_reducer";
import { GameTabs } from "../../../app/shell/components/GameTabs";

/** Sessions panel: renders the game tab bar, wired to session service. */
export const GameSessionsPanel = (): ReactElement => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const sessions: SessionItemState[] = selectSessions(state);

  const handleSelect = useCallback((sessionId: string): void => {
    services.switchSession(sessionId);
  }, [services]);

  const handleClose = useCallback((sessionId: string): void => {
    services.closeSession(sessionId);
  }, [services]);

  return (
    <GameTabs sessions={sessions} onSelect={handleSelect} onClose={handleClose} />
  );
};
