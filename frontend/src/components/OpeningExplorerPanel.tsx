/**
 * OpeningExplorerPanel — opening statistics for the current board position.
 *
 * Shows move frequency, win/draw/loss bars, and the opening name from the
 * Lichess opening explorer API. Updates automatically as the user navigates.
 *
 * Integration API:
 * - `<OpeningExplorerPanel result={...} isLoading={...} source={...}
 *     onSourceChange={...} enabled={...} onToggle={...} t={...} />`
 *
 * Configuration API:
 * - No global configuration.
 *
 * Communication API:
 * - `onSourceChange(source)` fires when the user switches masters/lichess.
 * - `onToggle(enabled)` fires when the user enables/disables the panel.
 */

import { useCallback, type ReactElement } from "react";
import type { OpeningResult, OpeningMove } from "../resources/ext_databases/opening_types";

type OpeningExplorerPanelProps = {
  result: OpeningResult | null;
  isLoading: boolean;
  source: "masters" | "lichess";
  onSourceChange: (source: "masters" | "lichess") => void;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  /** Opens the external database settings dialog (E9). */
  onOpenSettings: () => void;
  t: (key: string, fallback?: string) => string;
};

// ── Formatting helpers ─────────────────────────────────────────────────────────

const pct = (n: number, total: number): string =>
  total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;

const formatGames = (n: number): string =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(0)}k`
      : String(n);

// ── Sub-components ─────────────────────────────────────────────────────────────

const WdlBar = ({
  white,
  draws,
  black,
  total,
}: {
  white: number;
  draws: number;
  black: number;
  total: number;
}): ReactElement => {
  const wp = (white / total) * 100;
  const dp = (draws / total) * 100;
  const bp = (black / total) * 100;

  return (
    <div className="opening-wdl-bar" title={`W${pct(white, total)} D${pct(draws, total)} L${pct(black, total)}`}>
      <div className="opening-wdl-bar-white" style={{ width: `${wp}%` }} />
      <div className="opening-wdl-bar-draw" style={{ width: `${dp}%` }} />
      <div className="opening-wdl-bar-black" style={{ width: `${bp}%` }} />
    </div>
  );
};

const MoveRow = ({
  move,
  totalGames,
}: {
  move: OpeningMove;
  totalGames: number;
}): ReactElement => {
  const moveTotal = move.white + move.draws + move.black;
  return (
    <tr className="opening-move-row">
      <td className="opening-move-san">{move.san}</td>
      <td className="opening-move-games">{formatGames(moveTotal)}</td>
      <td className="opening-move-pct">{pct(moveTotal, totalGames)}</td>
      <td className="opening-move-bar">
        <WdlBar white={move.white} draws={move.draws} black={move.black} total={moveTotal} />
      </td>
      <td className="opening-move-wdl">
        {pct(move.white, moveTotal)}
        <span className="opening-wdl-sep">/</span>
        {pct(move.draws, moveTotal)}
        <span className="opening-wdl-sep">/</span>
        {pct(move.black, moveTotal)}
      </td>
    </tr>
  );
};

// ── Component ──────────────────────────────────────────────────────────────────

/**
 * Collapsible panel showing opening explorer statistics for the current position.
 */
export const OpeningExplorerPanel = ({
  result,
  isLoading,
  source,
  onSourceChange,
  enabled,
  onToggle,
  onOpenSettings,
  t,
}: OpeningExplorerPanelProps): ReactElement => {
  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      onSourceChange(e.target.value as "masters" | "lichess");
    },
    [onSourceChange],
  );

  const handleToggle = useCallback((): void => {
    onToggle(!enabled);
  }, [enabled, onToggle]);

  return (
    <div className="opening-explorer-panel">
      {/* Header */}
      <div className="opening-explorer-header">
        <span className="opening-explorer-title">
          {t("opening.panel.title", "Opening Explorer")}
        </span>

        <select
          className="opening-explorer-source-select"
          value={source}
          onChange={handleSourceChange}
          disabled={!enabled}
          aria-label={t("opening.panel.sourceLabel", "Database source")}
        >
          <option value="masters">{t("opening.source.masters", "Masters")}</option>
          <option value="lichess">{t("opening.source.lichess", "Lichess")}</option>
        </select>

        <button
          type="button"
          className="opening-explorer-settings-btn"
          aria-label={t("opening.panel.settings", "Settings")}
          title={t("opening.panel.settings", "Settings")}
          onClick={onOpenSettings}
        >
          ⚙
        </button>

        <button
          type="button"
          className={`opening-explorer-toggle-btn${enabled ? " opening-explorer-toggle-btn--active" : ""}`}
          onClick={handleToggle}
        >
          {enabled
            ? t("opening.panel.disable", "Off")
            : t("opening.panel.enable", "On")}
        </button>
      </div>

      {/* Body */}
      {enabled && (
        <div className="opening-explorer-body">
          {isLoading && (
            <p className="opening-explorer-loading">
              {t("opening.panel.loading", "Loading…")}
            </p>
          )}

          {!isLoading && !result && (
            <p className="opening-explorer-empty">
              {t("opening.panel.noData", "No data for this position.")}
            </p>
          )}

          {!isLoading && result && (
            <>
              {/* Opening name + total game count */}
              <div className="opening-explorer-info">
                {result.openingName && (
                  <span className="opening-explorer-name">{result.openingName}</span>
                )}
                <span className="opening-explorer-total">
                  {formatGames(result.totalGames)}{" "}
                  {t("opening.panel.games", "games")}
                </span>
              </div>

              {/* Position WDL bar */}
              <WdlBar
                white={result.white}
                draws={result.draws}
                black={result.black}
                total={result.totalGames}
              />

              {/* Move table */}
              {result.moves.length > 0 && (
                <table className="opening-moves-table">
                  <thead>
                    <tr>
                      <th>{t("opening.col.move", "Move")}</th>
                      <th>{t("opening.col.games", "Games")}</th>
                      <th>{t("opening.col.freq", "%")}</th>
                      <th>{t("opening.col.bar", "")}</th>
                      <th>{t("opening.col.wdl", "W / D / L")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.moves.slice(0, 10).map((m) => (
                      <MoveRow key={m.uci} move={m} totalGames={result.totalGames} />
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
