/**
 * TextSearchPanel — full-text search across all open resources by player name,
 * event, or site.
 *
 * Integration API:
 * - `<TextSearchPanel t={t} onOpenGame={onOpenGame} />` — self-contained; manages
 *   its own query state and calls `services.searchByText` via hook.
 *
 * Configuration API:
 * - `t: (key, fallback?) => string` — translator function.
 * - `onOpenGame: (sourceRef) => void` — called when the user opens a result row.
 * - `externalSearch?: { query: string }` — when a new object reference is supplied
 *   the panel sets its query to `query` and triggers a search immediately.
 *   Designed for the Players panel "search" action.
 *
 * Communication API:
 * - Inbound: reads open resource tabs from `AppStoreState` via `selectResourceViewerTabs`.
 * - Outbound: `onOpenGame(sourceRef)` when the user clicks a result row.
 */

import { useState, useCallback, useEffect, useMemo, type ReactElement, type KeyboardEvent } from "react";
import { useAppContext } from "../../../app/providers/AppStateProvider";
import { useServiceContext } from "../../../app/providers/ServiceProvider";
import { selectResourceViewerTabs } from "../../../core/state/selectors";
import { isPgnResourceRef } from "../../../../../parts/resource/src/domain/resource_ref";
import type { TextSearchHit } from "../../../../../parts/resource/src/client/search_coordinator";
import type { PgnResourceRef } from "../../../../../parts/resource/src/domain/resource_ref";
import { UI_IDS } from "../../../core/model/ui_ids";
import { resourceDomainEvents } from "../../../core/events/resource_domain_events";
import { matchesResourceRefSet, toResourceKey } from "../services/resource_event_matching";
import { shouldTriggerLiveRefresh } from "../services/resource_live_refresh";

type TextSearchPanelProps = {
  t: (key: string, fallback?: string) => string;
  onOpenGame: (sourceRef: unknown) => void;
  externalSearch?: { query: string };
  liveRefreshEnabled?: boolean;
};

const hitLabel = (hit: TextSearchHit): string => {
  const id = hit.gameRef.recordId ?? hit.gameRef.locator;
  const resource = (/([^/]+)\/?$/.exec(hit.resourceRef.locator))?.[1] ?? hit.resourceRef.locator;
  return `${resource} — ${id}`;
};

export const TextSearchPanel = ({
  t,
  onOpenGame,
  externalSearch,
  liveRefreshEnabled = true,
}: TextSearchPanelProps): ReactElement => {
  const { state } = useAppContext();
  const services = useServiceContext();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TextSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [refreshRevision, setRefreshRevision] = useState(0);

  const tabs = selectResourceViewerTabs(state);
  const resourceRefs: PgnResourceRef[] = tabs
    .map((tab) => ({ kind: tab.kind, locator: tab.locator }))
    .filter(isPgnResourceRef);
  const refsKey: string = resourceRefs.map((ref: PgnResourceRef): string => `${ref.kind}:${ref.locator}`).join("|");
  const resourceRefSet: Set<string> = useMemo(
    (): Set<string> =>
      new Set<string>(resourceRefs.map((ref: PgnResourceRef): string => toResourceKey(ref.kind, ref.locator))),
    [refsKey],
  );

  const searchWithQuery = useCallback((q: string): void => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    if (resourceRefs.length === 0) {
      setResults([]);
      setHasSearched(true);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    void services.searchByText(trimmed, resourceRefs).then((hits) => {
      setResults(hits);
      setLoading(false);
    });
  }, [refsKey, services]);

  const search = useCallback((): void => {
    searchWithQuery(query);
  }, [query, searchWithQuery]);

  const onKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") search();
  }, [search]);

  // When an external search is triggered (e.g. from the Players panel), update
  // the query and run the search immediately using the supplied query string.
  useEffect(() => {
    if (!externalSearch) return;
    setQuery(externalSearch.query);
    searchWithQuery(externalSearch.query);
  }, [externalSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect((): (() => void) => {
    const unsubscribe: () => void = resourceDomainEvents.subscribe((event): void => {
      if (event.type !== "resource.resourceChanged") return;
      const hasMatchingRef: boolean = matchesResourceRefSet(event.resourceRef, resourceRefSet);
      const shouldRefresh: boolean = shouldTriggerLiveRefresh({
        liveRefreshEnabled,
        hasSearched,
        isLoading: loading,
        hasMatchingResourceRef: hasMatchingRef,
        queryText: query,
      });
      if (!shouldRefresh) return;
      setRefreshRevision((value: number): number => value + 1);
    });
    return (): void => {
      unsubscribe();
    };
  }, [hasSearched, liveRefreshEnabled, loading, resourceRefSet]);

  useEffect((): void => {
    if (!liveRefreshEnabled || !hasSearched || refreshRevision === 0) return;
    if (!query.trim()) return;
    searchWithQuery(query);
  }, [hasSearched, liveRefreshEnabled, query, refreshRevision, searchWithQuery]);

  return (
    <div className="text-search-panel" data-ui-id={UI_IDS.TEXT_SEARCH_PANEL}>
      {/* Header */}
      <div className="text-search-panel-header" data-ui-id={UI_IDS.TEXT_SEARCH_HEADER}>
        <span className="text-search-panel-title">
          {t("textSearch.title", "Game Search")}
        </span>
      </div>

      {/* Query input */}
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

      {/* Empty state */}
      {results.length === 0 && !loading && query.trim() !== "" && (
        <div className="text-search-panel-empty">
          {t("textSearch.empty", "No matching games found.")}
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <ul className="text-search-panel-results">
          {results.map((hit) => (
            <li key={`${hit.resourceRef.locator}:${hit.gameRef.recordId ?? hit.gameRef.locator}`} className="text-search-panel-result">
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
