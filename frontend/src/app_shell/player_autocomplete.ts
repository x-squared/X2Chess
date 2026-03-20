import type { PlayerRecord } from "./app_state";

/**
 * Player Autocomplete module.
 *
 * Integration API:
 * - Primary exports from this module: `createPlayerAutocompleteCapabilities`.
 *
 * Configuration API:
 * - Configure via `deps`: state, game-info input/suggestion elements, and typed
 *   normalization/suggestion/model callbacks.
 *
 * Communication API:
 * - Reads/writes `state.playerStore` and updates PGN headers through
 *   `applyPgnModelUpdate(...)`; updates suggestion container DOM for each player field.
 */

type PgnModelLike = unknown;

type PlayerAutocompleteState = {
  playerStore: PlayerRecord[];
  pgnModel: PgnModelLike;
};

type PlayerAutocompleteDeps = {
  state: PlayerAutocompleteState;
  gameInfoSuggestionEls: HTMLElement[];
  gameInfoInputs: Array<HTMLInputElement | HTMLSelectElement>;
  playerNameHeaderKeys: readonly string[];
  normalizePlayerRecordsFn: (records: unknown) => PlayerRecord[];
  parsePlayerRecordFn: (name: string) => PlayerRecord | null;
  buildPlayerNameSuggestionsFn: (records: unknown, query: string) => string[];
  normalizeGameInfoHeaderValueFn: (key: string, value: unknown) => string;
  getHeaderValueFn: (model: PgnModelLike, key: string, fallback: string) => string;
  setHeaderValueFn: (model: PgnModelLike, key: string, value: string) => PgnModelLike;
  ensureRequiredPgnHeadersFn: (model: PgnModelLike) => PgnModelLike;
  applyPgnModelUpdate: (model: PgnModelLike) => void;
  loadPlayerStore: () => Promise<void>;
  savePlayerStore: () => Promise<void>;
};

type PlayerAutocompleteCapabilities = {
  commitPlayerNameInput: (key: string, value: string) => void;
  handlePlayerNameInput: (key: string, input: HTMLInputElement, event?: InputEvent | null) => void;
  handlePlayerNameKeydown: (event: KeyboardEvent, key: string, input: HTMLInputElement) => void;
  hidePlayerSuggestions: (key: string) => void;
  isPlayerNameField: (key: string) => boolean;
  loadPlayerStore: () => Promise<void>;
  onSuggestionContainerMouseDown: (fieldKey: string, event: MouseEvent) => void;
  pickPlayerNameSuggestion: (key: string, playerName: string) => void;
};

