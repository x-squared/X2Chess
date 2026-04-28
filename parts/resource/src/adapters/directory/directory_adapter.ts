import {
  PgnResourceError,
  type PgnCreateGameResult,
  type PgnListGamesResult,
  type PgnLoadGameResult,
  type PgnSaveGameResult,
} from "../../domain/actions";
import type { PgnSaveOptions, PgnResourceAdapter } from "../../domain/contracts";
import type { PgnGameRef } from "../../domain/game_ref";
import type { PgnResourceRef } from "../../domain/resource_ref";
import type { FsGateway } from "../../io/fs_gateway";
import { readSidecar, writeSidecar } from "./sidecar";

/**
 * Canonical directory-resource adapter.
 *
 * Integration API:
 * - Primary export: `createDirectoryAdapter`.
 * - Serves canonical `directory` kind.
 *
 * Configuration API:
 * - `DirectoryAdapterDeps` supplies `fsGateway` (required for sidecar I/O) plus
 *   file-level callbacks for list/load/save/create. The adapter owns all sidecar
 *   ordering logic; callbacks only perform raw per-file I/O.
 *
 * Communication API:
 * - Sidecar (`dirLocator/.x2chess-meta.json`) is read on every `list` and updated
 *   on `create` and `reorder`.
 */

// ── Raw file-level callback types ─────────────────────────────────────────────

export type RawDirEntry = {
  recordId: string;
  titleHint: string;
  revisionToken: string;
  metadata: Record<string, string | string[]>;
  availableMetadataKeys: string[];
};

type DirectoryAdapterDeps = {
  /** Required for reading and writing the sidecar ordering file. */
  fsGateway: FsGateway;
  listRawEntries?: (dirLocator: string) => Promise<RawDirEntry[]>;
  loadFile?: (dirLocator: string, recordId: string) => Promise<{ pgnText: string; revisionToken: string }>;
  saveFile?: (dirLocator: string, recordId: string, pgnText: string) => Promise<{ revisionToken: string }>;
  createFile?: (dirLocator: string, titleHint: string, pgnText: string) => Promise<{ recordId: string; revisionToken: string }>;
};

/**
 * Create canonical directory adapter.
 *
 * @param deps Adapter dependencies including required `fsGateway`.
 * @returns Canonical adapter implementing kind `directory`.
 */
export const createDirectoryAdapter = (deps: DirectoryAdapterDeps): PgnResourceAdapter => ({
  kind: "directory",

  list: async (resourceRef: PgnResourceRef): Promise<PgnListGamesResult> => {
    if (!deps.listRawEntries) {
      throw new PgnResourceError("unsupported_operation", "Directory adapter list is not configured.");
    }
    const dirLocator = String(resourceRef.locator || "").trim();
    const rawEntries = await deps.listRawEntries(dirLocator);

    const sidecar = await readSidecar(deps.fsGateway, dirLocator);

    const ordered = [...rawEntries].sort((a, b) => {
      const oa = sidecar.games[a.recordId]?.orderIndex ?? Infinity;
      const ob = sidecar.games[b.recordId]?.orderIndex ?? Infinity;
      if (oa !== ob) return oa - ob;
      return a.titleHint.localeCompare(b.titleHint);
    });

    return {
      entries: ordered.map((entry) => ({
        gameRef: { kind: "directory", locator: dirLocator, recordId: entry.recordId },
        title: entry.titleHint,
        revisionToken: entry.revisionToken,
        metadata: entry.metadata,
        availableMetadataKeys: entry.availableMetadataKeys,
      })),
    };
  },

  load: async (gameRef: PgnGameRef): Promise<PgnLoadGameResult> => {
    if (!deps.loadFile) {
      throw new PgnResourceError("unsupported_operation", "Directory adapter load is not configured.");
    }
    const result = await deps.loadFile(String(gameRef.locator || ""), String(gameRef.recordId || ""));
    return { gameRef, pgnText: result.pgnText, revisionToken: result.revisionToken, title: String(gameRef.recordId || "").replace(/\.[^.]+$/, "") };
  },

  save: async (gameRef: PgnGameRef, pgnText: string, _options?: PgnSaveOptions): Promise<PgnSaveGameResult> => {
    if (!deps.saveFile) {
      throw new PgnResourceError("unsupported_operation", "Directory adapter save is not configured.");
    }
    const result = await deps.saveFile(String(gameRef.locator || ""), String(gameRef.recordId || ""), pgnText);
    return { gameRef, revisionToken: result.revisionToken };
  },

  create: async (resourceRef: PgnResourceRef, pgnText: string, title: string): Promise<PgnCreateGameResult> => {
    if (!deps.createFile) {
      throw new PgnResourceError("unsupported_operation", "Directory adapter create is not configured.");
    }
    const dirLocator = String(resourceRef.locator || "").trim();
    const result = await deps.createFile(dirLocator, title, pgnText);

    const sidecar = await readSidecar(deps.fsGateway, dirLocator);
    const maxOrder = Object.values(sidecar.games).reduce((m, g) => Math.max(m, g.orderIndex ?? -1), -1);
    sidecar.games[result.recordId] = { orderIndex: maxOrder + 1 };
    await writeSidecar(deps.fsGateway, dirLocator, sidecar);

    return {
      gameRef: { kind: "directory", locator: dirLocator, recordId: result.recordId },
      revisionToken: result.revisionToken,
      title,
    };
  },

  getSchemaId: async (resourceRef: PgnResourceRef): Promise<string | null> => {
    const dirLocator = String(resourceRef.locator || "").trim();
    const sidecar = await readSidecar(deps.fsGateway, dirLocator);
    return sidecar.schemaId ?? null;
  },

  setSchemaId: async (resourceRef: PgnResourceRef, schemaId: string | null): Promise<void> => {
    const dirLocator = String(resourceRef.locator || "").trim();
    const sidecar = await readSidecar(deps.fsGateway, dirLocator);
    if (schemaId === null) {
      delete sidecar.schemaId;
    } else {
      sidecar.schemaId = schemaId;
    }
    await writeSidecar(deps.fsGateway, dirLocator, sidecar);
  },

  reorder: async (gameRef: PgnGameRef, afterRef: PgnGameRef | null): Promise<void> => {
    const dirLocator = String(gameRef.locator || "").trim();
    const sidecar = await readSidecar(deps.fsGateway, dirLocator);

    const entries = Object.entries(sidecar.games)
      .map(([id, meta]) => ({ id, order: meta.orderIndex ?? 0 }))
      .sort((a, b) => a.order - b.order);

    if (afterRef === null) {
      const front = entries[0];
      if (!front || front.id === gameRef.recordId) return;
      sidecar.games[gameRef.recordId] = {
        ...sidecar.games[gameRef.recordId],
        orderIndex: front.order - 1,
      };
      await writeSidecar(deps.fsGateway, dirLocator, sidecar);
      return;
    }

    const afterIdx = entries.findIndex((e) => e.id === afterRef.recordId);
    if (afterIdx === -1) return;

    const afterOrder = entries[afterIdx].order;
    let nextIdx = afterIdx + 1;
    while (nextIdx < entries.length && entries[nextIdx].id === gameRef.recordId) nextIdx++;
    const nextOrder = nextIdx < entries.length ? entries[nextIdx].order : afterOrder + 2;

    sidecar.games[gameRef.recordId] = {
      ...sidecar.games[gameRef.recordId],
      orderIndex: (afterOrder + nextOrder) / 2,
    };
    await writeSidecar(deps.fsGateway, dirLocator, sidecar);
  },
});
