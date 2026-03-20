import type { ReactElement } from "react";
import { useSessionsRuntime } from "../hooks/useSessionsRuntime";
import { useAppContext } from "../state/app_context";
import { selectActiveSessionId, selectSessionCount, selectSessionTitles } from "../state/selectors";

/**
 * React game sessions boundary (Slice 5 in progress).
 */
export const GameSessionsPanel = (): ReactElement => {
  useSessionsRuntime();
  const { state } = useAppContext();
  const activeSessionId: string | null = selectActiveSessionId(state);
  const sessionCount: number = selectSessionCount(state);
  const sessionTitles: string[] = selectSessionTitles(state);

  return (
    <section
      data-react-slice="game-sessions"
      data-active-session-id={activeSessionId || ""}
      data-session-count={String(sessionCount)}
      data-session-titles={sessionTitles.join("|")}
      hidden
    />
  );
};
