/**
 * TablebasePanel — endgame tablebase probe display panel.
 *
 * Shows the WDL verdict and per-move tablebase results for positions
 * with ≤ 7 pieces, using the Lichess tablebase API.
 *
 * Integration API:
 * - `<TablebasePanel result={...} line={...} isLoading={...} enabled={...}
 *     onToggle={...} t={...} />`
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onToggle(enabled)` fires when the user enables/disables the panel.
 */

import { useCallback, type ReactElement } from "react";
import type { TbProbeResult, TbWdl, TbMoveEntry, TbMainLine } from "../../../resources/ext_databases/endgame_types";
import { UI_IDS } from "../../../core/model/ui_ids";

type TablebasePanelProps = {
  result: TbProbeResult | null;
  line: TbMainLine | null;
  isLoading: boolean;
  isLineLoading: boolean;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /** Called with the UCI string of the selected move (e.g. "e2e4"). */
  onMoveClick?: (uci: string) => void;
  t: (key: string, fallback?: string) => string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const wdlLabel = (wdl: TbWdl): string => {
  switch (wdl) {
    case "win":          return "Win";
    case "cursed_win":   return "Cursed Win";
    case "draw":         return "Draw";
    case "blessed_loss": return "Blessed Loss";
    case "loss":         return "Loss";
    default:             return "Unknown";
  }
};

const wdlClass = (wdl: TbWdl): string => {
  switch (wdl) {
    case "win":          return "tb-wdl--win";
    case "cursed_win":   return "tb-wdl--cursed-win";
    case "draw":         return "tb-wdl--draw";
    case "blessed_loss": return "tb-wdl--blessed-loss";
    case "loss":         return "tb-wdl--loss";
    default:             return "tb-wdl--unknown";
  }
};

/** Inline abbreviation element for DTZ with a plain-language tooltip. */
const Dtz = ({ value }: { value: number }): ReactElement => (
  <>
    <abbr className="tb-dtz-abbr" title="Distance to zeroing — half-moves until a capture or pawn move resets the 50-move clock">DTZ</abbr>
    {" "}{value}
  </>
);

// ── Sub-components ─────────────────────────────────────────────────────────────

const MoveRow = ({
  move,
  onMoveClick,
}: {
  move: TbMoveEntry;
  onMoveClick?: (uci: string) => void;
}): ReactElement => (
  <tr
    className={`tb-move-row${onMoveClick ? " tb-move-row--clickable" : ""}`}
    onClick={onMoveClick ? () => onMoveClick(move.uci) : undefined}
    title={onMoveClick ? `${move.san} — click to play` : undefined}
  >
    <td className="tb-move-san">{move.san}</td>
    <td className="tb-move-dtz">
      {move.dtz !== undefined && <Dtz value={move.dtz} />}
    </td>
    <td className="tb-move-flags">
      {move.checkmate && <span className="tb-flag tb-flag--mate">✓</span>}
      {move.stalemate && <span className="tb-flag tb-flag--stale">½</span>}
      {move.zeroing && !move.checkmate && (
        <span className="tb-flag tb-flag--zero" title="Zeroing move">0</span>
      )}
    </td>
  </tr>
);

type MoveGroupProps = {
  label: string;
  moves: TbMoveEntry[];
  wdl: TbWdl;
  onMoveClick?: (uci: string) => void;
};

const MoveGroup = ({ label, moves, wdl, onMoveClick }: MoveGroupProps): ReactElement | null => {
  if (moves.length === 0) return null;
  return (
    <div className="tb-group">
      <div className={`tb-group-header ${wdlClass(wdl)}`}>{label}</div>
      <table className="tb-moves-table">
        <tbody>
          {moves.map((m) => (
            <MoveRow key={m.uci} move={m} onMoveClick={onMoveClick} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Renders the main-line continuation as a PV token row. */
const MainLine = ({ line }: { line: TbMainLine }): ReactElement | null => {
  if (line.moves.length === 0) return null;

  const tokens: ReactElement[] = [];
  let moveNumber = 1;
  let isWhiteMove = line.startColor === "w";

  if (!isWhiteMove) {
    tokens.push(
      <span key="start-num" className="tb-pv-num">1…</span>
    );
  }

  line.moves.forEach((move) => {
    if (isWhiteMove) {
      tokens.push(
        <span key={`num-${move.uci}`} className="tb-pv-num">{moveNumber}.</span>
      );
    }
    tokens.push(
      <span key={`mv-${move.uci}`} className={`tb-pv-move ${wdlClass(move.wdl)}`}>{move.san}</span>
    );
    if (isWhiteMove) {
      isWhiteMove = false;
    } else {
      moveNumber++;
      isWhiteMove = true;
    }
  });

  if (line.terminal === "mate")      tokens.push(<span key="term" className="tb-pv-terminal">✓</span>);
  if (line.terminal === "stalemate") tokens.push(<span key="term" className="tb-pv-terminal">½</span>);

  return (
    <div className="tb-main-line">
      <span className="tb-main-line-label">Best:</span>
      <span className="tb-pv">{tokens}</span>
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Collapsible panel showing endgame tablebase results for the current position.
 */
export const TablebasePanel = ({
  result,
  line,
  isLoading,
  isLineLoading,
  enabled,
  onToggle,
  onMoveClick,
  t,
}: TablebasePanelProps): ReactElement => {
  const handleToggle = useCallback((): void => {
    onToggle(!enabled);
  }, [enabled, onToggle]);

  // Group and sort moves by outcome.
  const byDtzAsc  = (a: TbMoveEntry, b: TbMoveEntry): number => (a.dtz ?? 999) - (b.dtz ?? 999);
  const byDtzDesc = (a: TbMoveEntry, b: TbMoveEntry): number => (b.dtz ?? 999) - (a.dtz ?? 999);

  const winningMoves = result ? result.moves.filter((m) => m.wdl === "win" || m.wdl === "cursed_win").sort(byDtzAsc)  : [];
  const drawingMoves = result ? result.moves.filter((m) => m.wdl === "draw" || m.wdl === "blessed_loss")              : [];
  const losingMoves  = result ? result.moves.filter((m) => m.wdl === "loss" || m.wdl === "unknown").sort(byDtzDesc)   : [];

  // First best move derived synchronously from the initial probe result so something
  // is always shown inside the moves area while probeLine fetches the full continuation.
  const firstBestMove: TbMoveEntry | null = result
    ? (winningMoves[0] ?? drawingMoves[0] ?? losingMoves[0] ?? null)
    : null;

  return (
    <div className="tablebase-panel" data-ui-id={UI_IDS.TABLEBASE_PANEL}>
      {/* Header */}
      <div className="tablebase-panel-header" data-ui-id={UI_IDS.TABLEBASE_PANEL_HEADER}>
        <span className="tablebase-panel-title">
          {t("tablebase.panel.title", "Tablebase")}
        </span>

        {result && (
          <span className={`tablebase-verdict ${wdlClass(result.wdl)}${isLoading ? " tablebase-verdict--stale" : ""}`}>
            {wdlLabel(result.wdl)}
            {result.dtz !== undefined && (
              <span className="tablebase-verdict-dtz"> <Dtz value={result.dtz} /></span>
            )}
          </span>
        )}

        {isLoading && <span className="tablebase-spinner" aria-label="Loading" />}

        <button
          type="button"
          className={`tablebase-toggle-btn${enabled ? " tablebase-toggle-btn--active" : ""}`}
          onClick={handleToggle}
        >
          {enabled
            ? t("tablebase.panel.disable", "Off")
            : t("tablebase.panel.enable", "On")}
        </button>
      </div>

      {/* Body */}
      {enabled && (
        <div className="tablebase-panel-body">
          {!isLoading && !result && (
            <p className="tablebase-empty">
              {t("tablebase.panel.noData", "Position not in tablebase (> 7 pieces or no data).")}
            </p>
          )}

          {result?.insufficientMaterial && (
            <p className="tablebase-insuf">
              {t("tablebase.panel.insuf", "Insufficient material — drawn.")}
            </p>
          )}

          {firstBestMove && (
            <div className="tb-groups" data-ui-id={UI_IDS.TABLEBASE_MOVES}>
              {/* Best-line row — full continuation when probeLine has finished,
                  single best move immediately while it is still fetching. */}
              {(line && line.moves.length > 0)
                ? <MainLine line={line} />
                : (
                  <div className="tb-main-line">
                    <span className="tb-main-line-label">Best:</span>
                    <span className="tb-pv">
                      <span className={`tb-pv-move ${wdlClass(firstBestMove.wdl)}`}>{firstBestMove.san}</span>
                      {isLineLoading && <span className="tb-pv-ellipsis">⋯</span>}
                    </span>
                  </div>
                )
              }
              <MoveGroup label={t("tablebase.group.winning", "Winning")} moves={winningMoves} wdl="win"  onMoveClick={onMoveClick} />
              <MoveGroup label={t("tablebase.group.drawing", "Drawing")} moves={drawingMoves} wdl="draw" onMoveClick={onMoveClick} />
              <MoveGroup label={t("tablebase.group.losing",  "Losing")}  moves={losingMoves}  wdl="loss" onMoveClick={onMoveClick} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
