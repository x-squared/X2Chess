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

const MoveRow = ({ move }: { move: TbMoveEntry }): ReactElement => (
  <tr className="tb-move-row">
    <td className="tb-move-san">{move.san}</td>
    <td className={`tb-move-wdl ${wdlClass(move.wdl)}`}>
      {wdlLabel(move.wdl)}
    </td>
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

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Collapsible panel showing endgame tablebase results for the current position.
 */
export const TablebasePanel = ({
  result,
  isLoading,
  enabled,
  onToggle,
  t,
}: TablebasePanelProps): ReactElement => {
  const handleToggle = useCallback((): void => {
    onToggle(!enabled);
  }, [enabled, onToggle]);

  // Sort moves: wins first (by dtz asc), then draws, then losses (by dtz desc).
  const sortedMoves = result ? [...result.moves].sort((a, b) => {
    const order: Record<TbWdl, number> = {
      win: 0, cursed_win: 1, draw: 2, blessed_loss: 3, loss: 4, unknown: 5,
    };
    const diff = order[a.wdl] - order[b.wdl];
    if (diff !== 0) return diff;
    if (a.wdl === "win" || a.wdl === "cursed_win") {
      return (a.dtz ?? 999) - (b.dtz ?? 999);
    }
    if (a.wdl === "loss" || a.wdl === "blessed_loss") {
      return (b.dtz ?? 999) - (a.dtz ?? 999);
    }
    return 0;
  }) : [];

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

          {!isLoading && result && sortedMoves.length > 0 && (
            <table className="tb-moves-table">
              <thead>
                <tr>
                  <th>{t("tablebase.col.move", "Move")}</th>
                  <th>{t("tablebase.col.result", "Result")}</th>
                  <th>{t("tablebase.col.dtz", "DTZ")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedMoves.map((m) => (
                  <MoveRow key={m.uci} move={m} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
