import { createDirectoryAdapter } from "../../../resource/adapters/directory/directory_adapter";
import { createFileAdapter as createCanonicalFileAdapter } from "../../../resource/adapters/file/file_adapter";
import { createDbAdapter } from "../../../resource/adapters/db/db_adapter";
import { buildPositionIndex } from "./position_indexer";
import type { FsGateway } from "../../../resource/io/fs_gateway";
import type { DbGateway } from "../../../resource/io/db_gateway";
import { createResourceClient, type ResourceClient } from "../../../resource/client/api";
import {
  mapSourceKind,
  toCanonicalGameRefFromSource,
  toCanonicalResourceRefFromSource,
  type SourceAdapter,
  type SourceCreateResult,
  type SourceListEntry,
  type SourceLoadResult,
  type SourceRef,
  type SourceSaveResult,
} from "./source_types";
import type { PgnGameRef } from "../../../resource/domain/game_ref";
import type { PgnResourceRef } from "../../../resource/domain/resource_ref";
import { createSourcePickerAdapter } from "./source_picker_adapter";

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
  activeSourceKind: string;
  appMode: string;
  gameDirectoryPath: string;
  gameRootPath: string;
  gameDirectoryHandle: unknown | null;
};

type SourceGatewayDeps = {
  state: SourceGatewayState;
};

type TauriWindowLike = Window & {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: {
    core?: {
      invoke?: (command: string, payload?: Record<string, unknown>) => Promise<unknown>;
    };
  };
};

const isTauriRuntime = (): boolean => {
  const runtimeWindow = window as TauriWindowLike;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__ || runtimeWindow.__TAURI__);
};

const buildTauriFsGateway = (): FsGateway => ({
  readTextFile: async (path: string): Promise<string> => {
    const runtimeWindow = window as TauriWindowLike;
    const invokeFn = runtimeWindow.__TAURI__?.core?.invoke;
    if (typeof invokeFn !== "function") {
      throw new Error("Tauri invoke API is unavailable.");
    }
    return String(await invokeFn("load_text_file", { filePath: path }));
  },
  writeTextFile: async (path: string, content: string): Promise<void> => {
    const runtimeWindow = window as TauriWindowLike;
    const invokeFn = runtimeWindow.__TAURI__?.core?.invoke;
    if (typeof invokeFn !== "function") {
      throw new Error("Tauri invoke API is unavailable.");
    }
    await invokeFn("write_text_file", { filePath: path, content });
  },
});

