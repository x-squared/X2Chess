/**
 * TextSearchPanel — full-text search across all open resources by player name,
 * event, or site.
 *
 * Integration API:
 * - `<TextSearchPanel t={t} onOpenGame={onOpenGame} />` — self-contained; manages
 *   its own query state and calls `services.searchByText` via hook.
 *
 * Configuration API:
 * - None.
 *
 * Communication API:
 * - Inbound: reads open resource tabs from `AppStoreState` via `useTextSearch`.
 * - Outbound: `onOpenGame(sourceRef)` when the user clicks a result row.
 */

import { useState, useCallback, type ReactElement, type KeyboardEvent } from "react";
import { useAppContext } from "../../state/app_context";
import { useServiceContext } from "../../state/ServiceContext";
import { selectResourceViewerTabs } from "../../state/selectors";
import { isPgnResourceRef } from "../../../../resource/domain/resource_ref";
import type { TextSearchHit } from "../../../../resource/client/search_coordinator";
import type { PgnResourceRef } from "../../../../resource/domain/resource_ref";
import { GUIDE_IDS } from "../../guide/guide_ids";

type TextSearchPanelProps = {
  t: (key: string, fallback?: string) => string;
  onOpenGame: (sourceRef: unknown) => void;
};

const hitLabel = (hit: TextSearchHit): string => {
  const id = hit.gameRef.recordId ?? hit.gameRef.locator;
  const resource = hit.resourceRef.locator.split("/").filter(Boolean).at(-1) ?? hit.resourceRef.locator;
  return `${resource} — ${id}`;
};

export const TextSearchPanel = ({ t, onOpenGame }: TextSearchPanelProps): ReactElement => {
  const { state } = useAppContext();
  const services = useServiceContext();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TextSearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback((): void => {
    const q = query.trim();
    if (!q) return;

    const tabs = selectResourceViewerTabs(state);
    const resourceRefs: PgnResourceRef[] = tabs
      .map((tab) => ({ kind: tab.kind, locator: tab.locator }))
      .filter(isPgnResourceRef);

    if (resourceRefs.length === 0) {
      setResults([]);
      return;
    }

    setLoading(true);
    void services.searchByText(q, resourceRefs).then((hits) => {
      setResults(hits);
      setLoading(false);
    });
  }, [query, state, services]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") search();
  }, [search]);

  return (
    <div className="text-search-panel" data-guide-id={GUIDE_IDS.TEXT_SEARCH_PANEL}>
      <div className="text-search-panel-header" data-guide-id={GUIDE_IDS.TEXT_SEARCH_HEADER}>
        <span className="text-search-panel-title">
          {t("textSearch.title", "Game Search")}
        </span>
      </div>
      <div className="text-search-panel-input-row">
        <input
          className="text-search-panel-input"
          type="text"
          placeholder={t("textSearch.placeholder", "Player, event, site…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          className="text-search-panel-btn"
          onClick={search}
          disabled={loading || query.trim() === ""}
        >
          {loading
            ? t("textSearch.searching", "…")
            : t("textSearch.search", "Search")}
        </button>
      </div>

      {results.length === 0 && !loading && query.trim() !== "" && (
        <div className="text-search-panel-empty">
          {t("textSearch.empty", "No matching games found.")}
        </div>
      )}

      {results.length > 0 && (
        <ul className="text-search-panel-results">
          {results.map((hit, i) => (
            <li key={i} className="text-search-panel-result">
              <span className="text-search-panel-result-label" title={hitLabel(hit)}>
                {hitLabel(hit)}
              </span>
              <button
                className="text-search-panel-open-btn"
                onClick={() => onOpenGame({
                  kind: hit.gameRef.kind,
                  locator: hit.gameRef.locator,
                  recordId: hit.gameRef.recordId,
                })}
              >
                {t("textSearch.open", "Open")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
