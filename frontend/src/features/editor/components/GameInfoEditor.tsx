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
 * - **XSqr head** — readonly **moves-only** preview (`serializeXsqrHeadMovetext`); not written
 *   via `updateGameInfoHeader`; persisted only when the game is saved (`[Head]`).
 */

import { useMemo, useState, useRef, useEffect } from "react";
import type { ReactElement, ChangeEvent } from "react";
import { GAME_INFO_HEADER_FIELDS, PLAYER_NAME_HEADER_KEYS, normalizeGameInfoHeaderValue } from "../model/game_info";
import {
  getHeaderValue,
  REQUIRED_PGN_TAG_DEFAULTS,
  X2_STYLE_HEADER_KEY,
  X2_BOARD_ORIENTATION_HEADER_KEY,
  resolveEcoOpeningName,
  normalizeX2StyleValue,
  serializeXsqrHeadMovetext,
  allEcoMatches,
  ECO_OPENING_CODES,
} from "../../../model";
import type { EcoMatch } from "../../../model";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import {
  selectActiveSessionId,
  selectIsGameInfoEditorOpen,
  selectPgnModel,
  selectBoardFlipped,
  selectDerivedEco,
  selectMoves,
} from "../../../core/state/selectors";
import { useServiceContext } from "../../../app/providers/ServiceProvider";
import { useTranslator } from "../../../app/hooks/useTranslator";
import { PlayerAutocomplete } from "./PlayerAutocomplete";
import type { PgnModel } from "../../../../../parts/pgnparser/src/pgn_model";
import { UI_IDS } from "../../../core/model/ui_ids";
import { GameMetadataStrip } from "../../resources/metadata/GameMetadataStrip";

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

