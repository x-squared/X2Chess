/**
 * session_save_ops — domain-event emissions and source-creation logic for session saves.
 *
 * Integration API:
 * - `emitAfterSuccessfulSave(details)` — emit `resource.gameSaved` + `resource.resourceChanged`.
 * - `createEnsureSourceForActiveSession(deps)` — returns the `ensureSourceForActiveSession`
 *   async callback wired to the active resource viewer and session model.
 *
 * Communication API:
 * - Both functions emit on `resourceDomainEvents` to trigger live-refresh in the resource viewer.
 */

import type { SourceRefLike } from "../../runtime/bootstrap_shared";
import { resourceDomainEvents } from "../events/resource_domain_events";
import { log } from "../../logger";

// ── emitAfterSuccessfulSave ───────────────────────────────────────────────────

type SaveDetails = {
  sourceRef: SourceRefLike;
  sessionId: string;
  revisionToken: string;
  wasCreate: boolean;
};

export const emitAfterSuccessfulSave = (details: SaveDetails): void => {
  const kind = String(details.sourceRef.kind || "");
  const locator = String(details.sourceRef.locator || "");
  const recordId = typeof details.sourceRef.recordId === "string" ? details.sourceRef.recordId : undefined;
  resourceDomainEvents.emit({
    type: "resource.gameSaved",
    resourceRef: { kind, locator },
    sourceRef: { kind, locator, recordId },
    revisionToken: details.revisionToken,
    sessionId: details.sessionId,
    wasCreate: details.wasCreate,
  });
  resourceDomainEvents.emit({
    type: "resource.resourceChanged",
    resourceRef: { kind, locator },
    operation: "save",
    sourceRef: { kind, locator, recordId },
  });
  log.info("session_save_ops", "Emitted resource.gameSaved", {
    kind,
    locator,
    recordId: recordId ?? "",
    sessionId: details.sessionId,
    wasCreate: details.wasCreate,
  });
};

// ── createEnsureSourceForActiveSession ────────────────────────────────────────

type CreateResult = {
  sourceRef?: { kind?: unknown; locator?: unknown; recordId?: unknown };
  revisionToken?: unknown;
};

type EnsureSourceDeps = {
  getActiveTabId: () => string | null;
  getActiveResourceRef: () => { kind?: string; locator?: string } | null;
  getTranslator: () => (key: string, fallback?: string) => string;
  createSessionFromPgnText: (pgnText: string) => { pgnModel: unknown };
  deriveSessionTitle: (pgnModel: unknown, kind: string) => string;
  createGameInResource: (
    ref: { kind?: string; locator?: string },
    pgnText: string,
    titleHint: string,
  ) => Promise<CreateResult>;
};

export const createEnsureSourceForActiveSession = (
  deps: EnsureSourceDeps,
) => async (
  session: unknown,
  pgnText: string,
): Promise<{ sourceRef?: unknown; revisionToken?: string } | null> => {
  const { getActiveTabId, getActiveResourceRef, getTranslator, createSessionFromPgnText, deriveSessionTitle, createGameInResource } = deps;
  const activeTabId = getActiveTabId();
  const activeRef = getActiveResourceRef();
  log.info("session_save_ops", "ensureSourceForActiveSession: active resource tab", {
    activeTabId: activeTabId ?? "",
    resourceKind: typeof activeRef?.kind === "string" ? activeRef.kind : "",
    hasLocator: typeof activeRef?.locator === "string" && activeRef.locator.length > 0,
  });
  if (!activeTabId || !activeRef?.locator) {
    throw new Error(getTranslator()("pgn.save.noResource", "Open a resource folder or database first to save into"));
  }
  log.info("session_save_ops", "ensureSourceForActiveSession: creating new game record in resource", {
    resourceKind: String(activeRef.kind || ""),
  });
  const parsedForTitle = createSessionFromPgnText(pgnText);
  const sessionRecord = session as { sessionId?: string };
  const sessionSlug: string =
    typeof sessionRecord.sessionId === "string"
      ? sessionRecord.sessionId.replace(/^session-/i, "").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "")
      : "";
  const uniqueness: string = sessionSlug || String(Date.now());
  const derivedTitle: string = deriveSessionTitle(parsedForTitle.pgnModel, "game");
  const titleHint: string = `${derivedTitle}-${uniqueness}`;
  const created = await createGameInResource(
    { kind: activeRef.kind, locator: activeRef.locator },
    pgnText,
    titleHint,
  );
  log.info("session_save_ops", "ensureSourceForActiveSession: createGameInResource finished", {
    hasSourceRef: Boolean(created.sourceRef),
    recordId:
      created.sourceRef && typeof created.sourceRef.recordId === "string" ? created.sourceRef.recordId : "",
  });
  if (created.sourceRef?.kind && created.sourceRef.locator) {
    const kind = String(created.sourceRef.kind);
    const locator = String(created.sourceRef.locator);
    const recordId = typeof created.sourceRef.recordId === "string" ? created.sourceRef.recordId : undefined;
    resourceDomainEvents.emit({
      type: "resource.gameCreated",
      resourceRef: { kind, locator },
      sourceRef: { kind, locator, recordId },
      sessionId: typeof sessionRecord.sessionId === "string" ? sessionRecord.sessionId : undefined,
    });
    resourceDomainEvents.emit({
      type: "resource.resourceChanged",
      resourceRef: { kind, locator },
      operation: "create",
      sourceRef: { kind, locator, recordId },
    });
    log.info("session_save_ops", "Emitted resource.gameCreated", { kind, locator, recordId: recordId ?? "" });
  }
  return { sourceRef: created.sourceRef, revisionToken: String(created.revisionToken || "") };
};
