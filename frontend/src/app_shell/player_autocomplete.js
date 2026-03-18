/**
 * App shell player-autocomplete component.
 *
 * Integration API:
 * - `createPlayerAutocompleteCapabilities(deps)` returns suggestion and commit handlers
 *   for player-name fields (`White`, `Black`, `Annotator`).
 *
 * Configuration API:
 * - Caller provides player-name keys, normalization/query helpers, and persistence callbacks.
 *
 * Communication API:
 * - Reads/writes field values through provided DOM refs and callback functions.
 * - Persists player-store updates through provided save/load callbacks.
 */

/**
 * Create player autocomplete capabilities for game-info name fields.
 *
 * @param {object} deps - Component dependencies.
 * @param {object} deps.state - Shared app state.
 * @param {Array<HTMLElement>} deps.gameInfoSuggestionEls - Suggestion container elements.
 * @param {Array<HTMLInputElement|HTMLSelectElement>} deps.gameInfoInputs - Header input/select elements.
 * @param {string[]} deps.playerNameHeaderKeys - Header keys treated as player-name fields.
 * @param {Function} deps.normalizePlayerRecordsFn - `(records) => normalizedRecords`.
 * @param {Function} deps.parsePlayerRecordFn - `(name) => {lastName, firstName} | null`.
 * @param {Function} deps.buildPlayerNameSuggestionsFn - `(records, query) => string[]`.
 * @param {Function} deps.normalizeGameInfoHeaderValueFn - `(key, value) => normalized`.
 * @param {Function} deps.getHeaderValueFn - `(model, key, fallback) => string`.
 * @param {Function} deps.setHeaderValueFn - `(model, key, value) => model`.
 * @param {Function} deps.ensureRequiredPgnHeadersFn - `(model) => model`.
 * @param {Function} deps.applyPgnModelUpdate - `(model) => void`.
 * @param {Function} deps.loadPlayerStore - `() => Promise<void>`.
 * @param {Function} deps.savePlayerStore - `() => Promise<void>`.
 * @returns {object} Player autocomplete capabilities.
 */