const resolveFieldValue = (
  model: PgnModel | null,
  field: GameInfoFieldDef,
  derivedEco: { eco: string; name: string } | null,
): string => {
  const raw: string = getHeaderValue(model, field.key, "");
  const defaults: Record<string, string> = REQUIRED_PGN_TAG_DEFAULTS;
  const withDefault: string = raw || (Object.hasOwn(defaults, field.key) ? defaults[field.key] : "") || "";
  let normalized: string = normalizeGameInfoHeaderValue(field.key, withDefault);
  if (field.key === "ECO" && !normalized && derivedEco) {
    normalized = derivedEco.eco;
  }
  if (field.key === "Opening" && !normalized) {
    normalized = derivedEco?.name ?? resolveEcoOpeningName(getHeaderValue(model, "ECO", ""));
  }
  if (field.key === X2_STYLE_HEADER_KEY) {
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
 *
 * Reusable outside `GameInfoEditor` wherever a game-info field input is needed
 * (e.g. `NewGameDialog` metadata tab).
 */
export const FieldInput = ({ field, defaultVal, onCommit }: FieldInputProps): ReactElement => {
  const id: string = `game-info-${field.key.toLowerCase()}`;
  const [value, setValue] = useState<string>(defaultVal);
  const [isInvalid, setIsInvalid] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    const raw: string = e.target.value;
    setValue(raw);
    onCommit(field.key, raw);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setValue(e.target.value);
    setIsDirty(true);
    if (isInvalid) setIsInvalid(false);
  };

  const handleInputBlur = (): void => {
    if (!isDirty) return;
    const normalized: string = normalizeGameInfoHeaderValue(field.key, value);
    setValue(normalized);
    setIsInvalid(field.validate ? !field.validate(normalized) : false);
    setIsDirty(false);
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

// ── EcoPickerButton ───────────────────────────────────────────────────────────

type EcoPickerButtonProps = {
  moves: string[];
  onSelect: (eco: string, name: string) => void;
};

const EcoPickerButton = ({ moves, onSelect }: EcoPickerButtonProps): ReactElement => {
  const [open, setOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const matches: EcoMatch[] = useMemo((): EcoMatch[] => allEcoMatches(moves), [moves]);
  const matchedCodes: Set<string> = useMemo(
    (): Set<string> => new Set<string>(matches.map((m: EcoMatch): string => m.eco)),
    [matches],
  );

  useEffect((): (() => void) => {
    if (!open) return (): void => {};
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return (): void => { document.removeEventListener("mousedown", handler); };
  }, [open]);

  const title: string = matches.length === 0
    ? "No ECO match for this game — click to browse all codes"
    : `${matches.length} matching ECO code${matches.length === 1 ? "" : "s"}`;

  return (
    <div className="eco-picker" ref={containerRef}>
      <button
        type="button"
        className="eco-picker-btn"
        title={title}
        onClick={(): void => { setOpen((o: boolean): boolean => !o); }}
      >
        ◎
      </button>
      {open && (
        <ul className="eco-picker-popup" role="listbox">
          {matches.map((m: EcoMatch): ReactElement => (
            <li
              key={`${m.eco}|${m.name}`}
              role="option"
              aria-selected={false}
              className="eco-picker-option"
              onClick={(): void => { onSelect(m.eco, m.name); setOpen(false); }}
            >
              <span className="eco-picker-code">{m.eco}</span>
              <span className="eco-picker-name">{m.name}</span>
              <span className="eco-picker-depth">{m.depth}m</span>
            </li>
          ))}
          {matches.length > 0 && <hr className="eco-picker-separator" />}
          {ECO_OPENING_CODES.filter((c: string): boolean => !matchedCodes.has(c)).map(
            (code: string): ReactElement => (
              <li
                key={code}
                role="option"
                aria-selected={false}
                className="eco-picker-option eco-picker-option--other"
                onClick={(): void => { onSelect(code, resolveEcoOpeningName(code)); setOpen(false); }}
              >
                <span className="eco-picker-code">{code}</span>
                <span className="eco-picker-name">{resolveEcoOpeningName(code)}</span>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
};

// ── GameInfoEditorGrid ────────────────────────────────────────────────────────

type GameInfoEditorGridProps = {
  pgnModel: PgnModel | null;
  activeSessionId: string | null;
  boardFlipped: boolean;
  derivedEco: { eco: string; name: string } | null;
  headDisplay: string;
  moves: string[];
};

const GameInfoEditorGrid = ({
  pgnModel,
  activeSessionId,
  boardFlipped,
  derivedEco,
  headDisplay,
  moves,
}: GameInfoEditorGridProps): ReactElement => {
  const services = useServiceContext();
  const t: (key: string, fallback?: string) => string = useTranslator();
  const [openingRevision, setOpeningRevision] = useState<number>(0);
  const ecoFieldDef: GameInfoFieldDef = GAME_INFO_HEADER_FIELDS.find((f) => f.key === "ECO")!;
  const [ecoDisplay, setEcoDisplay] = useState<string>(resolveFieldValue(pgnModel, ecoFieldDef, derivedEco));

  const commitEco = (eco: string, name: string): void => {
    if (!activeSessionId) return;
    services.updateGameInfoHeader(activeSessionId, "ECO", eco);
    services.updateGameInfoHeader(activeSessionId, "Opening", name);
    setEcoDisplay(eco);
    setOpeningRevision((r: number): number => r + 1);
  };

  return (
    <div className="game-info-editor-grid">
      {GAME_INFO_HEADER_FIELDS.map((field: GameInfoFieldDef): ReactElement => {
        const id: string = `game-info-${field.key.toLowerCase()}`;
        const isPlayer: boolean = PLAYER_NAME_HEADER_KEYS.includes(field.key);
        let defaultVal: string = resolveFieldValue(pgnModel, field, derivedEco);
        if (field.key === X2_BOARD_ORIENTATION_HEADER_KEY) {
          defaultVal = boardFlipped ? "black" : "";
        }
        let fieldKey: string = field.key;
        if (field.key === X2_BOARD_ORIENTATION_HEADER_KEY) {
          fieldKey = `${field.key}-${String(boardFlipped)}`;
        } else if (field.key === "Opening") {
          fieldKey = `Opening-${openingRevision}`;
        }

        const isEco: boolean = field.key === "ECO";

        return (
          <label key={fieldKey} className="game-info-editor-field" htmlFor={id}>
            <span>{field.label}</span>
            {isPlayer ? (
              <PlayerAutocomplete
                fieldKey={field.key}
                id={id}
                defaultVal={defaultVal}
                placeholder={field.placeholder}
                onCommit={(key: string, value: string): void => {
                  if (!activeSessionId) return;
                  services.updateGameInfoHeader(activeSessionId, key, value);
                }}
              />
            ) : isEco ? (
              <div className="eco-field-row">
                <input
                  id={id}
                  type="text"
                  className="eco-display"
                  readOnly
                  value={ecoDisplay}
                  placeholder="—"
                />
                <EcoPickerButton
                  moves={moves}
                  onSelect={(eco: string, name: string): void => { commitEco(eco, name); }}
                />
              </div>
            ) : (
              <FieldInput
                field={field}
                defaultVal={defaultVal}
                onCommit={(key: string, value: string): void => {
                  if (!activeSessionId) return;
                  services.updateGameInfoHeader(activeSessionId, key, value);
                }}
              />
            )}
          </label>
        );
      })}
      <label className="game-info-editor-field" htmlFor="game-info-xsqr-head">
        <span>{t("gameInfo.head", "XSqr head")}</span>
        <textarea
          id="game-info-xsqr-head"
          className="game-info-xsqr-head"
          readOnly
          aria-readonly="true"
          tabIndex={0}
          rows={1}
          wrap="off"
          spellCheck={false}
          data-ui-id={UI_IDS.GAME_INFO_XSQR_HEAD}
          value={headDisplay}
          title={t("gameInfo.head.hint", "Main line moves only (no comments or symbols), up to the first variation or end of game (saved as Head)")}
        />
      </label>
    </div>
  );
};

// ── GameInfoEditor (root) ─────────────────────────────────────────────────────

/** Renders the compact game-info summary and collapsible editor form. */
export const GameInfoEditor = (): ReactElement => {
  const { state, dispatch } = useAppContext();
  const pgnModel: PgnModel | null = selectPgnModel(state);
  const isOpen: boolean = selectIsGameInfoEditorOpen(state);
  const boardFlipped: boolean = selectBoardFlipped(state);
  const activeSessionId: string | null = selectActiveSessionId(state);
  const derivedEco: { eco: string; name: string } | null = selectDerivedEco(state);
  const moves: string[] = selectMoves(state);
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
    const eco: string = getHeaderValue(pgnModel, "ECO", "") || (derivedEco?.eco ?? "");
    const opening: string = getHeaderValue(pgnModel, "Opening", "");
    const name: string = opening || (derivedEco?.name ?? resolveEcoOpeningName(eco));
    return [eco, name].filter(Boolean).join(" ").trim();
  }, [pgnModel, derivedEco]);

  const headDisplay: string = useMemo((): string => {
    if (!pgnModel) return "";
    return serializeXsqrHeadMovetext(pgnModel);
  }, [pgnModel]);

  /**
   * `formKey` forces a full remount of the form fields when the active session
   * changes, resetting all local input state to the new session's header values.
   * Session ID is used instead of `pgnModel.id` because model IDs are not
   * guaranteed to be globally unique across independently parsed sessions.
   */
  const formKey: string = activeSessionId ?? pgnModel?.id ?? "no-game";

  return (
    <section className={["game-info-card", isOpen ? "editor-open" : ""].filter(Boolean).join(" ")}>
      {/* ── Compact summary row ── */}
      <div className="game-info-summary-row" data-ui-id={UI_IDS.GAME_INFO_SUMMARY}>
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
        data-ui-id={UI_IDS.GAME_INFO_EDITOR}
        hidden={!isOpen}
      >
        <GameInfoEditorGrid
          key={formKey}
          pgnModel={pgnModel}
          activeSessionId={activeSessionId}
          boardFlipped={boardFlipped}
          derivedEco={derivedEco}
          headDisplay={headDisplay}
          moves={moves}
        />
        <GameMetadataStrip key={`meta-${activeSessionId ?? "no-session"}`} />
      </div>
    </section>
  );
};
