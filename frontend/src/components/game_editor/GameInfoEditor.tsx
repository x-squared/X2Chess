/**
 * GameInfoEditor — renders the fold-down PGN header editor and compact summary.
 *
 * Displays a read-only compact summary row (players, event, date, opening) and
 * a collapsible form with all editable PGN header fields.  Field `onChange`
 * events are wired to `services.updateGameInfoHeader` via `useServiceContext()`.
 * The toggle button dispatches `set_game_info_editor_open` directly.
 *
 * Integration API:
 * - `<GameInfoEditor />` — mount inside the app panel; no props required.
 * - Reads `pgnModel` and `isGameInfoEditorOpen` from `AppStoreState` context.
 *
 * Configuration API:
 * - No props.  All data flows through `AppStoreState` context.
 *
 * Communication API:
 * - Outbound: `updateGameInfoHeader` via `useServiceContext()` on field change;
 *   `set_game_info_editor_open` dispatched directly to toggle the editor.
 * - Inbound: re-renders when `pgnModel` or `isGameInfoEditorOpen` change.
 *   The form remounts (via `key`) when the active PGN model ID changes so
 *   `defaultValue` props reflect the newly loaded game.
 */

import { useMemo, useState } from "react";
import type { ReactElement, ChangeEvent } from "react";
import { GAME_INFO_HEADER_FIELDS, PLAYER_NAME_HEADER_KEYS, normalizeGameInfoHeaderValue } from "../../app_shell/game_info";
import { getHeaderValue, REQUIRED_PGN_TAG_DEFAULTS, X2_BOARD_ORIENTATION_HEADER_KEY, resolveEcoOpeningName, normalizeX2StyleValue } from "../../model";
import { useAppContext } from "../../state/app_context";
import { selectIsGameInfoEditorOpen, selectPgnModel, selectBoardFlipped } from "../../state/selectors";
import { useServiceContext } from "../../state/ServiceContext";
import { useTranslator } from "../../hooks/useTranslator";
import { PlayerAutocomplete } from "./PlayerAutocomplete";
import type { PgnModel } from "../../model/pgn_model";
import { GUIDE_IDS } from "../../guide/guide_ids";

// ── Summary helpers ────────────────────────────────────────────────────────────

const FALLBACK: string = "-";

const asDisplay = (value: string, fallback: string = FALLBACK): string =>
  value.trim() || fallback;

const abbreviateFirstName = (normalized: string): string => {
  if (!normalized.includes(",")) return normalized;
  const [last, first = ""] = normalized.split(",", 2);
  const firstTrim: string = first.trim();
  return firstTrim ? `${last.trim()}, ${firstTrim.charAt(0)}.` : last.trim();
};

const formatPlayerForHeader = (raw: string): string => {
  const normalized: string = String(raw ?? "").trim();
  if (!normalized) return "";
  const MAX: number = 20;
  return normalized.length <= MAX ? normalized : abbreviateFirstName(normalized);
};

const buildPlayersSummary = (white: string, black: string): string => {
  const w: string = formatPlayerForHeader(white);
  const b: string = formatPlayerForHeader(black);
  const pair: string = [w, b].filter(Boolean).join(" - ");
  if (!pair) return "";
  if (pair.length <= 42) return pair;
  const wLast: string = w.split(",")[0]?.trim() ?? w;
  const bLast: string = b.split(",")[0]?.trim() ?? b;
  return [wLast, bLast].filter(Boolean).join(" - ");
};

// ── Field helpers ─────────────────────────────────────────────────────────────

type GameInfoFieldDef = (typeof GAME_INFO_HEADER_FIELDS)[number];

