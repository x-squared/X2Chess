import { createDirectoryAdapter } from "../../../resource/adapters/directory/directory_adapter";
import { createFileAdapter as createCanonicalFileAdapter } from "../../../resource/adapters/file/file_adapter";
import { createResourceClient, type ResourceClient } from "../../../resource/client/api";
import {
  createCanonicalAdapter,
  mapLegacyKind,
  toCanonicalGameRef,
  toCanonicalResourceRef,
  type LegacyAdapter,
  type LegacyCreateResult,
  type LegacyListEntry,
  type LegacyLoadResult,
  type LegacySourceRef,
  type LegacySaveResult,
} from "../../../resource/client/compatibility";
import type { PgnGameRef } from "../../../resource/domain/game_ref";
import type { PgnResourceRef } from "../../../resource/domain/resource_ref";
import { createFileSourceAdapter } from "./sources/file_adapter";
import { createDatabaseSourceAdapter } from "./sources/db_adapter";

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
 * - Uses top-level `resource/client` as canonical boundary, while keeping legacy
 *   picker/source-root orchestration in frontend.
 */

type SourceGatewayState = {
  activeSourceKind: string;
  appMode: string;
  gameDirectoryPath: string;
};

type SourceGatewayDeps = {
  state: SourceGatewayState;
};

/**
 * Create source gateway boundary.
 *
 * @param deps Gateway dependencies.
 * @param deps.state Shared app state used for active kind and source-root tracking.
 * @returns Gateway methods for picker flows and canonical list/load/save/create operations.
 * @throws {Error} Picker methods throw when an unsupported or deferred resource kind is selected.
 */
