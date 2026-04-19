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
import type { DirtyState } from "../features/sessions/services/session_store";
import type { LayoutMode } from "../features/editor/model/plan/types";

// ── Boundary narrowing helpers ─────────────────────────────────────────────────

const toStr = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v : fallback;

const toStrOrNull = (v: unknown): string | null =>
  typeof v === "string" ? v : null;

const toNum = (v: unknown, fallback: number): number =>
  typeof v === "number" ? v : fallback;

const toDirtyState = (v: unknown): DirtyState => {
  if (v === "clean" || v === "dirty" || v === "saving" || v === "error") return v;
  return "clean";
};

const toLayoutMode = (v: unknown): LayoutMode => {
  if (v === "plain" || v === "text" || v === "tree") return v;
  return "plain";
};

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

const toSourceRef = (raw: unknown): SessionSnap["sourceRef"] => {
  const ref = raw as RawSourceRef ?? {};
  const locator = toStr(ref.locator, "");
  if (!locator) return null;
  const recordId = toStr(ref.recordId, "");
  return {
    kind: toStr(ref.kind, ""),
    locator,
    ...(recordId ? { recordId } : {}),
  };
};

const toSessionSnap = (raw: unknown): SessionSnap | null => {
  const s = raw as RawSession;
  const sessionId = toStr(s.sessionId, "");
  if (!sessionId) return null;

  const ownState = s.ownState as RawOwnState ?? {};
  return {
    sessionId,
    title: toStr(s.title, "") || sessionId,
    pgnText: toStr(ownState.pgnText, ""),
    sourceRef: toSourceRef(s.sourceRef),
    dirtyState: toDirtyState(s.dirtyState),
    saveMode: s.saveMode === "manual" ? "manual" : "auto",
    currentPly: toNum(ownState.currentPly, 0),
    selectedMoveId: toStrOrNull(ownState.selectedMoveId),
    pgnLayoutMode: toLayoutMode(ownState.pgnLayoutMode),
  };
};

const toResourceTabSnap = (raw: unknown): ResourceTabSnap | null => {
  const t = raw as RawResourceTab;
  const tabId = toStr(t.tabId, "");
  if (!tabId) return null;
  const locator = toStr(t.resourceRef?.locator, "");
  if (!locator) return null;
  return {
    tabId,
    title: toStr(t.title, ""),
    kind: toStr(t.resourceRef?.kind, ""),
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
    const dirtyState = toDirtyState(s.dirtyState);
    return !hasSource || dirtyState === "dirty" || dirtyState === "error";
  });
};
