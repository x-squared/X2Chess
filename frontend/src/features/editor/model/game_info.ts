/**
 * Game Info module.
 *
 * Integration API:
 * - Primary exports from this module: `PLAYER_NAME_HEADER_KEYS`, `GAME_INFO_HEADER_FIELDS`, `parsePlayerRecord`, `formatPlayerRecordName`, `normalizePlayerRecords`, `buildPlayerNameSuggestions`, `normalizeGameInfoHeaderValue`, `renderGameInfoSummary`, ....
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

import {
  ECO_OPENING_CODES,
  REQUIRED_PGN_TAG_DEFAULTS,
  X2_STYLE_HEADER_KEY,
  X2_BOARD_ORIENTATION_HEADER_KEY,
  getHeaderValue,
  normalizeX2StyleValue,
  resolveEcoOpeningName,
} from "../../../model";
import type { PlayerRecord } from "../../../app/shell/model/app_state";

type PgnModelLike = unknown;
type TranslatorFn = (key: string, fallback?: string) => string;
type HeaderKey = string;

type GameInfoInput = HTMLInputElement | HTMLSelectElement;

type GameInfoSummaryEls = {
  gameInfoPlayersValueEl?: HTMLElement | null;
  gameInfoEventValueEl?: HTMLElement | null;
  gameInfoDateValueEl?: HTMLElement | null;
  gameInfoOpeningValueEl?: HTMLElement | null;
};

type GameInfoEditorEls = {
  gameInfoEditorEl?: HTMLElement | null;
  btnGameInfoEdit?: HTMLElement | null;
  gameInfoInputs?: Element[] | null;
};

type GameInfoStateLike = {
  isGameInfoEditorOpen: boolean;
};

/**
 * Header keys that are player-name fields and use player-store autocomplete.
 */
export const PLAYER_NAME_HEADER_KEYS: readonly HeaderKey[] = ["White", "Black", "Annotator"];

// Declared here so GAME_INFO_HEADER_FIELDS can reference it in the Date entry.
const isPlausibleDateValues = (dd: string, mm: string, yyyy: string): boolean => {
  const d = Number.parseInt(dd, 10);
  const m = Number.parseInt(mm, 10);
  const y = Number.parseInt(yyyy, 10);
  return d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1000 && y <= 2999;
};

/**
 * Returns true when `value` is empty or a structurally valid dd.mm.yyyy date.
 *
 * @param {string} value - Normalized date string.
 * @returns {boolean} Whether the value represents a valid or absent date.
 */
export const isValidNormalizedDate = (value: string): boolean => {
  if (!value) return true;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  return m !== null && isPlausibleDateValues(m[1], m[2], m[3]);
};

/**
 * Editable game-info header fields rendered in the fold-down editor.
 */
type GameInfoField = {
  key: HeaderKey;
  label: string;
  control: "text" | "select" | "number";
  placeholder?: string;
  options?: string[];
  /** Optional display labels for select options keyed by option value. */
  optionLabels?: Record<string, string>;
  validate?: (value: string) => boolean;
};

export const GAME_INFO_HEADER_FIELDS: readonly GameInfoField[] = [
  // Row 1 — players + result
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
  // Row 2 — ratings + event
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
  { key: "Event", label: "Event", control: "text" },
  // Row 3 — opening + termination
  {
    key: "ECO",
    label: "ECO",
    control: "select",
    options: ["", ...ECO_OPENING_CODES],
  },
  { key: "Opening", label: "Opening", control: "text" },
  { key: "Termination", label: "Termination", control: "text" },
  // Row 4 — date + venue
  {
    key: "Date",
    label: "Date",
    control: "text",
    placeholder: "dd.mm.yyyy",
    validate: isValidNormalizedDate,
  },
  { key: "Site", label: "Site", control: "text" },
  { key: "Round", label: "Round", control: "text" },
  // Remaining fields
  { key: "TimeControl", label: "TimeControl", control: "text" },
  {
    key: "Annotator",
    label: "Annotator",
    control: "text",
    placeholder: "Last-name, First-name : Last-name, First-name",
  },
  {
    key: X2_STYLE_HEADER_KEY,
    label: X2_STYLE_HEADER_KEY,
    control: "select",
    options: ["plain", "text", "tree"],
  },
  {
    key: X2_BOARD_ORIENTATION_HEADER_KEY,
    label: X2_BOARD_ORIENTATION_HEADER_KEY,
    control: "select",
    options: ["", "white", "black"],
    optionLabels: { "": "Default Orientation" },
  },
];

const FALLBACK_VALUE = "-";

