/**
 * PositionSearchPanel — searches all open resources for the current board position.
 *
 * Displays a list of matching games across resources with a button to open each one.
 *
 * Integration API:
 * - `<PositionSearchPanel t={t} onOpenGame={onOpenGame} />` — self-contained;
 *   drives its own search via `usePositionSearch`.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Inbound: reads position from `AppStoreState` via `usePositionSearch`.
 * - Outbound: `onOpenGame(sourceRef)` when the user clicks a result row.
 */

import type { ReactElement } from "react";
import { usePositionSearch } from "../hooks/usePositionSearch";
import type { PositionSearchHit } from "../../../../../parts/resource/src/client/search_coordinator";
import { GUIDE_IDS } from "../../guide/model/guide_ids";

type PositionSearchPanelProps = {
  t: (key: string, fallback?: string) => string;
  onOpenGame: (sourceRef: unknown) => void;
};

const hitLabel = (hit: PositionSearchHit): string => {
  const id = hit.gameRef.recordId ?? hit.gameRef.locator;
  const resource = hit.resourceRef.locator.split("/").filter(Boolean).at(-1) ?? hit.resourceRef.locator;
  return `${resource} — ${id}`;
};

export const PositionSearchPanel = ({ t, onOpenGame }: PositionSearchPanelProps): ReactElement => {
  const { results, loading, search } = usePositionSearch();

  return (
    <div className="pos-search-panel" data-guide-id={GUIDE_IDS.POSITION_SEARCH_PANEL}>
      <div className="pos-search-panel-header" data-guide-id={GUIDE_IDS.POSITION_SEARCH_HEADER}>
        <span className="pos-search-panel-title">
          {t("posSearch.title", "Position Search")}
        </span>
        <button
          className="pos-search-panel-btn"
          onClick={search}
          disabled={loading}
        >
          {loading
            ? t("posSearch.searching", "Searching…")
            : t("posSearch.search", "Search")}
        </button>
      </div>

      {results.length === 0 && !loading && (
        <div className="pos-search-panel-empty">
          {t("posSearch.empty", "No matching games found.")}
        </div>
      )}

      {results.length > 0 && (
        <ul className="pos-search-panel-results">
          {results.map((hit, i) => (
            <li
              key={i}
              className="pos-search-panel-result"
              title={hitLabel(hit)}
            >
              <span className="pos-search-panel-result-label">{hitLabel(hit)}</span>
              <button
                className="pos-search-panel-open-btn"
                onClick={() => onOpenGame({
                  kind: hit.gameRef.kind,
                  locator: hit.gameRef.locator,
                  recordId: hit.gameRef.recordId,
                })}
              >
                {t("posSearch.open", "Open")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
