/**
 * mirror_resource_schema_ids — load canonical per-resource schema ids from adapters
 * (SQLite `resource_meta`, directory sidecar, …) and mirror them into localStorage so
 * sync code paths (`getResourceSchemaId` in `schema_storage`) match `ResourceViewer`.
 */

import type { ServicesBundle } from "../../core/services/createAppServices";
import { mirrorResourceSchemaIdToLocalStorage } from "../../features/resources/services/schema_storage";
import type { WorkspaceSnapshot } from "../../runtime/workspace_snapshot_store";
import type { PgnResourceRef } from "../../../../parts/resource/src/domain/resource_ref";
import { log } from "../../logger";

const errMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "unknown";
};

const refKey = (ref: { kind: string; locator: string }): string =>
  `${String(ref.kind).trim()}|${String(ref.locator).trim()}`;

/**
 * Collect unique resource refs from a workspace snapshot (sessions + resource tabs).
 *
 * @param snapshot - Persisted workspace snapshot.
 */
export const collectResourceRefsFromWorkspaceSnapshot = (
  snapshot: WorkspaceSnapshot,
): { kind: string; locator: string }[] => {
  const out: { kind: string; locator: string }[] = [];
  const seen = new Set<string>();
  const push = (kind: string, locator: string): void => {
    const k: string = kind.trim();
    const loc: string = locator.trim();
    if (!k || !loc) return;
    const key: string = refKey({ kind: k, locator: loc });
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind: k, locator: loc });
  };
  for (const tab of snapshot.resourceTabs) {
    push(tab.kind, tab.locator);
  }
  for (const session of snapshot.sessions) {
    const sr = session.sourceRef;
    if (sr != null) push(sr.kind, sr.locator);
  }
  return out;
};

/**
 * For each ref, load schema id from the resource layer and mirror into localStorage.
 *
 * @param bundle - Services bundle (must expose `resources.loadResourceSchemaId`).
 * @param refs - Distinct resource locators to refresh.
 */
export const mirrorCanonicalResourceSchemaIds = async (
  bundle: ServicesBundle,
  refs: readonly { kind: string; locator: string }[],
): Promise<void> => {
  let mirrored: number = 0;
  for (const ref of refs) {
    try {
      const schemaId: string | null = await bundle.resources.loadResourceSchemaId(ref as PgnResourceRef);
      const trimmed: string = typeof schemaId === "string" ? schemaId.trim() : "";
      mirrorResourceSchemaIdToLocalStorage(ref, schemaId);
      if (trimmed !== "") mirrored += 1;
    } catch (err: unknown) {
      const message: string = errMessage(err);
      log.warn("mirror_resource_schema_ids", "loadResourceSchemaId failed", {
        kind: ref.kind,
        locator: ref.locator,
        message,
      });
    }
  }
  if (mirrored > 0 || refs.length > 0) {
    log.info("mirror_resource_schema_ids", "Mirrored canonical schema ids for session-tab GRP", {
      refCount: refs.length,
      nonEmptySchemaIds: mirrored,
    });
  }
};
