/**
 * App shell game-info component.
 *
 * Integration API:
 * - Exposes `GAME_INFO_HEADER_FIELDS` and `PLAYER_NAME_HEADER_KEYS` for layout
 *   generation and input wiring.
 * - Exposes render/sync helpers used each frame:
 *   - `renderGameInfoSummary(...)`
 *   - `syncGameInfoEditorUi(...)`
 *   - `syncGameInfoEditorValues(...)`
 * - Exposes normalization helpers for header/player name handling.
 *
 * Configuration API:
 * - Configure editable tags, control types, placeholders, and option lists via
 *   `GAME_INFO_HEADER_FIELDS`.
 * - ECO lookup behavior is configured through model helpers (`resolveEcoOpeningName`).
 *
 * Communication API:
 * - Reads header values from `pgnModel`.
 * - Writes summary/editor values to supplied DOM refs.
 * - Does not bind events itself; wiring modules call these helpers.
 */

import {
  ECO_OPENING_CODES,
  REQUIRED_PGN_TAG_DEFAULTS,
  getHeaderValue,
  resolveEcoOpeningName,
} from "../model";

/**
 * Header keys that are player-name fields and use player-store autocomplete.
 */
export const PLAYER_NAME_HEADER_KEYS = ["White", "Black", "Annotator"];

/**
 * Editable game-info header fields rendered in the fold-down editor.
 */
export const GAME_INFO_HEADER_FIELDS = [
  { key: "Event", label: "Event", control: "text" },
  { key: "Site", label: "Site", control: "text" },
  { key: "Round", label: "Round", control: "text" },
  {
    key: "Date",
    label: "Date",
    control: "text",
    placeholder: "dd.mm.yyyy",
  },
  {
    key: "White",
    label: "White",
    control: "text",
    placeholder: "Last-name, First-name",
  },
  {
    key: "Black",
    label: "Black",
    control: "text",
    placeholder: "Last-name, First-name",
  },
  {
    key: "Result",
    label: "Result",
    control: "select",
    options: ["*", "1-0", "0-1", "1/2-1/2"],
  },
  {
    key: "ECO",
    label: "ECO",
    control: "select",
    options: ["", ...ECO_OPENING_CODES],
  },
  { key: "Opening", label: "Opening", control: "text" },
  {
    key: "WhiteElo",
    label: "WhiteElo",
    control: "number",
    placeholder: "integer",
  },
  {
    key: "BlackElo",
    label: "BlackElo",
    control: "number",
    placeholder: "integer",
  },
  { key: "TimeControl", label: "TimeControl", control: "text" },
  { key: "Termination", label: "Termination", control: "text" },
  {
    key: "Annotator",
    label: "Annotator",
    control: "text",
    placeholder: "Last-name, First-name : Last-name, First-name",
  },
];

const FALLBACK_VALUE = "-";

const asDisplay = (value, fallback = FALLBACK_VALUE) => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const normalizePersonName = (rawValue) => {
  const source = String(rawValue ?? "").trim();
  if (!source) return "";
  if (source === "?") return source;

  if (source.includes(",")) {
    const [lastRaw, firstRaw = ""] = source.split(",", 2);
    const last = lastRaw.trim();
    const first = firstRaw.trim();
    if (!last) return first;
    return first ? `${last}, ${first}` : last;
  }

  if (source.includes("/")) {
    const [firstRaw, lastRaw = ""] = source.split("/", 2);
    const first = firstRaw.trim();
    const last = lastRaw.trim();
    if (!last) return first;
    return first ? `${last}, ${first}` : last;
  }

  const words = source.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return source;
  const last = words[words.length - 1];
  const first = words.slice(0, -1).join(" ");
  return `${last}, ${first}`.trim();
};

const normalizeAnnotatorList = (rawValue) => {
  const source = String(rawValue ?? "").trim();
  if (!source) return "";
  return source
    .split(":")
    .map((entry) => normalizePersonName(entry))
    .filter(Boolean)
    .join(":");
};

/**
 * Parse a normalized player name into structured record fields.
 *
 * @param {string} rawValue - Name text, expected `Last-name, First-name` after normalization.
 * @returns {{lastName: string, firstName: string}|null} Player record or null when invalid.
 */
export const parsePlayerRecord = (rawValue) => {
  const normalized = normalizePersonName(rawValue);
  if (!normalized || normalized === "?") return null;
  const [lastRaw, firstRaw = ""] = normalized.split(",", 2);
  const lastName = String(lastRaw ?? "").trim();
  const firstName = String(firstRaw ?? "").trim();
  if (!lastName) return null;
  return { lastName, firstName };
};

/**
 * Format structured player record as display name.
 *
 * @param {{lastName?: string, firstName?: string}} player - Player record.
 * @returns {string} Formatted `Last-name, First-name` (or last name only).
 */
