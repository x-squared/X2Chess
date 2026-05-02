/**
 * createResourceOpenOps — resource-loading operations for the session orchestrator.
 *
 * Handles all operations that open, create, or query resources and games:
 * openResource, openResourceFile, openResourceDirectory, createResource,
 * openGameFromRef, openGameFromRecordId, fetchGameMetadataByRecordId,
 * fetchGameMetadataByRecordIdInResource, getActiveSessionResourceRef,
 * reorderGameInResource, deleteActiveGameInResource.
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
 * - Opening a game from a resource merges list-row metadata into the live `PgnModel` for any
 *   tag that is missing or blank in the loaded PGN (then re-parses), so headers stay the single
 *   source of truth for session UI and save/export.
 * - Dispatches `set_board_flipped` and `set_error_message` via `dispatchRef`.
 * - Calls `flushSessionState()` after each successful operation.
 */

import type { PgnResourceRef } from "../../../../parts/resource/src/domain/resource_ref";
import type { Dispatch } from "react";
import type { AppAction } from "../state/actions";
import type { AppStartupServices } from "../contracts/app_services";
import type { ServicesBundle } from "./createAppServices";
import type { GameSessionState } from "../../features/sessions/services/game_session_state";
import { deriveInitialBoardFlipped, serializeModelToPgn } from "../../model";
import type { PgnModel } from "../../../../parts/pgnparser/src/pgn_model";
import { hydratePgnModelFromResourceMetadata } from "../../features/sessions/services/resource_metadata_hydrate";
import { log } from "../../logger";
import {
  lastLocatorSegment,
  normalizeOptionalRecordId,
  normalizeStringField,
  buildSourceIdentityKey,
} from "./session_helpers";
import { findResourceRowMetadataByRecordId } from "./resource_list_metadata_lookup";
import { resourceDomainEvents } from "../events/resource_domain_events";
import { mirrorResourceSchemaIdToLocalStorage } from "../../features/resources/services/schema_storage";

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
  | "openResourceDatabase"
  | "openResourceDirectory"
  | "createResource"
  | "selectResourceTab"
  | "closeResourceTab"
  | "openGameFromRef"
  | "openGameFromRecordId"
  | "fetchGameMetadataByRecordId"
  | "fetchGameMetadataByRecordIdInResource"
  | "getActiveSessionResourceRef"
  | "reorderGameInResource"
  | "deleteActiveGameInResource"
>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a human-readable message from a thrown value of unknown type. */
const toErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "[unknown error]";
};

/**
 * Look up stored metadata for a game row in the given resource (same data as the resource table).
 *
 * @param bundle - Services bundle (uses `listGamesForResource`).
 * @param resourceKind - Resource kind (`db`, `directory`, …).
 * @param resourceLocator - Resource locator string.
 * @param recordId - Game record id within the resource.
 * @returns Normalized metadata map, or `null` when the row is not found or listing fails.
 */
const lookupResourceMetadataByRecordId = async (
  bundle: ServicesBundle,
  resourceKind: string,
  resourceLocator: string,
  recordId: string,
): Promise<Record<string, string> | null> => {
  if (!recordId) return null;
  try {
    const rows: unknown[] = await bundle.resources.listGamesForResource({
      kind: resourceKind,
      locator: resourceLocator,
    });
    return findResourceRowMetadataByRecordId(rows, recordId);
  } catch {
    return null;
  }
};

/**
 * Rebuild session state so resource-only metadata columns exist as PGN tags on the in-memory model.
 * Empty/missing header slots are filled; existing non-blank PGN tags win.
 *
 * @param initialState - Session built from loaded `pgnText`.
 * @param resourceMeta - Row metadata from `listGamesForResource` (may be null).
 * @param sessionModel - Session model factory (`createSessionFromPgnText`).
 * @returns Possibly new state after re-parse; unchanged when nothing was hydrated.
 */
