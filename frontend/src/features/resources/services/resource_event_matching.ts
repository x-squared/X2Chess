/**
 * resource_event_matching — shared matching helpers for resource mutation events.
 *
 * Integration API:
 * - `doesResourceChangeAffectTab(...)` decides whether a resource-change event
 *   should invalidate/reload a specific resource tab.
 * - `matchesResourceRefSet(...)` checks whether an event resource identity is
 *   relevant to a precomputed set of resource keys.
 * - `toResourceKey(...)` normalizes resource identity to a stable set key.
 *
 * Configuration API:
 * - No runtime configuration.
 *
 * Communication API:
 * - Pure helper module with no side effects.
 */

export type ResourceIdentity = {
  kind: string;
  locator: string;
};

/**
 * Build a stable key from a resource identity.
 *
 * @param kind Resource kind (`file`, `directory`, `db`).
 * @param locator Resource locator/path.
 * @returns Stable `${kind}:${locator}` key.
 */
export const toResourceKey = (kind: string, locator: string): string => `${kind}:${locator}`;

/**
 * Check whether a resource-change locator should refresh a given tab locator.
 *
 * For directory tabs, change events may carry file locators inside the directory
 * (for example `<dir>/games/new-game.pgn`). Those must still refresh the tab.
 *
 * @param tabKind Kind of the open tab resource.
 * @param tabLocator Locator of the open tab resource.
 * @param changedKind Kind reported by the change event.
 * @param changedLocator Locator reported by the change event.
 * @returns `true` when the change event affects the tab.
 */
export const doesResourceChangeAffectTab = (
  tabKind: string,
  tabLocator: string,
  changedKind: string,
  changedLocator: string,
): boolean => {
  if (tabKind !== changedKind) return false;
  if (tabLocator === changedLocator) return true;
  if (tabKind !== "directory") return false;
  const normalizedTabLocator: string = tabLocator.replace(/\/+$/, "");
  const normalizedChangedLocator: string = changedLocator.replace(/\/+$/, "");
  if (!normalizedTabLocator || !normalizedChangedLocator) return false;
  const tabPrefix: string = `${normalizedTabLocator}/`;
  return normalizedChangedLocator.startsWith(tabPrefix);
};

/**
 * Check whether a resource identity is present in a precomputed key set.
 *
 * @param resourceRef Event resource identity.
 * @param resourceRefSet Set containing `toResourceKey(...)` entries.
 * @returns `true` when the resource exists in the set.
 */
export const matchesResourceRefSet = (
  resourceRef: ResourceIdentity,
  resourceRefSet: Set<string>,
): boolean => resourceRefSet.has(toResourceKey(resourceRef.kind, resourceRef.locator));
