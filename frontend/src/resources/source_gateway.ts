import { createDirectoryAdapter } from "../../../parts/resource/src/adapters/directory/directory_adapter";
import { createFileAdapter as createCanonicalFileAdapter } from "../../../parts/resource/src/adapters/file/file_adapter";
import { createDbAdapter } from "../../../parts/resource/src/adapters/db/db_adapter";
import { buildPositionIndex, buildMoveEdgeIndex } from "./position_indexer";
import {
  searchAcrossResources,
  searchTextAcrossResources,
  exploreAcrossResources,
  type PositionSearchHit,
  type TextSearchHit,
} from "../../../parts/resource/src/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../parts/resource/src/domain/move_frequency";
import { createResourceClient, type ResourceClient } from "../../../parts/resource/src/client/api";
import {
  toCanonicalGameRef,
  toCanonicalResourceRef,
  type LegacyAdapter,
  type LegacyCreateResult,
  type LegacyListEntry,
  type LegacyLoadResult,
  type LegacySaveResult,
} from "../../../parts/resource/src/client/compatibility";
import type { PgnResourceRef } from "../../../parts/resource/src/domain/resource_ref";
import { createSourcePickerAdapter } from "./source_picker_adapter";
import { isTauriRuntime, buildTauriFsGateway, buildTauriDbGateway } from "../platform/desktop/tauri/tauri_gateways";

/**
 * Source Gateway module.
 *
 * Integration API:
 * - Primary exports from this module: `createSourceGateway`.
 *
 * Configuration API:
 * - Injects app `state` and frontend picker/runtime dependencies.
 *
 * Communication API:
 * - Uses top-level `resource/client` as canonical boundary, while keeping
 *   picker/source-root orchestration in frontend.
 */

type SourceGatewayState = {
  appMode: string;
  gameDirectoryPath: string;
  gameRootPath: string;
  gameDirectoryHandle: unknown;
};

type SourceGatewayDeps = {
  state: SourceGatewayState;
};

type SourceRefInput = { kind?: string; locator?: string; recordId?: string };

/**
 * Create source gateway boundary.
 *
 * @param deps Gateway dependencies.
 * @returns Gateway methods for picker flows and canonical list/load/save/create operations.
 */
