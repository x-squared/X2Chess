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
} from "../../editor/fen_utils";
import { useTranslator } from "../../hooks/useTranslator";

// ── FEN validation ─────────────────────────────────────────────────────────────

const validateFen = (fen: string): string | null => {
  const structural = validateFenStructure(fen);
  if (!structural.valid) return structural.error;
  const kingsError = validateKings(fen);
  if (kingsError) return kingsError;
  // Use chess.js for full legality check.
  try {
    new Chess(fen);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid position";
  }
};

// ── PGN generation ─────────────────────────────────────────────────────────────

type GameMetadata = {
  white: string;
  black: string;
  event: string;
  site: string;
  date: string;
  round: string;
  result: string;
};

const buildPgn = (
  fen: string,
  isCustom: boolean,
  meta: GameMetadata,
  isChess960: boolean,
): string => {
  const headers: string[] = [];
  const addHeader = (key: string, value: string): void => {
    headers.push(`[${key} "${value.replace(/"/g, '\\"')}"]`);
  };

  addHeader("Event", meta.event || "?");
  addHeader("Site", meta.site || "?");
  addHeader("Date", meta.date || "????.??.??");
  addHeader("Round", meta.round || "?");
  addHeader("White", meta.white || "?");
  addHeader("Black", meta.black || "?");
  addHeader("Result", meta.result || "*");

  if (isCustom) {
    addHeader("SetUp", "1");
    addHeader("FEN", fen);
    if (isChess960) addHeader("Variant", "Chess960");
  }

  return `${headers.join("\n")}\n\n${meta.result || "*"}\n`;
};

const todayDate = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
};

// ── Chess960 detection (NG5) ───────────────────────────────────────────────────

const expandRankStr = (rankStr: string): string[] => {
  const result: string[] = [];
  for (const ch of rankStr) {
    if (/[1-8]/.test(ch)) {
      for (let i = 0; i < Number(ch); i++) result.push(".");
    } else {
      result.push(ch);
    }
  }
  return result;
};

const isValidChess960BackRank = (squares: string[], isBlack: boolean): boolean => {
  const K = isBlack ? "k" : "K";
  const R = isBlack ? "r" : "R";
  const B = isBlack ? "b" : "B";
  const counts: Record<string, number> = {};
  for (const sq of squares) counts[sq] = (counts[sq] ?? 0) + 1;
  if (counts[K] !== 1 || counts[R] !== 2 || counts[B] !== 2) return false;
  const kingIdx = squares.indexOf(K);
  const rook1 = squares.indexOf(R);
  const rook2 = squares.lastIndexOf(R);
  if (kingIdx <= rook1 || kingIdx >= rook2) return false;
  const bIdx1 = squares.indexOf(B);
  const bIdx2 = squares.lastIndexOf(B);
  if (bIdx1 === bIdx2) return false;
  if ((bIdx1 % 2) === (bIdx2 % 2)) return false; // Same square color.
  return true;
};

/**
 * Returns true if `fen` represents a legal Chess960 (Fischer-Random) starting
 * position — i.e., it has standard pawn structure, empty middle ranks, and
 * legal back-rank placement for both sides but is NOT the standard starting
 * position.
 */
const detectChess960 = (fen: string): boolean => {
  const parts = fen.split(/\s/);
  const board = parts[0] ?? "";
  const ranks = board.split("/");
  if (ranks.length !== 8) return false;
  if (ranks[1] !== "pppppppp") return false;
  if (ranks[6] !== "PPPPPPPP") return false;
  for (let i = 2; i <= 5; i++) {
    if (ranks[i] !== "8") return false;
  }
  const whiteBack = expandRankStr(ranks[7] ?? "");
  const blackBack = expandRankStr(ranks[0] ?? "");
  if (!isValidChess960BackRank(whiteBack, false)) return false;
  if (!isValidChess960BackRank(blackBack, true)) return false;
  if ((ranks[7] ?? "") === "RNBQKBNR" && (ranks[0] ?? "") === "rnbqkbnr") return false;
  return true;
};

// ── PositionSetupBoard (NG1) ───────────────────────────────────────────────────

type PositionSetupBoardProps = {
  fen: string;
  onFenChange: (fen: string) => void;
  t: (key: string, fallback?: string) => string;
};

/**
 * Interactive 8×8 board for position setup.
 * Renders piece squares as a CSS grid; right-click empties a square;
 * left-click cycles through a piece palette to place pieces.
 *
 * The board reads its state entirely from `fen` and calls `onFenChange`
 * with an updated FEN on every interaction.
 */
