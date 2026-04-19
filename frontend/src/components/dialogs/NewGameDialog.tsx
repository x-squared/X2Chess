/**
 * NewGameDialog — two-tab dialog for starting a new game.
 *
 * Integration API:
 * - `<NewGameDialog onCreate={...} onClose={...} />` — opens a modal dialog
 *   that lets the user choose a starting position (Tab 1) and metadata (Tab 2),
 *   then calls `onCreate(pgn)` with the generated PGN string.
 *
 * Configuration API:
 * - No global configuration; all state is local.
 *
 * Communication API:
 * - `onCreate(pgn: string)` — called with the new game's PGN on confirm.
 * - `onClose()` — called when the dialog is dismissed without creating.
 * - Custom position tab: secondary modal explains FEN fields (info button beside
 *   the FEN input; brief hover delay or click opens it).
 */

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type ChangeEvent,
} from "react";
import { Chess } from "chess.js";
import {
  STANDARD_STARTING_FEN,
  validateFenStructure,
  validateKings,
} from "../../features/editor/model/fen_utils";
import { useTranslator } from "../../app/hooks/useTranslator";
import {
  GAME_INFO_HEADER_FIELDS,
  PLAYER_NAME_HEADER_KEYS,
  normalizeGameInfoHeaderValue,
} from "../../features/editor/model/game_info";
import { FieldInput } from "../../features/editor/components/GameInfoEditor";
import { PlayerAutocomplete } from "../../features/editor/components/PlayerAutocomplete";
import { PositionSetupBoard, detectChess960 } from "./PositionSetupBoard";
import "./dialog.css";
import "./new_game_dialog.css";

// ── Metadata field subset used in the New Game dialog ─────────────────────────

const NEW_GAME_FIELD_KEYS = new Set([
  "White", "Black", "Result",
  "WhiteElo", "BlackElo",
  "Event", "Date", "Site", "Round",
]);

const NEW_GAME_META_FIELDS = GAME_INFO_HEADER_FIELDS.filter(
  (f) => NEW_GAME_FIELD_KEYS.has(f.key),
);

// ── FEN validation ─────────────────────────────────────────────────────────────

const validateFen = (fen: string): string | null => {
  const structural = validateFenStructure(fen);
  if (!structural.valid) return structural.error;
  const kingsError = validateKings(fen);
  if (kingsError) return kingsError;
  try {
    new Chess(fen);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid position";
  }
};

// ── PGN generation ─────────────────────────────────────────────────────────────

const buildPgn = (
  fen: string,
  isCustom: boolean,
  meta: Record<string, string>,
  isChess960: boolean,
): string => {
  const headers: string[] = [];
  const addHeader = (key: string, value: string): void => {
    headers.push(`[${key} "${value.replace(/"/g, '\\"')}"]`);
  };

  addHeader("Event", meta["Event"] || "?");
  addHeader("Site", meta["Site"] || "?");
  addHeader("Date", meta["Date"] || "????.??.??");
  addHeader("Round", meta["Round"] || "?");
  addHeader("White", meta["White"] || "?");
  addHeader("Black", meta["Black"] || "?");
  addHeader("Result", meta["Result"] || "*");

  const whiteElo = meta["WhiteElo"] ?? "";
  const blackElo = meta["BlackElo"] ?? "";
  if (whiteElo) addHeader("WhiteElo", whiteElo);
  if (blackElo) addHeader("BlackElo", blackElo);

  if (isCustom) {
    addHeader("SetUp", "1");
    addHeader("FEN", fen);
    if (isChess960) addHeader("Variant", "Chess960");
  }

  return `${headers.join("\n")}\n\n${meta["Result"] || "*"}\n`;
};

const todayDate = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
};

// ── NewGameDialog ──────────────────────────────────────────────────────────────

type NewGameDialogProps = {
  onCreate: (pgn: string) => void;
  onClose: () => void;
};

