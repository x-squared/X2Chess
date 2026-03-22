import { createPlayerStoreService } from "./player_store_service";
import { createRuntimeConfigService } from "./runtime_config_service";
import { createSourceGateway } from "./source_gateway";
import type { PlayerRecord } from "../app_shell/app_state";
import type { SourceRefLike } from "../runtime/bootstrap_shared";
import type { PgnResourceRef } from "../../../resource/domain/resource_ref";
import type { PositionSearchHit, TextSearchHit } from "../../../resource/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../resource/domain/move_frequency";

type ResourcesState = {
  gameDirectoryHandle: unknown | null;
  gameRootPath: string;
  gameDirectoryPath: string;
  activeSourceKind: string;
  appMode: string;
  playerStore: PlayerRecord[];
};

type ResourcesDeps = {
  state: ResourcesState;
  t: (key: string, fallback?: string) => string;
  onSetSaveStatus: (message?: string, kind?: string) => void;
  onApplyRuntimeConfig: (config: Record<string, unknown>) => void;
  onLoadPgn?: () => void;
  onInitializeWithDefaultPgn?: () => void;
  pgnInput?: { value: string } | null;
};

type SourceGateway = ReturnType<typeof createSourceGateway>;
type ListEntry = Awaited<ReturnType<SourceGateway["listGames"]>>[number];
type LoadResult = Awaited<ReturnType<SourceGateway["loadBySourceRef"]>>;
type SaveResult = Awaited<ReturnType<SourceGateway["saveBySourceRef"]>>;
type CreateResult = Awaited<ReturnType<SourceGateway["createGameInResource"]>>;
type ChooseResourceResult = Awaited<ReturnType<SourceGateway["chooseResourceByPicker"]>>;

