/**
 * createResourceOpenOps — resource-loading operations for the session orchestrator.
 *
 * Handles all operations that open, create, or query resources and games:
 * openResource, openResourceFile, openResourceDirectory, createResource,
 * openGameFromRef, openGameFromRecordId, fetchGameMetadataByRecordId,
 * getActiveSessionResourceRef, reorderGameInResource.
 *
 * Integration API:
 * - `createResourceOpenOps(bundle, dispatchRef, flushSessionState, summarizeHeaders)`
 *   — call from `createSessionOrchestrator`; spread the result into the returned
 *   `AppStartupServices` object.
 *
 * Configuration API:
 * - No standalone configuration; receives all dependencies via parameters.
 *
 * Communication API:
 * - Reads from `bundle.resources`, `bundle.resourceViewer`, `bundle.sessionStore`,
 *   `bundle.sessionModel`.
 * - Dispatches `set_board_flipped` and `set_error_message` via `dispatchRef`.
 * - Calls `flushSessionState()` after each successful operation.
 */

import type { Dispatch } from "react";
import type { AppAction } from "../state/actions";
import type { AppStartupServices } from "../contracts/app_services";
import type { ServicesBundle } from "./createAppServices";
import type { GameSessionState } from "../../features/sessions/services/game_session_state";
import { deriveInitialBoardFlipped } from "../../model";
import { log } from "../../logger";
import {
  lastLocatorSegment,
  normalizeOptionalRecordId,
  normalizeStringField,
  buildSourceIdentityKey,
} from "./session_helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Loose structural type used when callers pass raw source-ref objects through
 * the `unknown`-typed contract boundary. All fields are optional so the
 * defensive helpers in `session_helpers` handle any missing/malformed values.
 */
type SourceRefInput = { kind?: unknown; locator?: unknown; recordId?: unknown } | null | undefined;

type ResourceOpenOps = Pick<
  AppStartupServices,
  | "openResource"
  | "openResourceFile"
  | "openResourceDirectory"
  | "createResource"
  | "openGameFromRef"
  | "openGameFromRecordId"
  | "fetchGameMetadataByRecordId"
  | "getActiveSessionResourceRef"
  | "reorderGameInResource"
>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a human-readable message from a thrown value of unknown type. */
const toErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "[unknown error]";
};

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Returns resource-loading service operations wired to the given bundle.
 *
 * @param bundle Fully-wired services bundle.
 * @param dispatchRef Mutable ref carrying the latest React dispatch function.
 * @param flushSessionState Flush active session state to React.
 * @param summarizeHeaders Produce a log-friendly header summary for a session.
 */