export const createSourceGateway = ({ state }: SourceGatewayDeps) => {
  const sourcePickerAdapter = createSourcePickerAdapter({ state }) as LegacyAdapter & {
    pickSourceRoot: () => Promise<unknown>;
    applySourceRoot: (sourceRoot: unknown) => void;
    pickResourceTarget: () => Promise<
      | { type: "folder"; title: string; sourceRoot: unknown }
      | { type: "file" | "db"; title: string; locator: string }
      | null
    >;
    pickFileOnlyTarget: () => Promise<{ type: "file" | "db"; title: string; locator: string } | null>;
    pickDatabaseOnlyTarget: () => Promise<{ type: "db"; title: string; locator: string } | null>;
    detectDefaultSourceRoot: () => Promise<unknown>;
    createNewDatabase: (suggestedName: string) => Promise<{ type: "db"; title: string; locator: string } | null>;
    createNewPgnFile: (suggestedName: string) => Promise<{ type: "file"; title: string; locator: string } | null>;
  };

  const tauriFsGateway = buildTauriFsGateway();

  const dbAdapter = isTauriRuntime()
    ? createDbAdapter(buildTauriDbGateway, { buildPositionIndex, buildMoveEdgeIndex })
    : createDbAdapter(
        () => { throw new Error("Database resources require the desktop application."); },
        { buildPositionIndex, buildMoveEdgeIndex },
      );

  const canonicalFileAdapter = createCanonicalFileAdapter({ fsGateway: tauriFsGateway });

  const directoryAdapter = createDirectoryAdapter({
    fsGateway: tauriFsGateway,

    listRawEntries: async (dirLocator) => {
      const rows: LegacyListEntry[] = await sourcePickerAdapter.list({
        sourceRef: { kind: "directory", locator: dirLocator },
      });
      return rows.map((row) => ({
        recordId: String(row.sourceRef?.recordId || ""),
        titleHint: String(row.titleHint || ""),
        revisionToken: String(row.revisionToken || ""),
        metadata: row.metadata ?? {},
        availableMetadataKeys: Array.isArray(row.availableMetadataKeys)
          ? row.availableMetadataKeys.map(String)
          : [],
      }));
    },

    loadFile: async (dirLocator, recordId) => {
      const loaded: LegacyLoadResult = await sourcePickerAdapter.load({
        kind: "directory",
        locator: dirLocator,
        recordId,
      });
      return { pgnText: loaded.pgnText, revisionToken: String(loaded.revisionToken || "") };
    },

    saveFile: async (dirLocator, recordId, pgnText) => {
      const saved: LegacySaveResult = await sourcePickerAdapter.save(
        { kind: "directory", locator: dirLocator, recordId },
        pgnText,
        "",
        {},
      );
      return { revisionToken: String(saved.revisionToken || "") };
    },

    createFile: async (dirLocator, titleHint, pgnText) => {
      if (typeof sourcePickerAdapter.createInResource !== "function") {
        throw new Error("Directory resources cannot create new games yet.");
      }
      const created: LegacyCreateResult = await sourcePickerAdapter.createInResource(
        { kind: "directory", locator: dirLocator },
        pgnText,
        titleHint,
      );
      return {
        recordId: String(created.sourceRef?.recordId || ""),
        revisionToken: String(created.revisionToken || ""),
      };
    },
  });

  const resourceClient: ResourceClient = createResourceClient({
    db: dbAdapter,
    directory: directoryAdapter,
    file: canonicalFileAdapter,
  });

  const supportsFileKind: boolean = isTauriRuntime();

  // ── Picker helpers ────────────────────────────────────────────────────────────

  const chooseFileSourceRoot = async (): Promise<void> => {
    const root = await sourcePickerAdapter.pickSourceRoot();
    if (!root) return;
    sourcePickerAdapter.applySourceRoot(root);
  };

  /**
   * Open unified resource picker.
   *
   * @returns Selected canonical resource reference and its kind string, or `null` on cancel.
   */
  const chooseResourceByPicker = async (): Promise<{ resourceRef: PgnResourceRef; activeKind: string } | null> => {
    const selected = await sourcePickerAdapter.pickResourceTarget();
    if (!selected) return null;
    if (selected.type === "folder") {
      sourcePickerAdapter.applySourceRoot(selected.sourceRoot);
      const locator = String(state.gameDirectoryPath || state.gameRootPath || "local-files");
      return { resourceRef: { kind: "directory", locator }, activeKind: "directory" };
    }
    if (selected.type === "file") {
      if (!supportsFileKind) throw new Error("Single-file resources require desktop runtime.");
      return { resourceRef: { kind: "file", locator: selected.locator }, activeKind: "file" };
    }
    if (selected.type === "db") {
      if (!supportsFileKind) throw new Error("Database resources require the desktop application.");
      return { resourceRef: { kind: "db", locator: selected.locator }, activeKind: "db" };
    }
    throw new TypeError("Unknown resource type selected.");
  };

  /**
   * Open a file-only picker.
   *
   * @returns Selected canonical resource reference and its kind string, or `null` on cancel.
   */
  const chooseFileByPicker = async (): Promise<{ resourceRef: PgnResourceRef; activeKind: string } | null> => {
    const selected = await sourcePickerAdapter.pickFileOnlyTarget();
    if (!selected) return null;
    if (!supportsFileKind) throw new Error("File resources require the desktop application.");
    if (selected.type === "file") return { resourceRef: { kind: "file", locator: selected.locator }, activeKind: "file" };
    if (selected.type === "db")   return { resourceRef: { kind: "db",   locator: selected.locator }, activeKind: "db" };
    throw new TypeError("Unknown resource type selected.");
  };

  const chooseDatabaseByPicker = async (): Promise<{ resourceRef: PgnResourceRef; activeKind: string } | null> => {
    const selected = await sourcePickerAdapter.pickDatabaseOnlyTarget();
    if (!selected) return null;
    if (!supportsFileKind) throw new Error("Database resources require the desktop application.");
    return { resourceRef: { kind: "db", locator: selected.locator }, activeKind: "db" };
  };

  /**
   * Open a folder picker.
   *
   * @returns Selected canonical resource reference and its kind string, or `null` on cancel.
   */
  const chooseFolderByPicker = async (): Promise<{ resourceRef: PgnResourceRef; activeKind: string } | null> => {
    const root = await sourcePickerAdapter.pickSourceRoot();
    if (!root) return null;
    sourcePickerAdapter.applySourceRoot(root);
    const locator = String(state.gameDirectoryPath || state.gameRootPath || "local-files");
    return { resourceRef: { kind: "directory", locator }, activeKind: "directory" };
  };

  /**
   * Create a new resource of the given kind.
   *
   * @returns Canonical resource reference and its kind string, or `null` on cancel.
   */
  const createResourceByKind = async (kind: "db" | "directory" | "file"): Promise<{ resourceRef: PgnResourceRef; activeKind: string } | null> => {
    if (kind === "file") {
      if (!supportsFileKind) throw new Error("PGN file creation requires the desktop application.");
      const selected = await sourcePickerAdapter.createNewPgnFile("");
      if (!selected) return null;
      return { resourceRef: { kind: "file", locator: selected.locator }, activeKind: "file" };
    }
    if (kind === "db") {
      if (!supportsFileKind) throw new Error("Database resources require the desktop application.");
      const selected = await sourcePickerAdapter.createNewDatabase("");
      if (!selected) return null;
      return { resourceRef: { kind: "db", locator: selected.locator }, activeKind: "db" };
    }
    const root = await sourcePickerAdapter.pickSourceRoot();
    if (!root) return null;
    sourcePickerAdapter.applySourceRoot(root);
    const locator = String(state.gameDirectoryPath || state.gameRootPath || "local-files");
    return { resourceRef: { kind: "directory", locator }, activeKind: "directory" };
  };

  const maybePreloadDefaultDevSource = async (): Promise<{ activeKind: string } | null> => {
    if (state.appMode !== "DEV") return null;
    const root = await sourcePickerAdapter.detectDefaultSourceRoot();
    if (!root) return null;
    sourcePickerAdapter.applySourceRoot(root);
    return { activeKind: "directory" };
  };

  // ── Resource operations ───────────────────────────────────────────────────────

  const listGamesForResource = async (resourceRef: SourceRefInput): Promise<LegacyListEntry[]> => {
    const canonicalRef = toCanonicalResourceRef(resourceRef || { kind: "directory", locator: "" });
    if (canonicalRef.kind === "file" && !supportsFileKind) return [];
    const listed = await resourceClient.listGames(canonicalRef);
    return listed.entries.map((entry) => ({
      sourceRef: { kind: entry.gameRef.kind, locator: entry.gameRef.locator, recordId: entry.gameRef.recordId },
      titleHint: entry.title,
      revisionToken: entry.revisionToken,
      metadata: entry.metadata,
      availableMetadataKeys: entry.availableMetadataKeys,
    }));
  };

  const loadBySourceRef = async (sourceRef: SourceRefInput): Promise<LegacyLoadResult> => {
    const loaded = await resourceClient.loadGame(toCanonicalGameRef(sourceRef));
    return { pgnText: loaded.pgnText, revisionToken: loaded.revisionToken, titleHint: loaded.title };
  };

  const saveBySourceRef = async (
    sourceRef: SourceRefInput,
    pgnText: string,
    revisionToken: string,
    _options: Record<string, unknown> = {},
  ): Promise<LegacySaveResult> => {
    const saved = await resourceClient.saveGame(toCanonicalGameRef(sourceRef), pgnText, {
      expectedRevisionToken: revisionToken,
    });
    return { revisionToken: saved.revisionToken };
  };

  const createGameInResource = async (
    resourceRef: SourceRefInput,
    pgnText: string,
    titleHint: string = "",
  ): Promise<LegacyCreateResult> => {
    const created = await resourceClient.createGame(
      toCanonicalResourceRef(resourceRef),
      pgnText,
      titleHint,
    );
    return {
      sourceRef: { kind: created.gameRef.kind, locator: created.gameRef.locator, recordId: created.gameRef.recordId },
      revisionToken: created.revisionToken,
      titleHint: created.title,
    };
  };

  const reorderGame = async (sourceRef: SourceRefInput, afterSourceRef: SourceRefInput | null): Promise<void> => {
    await resourceClient.reorderGame(
      toCanonicalGameRef(sourceRef),
      afterSourceRef ? toCanonicalGameRef(afterSourceRef) : null,
    );
  };

  const deleteGame = async (sourceRef: SourceRefInput): Promise<void> => {
    await resourceClient.deleteGame(toCanonicalGameRef(sourceRef));
  };

  const getResourceSchemaId = async (resourceRef: PgnResourceRef): Promise<string | null> =>
    resourceClient.getResourceSchemaId(resourceRef);

  const setResourceSchemaId = async (resourceRef: PgnResourceRef, schemaId: string | null): Promise<void> =>
    resourceClient.setResourceSchemaId(resourceRef, schemaId);

  const searchByPositionAcross = async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<PositionSearchHit[]> =>
    searchAcrossResources(positionHash, resourceRefs, (hash, ref) => resourceClient.searchByPositionHash(hash, ref));

  const searchTextAcross = async (query: string, resourceRefs: PgnResourceRef[]): Promise<TextSearchHit[]> =>
    searchTextAcrossResources(query, resourceRefs, (q, ref) => resourceClient.searchByText(q, ref));

  const explorePositionAcross = async (positionHash: string, resourceRefs: PgnResourceRef[]): Promise<MoveFrequencyEntry[]> =>
    exploreAcrossResources(positionHash, resourceRefs, (hash, ref) => resourceClient.explorePosition(hash, ref));

  return {
    chooseFileSourceRoot,
    chooseResourceByPicker,
    chooseFileByPicker,
    chooseDatabaseByPicker,
    chooseFolderByPicker,
    createResourceByKind,
    createGameInResource,
    getAdapterKinds: (): string[] => (supportsFileKind ? ["file", "directory", "db"] : ["directory"]),
    getResourceSchemaId,
    listGamesForResource,
    searchByPositionAcross,
    searchTextAcross,
    explorePositionAcross,
    loadBySourceRef,
    maybePreloadDefaultDevSource,
    reorderGame,
    deleteGame,
    saveBySourceRef,
    setResourceSchemaId,
  };
};

export type {
  LegacySourceRef as SourceRef,
  LegacyListEntry as SourceListEntry,
  LegacyLoadResult as SourceLoadResult,
  LegacySaveResult as SourceSaveResult,
  LegacyCreateResult as SourceCreateResult,
} from "../../../parts/resource/src/client/compatibility";
export {
  mapLegacyKind as mapSourceKind,
  toCanonicalGameRef as toCanonicalGameRefFromSource,
  toCanonicalResourceRef as toCanonicalResourceRefFromSource,
} from "../../../parts/resource/src/client/compatibility";
