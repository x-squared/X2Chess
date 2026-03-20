import { createPlayerAutocompleteCapabilities } from "../app_shell/player_autocomplete";

type PlayerAutocompleteDeps = Parameters<typeof createPlayerAutocompleteCapabilities>[0];

type PlayerAutocompleteBootstrapDeps = {
  state: PlayerAutocompleteDeps["state"];
  gameInfoSuggestionEls: PlayerAutocompleteDeps["gameInfoSuggestionEls"];
  gameInfoInputs: PlayerAutocompleteDeps["gameInfoInputs"];
  playerNameHeaderKeys: PlayerAutocompleteDeps["playerNameHeaderKeys"];
  normalizePlayerRecordsFn: PlayerAutocompleteDeps["normalizePlayerRecordsFn"];
  parsePlayerRecordFn: PlayerAutocompleteDeps["parsePlayerRecordFn"];
  buildPlayerNameSuggestionsFn: PlayerAutocompleteDeps["buildPlayerNameSuggestionsFn"];
  normalizeGameInfoHeaderValueFn: PlayerAutocompleteDeps["normalizeGameInfoHeaderValueFn"];
  getHeaderValueFn: PlayerAutocompleteDeps["getHeaderValueFn"];
  setHeaderValueFn: PlayerAutocompleteDeps["setHeaderValueFn"];
  ensureRequiredPgnHeadersFn: PlayerAutocompleteDeps["ensureRequiredPgnHeadersFn"];
  applyPgnModelUpdate: (nextModel: unknown) => void;
  loadPlayerStore: PlayerAutocompleteDeps["loadPlayerStore"];
  savePlayerStore: PlayerAutocompleteDeps["savePlayerStore"];
};

export const createPlayerAutocompleteBootstrap = ({
  state,
  gameInfoSuggestionEls,
  gameInfoInputs,
  playerNameHeaderKeys,
  normalizePlayerRecordsFn,
  parsePlayerRecordFn,
  buildPlayerNameSuggestionsFn,
  normalizeGameInfoHeaderValueFn,
  getHeaderValueFn,
  setHeaderValueFn,
  ensureRequiredPgnHeadersFn,
  applyPgnModelUpdate,
  loadPlayerStore,
  savePlayerStore,
}: PlayerAutocompleteBootstrapDeps): ReturnType<typeof createPlayerAutocompleteCapabilities> => {
  return createPlayerAutocompleteCapabilities({
    state,
    gameInfoSuggestionEls,
    gameInfoInputs,
    playerNameHeaderKeys,
    normalizePlayerRecordsFn,
    parsePlayerRecordFn,
    buildPlayerNameSuggestionsFn,
    normalizeGameInfoHeaderValueFn,
    getHeaderValueFn,
    setHeaderValueFn,
    ensureRequiredPgnHeadersFn,
    applyPgnModelUpdate,
    loadPlayerStore,
    savePlayerStore,
  });
};