/**
 * Create player autocomplete capabilities for game-info name fields.
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
}: PlayerAutocompleteDeps): PlayerAutocompleteCapabilities => {
  const playerNameKeySet: Set<string> = new Set(
    (Array.isArray(playerNameHeaderKeys) ? playerNameHeaderKeys : []).map((value: string): string => String(value)),
  );

  const gameInfoSuggestionByKey: Map<string, HTMLElement> = new Map(
    (Array.isArray(gameInfoSuggestionEls) ? gameInfoSuggestionEls : [])
      .filter((el: HTMLElement): boolean => el instanceof HTMLElement && Boolean(el.dataset.playerSuggestionsFor))
      .map((el: HTMLElement): [string, HTMLElement] => [String(el.dataset.playerSuggestionsFor), el]),
  );

  const gameInfoInputByKey: Map<string, HTMLInputElement | HTMLSelectElement> = new Map(
    (Array.isArray(gameInfoInputs) ? gameInfoInputs : [])
      .filter((el: HTMLInputElement | HTMLSelectElement): boolean => Boolean(el.dataset.headerKey))
      .map((el: HTMLInputElement | HTMLSelectElement): [string, HTMLInputElement | HTMLSelectElement] => [String(el.dataset.headerKey), el]),
  );

  const isPlayerNameField = (key: string): boolean => playerNameKeySet.has(String(key || ""));

  const hidePlayerSuggestions = (key: string): void => {
    const container: HTMLElement | undefined = gameInfoSuggestionByKey.get(String(key));
    if (!container) return;
    container.innerHTML = "";
    container.hidden = true;
  };

  const renderPlayerSuggestions = (key: string, suggestions: string[]): void => {
    const container: HTMLElement | undefined = gameInfoSuggestionByKey.get(String(key));
    if (!container) return;
    const entries: string[] = Array.isArray(suggestions) ? suggestions : [];
    if (entries.length === 0) {
      hidePlayerSuggestions(key);
      return;
    }
    container.innerHTML = entries
      .map((name: string): string => (
        `<button class="game-info-player-suggestion" type="button" data-player-suggestion-value="${name}">${name}</button>`
      ))
      .join("");
    container.hidden = false;
  };

  const maybePersistNewPlayer = async (normalizedName: string): Promise<void> => {
    const names: string[] = String(normalizedName ?? "")
      .split(":")
      .map((entry: string): string => String(entry ?? "").trim())
      .filter(Boolean);

    const parsedEntries: PlayerRecord[] = names
      .map((name: string): PlayerRecord | null => parsePlayerRecordFn(name))
      .filter((value: PlayerRecord | null): value is PlayerRecord => value !== null);

    if (parsedEntries.length === 0) return;

    const nextStore: PlayerRecord[] = normalizePlayerRecordsFn([
      ...(Array.isArray(state.playerStore) ? state.playerStore : []),
      ...parsedEntries,
    ]);

    const currentLength: number = Array.isArray(state.playerStore) ? state.playerStore.length : 0;
    const changed: boolean = nextStore.length !== currentLength;
    state.playerStore = nextStore;
    if (changed) await savePlayerStore();
  };

  const commitHeaderValue = (key: string, normalizedValue: string): void => {
    const currentValue: string = normalizeGameInfoHeaderValueFn(
      key,
      getHeaderValueFn(state.pgnModel, key, ""),
    );
    if (currentValue === normalizedValue) return;
    const nextModel: PgnModelLike = setHeaderValueFn(state.pgnModel, key, normalizedValue);
    applyPgnModelUpdate(ensureRequiredPgnHeadersFn(nextModel));
  };

  const handlePlayerNameInput = (key: string, input: HTMLInputElement, event: InputEvent | null = null): void => {
    const selectionStart: number = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
    const fullBeforeCaret: string = input.value.slice(0, selectionStart);
    const segmentStart: number = String(key) === "Annotator" ? (fullBeforeCaret.lastIndexOf(":") + 1) : 0;
    const typedSegment: string = input.value.slice(segmentStart, selectionStart);
    const typedValue: string = typedSegment.trim();
    const suggestions: string[] = buildPlayerNameSuggestionsFn(state.playerStore, typedValue);
    renderPlayerSuggestions(key, suggestions);
    if (!typedValue || suggestions.length === 0) return;

    const inputType: string = event instanceof InputEvent ? String(event.inputType || "") : "";
    const isDeleteAction: boolean = inputType.startsWith("delete");
    if (isDeleteAction) return;

    const best: string = suggestions[0];
    if (!best.toLowerCase().startsWith(typedValue.toLowerCase()) || best.length <= typedValue.length) return;

    const isCaretAtEnd: boolean = selectionStart === input.value.length;
    if (!isCaretAtEnd) return;

    if (String(key) === "Annotator") {
      const beforeSegment: string = input.value.slice(0, segmentStart);
      const afterSegment: string = input.value.slice(selectionStart);
      input.value = `${beforeSegment}${best}${afterSegment}`;
      const highlightStart: number = beforeSegment.length + typedSegment.length;
      const highlightEnd: number = beforeSegment.length + best.length;
      input.setSelectionRange(highlightStart, highlightEnd);
      return;
    }

    input.value = best;
    input.setSelectionRange(typedValue.length, best.length);
  };

  const handlePlayerNameKeydown = (event: KeyboardEvent, key: string, input: HTMLInputElement): void => {
    if (event.key === "Escape") {
      hidePlayerSuggestions(key);
      return;
    }

    if (event.key === "Tab") {
      const hasSelection: boolean = input.selectionStart !== input.selectionEnd;
      if (hasSelection) {
        event.preventDefault();
        const end: number = input.value.length;
        input.setSelectionRange(end, end);
      }
      hidePlayerSuggestions(key);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const end: number = input.value.length;
      input.setSelectionRange(end, end);
      hidePlayerSuggestions(key);
      const normalizedName: string = normalizeGameInfoHeaderValueFn(key, input.value);
      input.value = normalizedName;
      void maybePersistNewPlayer(normalizedName);
      commitHeaderValue(key, normalizedName);
    }
  };

  const commitPlayerNameInput = (key: string, value: string): void => {
    hidePlayerSuggestions(key);
    const input: HTMLInputElement | HTMLSelectElement | undefined = gameInfoInputByKey.get(String(key));
    const normalizedName: string = normalizeGameInfoHeaderValueFn(key, value);
    if (input instanceof HTMLInputElement) input.value = normalizedName;
    void maybePersistNewPlayer(normalizedName);
    commitHeaderValue(key, normalizedName);
  };

  const replaceCurrentAnnotatorSegment = (input: HTMLInputElement, pickedName: string): void => {
    const selectionStart: number = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
    const selectionEnd: number = typeof input.selectionEnd === "number" ? input.selectionEnd : selectionStart;
    const beforeCaret: string = input.value.slice(0, selectionStart);
    const segmentStart: number = beforeCaret.lastIndexOf(":") + 1;
    const nextSeparator: number = input.value.indexOf(":", selectionEnd);
    const segmentEnd: number = nextSeparator >= 0 ? nextSeparator : input.value.length;
    const beforeSegment: string = input.value.slice(0, segmentStart);
    const afterSegment: string = input.value.slice(segmentEnd);
    const replacement: string = normalizeGameInfoHeaderValueFn("Annotator", pickedName);
    input.value = `${beforeSegment}${replacement}${afterSegment}`;
    const caret: number = beforeSegment.length + replacement.length;
    input.setSelectionRange(caret, caret);
  };

  const pickPlayerNameSuggestion = (key: string, playerName: string): void => {
    const input: HTMLInputElement | HTMLSelectElement | undefined = gameInfoInputByKey.get(String(key));
    if (!(input instanceof HTMLInputElement)) return;

    if (String(key) === "Annotator") {
      replaceCurrentAnnotatorSegment(input, playerName);
    } else {
      input.value = normalizeGameInfoHeaderValueFn(key, playerName);
      const end: number = input.value.length;
      input.setSelectionRange(end, end);
    }

    commitHeaderValue(key, input.value);
    hidePlayerSuggestions(key);
  };

  const onSuggestionContainerMouseDown = (fieldKey: string, event: MouseEvent): void => {
    event.preventDefault();
    const target: EventTarget | null = event.target;
    if (!(target instanceof HTMLElement)) return;
    const optionEl: HTMLElement | null = target.closest("[data-player-suggestion-value]");
    if (!(optionEl instanceof HTMLElement)) return;
    const playerName: string | undefined = optionEl.dataset.playerSuggestionValue;
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