export const createSourceGateway = ({ state }: SourceGatewayDeps) => {
  const fileAdapter = createFileSourceAdapter({ state }) as LegacyAdapter & {
    pickSourceRoot: () => Promise<unknown>;
    applySourceRoot: (sourceRoot: unknown) => void;
    pickResourceTarget: () => Promise<
      | { type: "folder"; title: string; sourceRoot: unknown }
      | { type: "file" | "db"; title: string; locator: string }
      | null
    >;
    detectDefaultSourceRoot: () => Promise<unknown>;
  };
  const sqliteAdapter = createDatabaseSourceAdapter() as LegacyAdapter;
  const canonicalFileAdapter = createCanonicalFileAdapter();

  const directoryAdapter = createDirectoryAdapter({
    listGames: async (resourceRef: PgnResourceRef) => {
      const rows: LegacyListEntry[] = await fileAdapter.list({
        sourceRef: { kind: "file", locator: resourceRef.locator },
      });
      return {
        entries: rows.map((row: LegacyListEntry) => ({
          gameRef: {
            kind: "directory",
            locator: String(row.sourceRef?.locator || resourceRef.locator || ""),
            recordId: String(row.sourceRef?.recordId || ""),
          },
          title: String(row.titleHint || ""),
          revisionToken: String(row.revisionToken || ""),
          metadata: row.metadata || {},
          availableMetadataKeys: Array.isArray(row.availableMetadataKeys)
            ? [...row.availableMetadataKeys].map((key: string): string => String(key))
            : [],
        })),
      };
    },
    loadGame: async (gameRef: PgnGameRef) => {
      const loaded: LegacyLoadResult = await fileAdapter.load({
        kind: "file",
        locator: gameRef.locator,
        recordId: gameRef.recordId,
      });
      return {
        gameRef,
        pgnText: loaded.pgnText,
        revisionToken: String(loaded.revisionToken || ""),
        title: String(loaded.titleHint || ""),
      };
    },
    saveGame: async (gameRef: PgnGameRef, pgnText: string, options) => {
      const saved: LegacySaveResult = await fileAdapter.save(
        {
          kind: "file",
          locator: gameRef.locator,
          recordId: gameRef.recordId,
        },
        pgnText,
        String(options?.expectedRevisionToken || ""),
        {},
      );
      return {
        gameRef,
        revisionToken: String(saved.revisionToken || ""),
      };
    },
    createGame: async (resourceRef: PgnResourceRef, pgnText: string, title: string) => {
      if (typeof fileAdapter.createInResource !== "function") {
        throw new Error("Directory resources cannot create new games yet.");
      }
      const created: LegacyCreateResult = await fileAdapter.createInResource(
        { kind: "file", locator: resourceRef.locator },
        pgnText,
        title,
      );
      return {
        gameRef: {
          kind: "directory",
          locator: String(created.sourceRef?.locator || resourceRef.locator || ""),
          recordId: String(created.sourceRef?.recordId || ""),
        },
        revisionToken: String(created.revisionToken || ""),
        title: String(created.titleHint || ""),
      };
    },
  });

  const resourceClient: ResourceClient = createResourceClient({
    db: createCanonicalAdapter("db", sqliteAdapter),
    directory: directoryAdapter,
    file: canonicalFileAdapter,
  });

  /**
   * Choose and apply a directory source root.
   *
   * Side effects: mutates `state.activeSourceKind` and directory state via file adapter.
   */
  const chooseFileSourceRoot = async (): Promise<void> => {
    const root = await fileAdapter.pickSourceRoot();
    if (!root) return;
    fileAdapter.applySourceRoot(root);
    state.activeSourceKind = "directory";
  };

  /**
   * Open unified resource picker and return canonical resource reference.
   *
   * @returns Selected canonical resource reference or `null` when canceled.
   * @throws Error when deferred DB kind is selected in current migration phase.
   */
  const chooseResourceByPicker = async (): Promise<{ resourceRef: PgnResourceRef } | null> => {
    const selected = await fileAdapter.pickResourceTarget();
    if (!selected) return null;
    if (selected.type === "folder") {
      fileAdapter.applySourceRoot(selected.sourceRoot);
      state.activeSourceKind = "directory";
      return {
        resourceRef: {
          kind: "directory",
          locator: state.gameDirectoryPath || "local-files",
        },
      };
    }
    if (selected.type === "file") {
      state.activeSourceKind = "file";
      return {
        resourceRef: { kind: "file", locator: selected.locator },
      };
    }
    throw new Error("Database resources are temporarily disabled in this migration phase.");
  };

  /**
   * Try to preload default DEV source root.
   *
   * @returns True when preload succeeded and source root was applied.
   */
  const maybePreloadDefaultDevSource = async (): Promise<boolean> => {
    if (state.appMode !== "DEV") return false;
    const root = await fileAdapter.detectDefaultSourceRoot();
    if (!root) return false;
    fileAdapter.applySourceRoot(root);
    state.activeSourceKind = "directory";
    return true;
  };

  /**
   * List games for one source kind through canonical client dispatch.
   *
   * @param kind Source kind token (canonical or compatibility).
   * @returns Legacy-shaped rows for existing frontend consumers.
   */
  const listGames = async (kind: string = state.activeSourceKind || "directory"): Promise<LegacyListEntry[]> => {
    const listed = await resourceClient.listGames({
      kind: mapLegacyKind(kind),
      locator: state.gameDirectoryPath || "",
    });
    return listed.entries.map((entry) => ({
      sourceRef: {
        kind: entry.gameRef.kind,
        locator: entry.gameRef.locator,
        recordId: entry.gameRef.recordId,
      },
      titleHint: entry.title,
      revisionToken: entry.revisionToken,
      metadata: entry.metadata,
      availableMetadataKeys: entry.availableMetadataKeys,
    }));
  };

  /**
   * Load one game by source reference through canonical client API.
   *
   * @param sourceRef Legacy source reference.
   * @returns Legacy load payload with PGN text and revision token.
   */
  const loadBySourceRef = async (sourceRef: LegacySourceRef): Promise<LegacyLoadResult> => {
    const loaded = await resourceClient.loadGame(toCanonicalGameRef(sourceRef));
    return {
      pgnText: loaded.pgnText,
      revisionToken: loaded.revisionToken,
      titleHint: loaded.title,
    };
  };

  /**
   * Save one game by source reference through canonical client API.
   *
   * @param sourceRef Legacy source reference.
   * @param pgnText Serialized PGN text.
   * @param revisionToken Prior revision token from last load/save.
   * @returns Legacy save payload with next revision token.
   */
  const saveBySourceRef = async (
    sourceRef: LegacySourceRef,
    pgnText: string,
    revisionToken: string,
    _options: Record<string, unknown> = {},
  ): Promise<LegacySaveResult> => {
    const saved = await resourceClient.saveGame(toCanonicalGameRef(sourceRef), pgnText, {
      expectedRevisionToken: revisionToken,
    });
    return { revisionToken: saved.revisionToken };
  };

  /**
   * Create one game in a target resource through canonical client API.
   *
   * @param resourceRef Target resource reference.
   * @param pgnText New game PGN text.
   * @param titleHint Title hint used by adapters as filename/title seed.
   * @returns Legacy create payload with source reference and revision token.
   */
  const createGameInResource = async (
    resourceRef: LegacySourceRef,
    pgnText: string,
    titleHint: string = "",
  ): Promise<LegacyCreateResult> => {
    const created = await resourceClient.createGame(
      toCanonicalResourceRef(resourceRef || { kind: state.activeSourceKind || "directory", locator: state.gameDirectoryPath || "" }),
      pgnText,
      titleHint,
    );
    return {
      sourceRef: {
        kind: created.gameRef.kind,
        locator: created.gameRef.locator,
        recordId: created.gameRef.recordId,
      },
      revisionToken: created.revisionToken,
      titleHint: created.title,
    };
  };

  return {
    chooseFileSourceRoot,
    chooseResourceByPicker,
    createGameInResource,
    getAdapterKinds: (): string[] => ["file", "directory"],
    listGames,
    listGamesForResource: async (resourceRef: LegacySourceRef): Promise<LegacyListEntry[]> => {
      const listed = await resourceClient.listGames(
        toCanonicalResourceRef(resourceRef || { kind: "directory", locator: "" }),
      );
      return listed.entries.map((entry) => ({
        sourceRef: {
          kind: entry.gameRef.kind,
          locator: entry.gameRef.locator,
          recordId: entry.gameRef.recordId,
        },
        titleHint: entry.title,
        revisionToken: entry.revisionToken,
        metadata: entry.metadata,
        availableMetadataKeys: entry.availableMetadataKeys,
      }));
    },
    loadBySourceRef,
    maybePreloadDefaultDevSource,
    saveBySourceRef,
  };
};
