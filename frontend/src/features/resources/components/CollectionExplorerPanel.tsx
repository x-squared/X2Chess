/**
 * CollectionExplorerPanel — opening/position explorer driven by own game collections.
 *
 * Shows, for the current board position, every move played in the indexed game
 * collections with frequency count and a W/D/L result bar. Clicking a move
 * executes it on the board.
 *
 * Integration API:
 * - `<CollectionExplorerPanel t={t} onMoveClick={onMoveClick} />` — self-contained;
 *   drives its own state via `useCollectionExplorer`.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Inbound: position and resource tabs from `AppStoreState` via hook.
 * - Outbound: `onMoveClick(uci)` when the user selects a move row.
 */

import type { ReactElement } from "react";
import { useCollectionExplorer } from "../hooks/useCollectionExplorer";
import type { MoveFrequencyEntry } from "../../../../../parts/resource/src/domain/move_frequency";
import { GUIDE_IDS } from "../../guide/model/guide_ids";

type CollectionExplorerPanelProps = {
  t: (key: string, fallback?: string) => string;
  /** Called with the UCI string of the selected move (e.g. "e2e4", "e7e8q"). */
  onMoveClick: (uci: string) => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Percentage as a CSS width string, clamped to [0, 100]. */
const pct = (n: number, total: number): string =>
  total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;

const ResultBar = ({ entry }: { entry: MoveFrequencyEntry }): ReactElement => {
  const { count, whiteWins, draws, blackWins } = entry;
  return (
    <div className="ce-result-bar" title={`W ${whiteWins} / D ${draws} / B ${blackWins}`}>
      <div className="ce-result-bar-w" style={{ width: pct(whiteWins, count) }} />
      <div className="ce-result-bar-d" style={{ width: pct(draws, count) }} />
      <div className="ce-result-bar-b" style={{ width: pct(blackWins, count) }} />
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────────────────────

export const CollectionExplorerPanel = ({ t, onMoveClick }: CollectionExplorerPanelProps): ReactElement => {
  const { entries, loading } = useCollectionExplorer();

  return (
    <div className="ce-panel" data-guide-id={GUIDE_IDS.COLLECTION_EXPLORER_PANEL}>
      <div className="ce-panel-header" data-guide-id={GUIDE_IDS.COLLECTION_EXPLORER_HEADER}>
        <span className="ce-panel-title">
          {t("collectionExplorer.title", "Collection Explorer")}
        </span>
        {loading && (
          <span className="ce-panel-loading">
            {t("collectionExplorer.loading", "…")}
          </span>
        )}
      </div>

      {!loading && entries.length === 0 && (
        <div className="ce-empty">
          {t("collectionExplorer.empty", "No games found for this position.")}
        </div>
      )}

      {entries.length > 0 && (
        <table className="ce-table">
          <thead>
            <tr>
              <th className="ce-col-move">{t("collectionExplorer.col.move", "Move")}</th>
              <th className="ce-col-count">{t("collectionExplorer.col.games", "Games")}</th>
              <th className="ce-col-bar">{t("collectionExplorer.col.results", "Results")}</th>
              <th className="ce-col-pct">{t("collectionExplorer.col.score", "Score%")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const score = entry.count === 0 ? 0 :
                Math.round(((entry.whiteWins + entry.draws * 0.5) / entry.count) * 100);
              return (
                <tr
                  key={entry.uci}
                  className="ce-row"
                  onClick={() => onMoveClick(entry.uci)}
                  title={`${entry.san} — click to play`}
                >
                  <td className="ce-col-move ce-move-san">{entry.san}</td>
                  <td className="ce-col-count">{entry.count}</td>
                  <td className="ce-col-bar"><ResultBar entry={entry} /></td>
                  <td className="ce-col-pct">{score}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};
