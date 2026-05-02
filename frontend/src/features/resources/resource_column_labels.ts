/**
 * Shared column header labels for the resource viewer table and column-order UI.
 *
 * Integration API:
 * - `resolveResourceTableColumnLabel(key, t)` — human-readable title for a `metadataColumnOrder` key.
 */

/**
 * Resolve the visible table header title for a resource column key (`game` = Game ID, system keys, or raw tag).
 *
 * @param key Column key from `metadataColumnOrder`.
 * @param t App translator.
 * @returns Localised or passthrough label.
 */
export const resolveResourceTableColumnLabel = (
  key: string,
  t: (key: string, fallback?: string) => string,
): string => {
  if (key === "game") return t("resources.table.gameId", "Game ID");
  if (key === "identifier") return t("resources.table.identifier", "Identifier");
  if (key === "source") return t("resources.table.source", "Source");
  if (key === "revision") return t("resources.table.revision", "Revision");
  return key;
};