const asDisplay = (value: unknown, fallback: string = FALLBACK_VALUE): string => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const normalizePersonName = (rawValue: unknown): string => {
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

const normalizeAnnotatorList = (rawValue: unknown): string => {
  const source = String(rawValue ?? "").trim();
  if (!source) return "";
  return source
    .split(":")
    .map((entry: string): string => normalizePersonName(entry))
    .filter(Boolean)
    .join(":");
};

/**
 * Parse a normalized player name into structured record fields.
 *
 * @param {string} rawValue - Name text, expected `Last-name, First-name` after normalization.
 * @returns {{lastName: string, firstName: string}|null} Player record or null when invalid.
 */
export const parsePlayerRecord = (rawValue: unknown): PlayerRecord | null => {
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
export const formatPlayerRecordName = (
  player: Partial<PlayerRecord> | { name?: string } | null | undefined,
): string => {
  const asRecord = player && typeof player === "object" ? player : null;
  const lastName = String(
    asRecord && "lastName" in asRecord ? asRecord.lastName : "",
  ).trim();
  const firstName = String(
    asRecord && "firstName" in asRecord ? asRecord.firstName : "",
  ).trim();
  if (!lastName) return "";
  return firstName ? `${lastName}, ${firstName}` : lastName;
};

/**
 * Normalize, deduplicate, and sort player records.
 *
 * @param {Array<object|string>} records - Raw player records.
 * @returns {Array<{lastName: string, firstName: string}>} Normalized unique list.
 */
export const normalizePlayerRecords = (records: unknown): PlayerRecord[] => {
  const byKey = new Map<string, PlayerRecord>();
  (Array.isArray(records) ? records : []).forEach((entry: unknown): void => {
    const entryObject: Record<string, unknown> | null =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>) : null;
    const maybeName = typeof entry === "string"
      ? entry
      : formatPlayerRecordName({
        lastName: String(entryObject?.lastName ?? entryObject?.name ?? ""),
        firstName: String(entryObject?.firstName ?? ""),
      });
    const parsed = parsePlayerRecord(maybeName);
    if (!parsed) return;
    const key = `${parsed.lastName.toLowerCase()}|${parsed.firstName.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, parsed);
  });
  return [...byKey.values()].sort((left: PlayerRecord, right: PlayerRecord): number => {
    const lastCmp = left.lastName.localeCompare(right.lastName);
    if (lastCmp !== 0) return lastCmp;
    return left.firstName.localeCompare(right.firstName);
  });
};

const scorePlayerSuggestion = (normalizedQuery: string, playerName: string): number => {
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
export const buildPlayerNameSuggestions = (
  playerRecords: unknown,
  query: string,
  limit: number = 8,
): string[] => {
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  if (!normalizedQuery) return [];
  return normalizePlayerRecords(playerRecords)
    .map((player: PlayerRecord): string => formatPlayerRecordName(player))
    .map((name: string): {name: string; score: number} => ({ name, score: scorePlayerSuggestion(normalizedQuery, name) }))
    .filter((entry: {name: string; score: number}): boolean => entry.score >= 0)
    .sort((left: {name: string; score: number}, right: {name: string; score: number}): number => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, Math.max(1, limit))
    .map((entry: {name: string; score: number}): string => entry.name);
};

const abbreviateFirstNameInDisplay = (normalizedLastFirstName: string): string => {
  const source = String(normalizedLastFirstName ?? "").trim();
  if (!source.includes(",")) return source;
  const [lastRaw, firstRaw = ""] = source.split(",", 2);
  const last = lastRaw.trim();
  const first = firstRaw.trim();
  if (!first) return last || source;
  return `${last}, ${first.charAt(0)}.`;
};

const formatPlayerNameForHeader = (rawValue: unknown): string => {
  const normalized = normalizePersonName(rawValue);
  if (!normalized) return "";
  const MAX_HEADER_NAME_LENGTH = 20;
  if (normalized.length <= MAX_HEADER_NAME_LENGTH) return normalized;
  return abbreviateFirstNameInDisplay(normalized);
};

const getLastNameFromNormalizedPersonName = (normalizedName: string): string => {
  const source = String(normalizedName ?? "").trim();
  if (!source) return "";
  if (source.includes(",")) {
    return source.split(",", 2)[0].trim();
  }
  return source;
};

const formatPlayersSummaryForHeader = (whiteRaw: unknown, blackRaw: unknown): string => {
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

const RE_DATE_CANONICAL   = /^\d{2}\.\d{2}\.\d{4}$/;
const RE_DATE_YMD_DOT     = /^(\d{4})\.(\d{2})\.(\d{2})$/;
const RE_DATE_DMY_SEP     = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/;
const RE_DATE_ISO_SEP     = /^(\d{4})[/-](\d{2})[/-](\d{2})$/;
const RE_DATE_SINGLE_DOT  = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const RE_DATE_8DIGITS     = /^(\d{8})$/;
const RE_DATE_MISSING_DOT = /^(\d{1,2})\.(\d{2})(\d{4})$/;

const normalizeDateValue = (rawValue: unknown): string => {
  const source = String(rawValue ?? "").trim();
  if (!source) return "";

  // dd.mm.yyyy — already canonical
  if (RE_DATE_CANONICAL.test(source)) return source;

  // yyyy.mm.dd
  const ymdDot = RE_DATE_YMD_DOT.exec(source);
  if (ymdDot) return `${ymdDot[3]}.${ymdDot[2]}.${ymdDot[1]}`;

  // d(d)/m(m)/yyyy or d(d)-m(m)-yyyy
  const dmySep = RE_DATE_DMY_SEP.exec(source);
  if (dmySep) {
    const dd = dmySep[1].padStart(2, "0"), mm = dmySep[2].padStart(2, "0"), yyyy = dmySep[3];
    return `${dd}.${mm}.${yyyy}`;
  }

  // yyyy-mm-dd or yyyy/mm/dd (ISO)
  const isoSep = RE_DATE_ISO_SEP.exec(source);
  if (isoSep) return `${isoSep[3]}.${isoSep[2]}.${isoSep[1]}`;

  // d.m.yyyy with one or two digits per part
  const singleDot = RE_DATE_SINGLE_DOT.exec(source);
  if (singleDot) {
    const dd = singleDot[1].padStart(2, "0"), mm = singleDot[2].padStart(2, "0"), yyyy = singleDot[3];
    return `${dd}.${mm}.${yyyy}`;
  }

  // 8 pure digits — try ddmmyyyy, then yyyymmdd
  const digits8 = RE_DATE_8DIGITS.exec(source);
  if (digits8) {
    const s = digits8[1];
    const dd1 = s.slice(0, 2), mm1 = s.slice(2, 4), yyyy1 = s.slice(4);
    if (isPlausibleDateValues(dd1, mm1, yyyy1)) return `${dd1}.${mm1}.${yyyy1}`;
    const yyyy2 = s.slice(0, 4), mm2 = s.slice(4, 6), dd2 = s.slice(6);
    if (isPlausibleDateValues(dd2, mm2, yyyy2)) return `${dd2}.${mm2}.${yyyy2}`;
  }

  // dd.mmyyyy — missing second dot (e.g. "01.012026")
  const missingDot = RE_DATE_MISSING_DOT.exec(source);
  if (missingDot) {
    const dd = missingDot[1].padStart(2, "0"), mm = missingDot[2], yyyy = missingDot[3];
    if (isPlausibleDateValues(dd, mm, yyyy)) return `${dd}.${mm}.${yyyy}`;
  }

  return source;
};

const normalizeIntegerValue = (rawValue: unknown): string => {
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
export const normalizeGameInfoHeaderValue = (key: HeaderKey, rawValue: unknown): string => {
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
export const renderGameInfoSummary = ({
  pgnModel,
  els,
  t,
}: {
  pgnModel: PgnModelLike;
  els: GameInfoSummaryEls;
  t: TranslatorFn;
}): void => {
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
export const syncGameInfoEditorUi = ({
  state,
  els,
}: {
  state: GameInfoStateLike;
  els: GameInfoEditorEls;
}): void => {
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
export const syncGameInfoEditorValues = ({
  pgnModel,
  els,
}: {
  pgnModel: PgnModelLike;
  els: GameInfoEditorEls;
}): void => {
  if (!Array.isArray(els.gameInfoInputs)) return;
  const eco = getHeaderValue(pgnModel, "ECO", "");
  const requiredDefaults = REQUIRED_PGN_TAG_DEFAULTS as Record<string, string>;
  for (const input of els.gameInfoInputs) {
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) continue;
    const key = input.dataset.headerKey;
    if (!key) continue;
    let nextValue = getHeaderValue(pgnModel, key, "");
    if (!nextValue && Object.hasOwn(requiredDefaults, key)) {
      nextValue = requiredDefaults[key];
    }
    nextValue = normalizeGameInfoHeaderValue(key, nextValue);
    if (key === "Opening" && !nextValue) {
      nextValue = resolveEcoOpeningName(eco);
    }
    if (key === X2_STYLE_HEADER_KEY) {
      nextValue = normalizeX2StyleValue(nextValue);
    }
    if (input.value !== nextValue) input.value = nextValue;
  }
};