export { type PositionSetupBoardProps };
export const PositionSetupBoard = ({ fen, onFenChange, t }: PositionSetupBoardProps): ReactElement => {
  const [selectedPiece, setSelectedPiece] = useState<string>("wP");

  // Parse the board section from FEN into a flat 64-element array (a8…h1).
  const expandRanks = (boardSection: string): string[] => {
    const squares: string[] = [];
    for (const rank of boardSection.split("/")) {
      for (const ch of rank) {
        if (/[1-8]/.test(ch)) {
          for (let i = 0; i < Number(ch); i++) squares.push("");
        } else {
          squares.push(ch);
        }
      }
    }
    return squares;
  };

  const compressRanks = (squares: string[]): string => {
    let result = "";
    for (let rank = 0; rank < 8; rank++) {
      if (rank > 0) result += "/";
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const piece = squares[rank * 8 + file];
        if (!piece) {
          empty++;
        } else {
          if (empty > 0) { result += String(empty); empty = 0; }
          result += piece;
        }
      }
      if (empty > 0) result += String(empty);
    }
    return result;
  };

  const boardSection = fen.split(/\s/)[0] ?? "";
  const restSections = fen.split(/\s/).slice(1).join(" ");
  const squares = expandRanks(boardSection);

  const handleSquareClick = (index: number): void => {
    const next = [...squares];
    // If same piece already here, clear it; otherwise place selected piece.
    if (next[index] === pieceChar(selectedPiece)) {
      next[index] = "";
    } else {
      next[index] = pieceChar(selectedPiece);
    }
    onFenChange(`${compressRanks(next)} ${restSections}`);
  };

  const handleSquareRightClick = (e: React.MouseEvent, index: number): void => {
    e.preventDefault();
    const next = [...squares];
    next[index] = "";
    onFenChange(`${compressRanks(next)} ${restSections}`);
  };

  const pieceChar = (piece: string): string => {
    const map: Record<string, string> = {
      wK: "K", wQ: "Q", wR: "R", wB: "B", wN: "N", wP: "P",
      bK: "k", bQ: "q", bR: "r", bB: "b", bN: "n", bP: "p",
    };
    return map[piece] ?? "";
  };

  const PIECE_SYMBOLS: Record<string, string> = {
    K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
    k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
  };

  const PALETTE = ["wK","wQ","wR","wB","wN","wP","bK","bQ","bR","bB","bN","bP"];

  return (
    <div className="position-setup-board-wrap">
      {/* Palette */}
      <div className="position-setup-palette" aria-label={t("newgame.palette", "Piece palette")}>
        {PALETTE.map((piece) => (
          <button
            key={piece}
            type="button"
            className={`position-setup-palette-btn${selectedPiece === piece ? " selected" : ""}`}
            onClick={(): void => { setSelectedPiece(piece); }}
            aria-label={piece}
            title={piece}
          >
            {PIECE_SYMBOLS[pieceChar(piece)] ?? "?"}
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="position-setup-board" aria-label={t("newgame.board", "Setup board")}>
        {squares.map((piece, idx) => {
          const rank = Math.floor(idx / 8);
          const file = idx % 8;
          const isLight = (rank + file) % 2 === 0;
          return (
            <div
              key={idx}
              className={`position-setup-square${isLight ? " light" : " dark"}`}
              onClick={(): void => { handleSquareClick(idx); }}
              onContextMenu={(e): void => { handleSquareRightClick(e, idx); }}
              role="button"
              tabIndex={0}
              aria-label={`${String.fromCharCode(97 + file)}${8 - rank}`}
              onKeyDown={(e): void => {
                if (e.key === "Enter" || e.key === " ") handleSquareClick(idx);
              }}
            >
              {piece && (
                <span className={`position-setup-piece${piece === piece.toUpperCase() ? " white" : " black"}`}>
                  {PIECE_SYMBOLS[piece] ?? piece}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Board actions */}
      <div className="position-setup-actions">
        <button
          type="button"
          className="newgame-btn newgame-btn--ghost"
          onClick={(): void => {
            const next = Array(64).fill("");
            onFenChange(`${compressRanks(next)} ${restSections}`);
          }}
        >
          {t("newgame.clearBoard", "Clear board")}
        </button>
        <button
          type="button"
          className="newgame-btn newgame-btn--ghost"
          onClick={(): void => { onFenChange(STANDARD_STARTING_FEN); }}
        >
          {t("newgame.standardPosition", "Standard")}
        </button>
      </div>
    </div>
  );
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
  const [tab, setTab] = useState<Tab>("position");
  const [useCustom, setUseCustom] = useState<boolean>(false);
  const [fen, setFen] = useState<string>(STANDARD_STARTING_FEN);
  const [fenInput, setFenInput] = useState<string>(STANDARD_STARTING_FEN);
  const [fenError, setFenError] = useState<string | null>(null);
  const [chess960Override, setChess960Override] = useState<boolean | null>(null);
  const [meta, setMeta] = useState<GameMetadata>({
    white: "",
    black: "",
    event: "",
    site: "",
    date: todayDate(),
    round: "",
    result: "*",
  });

  useEffect((): void => { dialogRef.current?.showModal(); }, []);

  // Detect Chess960 automatically from FEN (NG5); user can override.
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
      setChess960Override(null); // Reset override on FEN change.
    }
  }, []);

  const handleBoardFenChange = useCallback((newFen: string): void => {
    setFen(newFen);
    setFenInput(newFen);
    setFenError(validateFen(newFen));
    setChess960Override(null);
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
    <dialog ref={dialogRef} className="newgame-dialog" onClose={onClose}>
      <div className="newgame-form">
        <p className="newgame-title">{t("newgame.title", "New Game")}</p>

        {/* Tab bar */}
        <div className="newgame-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`newgame-tab${tab === "position" ? " active" : ""}`}
            aria-selected={tab === "position"}
            onClick={(): void => { setTab("position"); }}
          >
            {t("newgame.tab.position", "Starting position")}
          </button>
          <button
            type="button"
            role="tab"
            className={`newgame-tab${tab === "metadata" ? " active" : ""}`}
            aria-selected={tab === "metadata"}
            onClick={(): void => { setTab("metadata"); }}
          >
            {t("newgame.tab.metadata", "Metadata")}
          </button>
        </div>

        {/* Tab 1: Starting position */}
        {tab === "position" && (
          <div className="newgame-tab-panel" role="tabpanel">
            <div className="newgame-position-toggle">
              <label className="newgame-radio-label">
                <input
                  type="radio"
                  name="positionType"
                  checked={!useCustom}
                  onChange={(): void => { setUseCustom(false); setFen(STANDARD_STARTING_FEN); }}
                />
                {t("newgame.standard", "Standard starting position")}
              </label>
              <label className="newgame-radio-label">
                <input
                  type="radio"
                  name="positionType"
                  checked={useCustom}
                  onChange={(): void => { setUseCustom(true); }}
                />
                {t("newgame.custom", "Custom position")}
              </label>
            </div>

            {useCustom && (
              <>
                <div className="newgame-fen-row">
                  <label className="newgame-fen-label">
                    {t("newgame.fen", "FEN:")}
                    <input
                      className={`newgame-fen-input${fenError ? " error" : ""}`}
                      value={fenInput}
                      onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                        handleFenInputChange(e.target.value);
                      }}
                      spellCheck={false}
                    />
                  </label>
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

                {/* Chess960 badge (NG5) */}
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
          <div className="newgame-tab-panel" role="tabpanel">
            <div className="newgame-meta-grid">
              {(["white","black","event","site","round"] as const).map((key) => (
                <label key={key} className="newgame-meta-label">
                  <span>{t(`newgame.meta.${key}`, key.charAt(0).toUpperCase() + key.slice(1))}:</span>
                  <input
                    className="newgame-meta-input"
                    value={meta[key]}
                    onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                      const v = e.target.value;
                      setMeta((m) => ({ ...m, [key]: v }));
                    }}
                  />
                </label>
              ))}
              <label className="newgame-meta-label">
                <span>{t("newgame.meta.date", "Date")}:</span>
                <input
                  className="newgame-meta-input"
                  type="date"
                  value={meta.date.replace(/\./g, "-")}
                  onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                    setMeta((m) => ({ ...m, date: e.target.value.replace(/-/g, ".") }));
                  }}
                />
              </label>
              <label className="newgame-meta-label">
                <span>{t("newgame.meta.result", "Result")}:</span>
                <select
                  className="newgame-meta-select"
                  value={meta.result}
                  onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
                    setMeta((m) => ({ ...m, result: e.target.value }));
                  }}
                >
                  {["*","1-0","0-1","1/2-1/2"].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="newgame-meta-hint">
              {t("newgame.meta.hint", "All fields are optional.")}
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="newgame-footer">
          {tab === "metadata" && (
            <button type="button" className="newgame-btn newgame-btn--secondary" onClick={(): void => { setTab("position"); }}>
              {t("newgame.back", "← Back")}
            </button>
          )}
          <button type="button" className="newgame-btn newgame-btn--secondary" onClick={handleClose}>
            {t("common.cancel", "Cancel")}
          </button>
          {tab === "position" && (
            <button
              type="button"
              className="newgame-btn newgame-btn--primary"
              onClick={(): void => { setTab("metadata"); }}
            >
              {t("newgame.next", "Next: Metadata →")}
            </button>
          )}
          {tab === "metadata" && (
            <button
              type="button"
              className="newgame-btn newgame-btn--primary"
              disabled={!canCreate}
              onClick={handleCreate}
            >
              {t("newgame.create", "Create game")}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
};
