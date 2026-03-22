/**
 * ExtractPositionDialog — extracts the current board position as a new game or position entry.
 *
 * Integration API:
 * - `<ExtractPositionDialog fen={...} ply={...} sanMoves={...} metadata={...}
 *     onCreate={...} onClose={...} t={...} />`
 *   Mount when the user requests position extraction.
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onCreate(pgnText)` fires with the generated PGN string.
 * - `onClose()` fires on cancel/dismiss.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type ChangeEvent,
} from "react";

type ExtractMode = "position_only" | "include_moves";

type ExtractPositionDialogProps = {
  /** FEN of the position to extract. */
  fen: string;
  /** The ply index (0 = start, 1 = after first half-move, etc.). */
  ply: number;
  /** All SAN moves of the game, up to and including the current position. */
  sanMoves: string[];
  /** Metadata to pre-fill in the resulting PGN headers. */
  metadata: {
    white?: string;
    black?: string;
    event?: string;
    date?: string;
  };
  t: (key: string, fallback?: string) => string;
  onCreate: (pgnText: string) => void;
  onClose: () => void;
};

/** Format ply index as "move N, White/Black" label. */
const plyLabel = (ply: number, t: (key: string, fallback?: string) => string): string => {
  if (ply <= 0) return t("extract.startPosition", "start position");
  const moveNum = Math.ceil(ply / 2);
  const side = ply % 2 === 1 ? t("extract.white", "White") : t("extract.black", "Black");
  return `${t("extract.moveNum", "move")} ${moveNum}, ${side}`;
};

/** Build PGN headers block. */
const buildHeaders = (
  meta: ExtractPositionDialogProps["metadata"],
  setupFen?: string,
): string => {
  const lines: string[] = [];
  if (meta.white) lines.push(`[White "${meta.white}"]`);
  if (meta.black) lines.push(`[Black "${meta.black}"]`);
  if (meta.event) lines.push(`[Event "${meta.event}"]`);
  if (meta.date) lines.push(`[Date "${meta.date}"]`);
  if (setupFen) {
    lines.push(`[SetUp "1"]`);
    lines.push(`[FEN "${setupFen}"]`);
  }
  return lines.join("\n");
};

/** Build a SAN move list from the given moves array, starting at startPly=0. */
const buildMoveText = (sanMoves: string[]): string => {
  const parts: string[] = [];
  for (let i = 0; i < sanMoves.length; i++) {
    if (i % 2 === 0) parts.push(`${Math.floor(i / 2) + 1}.`);
    parts.push(sanMoves[i] ?? "");
  }
  return parts.join(" ");
};

/**
 * Modal dialog for extracting a position from the current game into a new PGN.
 */
export const ExtractPositionDialog = ({
  fen,
  ply,
  sanMoves,
  metadata,
  t,
  onCreate,
  onClose,
}: ExtractPositionDialogProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<ExtractMode>("position_only");
  const [introComment, setIntroComment] = useState<string>(() => {
    const parts: string[] = [];
    if (metadata.white && metadata.black) parts.push(`${metadata.white}–${metadata.black}`);
    if (metadata.event) parts.push(metadata.event);
    return parts.join(", ");
  });

  useEffect((): void => {
    dialogRef.current?.showModal();
  }, []);

  const handleExtract = useCallback((): void => {
    const movesUpToPly = sanMoves.slice(0, ply);
    let pgnText: string;
    if (mode === "position_only") {
      const headers = buildHeaders(metadata, fen);
      const comment = introComment.trim();
      const body = comment ? `{${comment}} *` : `*`;
      pgnText = headers ? `${headers}\n\n${body}` : body;
    } else {
      const headers = buildHeaders(metadata);
      const comment = introComment.trim();
      const moves = buildMoveText(movesUpToPly);
      const body = comment
        ? `{${comment}} ${moves} *`
        : `${moves} *`;
      pgnText = headers ? `${headers}\n\n${body}` : body;
    }
    dialogRef.current?.close();
    onCreate(pgnText.trim());
  }, [mode, introComment, fen, ply, sanMoves, metadata, onCreate]);

  const handleCancel = useCallback((): void => {
    dialogRef.current?.close();
    onClose();
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="extract-dialog" onClose={onClose}>
      <div className="extract-dialog-content">
        <h2 className="extract-dialog-title">
          {t("extract.title", "Extract Position")}
        </h2>

        <p className="extract-dialog-position-label">
          {t("extract.positionAfter", "Position after:")}
          {" "}
          <strong>{plyLabel(ply, t)}</strong>
        </p>

        <fieldset className="extract-dialog-fieldset">
          <legend className="extract-dialog-legend">
            {t("extract.howTo", "How to extract:")}
          </legend>
          {(["position_only", "include_moves"] as ExtractMode[]).map((m) => (
            <label key={m} className="extract-dialog-radio">
              <input
                type="radio"
                name="extract-mode"
                value={m}
                checked={mode === m}
                onChange={(): void => { setMode(m); }}
              />
              {m === "position_only"
                ? t("extract.positionOnly", "Position only (FEN start — no preceding moves)")
                : t("extract.includeMoves", "Include preceding moves")}
            </label>
          ))}
        </fieldset>

        <label className="extract-dialog-field">
          <span className="extract-dialog-label">
            {t("extract.introComment", "Intro comment:")}
          </span>
          <input
            type="text"
            className="extract-dialog-input"
            value={introComment}
            onChange={(e: ChangeEvent<HTMLInputElement>): void => {
              setIntroComment(e.target.value);
            }}
          />
        </label>

        <div className="extract-dialog-actions">
          <button
            type="button"
            className="extract-dialog-btn-cancel"
            onClick={handleCancel}
          >
            {t("extract.cancel", "Cancel")}
          </button>
          <button
            type="button"
            className="extract-dialog-btn-extract"
            onClick={handleExtract}
          >
            {t("extract.extract", "Extract")}
          </button>
        </div>
      </div>
    </dialog>
  );
};
