/**
 * resource_tab_refresh — helpers for event-driven resource tab invalidation.
 *
 * Integration API:
 * - `collectAffectedResourceTabIds(...)` returns tab IDs that must be reloaded
 *   for a given resource mutation event.
 *
 * Configuration API:
 * - No runtime configuration.
 *
 * Communication API:
 * - Pure helper module with no side effects.
 */

import { doesResourceChangeAffectTab } from "./resource_event_matching";

export type ResourceTabIdentity = {
  tabId: string;
  kind: string;
  locator: string;
};

export type ResourceTabReloadPlanItem = {
  tabId: string;
  resourceRef: {
    kind: string;
    locator: string;
  };
};

/**
 * Collect tab IDs affected by a resource mutation event.
 *
 * @param tabs Open resource tabs with identity fields.
 * @param changedKind Event resource kind.
 * @param changedLocator Event resource locator.
 * @returns Ordered list of affected `tabId` values.
 */
export const collectAffectedResourceTabIds = (
  tabs: ResourceTabIdentity[],
  changedKind: string,
  changedLocator: string,
): string[] =>
  tabs
    .filter((tab: ResourceTabIdentity): boolean =>
      doesResourceChangeAffectTab(tab.kind, tab.locator, changedKind, changedLocator),
    )
    .map((tab: ResourceTabIdentity): string => tab.tabId);

/**
 * Build reload plan entries for tabs affected by a mutation event.
 *
 * @param tabs Open tabs with identity and reload reference data.
 * @param changedKind Event resource kind.
 * @param changedLocator Event resource locator.
 * @returns Ordered list of reload plan items.
 */
export const buildResourceTabReloadPlan = (
  tabs: ResourceTabReloadPlanItem[],
  changedKind: string,
  changedLocator: string,
): ResourceTabReloadPlanItem[] => {
  const affectedTabIdSet: Set<string> = new Set<string>(
    collectAffectedResourceTabIds(
      tabs.map((tab: ResourceTabReloadPlanItem): ResourceTabIdentity => ({
        tabId: tab.tabId,
        kind: tab.resourceRef.kind,
        locator: tab.resourceRef.locator,
      })),
      changedKind,
      changedLocator,
    ),
  );
  return tabs.filter((tab: ResourceTabReloadPlanItem): boolean => affectedTabIdSet.has(tab.tabId));
};