export const createResourceOpenOps = (
  bundle: ServicesBundle,
  dispatchRef: { current: Dispatch<AppAction> },
  flushSessionState: () => void,
  summarizeHeaders: (session: GameSessionState) => string,
): ResourceOpenOps => ({
  openResource: (): void => {
    void (async (): Promise<void> => {
      try {
        const selected = await bundle.resources.chooseResourceByPicker();
        if (!selected) return;
        const ref = selected.resourceRef;
        const locatorLastSegment: string = lastLocatorSegment(ref.locator, String(ref.kind ?? "Resource"));
        bundle.resourceViewer.upsertTab({
          title: locatorLastSegment,
          resourceRef: ref,
          select: true,
        });
        flushSessionState();
      } catch (err: unknown) {
        const message: string = toErrorMessage(err);
        log.error("session_resource_open_ops", message);
        dispatchRef.current({ type: "set_error_message", message });
      }
    })();
  },

  openResourceFile: (): void => {
    void (async (): Promise<void> => {
      try {
        const selected = await bundle.resources.chooseFileResource();
        if (!selected) return;
        const ref = selected.resourceRef;
        const locatorLastSegment: string = lastLocatorSegment(ref.locator, String(ref.kind ?? "Resource"));
        bundle.resourceViewer.upsertTab({ title: locatorLastSegment, resourceRef: ref, select: true });
        flushSessionState();
      } catch (err: unknown) {
        const message: string = toErrorMessage(err);
        log.error("session_resource_open_ops", message);
        dispatchRef.current({ type: "set_error_message", message });
      }
    })();
  },

  openResourceDirectory: (): void => {
    void (async (): Promise<void> => {
      try {
        const selected = await bundle.resources.chooseFolderResource();
        if (!selected) return;
        const ref = selected.resourceRef;
        const locatorLastSegment: string = lastLocatorSegment(ref.locator, String(ref.kind ?? "Resource"));
        bundle.resourceViewer.upsertTab({ title: locatorLastSegment, resourceRef: ref, select: true });
        flushSessionState();
      } catch (err: unknown) {
        const message: string = toErrorMessage(err);
        log.error("session_resource_open_ops", message);
        dispatchRef.current({ type: "set_error_message", message });
      }
    })();
  },

  createResource: (kind: "db" | "directory" | "file"): void => {
    void (async (): Promise<void> => {
      try {
        const selected = await bundle.resources.createResourceByKind(kind);
        if (!selected) return;
        const ref = selected.resourceRef;
        const locatorLastSegment: string = lastLocatorSegment(ref.locator, String(ref.kind ?? "Resource"));
        bundle.resourceViewer.upsertTab({
          title: locatorLastSegment,
          resourceRef: ref,
          select: true,
        });
        flushSessionState();
      } catch (err: unknown) {
        const message: string = toErrorMessage(err);
        log.error("session_resource_open_ops", message);
        dispatchRef.current({ type: "set_error_message", message });
      }
    })();
  },

  openGameFromRef: (sourceRef: unknown): void => {
    void (async (): Promise<void> => {
      const ref: SourceRefInput = sourceRef as SourceRefInput;
      try {
        const requestedKey: string = buildSourceIdentityKey(ref);
        const existingSession = bundle.sessionStore.listSessions().find((raw: unknown): boolean => {
          const session = raw as { sourceRef?: SourceRefInput };
          return buildSourceIdentityKey(session.sourceRef) === requestedKey;
        }) as { sessionId?: string } | undefined;
        if (existingSession?.sessionId) {
          const switched = bundle.sessionStore.switchToSession(existingSession.sessionId);
          if (switched) {
            log.info("session_resource_open_ops", `openGameFromRef: reused existing session "${existingSession.sessionId}"`);
            flushSessionState();
            dispatchRef.current({
              type: "set_board_flipped",
              flipped: deriveInitialBoardFlipped(bundle.activeSessionRef.current.pgnModel),
            });
          }
          return;
        }
        const normalizedRecordId: string | undefined = normalizeOptionalRecordId(ref?.recordId);
        const resolvedKind: string = normalizeStringField(ref?.kind, "directory");
        const resolvedLocator: string = normalizeStringField(ref?.locator, "");
        const result = await bundle.resources.loadGameBySourceRef({
          kind: resolvedKind,
          locator: resolvedLocator,
          recordId: normalizedRecordId,
        });
        const nextSourceRef: { kind: string; locator: string; recordId?: string } = {
          kind: resolvedKind,
          locator: resolvedLocator,
          recordId: normalizedRecordId,
        };
        const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(result.pgnText);
        const titleFallback: string = nextSourceRef.recordId ?? "New Game";
        const title: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, titleFallback);
        bundle.sessionStore.openSession({
          ownState: newState,
          title,
          sourceRef: nextSourceRef,
        });
        log.info(
          "session_resource_open_ops",
          `openGameFromRef: opened session from ${nextSourceRef.kind}:${nextSourceRef.locator} ` +
            `recordId="${nextSourceRef.recordId ?? ""}" ${summarizeHeaders(newState)}`,
        );
        flushSessionState();
        dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel) });
      } catch (err: unknown) {
        const message: string = toErrorMessage(err);
        log.error("session_resource_open_ops", message);
        dispatchRef.current({ type: "set_error_message", message });
      }
    })();
  },

  openGameFromRecordId: async (recordId: string): Promise<void> => {
    const activeSession = bundle.sessionStore.getActiveSession();
    const sourceRef = activeSession?.sourceRef;
    if (!sourceRef?.kind || !sourceRef.locator) return;
    try {
      const result = await bundle.resources.loadGameBySourceRef({
        kind: String(sourceRef.kind),
        locator: String(sourceRef.locator),
        recordId,
      });
      const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(result.pgnText);
      const title: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, recordId);
      bundle.sessionStore.openSession({
        ownState: newState,
        title,
        sourceRef: { kind: String(sourceRef.kind), locator: String(sourceRef.locator), recordId },
      });
      flushSessionState();
      dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel) });
    } catch (err: unknown) {
      const message: string = toErrorMessage(err);
      log.error("session_resource_open_ops", message);
      dispatchRef.current({ type: "set_error_message", message });
    }
  },

  fetchGameMetadataByRecordId: async (recordId: string): Promise<Record<string, string> | null> => {
    const activeSession = bundle.sessionStore.getActiveSession();
    const sourceRef = activeSession?.sourceRef;
    if (!sourceRef?.kind || !sourceRef.locator) return null;
    try {
      const resourceRef: { kind: string; locator: string } = {
        kind: String(sourceRef.kind),
        locator: String(sourceRef.locator),
      };
      const rows: unknown[] = await bundle.resources.listGamesForResource(resourceRef);
      const row = (rows as Array<Record<string, unknown>>).find((r: Record<string, unknown>): boolean => {
        const ref = r.sourceRef as Record<string, unknown> | null;
        const rowRecordId: string = normalizeOptionalRecordId(ref?.recordId) ?? "";
        const rowIdentifier: string = normalizeOptionalRecordId(r.identifier) ?? "";
        return rowRecordId === recordId || rowIdentifier === recordId;
      });
      if (!row) return null;
      return (row.metadata as Record<string, string>) ?? null;
    } catch {
      return null;
    }
  },

  getActiveSessionResourceRef: (): { kind: string; locator: string } | null => {
    const activeSession = bundle.sessionStore.getActiveSession();
    const sourceRef = activeSession?.sourceRef;
    if (!sourceRef?.kind || !sourceRef.locator) return null;
    return { kind: String(sourceRef.kind), locator: String(sourceRef.locator) };
  },

  reorderGameInResource: async (sourceRef: unknown, neighborSourceRef: unknown): Promise<void> => {
    const ref: SourceRefInput = sourceRef as SourceRefInput;
    const neighbor: SourceRefInput = neighborSourceRef as SourceRefInput;
    const sourceRecordId: string | undefined = normalizeOptionalRecordId(ref?.recordId);
    const neighborRecordId: string | undefined = normalizeOptionalRecordId(neighbor?.recordId);
    await bundle.resources.reorderGameInResource(
      { kind: normalizeStringField(ref?.kind, "db"), locator: normalizeStringField(ref?.locator, ""), recordId: sourceRecordId },
      { kind: normalizeStringField(neighbor?.kind, "db"), locator: normalizeStringField(neighbor?.locator, ""), recordId: neighborRecordId },
    );
  },
});
