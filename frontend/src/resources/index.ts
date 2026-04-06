import { createPlayerStoreService } from "./player_store_service";
import { createRuntimeConfigService } from "./runtime_config_service";
import { createSourceGateway } from "./source_gateway";
import type { PlayerRecord } from "../app_shell/app_state";
import type { SourceRefLike } from "../runtime/bootstrap_shared";
import type { PgnResourceRef } from "../../../resource/domain/resource_ref";
import type { PositionSearchHit, TextSearchHit } from "../../../resource/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../resource/domain/move_frequency";

type ResourcesDeps = {
  appMode?: string;
  initialPlayerStore?: PlayerRecord[];
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
type ChooseFileResult = Awaited<ReturnType<SourceGateway["chooseFileByPicker"]>>;
type ChooseFolderResult = Awaited<ReturnType<SourceGateway["chooseFolderByPicker"]>>;
type CreateResourceByKindResult = Awaited<ReturnType<SourceGateway["createResourceByKind"]>>;

export const createResourcesCapabilities = ({
  appMode = "DEV",
  initialPlayerStore = [],
  t,
  onSetSaveStatus,
  onApplyRuntimeConfig,
  onLoadPgn,
  onInitializeWithDefaultPgn,
  pgnInput,
}: ResourcesDeps) => {
  // ── Internal state (not injected from outside) ────────────────────────────
  const resourcesState = {
    gameDirectoryHandle: null as unknown,
    gameRootPath: "",
    gameDirectoryPath: "",
    activeSourceKind: "directory",
    appMode,
    appConfig: {} as Record<string, unknown>,
    playerStore: [...initialPlayerStore] as PlayerRecord[],
  };

  const runtimeConfigService = createRuntimeConfigService({ state: resourcesState });
  const playerStoreService = createPlayerStoreService({ state: resourcesState });
  const sourceGateway: SourceGateway = createSourceGateway({ state: resourcesState });

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

  const createResourceByKind = async (kind: "db" | "directory" | "file"): Promise<CreateResourceByKindResult> => {
    try {
      const selected: CreateResourceByKindResult = await sourceGateway.createResourceByKind(kind);
      if (!selected) return null;
      onSetSaveStatus("", "");
      return selected;
    } catch (error: unknown) {
      const msg: string = error instanceof Error ? error.message : String(error);
      onSetSaveStatus(msg || t("resources.error", "Unable to create resource."), "error");
      return null;
    }
  };

  const chooseFileResource = async (): Promise<ChooseFileResult> => {
    try {
      const selected: ChooseFileResult = await sourceGateway.chooseFileByPicker();
      if (!selected) return null;
      onSetSaveStatus("", "");
      return selected;
    } catch (error: unknown) {
      const msg: string = error instanceof Error ? error.message : String(error);
      onSetSaveStatus(msg || t("resources.error", "Unable to open resource file."), "error");
      return null;
    }
  };

  const chooseFolderResource = async (): Promise<ChooseFolderResult> => {
    try {
      const selected: ChooseFolderResult = await sourceGateway.chooseFolderByPicker();
      if (!selected) return null;
      onSetSaveStatus("", "");
      return selected;
    } catch (error: unknown) {
      const msg: string = error instanceof Error ? error.message : String(error);
      onSetSaveStatus(msg || t("resources.error", "Unable to open resource folder."), "error");
      return null;
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

  const getActiveSourceKind = (): string => resourcesState.activeSourceKind;
  const setAppConfig = (config: Record<string, unknown>): void => { resourcesState.appConfig = config; };
  const getPlayerStore = (): PlayerRecord[] => [...resourcesState.playerStore];

  const playerStoreKey = (r: PlayerRecord): string =>
    `${r.lastName.toLowerCase()}|${r.firstName.toLowerCase()}`;

  const addPlayerRecord = (record: PlayerRecord): void => {
    const key = playerStoreKey(record);
    const exists = resourcesState.playerStore.some(
      (p: PlayerRecord): boolean => playerStoreKey(p) === key,
    );
    if (!exists) resourcesState.playerStore.push(record);
  };

  const deletePlayerRecord = (record: PlayerRecord): void => {
    const key = playerStoreKey(record);
    resourcesState.playerStore = resourcesState.playerStore.filter(
      (p: PlayerRecord): boolean => playerStoreKey(p) !== key,
    );
  };

  const updatePlayerRecord = (oldRecord: PlayerRecord, updatedRecord: PlayerRecord): void => {
    const oldKey = playerStoreKey(oldRecord);
    const newKey = playerStoreKey(updatedRecord);
    const idx = resourcesState.playerStore.findIndex(
      (p: PlayerRecord): boolean => playerStoreKey(p) === oldKey,
    );
    if (idx === -1) return;
    // Prevent duplicate key (if the new name already exists as a different entry).
    const duplicateIdx = resourcesState.playerStore.findIndex(
      (p: PlayerRecord, i: number): boolean => i !== idx && playerStoreKey(p) === newKey,
    );
    if (duplicateIdx !== -1) {
      // New name is already present; just remove the old entry.
      resourcesState.playerStore.splice(idx, 1);
      return;
    }
    resourcesState.playerStore[idx] = updatedRecord;
  };

  return {
    addPlayerRecord,
    deletePlayerRecord,
    updatePlayerRecord,
    chooseClientGamesFolder,
    chooseFileResource,
    chooseFolderResource,
    chooseResourceByPicker,
    createResourceByKind,
    getActiveSourceKind,
    getAvailableSourceKinds: (): string[] => sourceGateway.getAdapterKinds(),
    getPlayerStore,
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
    setAppConfig,
  };
};