const buildTauriDbGateway = (dbPath: string): DbGateway => {
  const invoke = (): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) => {
    const runtimeWindow = window as TauriWindowLike;
    const fn = runtimeWindow.__TAURI__?.core?.invoke;
    if (typeof fn !== "function") throw new Error("Tauri invoke API is unavailable.");
    return fn as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };
  return {
    query: async (sql: string, params?: unknown[]): Promise<unknown[]> => {
      const result = await invoke()("query_db", { dbPath, sql, params: params ?? [] });
      return Array.isArray(result) ? result : [];
    },
    execute: async (sql: string, params?: unknown[]): Promise<void> => {
      await invoke()("execute_db", { dbPath, sql, params: params ?? [] });
    },
  };
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
  const sourcePickerAdapter = createSourcePickerAdapter({ state }) as SourceAdapter & {
    pickSourceRoot: () => Promise<unknown>;
    applySourceRoot: (sourceRoot: unknown) => void;
    pickResourceTarget: () => Promise<
      | { type: "folder"; title: string; sourceRoot: unknown }
      | { type: "file" | "db"; title: string; locator: string }
      | null
    >;
    detectDefaultSourceRoot: () => Promise<unknown>;
  };
  const dbAdapter = isTauriRuntime()
    ? createDbAdapter(buildTauriDbGateway, { buildPositionIndex })
    : createDbAdapter(
        () => { throw new Error("Database resources require the desktop application."); },
        { buildPositionIndex },
      );
  const canonicalFileAdapter = createCanonicalFileAdapter({ fsGateway: buildTauriFsGateway() });

  const directoryAdapter = createDirectoryAdapter({
    listGames: async (resourceRef: PgnResourceRef) => {
      const rows: SourceListEntry[] = await sourcePickerAdapter.list({
        sourceRef: { kind: "file", locator: resourceRef.locator },
      });
      return {
        entries: rows.map((row: SourceListEntry) => ({
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
      const loaded: SourceLoadResult = await sourcePickerAdapter.load({
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
      const saved: SourceSaveResult = await sourcePickerAdapter.save(
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
      if (typeof sourcePickerAdapter.createInResource !== "function") {
        throw new Error("Directory resources cannot create new games yet.");
      }
      const created: SourceCreateResult = await sourcePickerAdapter.createInResource(
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
    db: dbAdapter,
    directory: directoryAdapter,
    file: canonicalFileAdapter,
  });

  const supportsFileKind: boolean = isTauriRuntime();

  /**
   * Choose and apply a directory source root.
   *
   * Side effects: mutates `state.activeSourceKind` and directory state via file adapter.
   */
  const chooseFileSourceRoot = async (): Promise<void> => {
    const root = await sourcePickerAdapter.pickSourceRoot();
    if (!root) return;
    sourcePickerAdapter.applySourceRoot(root);
    state.activeSourceKind = "directory";
  };

  /**
   * Open unified resource picker and return canonical resource reference.
   *
   * @returns Selected canonical resource reference or `null` when canceled.
   * @throws Error when deferred DB kind is selected in current migration phase.
   */
  const chooseResourceByPicker = async (): Promise<{ resourceRef: PgnResourceRef } | null> => {
    const selected = await sourcePickerAdapter.pickResourceTarget();
    if (!selected) return null;
    if (selected.type === "folder") {
      sourcePickerAdapter.applySourceRoot(selected.sourceRoot);
      state.activeSourceKind = "directory";
      return {
        resourceRef: {
          kind: "directory",
          locator: state.gameDirectoryPath || state.gameRootPath || "local-files",
        },
      };
    }
    if (selected.type === "file") {
      if (!supportsFileKind) {
        throw new Error("Single-file resources require desktop runtime. Choose a directory resource in browser mode.");
      }
      state.activeSourceKind = "file";
      return {
        resourceRef: { kind: "file", locator: selected.locator },
      };
    }
    if (selected.type === "db") {
      if (!supportsFileKind) {
        throw new Error("Database resources require the desktop application.");
      }
      state.activeSourceKind = "db";
      return { resourceRef: { kind: "db", locator: selected.locator } };
    }
    throw new Error("Unknown resource type selected.");
  };

  /**
   * Try to preload default DEV source root.
   *
   * @returns True when preload succeeded and source root was applied.
   */
  const maybePreloadDefaultDevSource = async (): Promise<boolean> => {
    if (state.appMode !== "DEV") return false;
    const root = await sourcePickerAdapter.detectDefaultSourceRoot();
    if (!root) return false;
    sourcePickerAdapter.applySourceRoot(root);
    state.activeSourceKind = "directory";
    return true;
  };

  /**
   * List games for one source kind through canonical client dispatch.
   *
   * @param kind Source kind token resolved to canonical resource kind.
   * @returns Source-shaped rows for existing frontend consumers.
   */
  const listGames = async (kind: string = state.activeSourceKind || "directory"): Promise<SourceListEntry[]> => {
    const mappedKind = mapSourceKind(kind);
    if (mappedKind === "file" && !supportsFileKind) {
      return [];
    }
    const listed = await resourceClient.listGames({
      kind: mappedKind,
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
   * @param sourceRef Source reference.
   * @returns Load payload with PGN text and revision token.
   */
  const loadBySourceRef = async (sourceRef: SourceRef): Promise<SourceLoadResult> => {
    const loaded = await resourceClient.loadGame(toCanonicalGameRefFromSource(sourceRef));
    return {
      pgnText: loaded.pgnText,
      revisionToken: loaded.revisionToken,
      titleHint: loaded.title,
    };
  };

  /**
   * Save one game by source reference through canonical client API.
   *
   * @param sourceRef Source reference.
   * @param pgnText Serialized PGN text.
   * @param revisionToken Prior revision token from last load/save.
   * @returns Save payload with next revision token.
   */
  const saveBySourceRef = async (
    sourceRef: SourceRef,
    pgnText: string,
    revisionToken: string,
    _options: Record<string, unknown> = {},
  ): Promise<SourceSaveResult> => {
    const saved = await resourceClient.saveGame(toCanonicalGameRefFromSource(sourceRef), pgnText, {
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
   * @returns Create payload with source reference and revision token.
   */
  const createGameInResource = async (
    resourceRef: SourceRef,
    pgnText: string,
    titleHint: string = "",
  ): Promise<SourceCreateResult> => {
    const created = await resourceClient.createGame(
      toCanonicalResourceRefFromSource(resourceRef || { kind: state.activeSourceKind || "directory", locator: state.gameDirectoryPath || "" }),
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

  const reorderGame = async (sourceRef: SourceRef, neighborSourceRef: SourceRef): Promise<void> => {
    await resourceClient.reorderGame(
      toCanonicalGameRefFromSource(sourceRef),
      toCanonicalGameRefFromSource(neighborSourceRef),
    );
  };

  return {
    chooseFileSourceRoot,
    chooseResourceByPicker,
    createGameInResource,
    getAdapterKinds: (): string[] => (supportsFileKind ? ["file", "directory", "db"] : ["directory"]),
    listGames,
    listGamesForResource: async (resourceRef: SourceRef): Promise<SourceListEntry[]> => {
      const listed = await resourceClient.listGames(
        toCanonicalResourceRefFromSource(resourceRef || { kind: "directory", locator: "" }),
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
    reorderGame,
    saveBySourceRef,
  };
};
