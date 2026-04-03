/**
 * workspace_persistence — build and save workspace snapshots.
 *
 * Integration API:
 * - `buildWorkspaceSnapshot(state)` — capture the current workspace as a
 *   `WorkspaceSnapshot` without writing to storage.
 * - `saveWorkspaceSnapshot(state)` — build and write to `workspaceSnapshotStore`.
 * - `hasUnsavedSessions(state)` — true when any open session has edits not yet
 *   written to a source file (dirty and no source, or dirty with source).
 *
 * Configuration API:
 * - No configuration; all inputs come through the `state` parameter.
 *
 * Communication API:
 * - Pure module; no React, no DOM.
 */

import { workspaceSnapshotStore } from "./workspace_snapshot_store";
import type { WorkspaceSnapshot, SessionSnap, ResourceTabSnap } from "./workspace_snapshot_store";

// ── Internal types ─────────────────────────────────────────────────────────────

type RawSourceRef = { kind?: unknown; locator?: unknown; recordId?: unknown } | null | undefined;

type RawOwnState = {
  pgnText?: unknown;
  currentPly?: unknown;
  selectedMoveId?: unknown;
  pgnLayoutMode?: unknown;
} | null | undefined;

type RawSession = {
  sessionId?: unknown;
  title?: unknown;
  sourceRef?: unknown;
  dirtyState?: unknown;
  saveMode?: unknown;
  ownState?: unknown;
};

type RawResourceTab = {
  tabId?: unknown;
  title?: unknown;
  resourceRef?: { kind?: unknown; locator?: unknown } | null;
};

/** Minimal shape of the shared application state consumed by this module. */
type SharedStateForSnapshot = {
  gameSessions: unknown[];
  activeSessionId: string | null;
  resourceViewerTabs: unknown[];
  activeResourceTabId: string | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const toSessionSnap = (raw: unknown): SessionSnap | null => {
  const s = raw as RawSession;
  const sessionId = typeof s.sessionId === "string" ? s.sessionId : "";
  if (!sessionId) return null;

  const ownState = s.ownState as RawOwnState;
  const sourceRef = s.sourceRef as RawSourceRef;
  const hasLocator = typeof sourceRef?.locator === "string" && sourceRef.locator !== "";

  return {
    sessionId,
    title: typeof s.title === "string" ? s.title : sessionId,
    pgnText: typeof ownState?.pgnText === "string" ? ownState.pgnText : "",
    sourceRef: hasLocator
      ? {
          kind: typeof sourceRef?.kind === "string" ? sourceRef.kind : "",
          locator: String(sourceRef?.locator),
          ...(typeof sourceRef?.recordId === "string" && sourceRef.recordId
            ? { recordId: sourceRef.recordId }
            : {}),
        }
      : null,
    dirtyState: typeof s.dirtyState === "string" ? s.dirtyState : "clean",
    saveMode: s.saveMode === "manual" ? "manual" : "auto",
    currentPly: typeof ownState?.currentPly === "number" ? ownState.currentPly : 0,
    selectedMoveId:
      typeof ownState?.selectedMoveId === "string" ? ownState.selectedMoveId : null,
    pgnLayoutMode:
      typeof ownState?.pgnLayoutMode === "string" ? ownState.pgnLayoutMode : "plain",
  };
};

const toResourceTabSnap = (raw: unknown): ResourceTabSnap | null => {
  const t = raw as RawResourceTab;
  const tabId = typeof t.tabId === "string" ? t.tabId : "";
  if (!tabId) return null;
  const locator =
    t.resourceRef && typeof t.resourceRef.locator === "string" ? t.resourceRef.locator : "";
  if (!locator) return null;
  return {
    tabId,
    title: typeof t.title === "string" ? t.title : "",
    kind:
      t.resourceRef && typeof t.resourceRef.kind === "string" ? t.resourceRef.kind : "",
    locator,
  };
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Build a workspace snapshot from current shared state without writing to storage.
 *
 * @param state Shared application state (non-session fields).
 * @returns The current workspace snapshot.
 */
export const buildWorkspaceSnapshot = (state: SharedStateForSnapshot): WorkspaceSnapshot => {
  const sessions: SessionSnap[] = (
    Array.isArray(state.gameSessions) ? state.gameSessions : []
  )
    .map(toSessionSnap)
    .filter((s): s is SessionSnap => s !== null);

  const resourceTabs: ResourceTabSnap[] = (
    Array.isArray(state.resourceViewerTabs) ? state.resourceViewerTabs : []
  )
    .map(toResourceTabSnap)
    .filter((t): t is ResourceTabSnap => t !== null);

  return {
    sessions,
    activeSessionId:
      typeof state.activeSessionId === "string" ? state.activeSessionId : null,
    resourceTabs,
    activeResourceTabId:
      typeof state.activeResourceTabId === "string" ? state.activeResourceTabId : null,
  };
};

/**
 * Build and write the workspace snapshot to localStorage.
 *
 * Safe to call frequently — the caller is responsible for debouncing.
 *
 * @param state Shared application state.
 */
export const saveWorkspaceSnapshot = (state: SharedStateForSnapshot): void => {
  workspaceSnapshotStore.write(buildWorkspaceSnapshot(state));
};

/**
 * Return true when at least one open session has unsaved edits.
 *
 * A session is considered unsaved when:
 * - it has no source reference (never written to disk), **or**
 * - its dirty state is `"dirty"` or `"error"`.
 *
 * @param state Shared application state.
 */
export const hasUnsavedSessions = (state: SharedStateForSnapshot): boolean => {
  const sessions = Array.isArray(state.gameSessions) ? state.gameSessions : [];
  return sessions.some((raw: unknown): boolean => {
    const s = raw as RawSession;
    const sourceRef = s.sourceRef as RawSourceRef;
    const hasSource =
      typeof sourceRef?.locator === "string" && sourceRef.locator !== "";
    const dirtyState = typeof s.dirtyState === "string" ? s.dirtyState : "clean";
    return !hasSource || dirtyState === "dirty" || dirtyState === "error";
  });
};
