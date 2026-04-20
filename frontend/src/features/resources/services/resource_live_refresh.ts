/**
 * resource_live_refresh — shared guards for event-driven live refresh behavior.
 *
 * Integration API:
 * - `shouldTriggerLiveRefresh(...)` decides whether a `resource.resourceChanged`
 *   event should trigger an automatic re-query for search/explorer hooks.
 *
 * Configuration API:
 * - No runtime configuration.
 *
 * Communication API:
 * - Pure helper module with no side effects.
 */

type LiveRefreshParams = {
  liveRefreshEnabled: boolean;
  hasSearched: boolean;
  isLoading: boolean;
  hasMatchingResourceRef: boolean;
  queryText?: string;
};

/**
 * Decide whether a resource change event should trigger a live refresh.
 *
 * @param params Guard parameters from current hook/component state.
 * @param params.liveRefreshEnabled User/feature-level live-refresh toggle.
 * @param params.hasSearched Whether at least one search has been executed.
 * @param params.isLoading Whether a search/query is currently in-flight.
 * @param params.hasMatchingResourceRef Whether the event resource is relevant.
 * @param params.queryText Optional text query; when provided, it must be non-empty.
 * @returns `true` when a live refresh should be scheduled.
 */
export const shouldTriggerLiveRefresh = ({
  liveRefreshEnabled,
  hasSearched,
  isLoading,
  hasMatchingResourceRef,
  queryText,
}: LiveRefreshParams): boolean => {
  if (!liveRefreshEnabled) return false;
  if (!hasSearched) return false;
  if (isLoading) return false;
  if (!hasMatchingResourceRef) return false;
  if (queryText?.trim() === "") return false;
  return true;
};
