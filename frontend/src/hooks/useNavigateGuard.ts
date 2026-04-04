import { useState } from "react";
import type { AppStartupServices } from "../state/ServiceContext";
import type { SessionItemState } from "../state/app_reducer";

type PendingNavigate =
  | { kind: "switch"; sessionId: string }
  | { kind: "close"; sessionId: string };

export type NavigateGuardState = {
  /** Guarded replacements for `switchSession` and `closeSession`. */
  switchSession: (sessionId: string) => void;
  closeSession: (sessionId: string) => void;
  /** Non-null when a navigate-away confirmation is pending. */
  pendingNavigate: PendingNavigate | null;
  clearPendingNavigate: () => void;
};

/**
 * Wraps `switchSession` and `closeSession` from `rawServices` so that
 * navigating away from a dirty session shows a confirmation dialog instead of
 * discarding changes silently.
 *
 * The caller is responsible for rendering the confirmation dialog using
 * `pendingNavigate`, `clearPendingNavigate`, and the original `rawServices`
 * to perform the confirmed navigation.
 *
 * @param rawServices Unguarded services from `useAppStartup`.
 * @param sessions Current session list from React state.
 * @param activeSession Currently active session item, or `undefined` if none is active.
 * @returns Guarded navigation callbacks plus `pendingNavigate` / `clearPendingNavigate` for the confirmation dialog.
 */
export const useNavigateGuard = (
  rawServices: AppStartupServices,
  sessions: SessionItemState[],
  activeSession: SessionItemState | undefined,
): NavigateGuardState => {
  const [pendingNavigate, setPendingNavigate] = useState<PendingNavigate | null>(null);

  const isDirty =
    activeSession?.dirtyState === "dirty" || activeSession?.dirtyState === "error";

  const switchSession = (sessionId: string): void => {
    if (isDirty && sessionId !== activeSession?.sessionId) {
      setPendingNavigate({ kind: "switch", sessionId });
    } else {
      rawServices.switchSession(sessionId);
    }
  };

  const closeSession = (sessionId: string): void => {
    const target = sessions.find((s) => s.sessionId === sessionId);
    if (target?.dirtyState === "dirty" || target?.dirtyState === "error") {
      setPendingNavigate({ kind: "close", sessionId });
    } else {
      rawServices.closeSession(sessionId);
    }
  };

  const clearPendingNavigate = (): void => { setPendingNavigate(null); };

  return { switchSession, closeSession, pendingNavigate, clearPendingNavigate };
};
