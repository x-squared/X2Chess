import type { PlayerRecord } from "../app_shell/app_state";
import {
  PLAYER_NAME_HEADER_KEYS,
  buildPlayerNameSuggestions,
  normalizeGameInfoHeaderValue,
  normalizePlayerRecords,
  parsePlayerRecord,
} from "../app_shell/game_info";
import { getHeaderValue, setHeaderValue, ensureRequiredPgnHeaders } from "../editor";
import { createPlayerAutocompleteBootstrap } from "./player_autocomplete_bootstrap";

type PlayerAutocompleteBootstrapDeps = Parameters<typeof createPlayerAutocompleteBootstrap>[0];

type ResourcesCapabilitiesLike = {
  loadPlayerStoreFromClientData: (seedPlayers?: PlayerRecord[]) => Promise<PlayerRecord[]>;
  savePlayerStoreToClientData: (players: PlayerRecord[]) => Promise<void>;
};

type PlayerAutocompleteWiringDeps = {
  state: PlayerAutocompleteBootstrapDeps["state"];
  gameInfoSuggestionEls: Array<HTMLElement>;
  gameInfoInputs: Array<HTMLInputElement | HTMLSelectElement>;
  applyPgnModelUpdate: (nextModel: unknown) => void;
  getResourcesCapabilities: () => ResourcesCapabilitiesLike | null;
  bundledPlayers: PlayerRecord[];
};

export const createPlayerAutocompleteWiring = ({
  state,
  gameInfoSuggestionEls,
  gameInfoInputs,
  applyPgnModelUpdate,
  getResourcesCapabilities,
  bundledPlayers,
}: PlayerAutocompleteWiringDeps): ReturnType<typeof createPlayerAutocompleteBootstrap> => {
  return createPlayerAutocompleteBootstrap({
    state,
    gameInfoSuggestionEls,
    gameInfoInputs,
    playerNameHeaderKeys: PLAYER_NAME_HEADER_KEYS,
    normalizePlayerRecordsFn: normalizePlayerRecords,
    parsePlayerRecordFn: parsePlayerRecord,
    buildPlayerNameSuggestionsFn: buildPlayerNameSuggestions,
    normalizeGameInfoHeaderValueFn: normalizeGameInfoHeaderValue,
    getHeaderValueFn: getHeaderValue,
    setHeaderValueFn: setHeaderValue,
    ensureRequiredPgnHeadersFn: ensureRequiredPgnHeaders,
    applyPgnModelUpdate: (nextModel: unknown): void => {
      applyPgnModelUpdate(nextModel);
    },
    loadPlayerStore: async (): Promise<void> => {
      const resourcesCapabilities = getResourcesCapabilities();
      if (!resourcesCapabilities) return;
      (state as { playerStore: PlayerRecord[] }).playerStore = await resourcesCapabilities.loadPlayerStoreFromClientData(bundledPlayers);
    },
    savePlayerStore: async (): Promise<void> => {
      const resourcesCapabilities = getResourcesCapabilities();
      if (!resourcesCapabilities) return;
      await resourcesCapabilities.savePlayerStoreToClientData((state as { playerStore: PlayerRecord[] }).playerStore);
    },
  });
};