export const createPlayerAutocompleteCapabilities = ({
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
}) => {
  const playerNameKeySet = new Set((Array.isArray(playerNameHeaderKeys) ? playerNameHeaderKeys : []).map((value) => String(value)));
  const gameInfoSuggestionByKey = new Map(
    (Array.isArray(gameInfoSuggestionEls) ? gameInfoSuggestionEls : [])
      .filter((el) => el instanceof HTMLElement && el.dataset.playerSuggestionsFor)
      .map((el) => [String(el.dataset.playerSuggestionsFor), el]),
  );
  const gameInfoInputByKey = new Map(
    (Array.isArray(gameInfoInputs) ? gameInfoInputs : [])
      .filter((el) => (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) && el.dataset.headerKey)
      .map((el) => [String(el.dataset.headerKey), el]),
  );

  const isPlayerNameField = (key) => playerNameKeySet.has(String(key || ""));

  const hidePlayerSuggestions = (key) => {
    const container = gameInfoSuggestionByKey.get(String(key));
    if (!container) return;
    container.innerHTML = "";
    container.hidden = true;
  };

  const renderPlayerSuggestions = (key, suggestions) => {
    const container = gameInfoSuggestionByKey.get(String(key));
    if (!container) return;
    const entries = Array.isArray(suggestions) ? suggestions : [];
    if (entries.length === 0) {
      hidePlayerSuggestions(key);
      return;
    }
    container.innerHTML = entries.map((name) => (
      `<button class="game-info-player-suggestion" type="button" data-player-suggestion-value="${name}">${name}</button>`
    )).join("");
    container.hidden = false;
  };

  const maybePersistNewPlayer = async (normalizedName) => {
    const names = String(normalizedName ?? "")
      .split(":")
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
    const parsedEntries = names
      .map((name) => parsePlayerRecordFn(name))
      .filter(Boolean);
    if (parsedEntries.length === 0) return;
    const nextStore = normalizePlayerRecordsFn([
      ...(Array.isArray(state.playerStore) ? state.playerStore : []),
      ...parsedEntries,
    ]);
    const changed = nextStore.length !== (Array.isArray(state.playerStore) ? state.playerStore.length : 0);
    state.playerStore = nextStore;
    if (changed) await savePlayerStore();
  };

  const commitHeaderValue = (key, normalizedValue) => {
    const currentValue = normalizeGameInfoHeaderValueFn(
      key,
      getHeaderValueFn(state.pgnModel, key, ""),
    );
    if (currentValue === normalizedValue) return;
    const nextModel = setHeaderValueFn(state.pgnModel, key, normalizedValue);
    applyPgnModelUpdate(ensureRequiredPgnHeadersFn(nextModel));
  };

  const handlePlayerNameInput = (key, input, event = null) => {
    if (!(input instanceof HTMLInputElement)) return;
    const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
    const fullBeforeCaret = input.value.slice(0, selectionStart);
    const segmentStart = String(key) === "Annotator" ? (fullBeforeCaret.lastIndexOf(":") + 1) : 0;
    const typedSegment = input.value.slice(segmentStart, selectionStart);
    const typedValue = typedSegment.trim();
    const suggestions = buildPlayerNameSuggestionsFn(state.playerStore, typedValue);
    renderPlayerSuggestions(key, suggestions);
    if (!typedValue || suggestions.length === 0) return;
    const inputType = event instanceof InputEvent ? String(event.inputType || "") : "";
    const isDeleteAction = inputType.startsWith("delete");
    if (isDeleteAction) return;
    const best = suggestions[0];
    if (!best.toLowerCase().startsWith(typedValue.toLowerCase()) || best.length <= typedValue.length) return;
    const isCaretAtEnd = selectionStart === input.value.length;
    if (!isCaretAtEnd) return;
    if (String(key) === "Annotator") {
      const beforeSegment = input.value.slice(0, segmentStart);
      const afterSegment = input.value.slice(selectionStart);
      input.value = `${beforeSegment}${best}${afterSegment}`;
      const highlightStart = beforeSegment.length + typedSegment.length;
      const highlightEnd = beforeSegment.length + best.length;
      input.setSelectionRange(highlightStart, highlightEnd);
      return;
    }
    input.value = best;
    input.setSelectionRange(typedValue.length, best.length);
  };

  const handlePlayerNameKeydown = (event, key, input) => {
    if (!(input instanceof HTMLInputElement)) return;
    if (event.key === "Escape") {
      hidePlayerSuggestions(key);
      return;
    }
    if (event.key === "Tab") {
      const hasSelection = input.selectionStart !== input.selectionEnd;
      if (hasSelection) {
        event.preventDefault();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      }
      hidePlayerSuggestions(key);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const end = input.value.length;
      input.setSelectionRange(end, end);
      hidePlayerSuggestions(key);
      const normalizedName = normalizeGameInfoHeaderValueFn(key, input.value);
      input.value = normalizedName;
      void maybePersistNewPlayer(normalizedName);
      commitHeaderValue(key, normalizedName);
    }
  };

  const commitPlayerNameInput = (key, value) => {
    hidePlayerSuggestions(key);
    const input = gameInfoInputByKey.get(String(key));
    const normalizedName = normalizeGameInfoHeaderValueFn(key, value);
    if (input instanceof HTMLInputElement) input.value = normalizedName;
    void maybePersistNewPlayer(normalizedName);
    commitHeaderValue(key, normalizedName);
  };

  const replaceCurrentAnnotatorSegment = (input, pickedName) => {
    const selectionStart = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
    const selectionEnd = typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
    const beforeCaret = input.value.slice(0, selectionStart);
    const segmentStart = beforeCaret.lastIndexOf(":") + 1;
    const nextSeparator = input.value.indexOf(":", selectionEnd);
    const segmentEnd = nextSeparator >= 0 ? nextSeparator : input.value.length;
    const beforeSegment = input.value.slice(0, segmentStart);
    const afterSegment = input.value.slice(segmentEnd);
    const replacement = normalizeGameInfoHeaderValueFn("Annotator", pickedName);
    input.value = `${beforeSegment}${replacement}${afterSegment}`;
    const caret = beforeSegment.length + replacement.length;
    input.setSelectionRange(caret, caret);
  };

  const pickPlayerNameSuggestion = (key, playerName) => {
    const input = gameInfoInputByKey.get(String(key));
    if (!(input instanceof HTMLInputElement)) return;
    if (String(key) === "Annotator") {
      replaceCurrentAnnotatorSegment(input, playerName);
    } else {
      input.value = normalizeGameInfoHeaderValueFn(key, playerName);
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    commitHeaderValue(key, input.value);
    hidePlayerSuggestions(key);
  };

  const onSuggestionContainerMouseDown = (fieldKey, event) => {
    event.preventDefault();
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const optionEl = target.closest("[data-player-suggestion-value]");
    if (!(optionEl instanceof HTMLElement)) return;
    const playerName = optionEl.dataset.playerSuggestionValue;
    if (!playerName) return;
    pickPlayerNameSuggestion(fieldKey, playerName);
  };

  return {
    commitPlayerNameInput,
    handlePlayerNameInput,
    handlePlayerNameKeydown,
    hidePlayerSuggestions,
    isPlayerNameField,
    loadPlayerStore,
    onSuggestionContainerMouseDown,
    pickPlayerNameSuggestion,
  };
};
