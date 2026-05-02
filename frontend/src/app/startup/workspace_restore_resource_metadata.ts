/**
 * workspace_restore_resource_metadata — after a workspace snapshot is restored, re-fetch
 * each session’s resource list row metadata so `resourceMetadataOverlay` matches a fresh
 * `openGameFromRef` (PGN + indexed columns merged the same way as the resource table).
 *
 * `SessionSnap` persists `pgnText` but not `resourceMetadataOverlay`; without this step,
 * session-tab GRP only sees headers parsed from `pgnText`, so DB-only fields (for example
 * `Opening` indexed but absent from bracket tags) disappear until the game is re-opened.
 */

import type { ServicesBundle } from "../../core/services/createAppServices";
import { findResourceRowMetadataByRecordId } from "../../core/services/resource_list_metadata_lookup";
import { normalizeOptionalRecordId } from "../../core/services/session_helpers";
import { log } from "../../logger";

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "unknown";
};

/**
 * For every restored session tied to a resource game row, load list metadata and attach
 * it as `resourceMetadataOverlay` so `mergeResourceMetadataOverlayForGrp` can align tab
 * chrome with the resource table.
 *
 * @param bundle - Application services bundle (session store + resources).
 */
export const refreshResourceMetadataOverlaysAfterWorkspaceRestore = async (
  bundle: ServicesBundle,
): Promise<void> => {
  const sessions = bundle.sessionStore.listSessions();
  let refreshed: number = 0;
  for (const session of sessions) {
    const ref = session.sourceRef;
    if (ref == null || typeof ref.kind !== "string" || typeof ref.locator !== "string") continue;
    const recordId: string = normalizeOptionalRecordId(ref.recordId) ?? "";
    if (recordId === "") continue;
    try {
      const rows: unknown[] = await bundle.resources.listGamesForResource({
        kind: ref.kind,
        locator: ref.locator,
      });
      const meta: Record<string, string> | null = findResourceRowMetadataByRecordId(rows, recordId);
      if (meta != null && Object.keys(meta).length > 0) {
        bundle.sessionStore.setSessionResourceMetadataOverlay(session.sessionId, meta);
        refreshed += 1;
      }
    } catch (err: unknown) {
      const message: string = errorMessage(err);
      log.warn("workspace_restore_resource_metadata", "listGamesForResource failed during overlay refresh", {
        sessionId: session.sessionId,
        kind: ref.kind,
        message,
      });
    }
  }
  if (refreshed > 0) {
    log.info("workspace_restore_resource_metadata", "Refreshed resourceMetadataOverlay after workspace restore", {
      sessionCount: sessions.length,
      refreshed,
    });
  }
};