type Tab = "position" | "metadata";

/** Two-tab dialog: Tab 1 = starting position, Tab 2 = metadata. */
export const NewGameDialog = ({ onCreate, onClose }: NewGameDialogProps): ReactElement => {
  const t = useTranslator();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fenHelpDialogRef = useRef<HTMLDialogElement>(null);
  const fenHelpHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fenHelpDialogOpen, setFenHelpDialogOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<Tab>("position");
  const [useCustom, setUseCustom] = useState<boolean>(false);
  const [fen, setFen] = useState<string>(STANDARD_STARTING_FEN);
  const [fenInput, setFenInput] = useState<string>(STANDARD_STARTING_FEN);
  const [fenError, setFenError] = useState<string | null>(null);
  const [chess960Override, setChess960Override] = useState<boolean | null>(null);
  const [meta, setMeta] = useState<Record<string, string>>({
    White: "",
    Black: "",
    Result: "*",
    WhiteElo: "",
    BlackElo: "",
    Event: "",
    Date: normalizeGameInfoHeaderValue("Date", todayDate()),
    Site: "",
    Round: "",
  });

  useEffect((): void => { dialogRef.current?.showModal(); }, []);

  const clearFenHelpHoverTimer = useCallback((): void => {
    if (fenHelpHoverTimerRef.current !== null) {
      clearTimeout(fenHelpHoverTimerRef.current);
      fenHelpHoverTimerRef.current = null;
    }
  }, []);

  useEffect((): (() => void) => {
    return (): void => {
      clearFenHelpHoverTimer();
    };
  }, [clearFenHelpHoverTimer]);

  const openFenHelpDialog = useCallback((): void => {
    const dlg: HTMLDialogElement | null = fenHelpDialogRef.current;
    if (dlg === null || dlg.open) {
      return;
    }
    dlg.showModal();
    setFenHelpDialogOpen(true);
  }, []);

  const closeFenHelpDialog = useCallback((): void => {
    const dlg: HTMLDialogElement | null = fenHelpDialogRef.current;
    if (dlg === null || !dlg.open) {
      return;
    }
    dlg.close();
    setFenHelpDialogOpen(false);
  }, []);

  const handleFenHelpDialogClose = useCallback((): void => {
    setFenHelpDialogOpen(false);
  }, []);

  const toggleFenHelpDialog = useCallback((): void => {
    const dlg: HTMLDialogElement | null = fenHelpDialogRef.current;
    if (dlg === null) {
      return;
    }
    if (dlg.open) {
      closeFenHelpDialog();
    } else {
      openFenHelpDialog();
    }
  }, [openFenHelpDialog, closeFenHelpDialog]);

  const FEN_HELP_HOVER_MS: number = 280;

  const onFenHelpButtonMouseEnter = useCallback((): void => {
    clearFenHelpHoverTimer();
    fenHelpHoverTimerRef.current = setTimeout((): void => {
      fenHelpHoverTimerRef.current = null;
      openFenHelpDialog();
    }, FEN_HELP_HOVER_MS);
  }, [clearFenHelpHoverTimer, openFenHelpDialog]);

  const onFenHelpButtonMouseLeave = useCallback((): void => {
    clearFenHelpHoverTimer();
  }, [clearFenHelpHoverTimer]);

  const chess960Detected = useMemo(
    (): boolean => useCustom && !fenError ? detectChess960(fen) : false,
    [useCustom, fenError, fen],
  );
  const isChess960 = chess960Override !== null ? chess960Override : chess960Detected;

  const handleFenInputChange = useCallback((value: string): void => {
    setFenInput(value);
    const error = validateFen(value);
    setFenError(error);
    if (!error) {
      setFen(value);
      setChess960Override(null);
    }
  }, []);

  const handleBoardFenChange = useCallback((newFen: string): void => {
    setFen(newFen);
    setFenInput(newFen);
    setFenError(validateFen(newFen));
    setChess960Override(null);
  }, []);

  const handleMetaCommit = useCallback((key: string, value: string): void => {
    setMeta((m) => ({ ...m, [key]: value }));
  }, []);

  const handleCreate = useCallback((): void => {
    const pgn = buildPgn(useCustom ? fen : STANDARD_STARTING_FEN, useCustom, meta, isChess960);
    onCreate(pgn);
    dialogRef.current?.close();
  }, [fen, useCustom, meta, isChess960, onCreate]);

  const handleClose = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  const canCreate = !useCustom || !fenError;

  return (
    <>
    <dialog ref={dialogRef} className="newgame-dialog x2-dialog" onClose={onClose}>
      <div className="x2-dialog-body">
        <p className="x2-dialog-title">{t("newgame.title", "New Game")}</p>

        {/* Tab bar */}
        <div className="x2-dialog-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`x2-dialog-tab${tab === "position" ? " active" : ""}`}
            aria-selected={tab === "position"}
            onClick={(): void => { setTab("position"); }}
          >
            {t("newgame.tab.position", "Starting position")}
          </button>
          <button
            type="button"
            role="tab"
            className={`x2-dialog-tab${tab === "metadata" ? " active" : ""}`}
            aria-selected={tab === "metadata"}
            onClick={(): void => { setTab("metadata"); }}
          >
            {t("newgame.tab.metadata", "Metadata")}
          </button>
        </div>

        {/* Tab 1: Starting position */}
        {tab === "position" && (
          <div className="x2-dialog-tab-panel" role="tabpanel">
            <div className="newgame-position-toggle">
              <label className="newgame-radio-label">
                <input
                  type="radio"
                  name="positionType"
                  checked={!useCustom}
                  onChange={(): void => {
                    setUseCustom(false);
                    setFen(STANDARD_STARTING_FEN);
                    setFenInput(STANDARD_STARTING_FEN);
                    setFenError(null);
                    setChess960Override(null);
                  }}
                />
                {t("newgame.standard", "Standard starting position")}
              </label>
              <label className="newgame-radio-label">
                <input
                  type="radio"
                  name="positionType"
                  checked={useCustom}
                  onChange={(): void => {
                    const emptyFen = "8/8/8/8/8/8/8/8 w KQkq - 0 1";
                    setUseCustom(true);
                    setFen(emptyFen);
                    setFenInput(emptyFen);
                    setFenError(validateFen(emptyFen));
                    setChess960Override(null);
                  }}
                />
                {t("newgame.custom", "Custom position")}
              </label>
            </div>

            {useCustom && (
              <>
                <div className="newgame-fen-row">
                  <label className="newgame-fen-label" htmlFor="newgame-fen-input">
                    {t("newgame.fen", "FEN:")}
                  </label>
                  <div className="newgame-fen-input-row">
                    <input
                      id="newgame-fen-input"
                      className={`newgame-fen-input${fenError ? " error" : ""}`}
                      value={fenInput}
                      onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                        handleFenInputChange(e.target.value);
                      }}
                      spellCheck={false}
                    />
                    {/* FEN notation — opens help on click or after brief hover */}
                    <button
                      type="button"
                      className="newgame-fen-info-btn"
                      aria-label={t("newgame.fenHelp.buttonAria", "FEN notation explained")}
                      aria-expanded={fenHelpDialogOpen}
                      aria-haspopup="dialog"
                      aria-controls="newgame-fen-help-dialog"
                      onClick={toggleFenHelpDialog}
                      onMouseEnter={onFenHelpButtonMouseEnter}
                      onMouseLeave={onFenHelpButtonMouseLeave}
                    >
                      <svg
                        className="newgame-fen-info-icon"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4" />
                        <path d="M12 8h.01" />
                      </svg>
                    </button>
                  </div>
                  {fenError ? (
                    <span className="newgame-fen-error">{fenError}</span>
                  ) : (
                    <span className="newgame-fen-valid">
                      {t("newgame.fenValid", "✓ Valid position")}
                    </span>
                  )}
                </div>

                <PositionSetupBoard
                  fen={fenError ? fen : fenInput}
                  onFenChange={handleBoardFenChange}
                  t={t}
                />

                {/* Side to move */}
                <div className="newgame-side-row">
                  <span className="newgame-side-label">{t("newgame.sideToMove", "Side to move:")}</span>
                  <label className="newgame-radio-label">
                    <input
                      type="radio"
                      name="sideToMove"
                      checked={(fen.split(/\s/)[1] ?? "w") === "w"}
                      onChange={(): void => {
                        const parts = fen.split(/\s/);
                        parts[1] = "w";
                        handleBoardFenChange(parts.join(" "));
                      }}
                    />
                    {t("newgame.white", "White")}
                  </label>
                  <label className="newgame-radio-label">
                    <input
                      type="radio"
                      name="sideToMove"
                      checked={(fen.split(/\s/)[1] ?? "w") === "b"}
                      onChange={(): void => {
                        const parts = fen.split(/\s/);
                        parts[1] = "b";
                        handleBoardFenChange(parts.join(" "));
                      }}
                    />
                    {t("newgame.black", "Black")}
                  </label>
                </div>

                {/* Castling rights */}
                <div className="newgame-castling-row">
                  <span className="newgame-castling-label">{t("newgame.castling", "Castling rights:")}</span>
                  {(["K","Q","k","q"] as const).map((c) => {
                    const castling = fen.split(/\s/)[2] ?? "-";
                    const checked = castling.includes(c);
                    const labels: Record<string, string> = { K: "White O-O", Q: "White O-O-O", k: "Black O-O", q: "Black O-O-O" };
                    return (
                      <label key={c} className="newgame-castling-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(): void => {
                            const parts = fen.split(/\s/);
                            const cur = parts[2] === "-" ? "" : (parts[2] ?? "");
                            const next = checked
                              ? cur.replace(c, "")
                              : [...cur, c].sort((a, b) => "KQkq".indexOf(a) - "KQkq".indexOf(b)).join("");
                            parts[2] = next || "-";
                            handleBoardFenChange(parts.join(" "));
                          }}
                        />
                        {labels[c]}
                      </label>
                    );
                  })}
                </div>

                {/* Chess960 badge */}
                {(chess960Detected || chess960Override !== null) && (
                  <div className="newgame-chess960-row">
                    <label className="newgame-chess960-label">
                      <input
                        type="checkbox"
                        checked={isChess960}
                        onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                          setChess960Override(e.target.checked);
                        }}
                      />
                      {t("newgame.chess960", "Fischer-Random starting position (Chess960)")}
                    </label>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Metadata */}
        {tab === "metadata" && (
          <div className="x2-dialog-tab-panel" role="tabpanel">
            <div className="game-info-editor-grid">
              {NEW_GAME_META_FIELDS.map((field) => {
                const id = `newgame-${field.key.toLowerCase()}`;
                const isPlayer = (PLAYER_NAME_HEADER_KEYS as readonly string[]).includes(field.key);
                return (
                  <label key={field.key} className="game-info-editor-field" htmlFor={id}>
                    <span>{field.label}</span>
                    {isPlayer ? (
                      <PlayerAutocomplete
                        fieldKey={field.key}
                        id={id}
                        defaultVal={meta[field.key] ?? ""}
                        placeholder={field.placeholder}
                        onCommit={handleMetaCommit}
                      />
                    ) : (
                      <FieldInput
                        field={field}
                        defaultVal={meta[field.key] ?? ""}
                        onCommit={handleMetaCommit}
                      />
                    )}
                  </label>
                );
              })}
            </div>
            <p className="newgame-meta-hint">
              {t("newgame.meta.hint", "All fields are optional.")}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="x2-dialog-footer">
          {tab === "metadata" && (
            <button type="button" className="x2-dialog-btn" onClick={(): void => { setTab("position"); }}>
              {t("newgame.back", "← Back")}
            </button>
          )}
          <button type="button" className="x2-dialog-btn" onClick={handleClose}>
            {t("common.cancel", "Cancel")}
          </button>
          {tab === "position" && (
            <button
              type="button"
              className="x2-dialog-btn x2-dialog-btn--primary"
              onClick={(): void => { setTab("metadata"); }}
            >
              {t("newgame.next", "Next: Metadata →")}
            </button>
          )}
          {tab === "metadata" && (
            <button
              type="button"
              className="x2-dialog-btn x2-dialog-btn--primary"
              disabled={!canCreate}
              onClick={handleCreate}
            >
              {t("newgame.create", "Create game")}
            </button>
          )}
        </div>
      </div>
    </dialog>

    {/* FEN notation — nested modal (above New Game in top layer) */}
    <dialog
      id="newgame-fen-help-dialog"
      ref={fenHelpDialogRef}
      className="newgame-fen-help-dialog x2-dialog"
      onClose={handleFenHelpDialogClose}
    >
      <div className="newgame-fen-help-inner">
        <p className="x2-dialog-title newgame-fen-help-title">
          {t("newgame.fenHelp.title", "About FEN")}
        </p>
        <div className="newgame-fen-help-sections">
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.placement", "Piece placement")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.placement.l1", "The board is written rank by rank from the 8th rank to the 1st.")}</li>
              <li>{t("newgame.fenHelp.placement.l2", "Within each rank, files run from a to h.")}</li>
              <li>{t("newgame.fenHelp.placement.l3", "Pieces use letters: uppercase for White, lowercase for Black.")}</li>
              <li>{t("newgame.fenHelp.placement.l4", "Empty squares are compressed as numbers.")}</li>
              <li>{t("newgame.fenHelp.placement.l5", "Slashes separate ranks.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.sideToMove", "Side to move")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.sideToMove.l1", "w means White to move.")}</li>
              <li>{t("newgame.fenHelp.sideToMove.l2", "b means Black to move.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.castling", "Castling rights")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.castling.l1", "K — White can castle kingside.")}</li>
              <li>{t("newgame.fenHelp.castling.l2", "Q — White can castle queenside.")}</li>
              <li>{t("newgame.fenHelp.castling.l3", "k — Black can castle kingside.")}</li>
              <li>{t("newgame.fenHelp.castling.l4", "q — Black can castle queenside.")}</li>
              <li>{t("newgame.fenHelp.castling.l5", "- means no castling is available.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.enPassant", "En passant target square")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.enPassant.l1", "If a pawn just advanced two squares, this field shows the square behind it.")}</li>
              <li>{t("newgame.fenHelp.enPassant.l2", "If no en passant capture is possible, use -.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.halfmove", "Halfmove clock")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.halfmove.l1", "Counts half-moves since the last pawn move or capture.")}</li>
              <li>{t("newgame.fenHelp.halfmove.l2", "Used for the 50-move draw rule.")}</li>
            </ul>
          </section>
          <section className="newgame-fen-help-section">
            <h3 className="newgame-fen-help-section-title">
              {t("newgame.fenHelp.section.fullmove", "Fullmove number")}
            </h3>
            <ul className="newgame-fen-help-list">
              <li>{t("newgame.fenHelp.fullmove.l1", "Starts at 1 and increases after Black's move.")}</li>
            </ul>
          </section>
        </div>
        <div className="newgame-fen-help-footer">
          <button type="button" className="x2-dialog-btn x2-dialog-btn--primary" onClick={closeFenHelpDialog}>
            {t("newgame.fenHelp.close", "Close")}
          </button>
        </div>
      </div>
    </dialog>
    </>
  );
};