export const createResourcesCapabilities = ({
  state,
  t,
  onSetSaveStatus,
  onApplyRuntimeConfig,
  onLoadPgn,
  onInitializeWithDefaultPgn,
  pgnInput,
}: ResourcesDeps) => {
  const runtimeConfigService = createRuntimeConfigService({ state });
  const playerStoreService = createPlayerStoreService({ state });
  const sourceGateway: SourceGateway = createSourceGateway({ state });

  const listSourceGames = async (kind: string = "file"): Promise<ListEntry[]> => sourceGateway.listGames(kind);

  const listGamesForResource = async (resourceRef: SourceRefLike): Promise<ListEntry[]> =>
    sourceGateway.listGamesForResource({
      kind: String(resourceRef.kind || "directory"),
      locator: String(resourceRef.locator || ""),
      recordId: resourceRef.recordId === undefined ? undefined : String(resourceRef.recordId),
    });

  const chooseClientGamesFolder = async (): Promise<ListEntry[]> => {
    try {
      await sourceGateway.chooseFileSourceRoot();
      const runtimeConfig: Record<string, unknown> = await runtimeConfigService.loadRuntimeConfigFromClientData();
      onApplyRuntimeConfig(runtimeConfig);
      const listed: ListEntry[] = await listSourceGames("file");
      if (listed.length > 0) {
        onSetSaveStatus(`${t("pgn.source.folderSelected", "Folder")}`, "");
      } else {
        onSetSaveStatus(t("pgn.source.folderHint", "Choose a local folder (for example run/DEV)."), "");
      }
      return listed;
    } catch (error: unknown) {
      const msg: string = error instanceof Error ? error.message : String(error);
      onSetSaveStatus(msg || t("pgn.save.error", "Autosave failed"), "error");
      return [];
    }
  };

  const chooseResourceByPicker = async (): Promise<ChooseResourceResult> => {
    try {
      const selected: ChooseResourceResult = await sourceGateway.chooseResourceByPicker();
      if (!selected) return null;
      onSetSaveStatus("", "");
      return selected;
    } catch (error: unknown) {
      const msg: string = error instanceof Error ? error.message : String(error);
      onSetSaveStatus(msg || t("resources.error", "Unable to load resource games."), "error");
      return null;
    }
  };

  const loadGameBySourceRef = async (sourceRef: SourceRefLike): Promise<LoadResult> => {
    const payload: LoadResult = await sourceGateway.loadBySourceRef({
      kind: String(sourceRef.kind || "directory"),
      locator: String(sourceRef.locator || ""),
      recordId: sourceRef.recordId === undefined ? undefined : String(sourceRef.recordId),
    });
    if (pgnInput) pgnInput.value = payload.pgnText;
    if (typeof onLoadPgn === "function") onLoadPgn();
    onSetSaveStatus("", "");
    return payload;
  };

  const createGameInResource = async (
    resourceRef: SourceRefLike,
    pgnText: string,
    titleHint: string = "",
  ): Promise<CreateResult> => sourceGateway.createGameInResource(
    {
      kind: String(resourceRef.kind || "directory"),
      locator: String(resourceRef.locator || ""),
      recordId: resourceRef.recordId === undefined ? undefined : String(resourceRef.recordId),
    },
    pgnText,
    titleHint,
  );

  const searchByPositionAcross = async (
    positionHash: string,
    resourceRefs: PgnResourceRef[],
  ): Promise<PositionSearchHit[]> => sourceGateway.searchByPositionAcross(positionHash, resourceRefs);

  const searchTextAcross = async (
    query: string,
    resourceRefs: PgnResourceRef[],
  ): Promise<TextSearchHit[]> => sourceGateway.searchTextAcross(query, resourceRefs);

  const explorePositionAcross = async (
    positionHash: string,
    resourceRefs: PgnResourceRef[],
  ): Promise<MoveFrequencyEntry[]> => sourceGateway.explorePositionAcross(positionHash, resourceRefs);

  const reorderGameInResource = async (
    sourceRef: SourceRefLike,
    neighborSourceRef: SourceRefLike,
  ): Promise<void> => sourceGateway.reorderGame(
    { kind: String(sourceRef.kind || "db"), locator: String(sourceRef.locator || ""), recordId: sourceRef.recordId === undefined ? undefined : String(sourceRef.recordId) },
    { kind: String(neighborSourceRef.kind || "db"), locator: String(neighborSourceRef.locator || ""), recordId: neighborSourceRef.recordId === undefined ? undefined : String(neighborSourceRef.recordId) },
  );

  const saveGameBySourceRef = async (
    sourceRef: SourceRefLike,
    pgnText: string,
    revisionToken: string,
    options: Record<string, unknown> = {},
  ): Promise<SaveResult> => sourceGateway.saveBySourceRef(
    {
      kind: String(sourceRef.kind || "directory"),
      locator: String(sourceRef.locator || ""),
      recordId: sourceRef.recordId === undefined ? undefined : String(sourceRef.recordId),
    },
    pgnText,
    revisionToken,
    options,
  );

  const loadRuntimeConfigFromClientDataAndDefaults = async (): Promise<void> => {
    await sourceGateway.maybePreloadDefaultDevSource();
    const runtimeConfig: Record<string, unknown> = await runtimeConfigService.loadRuntimeConfigFromClientDataAndDefaults();
    onApplyRuntimeConfig(runtimeConfig);
    void runtimeConfig;
    return;
  };

  const scheduleAutosave = (): void => {
    // Autosave is handled by session persistence.
  };

  void onInitializeWithDefaultPgn;

  return {
    chooseClientGamesFolder,
    chooseResourceByPicker,
    getAvailableSourceKinds: (): string[] => sourceGateway.getAdapterKinds(),
    listGamesForResource,
    reorderGameInResource,
    listSourceGames,
    createGameInResource,
    loadGameBySourceRef,
    loadPlayerStoreFromClientData: playerStoreService.loadPlayerStoreFromClientData,
    loadRuntimeConfigFromClientDataAndDefaults,
    saveGameBySourceRef,
    savePlayerStoreToClientData: playerStoreService.savePlayerStoreToClientData,
    scheduleAutosave,
    searchByPositionAcross,
    searchTextAcross,
    explorePositionAcross,
  };
};
