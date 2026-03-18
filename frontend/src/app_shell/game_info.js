/**
 * App shell game-info component.
 *
 * Integration API:
 * - `GAME_INFO_HEADER_FIELDS` list used by layout/wiring for editable headers.
 * - `renderGameInfoSummary({ pgnModel, els, t })` updates summary labels.
 * - `syncGameInfoEditorUi({ state, els })` syncs fold-down visibility state.
 * - `syncGameInfoEditorValues({ pgnModel, els })` keeps editor field values aligned.
 *
 * Configuration API:
 * - Header keys are defined in `GAME_INFO_HEADER_FIELDS`.
 *
 * Communication API:
 * - Reads model header values and writes text content/value into provided DOM refs.
 */

import { getHeaderValue, resolveEcoOpeningName } from "../model";

/**
 * Editable game-info header fields rendered in the fold-down editor.
 */
export const GAME_INFO_HEADER_FIELDS = [
  { key: "Event", label: "Event" },
  { key: "Site", label: "Site" },
  { key: "Date", label: "Date" },
  { key: "Round", label: "Round" },
  { key: "White", label: "White" },
  { key: "Black", label: "Black" },
  { key: "Result", label: "Result" },
  { key: "ECO", label: "Opening code (ECO)" },
  { key: "Opening", label: "Opening name" },
];

const FALLBACK_VALUE = "-";

const asDisplay = (value, fallback = FALLBACK_VALUE) => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
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
  const white = getHeaderValue(pgnModel, "White", "");
  const black = getHeaderValue(pgnModel, "Black", "");
  const event = getHeaderValue(pgnModel, "Event", "");
  const date = getHeaderValue(pgnModel, "Date", "");
  const eco = getHeaderValue(pgnModel, "ECO", "");
  const openingNameRaw = getHeaderValue(pgnModel, "Opening", "");
  const openingName = openingNameRaw || resolveEcoOpeningName(eco);
  const openingSummary = [eco, openingName].filter(Boolean).join(" ").trim();

  if (els.gameInfoPlayersValueEl) {
    els.gameInfoPlayersValueEl.textContent = asDisplay(
      white || black ? `${asDisplay(white)} - ${asDisplay(black)}` : "",
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
    if (!(input instanceof HTMLInputElement)) continue;
    const key = input.dataset.headerKey;
    if (!key) continue;
    let nextValue = getHeaderValue(pgnModel, key, "");
    if (key === "Opening" && !nextValue) {
      nextValue = resolveEcoOpeningName(eco);
    }
    if (input.value !== nextValue) input.value = nextValue;
  }
};
