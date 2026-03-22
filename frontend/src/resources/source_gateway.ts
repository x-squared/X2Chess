import { createDirectoryAdapter } from "../../../resource/adapters/directory/directory_adapter";
import { createFileAdapter as createCanonicalFileAdapter } from "../../../resource/adapters/file/file_adapter";
import { createDbAdapter } from "../../../resource/adapters/db/db_adapter";
import { buildPositionIndex, buildMoveEdgeIndex } from "./position_indexer";
import { readSidecar, writeSidecar } from "../../../resource/adapters/directory/sidecar";
import {
  searchAcrossResources,
  searchTextAcrossResources,
  exploreAcrossResources,
  type PositionSearchHit,
  type TextSearchHit,
} from "../../../resource/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../resource/domain/move_frequency";
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
import { isTauriRuntime, buildTauriFsGateway, buildTauriDbGateway } from "./tauri_gateways";

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
    ? createDbAdapter(buildTauriDbGateway, { buildPositionIndex, buildMoveEdgeIndex })
    : createDbAdapter(
        () => { throw new Error("Database resources require the desktop application."); },
        { buildPositionIndex, buildMoveEdgeIndex },
      );
  const canonicalFileAdapter = createCanonicalFileAdapter({ fsGateway: buildTauriFsGateway() });

  const tauriFsGateway = buildTauriFsGateway();

  const directoryAdapter = createDirectoryAdapter({
    listGames: async (resourceRef: PgnResourceRef) => {
      const rows: SourceListEntry[] = await sourcePickerAdapter.list({
        sourceRef: { kind: "file", locator: resourceRef.locator },
      });

      // Apply sidecar ordering when available (Phase 5).
      const sidecar = isTauriRuntime()
        ? await readSidecar(tauriFsGateway, resourceRef.locator)
        : { version: 1 as const, games: {} };

      const orderedRows = [...rows].sort((a, b) => {
        const idA = String(a.sourceRef?.recordId || "");
        const idB = String(b.sourceRef?.recordId || "");
        const oA = sidecar.games[idA]?.orderIndex ?? Infinity;
        const oB = sidecar.games[idB]?.orderIndex ?? Infinity;
        return oA - oB;
      });

      return {
        entries: orderedRows.map((row: SourceListEntry) => ({
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
      const recordId = String(created.sourceRef?.recordId || "");

      // Update sidecar: assign next orderIndex for the new game.
      if (isTauriRuntime() && recordId) {
        const sidecar = await readSidecar(tauriFsGateway, resourceRef.locator);
        const maxOrder = Object.values(sidecar.games).reduce(
          (m, g) => Math.max(m, g.orderIndex ?? -1),
          -1,
        );
        sidecar.games[recordId] = { orderIndex: maxOrder + 1 };
        await writeSidecar(tauriFsGateway, resourceRef.locator, sidecar);
      }

      return {
        gameRef: {
          kind: "directory",
          locator: String(created.sourceRef?.locator || resourceRef.locator || ""),
          recordId,
        },
        revisionToken: String(created.revisionToken || ""),
        title: String(created.titleHint || ""),
      };
    },

    reorder: async (gameRef: PgnGameRef, neighborGameRef: PgnGameRef) => {
      if (!isTauriRuntime()) return;
      const dirLocator = gameRef.locator;
      const sidecar = await readSidecar(tauriFsGateway, dirLocator);
      // Swap orderIndex values (or assign them if not yet present).
      const allOrders = Object.values(sidecar.games).map((g) => g.orderIndex ?? 0);
      const maxOrder = allOrders.length > 0 ? Math.max(...allOrders) : 0;
      const idA = gameRef.recordId;
      const idB = neighborGameRef.recordId;
      const oA = sidecar.games[idA]?.orderIndex ?? maxOrder + 1;
      const oB = sidecar.games[idB]?.orderIndex ?? maxOrder + 2;
      sidecar.games[idA] = { ...(sidecar.games[idA] ?? {}), orderIndex: oB };
      sidecar.games[idB] = { ...(sidecar.games[idB] ?? {}), orderIndex: oA };
      await writeSidecar(tauriFsGateway, dirLocator, sidecar);
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

  /**
   * Fan out a position hash search across the provided canonical resource refs.
   *
   * @param positionHash 16-char FNV-1a hex hash of the first four FEN fields.
   * @param resourceRefs Canonical resource refs to search (typically all open DB tabs).
   * @returns Flat list of matching game refs with their originating resource ref.
   */
  const searchByPositionAcross = async (
    positionHash: string,
    resourceRefs: PgnResourceRef[],
  ): Promise<PositionSearchHit[]> =>
    searchAcrossResources(
      positionHash,
      resourceRefs,
      (hash: string, ref: PgnResourceRef): Promise<PgnGameRef[]> =>
        resourceClient.searchByPositionHash(hash, ref),
    );

  /**
   * Fan out a full-text search across the provided canonical resource refs.
   *
   * @param query Substring to match against White, Black, Event, Site metadata.
   * @param resourceRefs Canonical resource refs to search.
   * @returns Flat list of matching game refs with their originating resource ref.
   */
  const searchTextAcross = async (
    query: string,
    resourceRefs: PgnResourceRef[],
  ): Promise<TextSearchHit[]> =>
    searchTextAcrossResources(
      query,
      resourceRefs,
      (q: string, ref: PgnResourceRef): Promise<PgnGameRef[]> =>
        resourceClient.searchByText(q, ref),
    );

  /**
   * Fan out a position exploration across the provided canonical resource refs.
   *
   * @param positionHash 16-char FNV-1a hex hash of the position to explore.
   * @param resourceRefs Canonical resource refs to query.
   * @returns Merged move-frequency list sorted by count descending.
   */
  const explorePositionAcross = async (
    positionHash: string,
    resourceRefs: PgnResourceRef[],
  ): Promise<MoveFrequencyEntry[]> =>
    exploreAcrossResources(
      positionHash,
      resourceRefs,
      (hash: string, ref: PgnResourceRef) => resourceClient.explorePosition(hash, ref),
    );

  return {
    chooseFileSourceRoot,
    chooseResourceByPicker,
    createGameInResource,
    getAdapterKinds: (): string[] => (supportsFileKind ? ["file", "directory", "db"] : ["directory"]),
    listGames,
    searchByPositionAcross,
    searchTextAcross,
    explorePositionAcross,
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
