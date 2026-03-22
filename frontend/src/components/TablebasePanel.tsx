/**
 * TablebasePanel — endgame tablebase probe display panel.
 *
 * Shows the WDL verdict and per-move tablebase results for positions
 * with ≤ 7 pieces, using the Lichess tablebase API.
 *
 * Integration API:
 * - `<TablebasePanel result={...} isLoading={...} enabled={...}
 *     onToggle={...} t={...} />`
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onToggle(enabled)` fires when the user enables/disables the panel.
 */

import { useCallback, type ReactElement } from "react";
import type { TbProbeResult, TbWdl, TbMoveEntry } from "../resources/ext_databases/endgame_types";

type TablebasePanelProps = {
  result: TbProbeResult | null;
  isLoading: boolean;
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
      {move.dtz !== undefined ? `DTZ ${move.dtz}` : ""}
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

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Collapsible panel showing endgame tablebase results for the current position.
 */
export const TablebasePanel = ({
  result,
  isLoading,
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

  const winningMoves  = result ? result.moves.filter((m) => m.wdl === "win" || m.wdl === "cursed_win").sort(byDtzAsc)  : [];
  const drawingMoves  = result ? result.moves.filter((m) => m.wdl === "draw" || m.wdl === "blessed_loss")              : [];
  const losingMoves   = result ? result.moves.filter((m) => m.wdl === "loss" || m.wdl === "unknown").sort(byDtzDesc)   : [];

  return (
    <div className="tablebase-panel">
      {/* Header */}
      <div className="tablebase-panel-header">
        <span className="tablebase-panel-title">
          {t("tablebase.panel.title", "Tablebase")}
        </span>

        {result && !isLoading && (
          <span className={`tablebase-verdict ${wdlClass(result.wdl)}`}>
            {wdlLabel(result.wdl)}
            {result.dtz !== undefined && (
              <span className="tablebase-verdict-dtz"> DTZ {result.dtz}</span>
            )}
          </span>
        )}

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
          {isLoading && (
            <p className="tablebase-loading">
              {t("tablebase.panel.loading", "Probing…")}
            </p>
          )}

          {!isLoading && !result && (
            <p className="tablebase-empty">
              {t("tablebase.panel.noData", "Position not in tablebase (> 7 pieces or no data).")}
            </p>
          )}

          {!isLoading && result?.insufficientMaterial && (
            <p className="tablebase-insuf">
              {t("tablebase.panel.insuf", "Insufficient material — drawn.")}
            </p>
          )}

          {!isLoading && result && (winningMoves.length > 0 || drawingMoves.length > 0 || losingMoves.length > 0) && (
            <div className="tb-groups">
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
