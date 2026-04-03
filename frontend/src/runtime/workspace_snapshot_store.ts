/**
 * workspace_snapshot_store — versioned store for the full workspace snapshot.
 *
 * A workspace snapshot captures every open game session and every open resource
 * tab so the application can restore its state exactly on the next launch.
 *
 * Integration API:
 * - `workspaceSnapshotStore` — call `.read()` on startup, `.write()` after each change.
 * - `WorkspaceSnapshot`, `SessionSnap`, `ResourceTabSnap` — the snapshot types.
 * - `EMPTY_WORKSPACE_SNAPSHOT` — the default (empty) value.
 *
 * Configuration API:
 * - Storage key: `"x2chess.workspaceSnapshot"` in localStorage.
 * - Version 1 — initial versioned form.
 *
 * Communication API:
 * - Pure module; no React, no DOM.
 */

import { createVersionedStore } from "../storage";
import type { VersionedStore } from "../storage";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Snapshot of one open game session. */
export type SessionSnap = {
  /** Original session ID — used to identify the active session on restore. */
  sessionId: string;
  title: string;
  /** Full PGN text at the time of snapshot (may include unsaved edits). */
  pgnText: string;
  /** Source the session is backed by, or null for sessions never saved to disk. */
  sourceRef: { kind: string; locator: string; recordId?: string } | null;
  dirtyState: string;
  saveMode: "auto" | "manual";
  /** Half-move index (0 = start position). */
  currentPly: number;
  selectedMoveId: string | null;
  /** PGN editor layout mode for this session. */
  pgnLayoutMode: string;
};

/** Snapshot of one open resource viewer tab. */
export type ResourceTabSnap = {
  tabId: string;
  title: string;
  kind: string;
  locator: string;
};

/** Full workspace snapshot persisted across app launches. */
export type WorkspaceSnapshot = {
  sessions: SessionSnap[];
  /** Original session ID of the active session when the snapshot was taken. */
  activeSessionId: string | null;
  resourceTabs: ResourceTabSnap[];
  activeResourceTabId: string | null;
};

// ── Defaults ──────────────────────────────────────────────────────────────────

export const EMPTY_WORKSPACE_SNAPSHOT: WorkspaceSnapshot = {
  sessions: [],
  activeSessionId: null,
  resourceTabs: [],
  activeResourceTabId: null,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const workspaceSnapshotStore: VersionedStore<WorkspaceSnapshot> =
  createVersionedStore<WorkspaceSnapshot>({
    key: "x2chess.workspaceSnapshot",
    version: 1,
    defaultValue: EMPTY_WORKSPACE_SNAPSHOT,
    migrations: [],
  });
