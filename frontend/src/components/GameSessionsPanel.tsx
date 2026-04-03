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
 *   `useAppStartup` via `set_sessions` action).
 *
 * Communication API:
 * - Receives: `set_sessions` action dispatched by `useAppStartup` render callback.
 * - Emits: `switchSession` and `closeSession` via `useServiceContext()`.
 */

import type { ReactElement } from "react";
import { useCallback } from "react";
import { useAppContext } from "../state/app_context";
import { selectSessions } from "../state/selectors";
import { useServiceContext } from "../state/ServiceContext";
import type { SessionItemState } from "../state/app_reducer";
import { useTranslator } from "../hooks/useTranslator";
import { GameTabs } from "./GameTabs";

/** Sessions panel: renders the game tab bar, wired to session service. */
export const GameSessionsPanel = (): ReactElement => {
  const services = useServiceContext();
  const { state } = useAppContext();
  const sessions: SessionItemState[] = selectSessions(state);
  const t: (key: string, fallback?: string) => string = useTranslator();

  const handleSelect = useCallback((sessionId: string): void => {
    services.switchSession(sessionId);
  }, [services]);

  const handleClose = useCallback((sessionId: string): void => {
    const session = sessions.find((s: SessionItemState): boolean => s.sessionId === sessionId);
    if (session?.dirtyState === "dirty") {
      const confirmed = globalThis.confirm(t("games.close_unsaved_confirm", "This game has unsaved changes. Close anyway?"));
      if (!confirmed) return;
    }
    services.closeSession(sessionId);
  }, [services, sessions, t]);

  return (
    <GameTabs sessions={sessions} onSelect={handleSelect} onClose={handleClose} />
  );
};
