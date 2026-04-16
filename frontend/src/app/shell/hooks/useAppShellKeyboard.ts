/**
 * useAppShellKeyboard — global keyboard shortcuts and beforeunload guard for AppShell.
 *
 * Integration API:
 * - `useAppShellKeyboard(sessions, services)`
 * - Call once in AppShell after `services` is fully wired.
 *
 * Configuration API:
 * - `sessions` — list of session items; used to detect unsaved edits for M9.
 * - `services` — needs `saveActiveGameNow`, `undo`, `redo`.
 *
 * Communication API:
 * - Attaches `beforeunload` and `keydown` listeners to `window`.
 * - No state; no context reads.
 */

import { useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionLike = { dirtyState?: string };
type ServiceLike = {
  saveActiveGameNow: () => void;
  undo: () => void;
  redo: () => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Registers:
 * - `beforeunload` guard when any session has unsaved edits (M9).
 * - Ctrl/Cmd+S (save), Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z / Ctrl/Cmd+Y (redo).
 */
export const useAppShellKeyboard = (
  sessions: SessionLike[],
  services: ServiceLike,
): void => {
  // A ref carries the latest dirty flag so the handler registered once always
  // reads the current state without being re-registered.
  const hasUnsavedRef = useRef(false);

  useEffect((): void => {
    hasUnsavedRef.current = sessions.some(
      (s) => s.dirtyState === "dirty" || s.dirtyState === "error",
    );
  }, [sessions]);

  useEffect((): (() => void) => {
    const handler = (e: BeforeUnloadEvent): void => {
      if (!hasUnsavedRef.current) return;
      e.preventDefault();
      // returnValue is required for the browser dialog to appear.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return (): void => { window.removeEventListener("beforeunload", handler); };
  }, []);

  // Ctrl/Cmd+S — save active game.
  // Ctrl/Cmd+Z — undo.  Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y — redo.  (M5)
  useEffect((): (() => void) => {
    const handler = (e: KeyboardEvent): void => {
      const withMeta = e.metaKey || e.ctrlKey;
      if (!withMeta) return;
      if (e.key === "s") {
        e.preventDefault();
        services.saveActiveGameNow();
      } else if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        services.undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        services.redo();
      }
    };
    window.addEventListener("keydown", handler);
    return (): void => { window.removeEventListener("keydown", handler); };
  // services ref is stable for the lifetime of the component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