const resolveFieldValue = (model: PgnModel | null, field: GameInfoFieldDef): string => {
  const raw: string = getHeaderValue(model, field.key, "");
  const defaults: Record<string, string> = REQUIRED_PGN_TAG_DEFAULTS as Record<string, string>;
  const withDefault: string = raw || (Object.hasOwn(defaults, field.key) ? defaults[field.key] : "") || "";
  let normalized: string = normalizeGameInfoHeaderValue(field.key, withDefault);
  if (field.key === "Opening" && !normalized) {
    normalized = resolveEcoOpeningName(getHeaderValue(model, "ECO", ""));
  }
  if (field.key === "X2Style") {
    normalized = normalizeX2StyleValue(normalized);
  }
  return normalized;
};

// ── FieldInput ────────────────────────────────────────────────────────────────

type FieldInputProps = {
  field: GameInfoFieldDef;
  defaultVal: string;
  onCommit: (key: string, value: string) => void;
};

/**
 * Renders a single form control (select or text/number input) for non-player fields.
 * Text and number inputs are controlled: value is committed and normalized on blur.
 * Select inputs commit immediately on change (discrete values are always valid).
 */
const FieldInput = ({ field, defaultVal, onCommit }: FieldInputProps): ReactElement => {
  const id: string = `game-info-${field.key.toLowerCase()}`;
  const [value, setValue] = useState<string>(defaultVal);
  const [isInvalid, setIsInvalid] = useState<boolean>(false);

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const raw: string = e.target.value;
    setValue(raw);
    onCommit(field.key, raw);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setValue(e.target.value);
    if (isInvalid) setIsInvalid(false);
  };

  const handleInputBlur = (): void => {
    const normalized: string = normalizeGameInfoHeaderValue(field.key, value);
    setValue(normalized);
    setIsInvalid(field.validate ? !field.validate(normalized) : false);
    onCommit(field.key, normalized);
  };

  if (field.control === "select") {
    return (
      <select
        id={id}
        data-header-key={field.key}
        value={value}
        onChange={handleSelectChange}
      >
        {(field.options ?? []).map((opt: string): ReactElement => (
          <option key={opt} value={opt}>
            {field.optionLabels?.[opt] ?? (opt || "-")}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      id={id}
      type={field.control === "number" ? "number" : "text"}
      data-header-key={field.key}
      className={isInvalid ? "field-invalid" : undefined}
      placeholder={field.placeholder ?? field.label}
      value={value}
      onChange={handleInputChange}
      onBlur={handleInputBlur}
      {...(field.control === "number"
        ? { inputMode: "numeric", step: "1", min: "0" }
        : {})}
    />
  );
};

// ── GameInfoEditor (root) ─────────────────────────────────────────────────────

/** Renders the compact game-info summary and collapsible editor form. */
export const GameInfoEditor = (): ReactElement => {
  const services = useServiceContext();
  const { state, dispatch } = useAppContext();
  const pgnModel: PgnModel | null = selectPgnModel(state);
  const isOpen: boolean = selectIsGameInfoEditorOpen(state);
  const boardFlipped: boolean = selectBoardFlipped(state);
  const t: (key: string, fallback?: string) => string = useTranslator();

  const playersSummary: string = useMemo((): string => {
    const w: string = getHeaderValue(pgnModel, "White", "");
    const b: string = getHeaderValue(pgnModel, "Black", "");
    return buildPlayersSummary(w, b);
  }, [pgnModel]);

  const eventSummary: string = useMemo(
    (): string => getHeaderValue(pgnModel, "Event", ""),
    [pgnModel],
  );

  const dateSummary: string = useMemo(
    (): string => normalizeGameInfoHeaderValue("Date", getHeaderValue(pgnModel, "Date", "")),
    [pgnModel],
  );

  const openingSummary: string = useMemo((): string => {
    const eco: string = getHeaderValue(pgnModel, "ECO", "");
    const opening: string = getHeaderValue(pgnModel, "Opening", "");
    const name: string = opening || resolveEcoOpeningName(eco);
    return [eco, name].filter(Boolean).join(" ").trim();
  }, [pgnModel]);

  /**
   * `formKey` forces a full remount of the form fields when the active game
   * changes, resetting all `defaultValue` props to the new game's header values.
   */
  const formKey: string = pgnModel?.id ?? "no-game";

  return (
    <section className={["game-info-card", isOpen ? "editor-open" : ""].filter(Boolean).join(" ")}>
      {/* ── Compact summary row ── */}
      <div className="game-info-summary-row" data-guide-id={GUIDE_IDS.GAME_INFO_SUMMARY}>
        <div className="game-info-summary-grid">
          <p className="game-info-item">
            <span className="game-info-label">{t("gameInfo.players", "Players")}</span>
            <span
              id="game-info-players-value"
              className="game-info-value game-info-players-value"
            >
              {asDisplay(playersSummary, t("gameInfo.players.empty", "-"))}
            </span>
          </p>
          <p className="game-info-item">
            <span className="game-info-label">{t("gameInfo.event", "Event")}</span>
            <span id="game-info-event-value" className="game-info-value">
              {asDisplay(eventSummary, t("gameInfo.event.empty", "-"))}
            </span>
          </p>
          <p className="game-info-item">
            <span className="game-info-label">{t("gameInfo.date", "Date")}</span>
            <span id="game-info-date-value" className="game-info-value">
              {asDisplay(dateSummary, t("gameInfo.date.empty", "-"))}
            </span>
          </p>
          <p className="game-info-item">
            <span className="game-info-label">{t("gameInfo.opening", "Opening")}</span>
            <span id="game-info-opening-value" className="game-info-value">
              {asDisplay(openingSummary, t("gameInfo.opening.empty", "-"))}
            </span>
          </p>
        </div>
        <button
          id="btn-game-info-edit"
          className="game-info-edit-trigger"
          type="button"
          aria-label={t("gameInfo.edit", "Edit game information")}
          aria-expanded={isOpen ? "true" : "false"}
          aria-controls="game-info-editor"
          title={t("gameInfo.edit", "Edit game information")}
          onClick={(): void => {
            dispatch({ type: "set_game_info_editor_open", open: !isOpen });
          }}
        >
          <span aria-hidden="true">{isOpen ? "▲" : "▼"}</span>
        </button>
      </div>

      {/* ── Collapsible editor form ── */}
      <div
        id="game-info-editor"
        className={["game-info-editor", isOpen ? "open" : ""].filter(Boolean).join(" ")}
        data-guide-id={GUIDE_IDS.GAME_INFO_EDITOR}
        hidden={!isOpen}
      >
        {/*
         * `key={formKey}` remounts the grid whenever the active game model
         * changes, resetting all defaultValues to the newly loaded game.
         */}
        <div key={formKey} className="game-info-editor-grid">
          {GAME_INFO_HEADER_FIELDS.map((field: GameInfoFieldDef): ReactElement => {
            const id: string = `game-info-${field.key.toLowerCase()}`;
            const isPlayer: boolean =
              (PLAYER_NAME_HEADER_KEYS as readonly string[]).includes(field.key);
            // X2BoardOrientation is derived from the live boardFlipped state so
            // that the select always reflects the current board orientation, and
            // remounts (via key) whenever the board is flipped programmatically.
            let defaultVal: string = resolveFieldValue(pgnModel, field);
            if (field.key === X2_BOARD_ORIENTATION_HEADER_KEY) {
              defaultVal = boardFlipped ? "black" : "";
            }
            const fieldKey: string =
              field.key === X2_BOARD_ORIENTATION_HEADER_KEY
                ? `${field.key}-${String(boardFlipped)}`
                : field.key;

            return (
              <label key={fieldKey} className="game-info-editor-field" htmlFor={id}>
                <span>{field.label}</span>
                {isPlayer ? (
                  <PlayerAutocomplete
                    fieldKey={field.key}
                    id={id}
                    defaultVal={defaultVal}
                    placeholder={field.placeholder}
                    onCommit={services.updateGameInfoHeader}
                  />
                ) : (
                  <FieldInput
                    field={field}
                    defaultVal={defaultVal}
                    onCommit={services.updateGameInfoHeader}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
};