const rebuildSessionWithResourceMetadataHydration = (
  initialState: GameSessionState,
  resourceMeta: Record<string, string> | null,
  sessionModel: ServicesBundle["sessionModel"],
): GameSessionState => {
  if (resourceMeta == null || Object.keys(resourceMeta).length === 0) {
    return initialState;
  }
  const pgnModel: PgnModel | null = initialState.pgnModel;
  if (pgnModel == null) return initialState;
  const { model, keysFilled } = hydratePgnModelFromResourceMetadata(pgnModel, resourceMeta);
  if (keysFilled.length === 0) return initialState;
  const pgnText: string = serializeModelToPgn(model);
  log.info("session_resource_open_ops", "hydrated PGN headers from resource row", {
    keysCount: keysFilled.length,
    keysFilled: keysFilled.join(","),
  });
  return sessionModel.createSessionFromPgnText(pgnText);
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

  openResourceDatabase: (): void => {
    void (async (): Promise<void> => {
      try {
        const selected = await bundle.resources.chooseDatabaseResource();
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
              flipped: deriveInitialBoardFlipped(bundle.activeSessionRef.current.pgnModel!),
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
        const resourceMeta: Record<string, string> | null =
          normalizedRecordId != null && normalizedRecordId !== ""
            ? await lookupResourceMetadataByRecordId(bundle, resolvedKind, resolvedLocator, normalizedRecordId)
            : null;
        const parsedState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(result.pgnText);
        const newState: GameSessionState = rebuildSessionWithResourceMetadataHydration(
          parsedState,
          resourceMeta,
          bundle.sessionModel,
        );
        const titleFallback: string = nextSourceRef.recordId ?? "New Game";
        const title: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, titleFallback);
        bundle.sessionStore.openSession({
          ownState: newState,
          title,
          sourceRef: nextSourceRef,
          resourceMetadataOverlay: resourceMeta,
        });
        const resourceRefForSchema: PgnResourceRef = {
          kind: resolvedKind as PgnResourceRef["kind"],
          locator: resolvedLocator,
        };
        void bundle.resources.loadResourceSchemaId(resourceRefForSchema).then((schemaId: string | null): void => {
          mirrorResourceSchemaIdToLocalStorage(resourceRefForSchema, schemaId);
          bundle.sessionStore.notifySessionsChanged();
        });
        log.info(
          "session_resource_open_ops",
          `openGameFromRef: opened session from ${nextSourceRef.kind}:${nextSourceRef.locator} ` +
            `recordId="${nextSourceRef.recordId ?? ""}" ${summarizeHeaders(newState)}`,
        );
        flushSessionState();
        dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel!) });
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
      const resourceMeta: Record<string, string> | null = await lookupResourceMetadataByRecordId(
        bundle,
        String(sourceRef.kind),
        String(sourceRef.locator),
        recordId,
      );
      const parsedState: GameSessionState = bundle.sessionModel.createSessionFromPgnText(result.pgnText);
      const newState: GameSessionState = rebuildSessionWithResourceMetadataHydration(
        parsedState,
        resourceMeta,
        bundle.sessionModel,
      );
      const title: string = bundle.sessionModel.deriveSessionTitle(newState.pgnModel, recordId);
      bundle.sessionStore.openSession({
        ownState: newState,
        title,
        sourceRef: { kind: String(sourceRef.kind), locator: String(sourceRef.locator), recordId },
        resourceMetadataOverlay: resourceMeta,
      });
      const kindOpen: string = String(sourceRef.kind);
      const locatorOpen: string = String(sourceRef.locator);
      const resourceRefForSchemaOpen: PgnResourceRef = {
        kind: kindOpen as PgnResourceRef["kind"],
        locator: locatorOpen,
      };
      void bundle.resources.loadResourceSchemaId(resourceRefForSchemaOpen).then((schemaId: string | null): void => {
        mirrorResourceSchemaIdToLocalStorage(resourceRefForSchemaOpen, schemaId);
        bundle.sessionStore.notifySessionsChanged();
      });
      flushSessionState();
      dispatchRef.current({ type: "set_board_flipped", flipped: deriveInitialBoardFlipped(newState.pgnModel!) });
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
    const id: string = String(recordId ?? "").trim();
    if (!id) return null;
    return lookupResourceMetadataByRecordId(
      bundle,
      String(sourceRef.kind),
      String(sourceRef.locator),
      id,
    );
  },

  fetchGameMetadataByRecordIdInResource: async (
    resource: { kind: string; locator: string },
    recordId: string,
  ): Promise<Record<string, string> | null> => {
    const kind: string = String(resource?.kind ?? "").trim();
    const locator: string = String(resource?.locator ?? "").trim();
    const id: string = String(recordId ?? "").trim();
    if (!kind || !locator || !id) return null;
    return lookupResourceMetadataByRecordId(bundle, kind, locator, id);
  },

  getActiveSessionResourceRef: (): { kind: string; locator: string } | null => {
    const activeSession = bundle.sessionStore.getActiveSession();
    const sourceRef = activeSession?.sourceRef;
    if (!sourceRef?.kind || !sourceRef.locator) return null;
    return { kind: String(sourceRef.kind), locator: String(sourceRef.locator) };
  },

  selectResourceTab: (tabId: string): void => {
    bundle.resourceViewer.selectTab(tabId);
  },

  closeResourceTab: (tabId: string): void => {
    bundle.resourceViewer.closeTab(tabId);
  },

  reorderGameInResource: async (sourceRef: unknown, afterSourceRef: unknown): Promise<void> => {
    const ref: SourceRefInput = sourceRef as SourceRefInput;
    const after: SourceRefInput | null = afterSourceRef ? afterSourceRef as SourceRefInput : null;
    const sourceRecordId: string | undefined = normalizeOptionalRecordId(ref?.recordId);
    const afterRecordId: string | undefined = after ? normalizeOptionalRecordId(after.recordId) : undefined;
    const resourceKind: string = normalizeStringField(ref?.kind, "db");
    const resourceLocator: string = normalizeStringField(ref?.locator, "");
    const canonicalAfter = after
      ? { kind: normalizeStringField(after.kind, resourceKind), locator: normalizeStringField(after.locator, resourceLocator), recordId: afterRecordId }
      : null;
    await bundle.resources.reorderGameInResource(
      { kind: resourceKind, locator: resourceLocator, recordId: sourceRecordId },
      canonicalAfter,
    );
    const primarySourceRef = { kind: resourceKind, locator: resourceLocator, recordId: sourceRecordId };
    resourceDomainEvents.emit({
      type: "resource.gameReordered",
      resourceRef: { kind: resourceKind, locator: resourceLocator },
      sourceRef: primarySourceRef,
      afterSourceRef: canonicalAfter ?? undefined,
    });
    resourceDomainEvents.emit({
      type: "resource.resourceChanged",
      resourceRef: { kind: resourceKind, locator: resourceLocator },
      operation: "reorder",
      sourceRef: primarySourceRef,
    });
    log.info("session_resource_open_ops", "Emitted resource.gameReordered", {
      kind: resourceKind,
      locator: resourceLocator,
      recordId: sourceRecordId ?? "",
      afterRecordId: afterRecordId ?? "(front)",
    });
  },

  deleteActiveGameInResource: async (): Promise<void> => {
    try {
      const activeSession = bundle.sessionStore.getActiveSession();
      if (!activeSession) return;
      const sourceRef = activeSession.sourceRef;
      const sessionId = activeSession.sessionId;
      const resourceKind: string = normalizeStringField(sourceRef?.kind, "");
      const resourceLocator: string = normalizeStringField(sourceRef?.locator, "");
      const recordId: string | undefined = normalizeOptionalRecordId(sourceRef?.recordId);
      if (!resourceKind || !resourceLocator || !recordId) {
        throw new Error("Active session is not linked to a deletable resource game.");
      }
      const canonicalSourceRef = { kind: resourceKind, locator: resourceLocator, recordId };
      await bundle.resources.deleteGameInResource(canonicalSourceRef);
      const closed = bundle.sessionStore.closeSession(sessionId);
      if (closed.emptyAfterClose) {
        const newState: GameSessionState = bundle.sessionModel.createSessionFromPgnText("");
        bundle.sessionStore.openSession({
          ownState: newState,
          title: "New Game",
        });
      }
      resourceDomainEvents.emit({
        type: "resource.gameDeleted",
        resourceRef: { kind: resourceKind, locator: resourceLocator },
        sourceRef: canonicalSourceRef,
      });
      resourceDomainEvents.emit({
        type: "resource.resourceChanged",
        resourceRef: { kind: resourceKind, locator: resourceLocator },
        operation: "delete",
        sourceRef: canonicalSourceRef,
      });
      log.info("session_resource_open_ops", "Deleted active resource game", {
        kind: resourceKind,
        locator: resourceLocator,
        recordId,
        sessionId,
      });
      flushSessionState();
    } catch (err: unknown) {
      const message: string = toErrorMessage(err);
      log.error("session_resource_open_ops", message);
      dispatchRef.current({ type: "set_error_message", message });
    }
  },
});