export const formatPlayerRecordName = (player) => {
  const lastName = String(player?.lastName ?? "").trim();
  const firstName = String(player?.firstName ?? "").trim();
  if (!lastName) return "";
  return firstName ? `${lastName}, ${firstName}` : lastName;
};

/**
 * Normalize, deduplicate, and sort player records.
 *
 * @param {Array<object|string>} records - Raw player records.
 * @returns {Array<{lastName: string, firstName: string}>} Normalized unique list.
 */
export const normalizePlayerRecords = (records) => {
  const byKey = new Map();
  (Array.isArray(records) ? records : []).forEach((entry) => {
    const maybeName = typeof entry === "string"
      ? entry
      : formatPlayerRecordName({
        lastName: entry?.lastName || entry?.name || "",
        firstName: entry?.firstName || "",
      });
    const parsed = parsePlayerRecord(maybeName);
    if (!parsed) return;
    const key = `${parsed.lastName.toLowerCase()}|${parsed.firstName.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, parsed);
  });
  return [...byKey.values()].sort((left, right) => {
    const lastCmp = left.lastName.localeCompare(right.lastName);
    if (lastCmp !== 0) return lastCmp;
    return left.firstName.localeCompare(right.firstName);
  });
};

const scorePlayerSuggestion = (normalizedQuery, playerName) => {
  const candidate = playerName.toLowerCase();
  if (!normalizedQuery) return 0;
  if (candidate.startsWith(normalizedQuery)) return 500 + normalizedQuery.length;
  const commaIndex = candidate.indexOf(",");
  const lastName = commaIndex >= 0 ? candidate.slice(0, commaIndex).trim() : candidate;
  const firstName = commaIndex >= 0 ? candidate.slice(commaIndex + 1).trim() : "";
  if (lastName.startsWith(normalizedQuery)) return 420 + normalizedQuery.length;
  if (firstName.startsWith(normalizedQuery)) return 360 + normalizedQuery.length;
  if (candidate.includes(normalizedQuery)) return 200 + normalizedQuery.length;
  return -1;
};

/**
 * Build ranked player-name suggestions for input query.
 *
 * @param {Array<{lastName: string, firstName: string}>} playerRecords - Player store.
 * @param {string} query - Current user query.
 * @param {number} [limit=8] - Max results.
 * @returns {string[]} Ranked suggested names.
 */
export const buildPlayerNameSuggestions = (playerRecords, query, limit = 8) => {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  if (!normalizedQuery) return [];
  return normalizePlayerRecords(playerRecords)
    .map((player) => formatPlayerRecordName(player))
    .map((name) => ({ name, score: scorePlayerSuggestion(normalizedQuery, name) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, Math.max(1, limit))
    .map((entry) => entry.name);
};

const abbreviateFirstNameInDisplay = (normalizedLastFirstName) => {
  const source = String(normalizedLastFirstName ?? "").trim();
  if (!source.includes(",")) return source;
  const [lastRaw, firstRaw = ""] = source.split(",", 2);
  const last = lastRaw.trim();
  const first = firstRaw.trim();
  if (!first) return last || source;
  return `${last}, ${first.charAt(0)}.`;
};

const formatPlayerNameForHeader = (rawValue) => {
  const normalized = normalizePersonName(rawValue);
  if (!normalized) return "";
  const MAX_HEADER_NAME_LENGTH = 20;
  if (normalized.length <= MAX_HEADER_NAME_LENGTH) return normalized;
  return abbreviateFirstNameInDisplay(normalized);
};

const getLastNameFromNormalizedPersonName = (normalizedName) => {
  const source = String(normalizedName ?? "").trim();
  if (!source) return "";
  if (source.includes(",")) {
    return source.split(",", 2)[0].trim();
  }
  return source;
};

const formatPlayersSummaryForHeader = (whiteRaw, blackRaw) => {
  const whiteFormatted = formatPlayerNameForHeader(whiteRaw);
  const blackFormatted = formatPlayerNameForHeader(blackRaw);
  const fullPair = [whiteFormatted, blackFormatted].filter(Boolean).join(" - ").trim();
  if (!fullPair) return "";
  const MAX_PAIR_LENGTH = 42;
  if (fullPair.length <= MAX_PAIR_LENGTH) return fullPair;

  // Preserve both last names even when names are very long.
  const whiteLast = getLastNameFromNormalizedPersonName(normalizePersonName(whiteRaw));
  const blackLast = getLastNameFromNormalizedPersonName(normalizePersonName(blackRaw));
  return [whiteLast, blackLast].filter(Boolean).join(" - ").trim();
};

const normalizeDateValue = (rawValue) => {
  const source = String(rawValue ?? "").trim();
  if (!source) return "";
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(source)) return source;
  const ymdMatch = source.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (ymdMatch) {
    const [, yyyy, mm, dd] = ymdMatch;
    return `${dd}.${mm}.${yyyy}`;
  }
  return source;
};

const normalizeIntegerValue = (rawValue) => {
  const source = String(rawValue ?? "").trim();
  if (!source) return "";
  const digitsOnly = source.replace(/[^\d]/g, "");
  if (!digitsOnly) return "";
  return String(Number.parseInt(digitsOnly, 10));
};

/**
 * Normalize raw game-info field value based on field/tag semantics.
 *
 * @param {string} key - PGN header key.
 * @param {string} rawValue - Raw form value.
 * @returns {string} Normalized value.
 */
export const normalizeGameInfoHeaderValue = (key, rawValue) => {
  if (key === "White" || key === "Black") {
    return normalizePersonName(rawValue);
  }
  if (key === "Annotator") return normalizeAnnotatorList(rawValue);
  if (key === "Date") return normalizeDateValue(rawValue);
  if (key === "WhiteElo" || key === "BlackElo") return normalizeIntegerValue(rawValue);
  if (key === "Result" || key === "ECO") return String(rawValue ?? "").trim().toUpperCase();
  return String(rawValue ?? "").trim();
};

/**
 * Render compact game-info summary values.
 *
 * @param {object} deps - Render dependencies.
 * @param {object} deps.pgnModel - Current PGN model.
 * @param {object} deps.els - Summary DOM refs.
 * @param {Function} deps.t - Translation callback `(key, fallback) => string`.
 */
export const renderGameInfoSummary = ({ pgnModel, els, t }) => {
  const whiteRaw = getHeaderValue(pgnModel, "White", "");
  const blackRaw = getHeaderValue(pgnModel, "Black", "");
  const playersSummary = formatPlayersSummaryForHeader(whiteRaw, blackRaw);
  const event = getHeaderValue(pgnModel, "Event", "");
  const date = normalizeGameInfoHeaderValue("Date", getHeaderValue(pgnModel, "Date", ""));
  const eco = getHeaderValue(pgnModel, "ECO", "");
  const openingNameRaw = getHeaderValue(pgnModel, "Opening", "");
  const openingName = openingNameRaw || resolveEcoOpeningName(eco);
  const openingSummary = [eco, openingName].filter(Boolean).join(" ").trim();

  if (els.gameInfoPlayersValueEl) {
    els.gameInfoPlayersValueEl.textContent = asDisplay(
      playersSummary,
      t("gameInfo.players.empty", "-"),
    );
  }
  if (els.gameInfoEventValueEl) {
    els.gameInfoEventValueEl.textContent = asDisplay(event, t("gameInfo.event.empty", "-"));
  }
  if (els.gameInfoDateValueEl) {
    els.gameInfoDateValueEl.textContent = asDisplay(date, t("gameInfo.date.empty", "-"));
  }
  if (els.gameInfoOpeningValueEl) {
    els.gameInfoOpeningValueEl.textContent = asDisplay(openingSummary, t("gameInfo.opening.empty", "-"));
  }
};

/**
 * Sync open/closed UI state for fold-down game-info editor panel.
 *
 * @param {object} deps - UI state dependencies.
 * @param {object} deps.state - Shared app state.
 * @param {object} deps.els - Editor-related DOM refs.
 */
export const syncGameInfoEditorUi = ({ state, els }) => {
  const isOpen = Boolean(state.isGameInfoEditorOpen);
  const cardEl = els.gameInfoEditorEl?.closest(".game-info-card");
  if (cardEl) {
    cardEl.classList.toggle("editor-open", isOpen);
  }
  if (els.gameInfoEditorEl) {
    els.gameInfoEditorEl.hidden = !isOpen;
    els.gameInfoEditorEl.classList.toggle("open", isOpen);
  }
  if (els.btnGameInfoEdit) {
    els.btnGameInfoEdit.setAttribute("aria-expanded", isOpen ? "true" : "false");
    const iconEl = els.btnGameInfoEdit.querySelector("span[aria-hidden='true']");
    if (iconEl) {
      iconEl.textContent = isOpen ? "▲" : "▼";
    }
  }
};

/**
 * Sync editable game-info field values from model headers.
 *
 * @param {object} deps - Value-sync dependencies.
 * @param {object} deps.pgnModel - Current PGN model.
 * @param {object} deps.els - Form DOM refs.
 */
export const syncGameInfoEditorValues = ({ pgnModel, els }) => {
  if (!Array.isArray(els.gameInfoInputs)) return;
  const eco = getHeaderValue(pgnModel, "ECO", "");
  for (const input of els.gameInfoInputs) {
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) continue;
    const key = input.dataset.headerKey;
    if (!key) continue;
    let nextValue = getHeaderValue(pgnModel, key, "");
    if (!nextValue && Object.hasOwn(REQUIRED_PGN_TAG_DEFAULTS, key)) {
      nextValue = REQUIRED_PGN_TAG_DEFAULTS[key];
    }
    nextValue = normalizeGameInfoHeaderValue(key, nextValue);
    if (key === "Opening" && !nextValue) {
      nextValue = resolveEcoOpeningName(eco);
    }
    if (input.value !== nextValue) input.value = nextValue;
  }
};
