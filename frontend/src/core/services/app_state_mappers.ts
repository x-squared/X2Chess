/**
 * app_state_mappers — pure helpers that convert raw store objects into typed
 * React state shapes.
 *
 * Integration API:
 * - `toDevTab(raw)` — normalise a raw devTab value.
 * - `toDirtyState(v)` — normalise a raw dirty-state string.
 * - `toSessionItem(raw, activeSessionId, liveModel)` — map a session store record to `SessionItemState`.
 * - `toResourceTab(raw)` — map a raw resource-viewer tab to `ResourceTabSnapshot`.
 */

import { getHeaderValue } from "../../model";
import type { DirtyState } from "../../features/sessions/services/session_store";
import type { SessionItemState, ResourceTabSnapshot } from "../state/app_reducer";

// ── toDevTab ──────────────────────────────────────────────────────────────────

/**
 * Normalise a raw devTab value to the accepted union type.
 *
 * @param raw Any raw value from persisted state.
 * @returns `"ast"` or `"pgn"`; defaults to `"ast"` for unknown values.
 */
export const toDevTab = (raw: unknown): "ast" | "pgn" => (raw === "pgn" ? "pgn" : "ast");

// ── toDirtyState ──────────────────────────────────────────────────────────────

export const toDirtyState = (v: unknown): DirtyState => {
  if (v === "clean" || v === "dirty" || v === "saving" || v === "error") return v;
  return "clean";
};

// ── toSessionItem ─────────────────────────────────────────────────────────────

type RawSession = {
  sessionId?: unknown;
  title?: unknown;
  dirtyState?: unknown;
  saveMode?: unknown;
  sourceRef?: unknown;
  ownState?: unknown;
};

/**
 * Map a raw session object (from session_store.listSessions) to `SessionItemState`.
 *
 * @param raw - Raw session object from the store.
 * @param activeSessionId - ID of the currently active session.
 * @param liveModel - Live pgnModel from activeSessionRef for the active session; null for inactive sessions.
 * @param renderedLine1 - Pre-computed primary label from the resource rendering profile; undefined when no profile applies.
 * @param renderedLine2 - Pre-computed secondary label from the resource rendering profile; undefined when not defined.
 * @param grpProfileApplied - True when GRP matched a rule (including empty rendered strings).
 */
export const toSessionItem = (
  raw: unknown,
  activeSessionId: string | null,
  liveModel: unknown,
  renderedLine1?: string,
  renderedLine2?: string,
  grpProfileApplied?: boolean,
): SessionItemState => {
  const session: RawSession = (raw as RawSession) ?? {};
  const sessionId: string = typeof session.sessionId === "string" ? session.sessionId : "";
  const isActive: boolean = sessionId !== "" && sessionId === activeSessionId;
  const ownState = session.ownState as { pgnModel?: unknown } | null | undefined;
  const pgnModel: unknown = (isActive && liveModel != null)
    ? liveModel
    : ownState?.pgnModel;
  const hv = (key: string): string => getHeaderValue(pgnModel as Parameters<typeof getHeaderValue>[0], key, "").trim();
  const sourceRef = session.sourceRef as { kind?: unknown; locator?: unknown; recordId?: unknown } | null | undefined;
  const sourceLocator: string = typeof sourceRef?.locator === "string" ? sourceRef.locator : "";
  const sourceGameRef: string = sourceRef
    ? [
        typeof sourceRef.kind === "string" ? sourceRef.kind : "",
        typeof sourceRef.locator === "string" ? sourceRef.locator : "",
        typeof sourceRef.recordId === "string" ? sourceRef.recordId : "",
      ].join(":")
    : "";
  return {
    sessionId,
    title: typeof session.title === "string" ? session.title : sessionId,
    dirtyState: toDirtyState(session.dirtyState),
    saveMode: session.saveMode === "manual" ? "manual" : "auto",
    isActive,
    isUnsaved: !session.sourceRef,
    white: hv("White"),
    black: hv("Black"),
    event: hv("Event"),
    date: hv("Date"),
    sourceLocator,
    sourceGameRef,
    renderedLine1,
    renderedLine2,
    ...(grpProfileApplied === true ? { grpProfileApplied: true } : {}),
  };
};

// ── toResourceTab ─────────────────────────────────────────────────────────────

type RawResourceTab = {
  tabId?: unknown;
  title?: unknown;
  resourceRef?: { kind?: unknown; locator?: unknown } | null;
};

/**
 * Map a raw resource-tab object to `ResourceTabSnapshot`, or `null` when `tabId` is absent.
 *
 * @param raw Raw tab object from `resourceViewer.buildTabSnapshots()`.
 * @returns Typed tab snapshot, or `null` when the `tabId` field is missing.
 */
export const toResourceTab = (raw: unknown): ResourceTabSnapshot | null => {
  const tab: RawResourceTab = (raw as RawResourceTab) ?? {};
  const tabId: string = typeof tab.tabId === "string" ? tab.tabId : "";
  if (!tabId) return null;
  return {
    tabId,
    title: typeof tab.title === "string" ? tab.title : "",
    kind:
      tab.resourceRef && typeof tab.resourceRef.kind === "string"
        ? tab.resourceRef.kind
        : "",
    locator:
      tab.resourceRef && typeof tab.resourceRef.locator === "string"
        ? tab.resourceRef.locator
        : "",
  };
};
