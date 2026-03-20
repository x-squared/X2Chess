/**
 * Resource loader service registry.
 *
 * Provides a module-level slot for the `listGamesForResource` function that is
 * populated by the legacy startup sequence (Slice 5) and later by `useAppStartup`
 * (Slice 7).  React components call `getResourceLoaderService()` to access the
 * function without depending on the legacy module graph.
 *
 * Integration API:
 * - `setResourceLoaderService(fn)` — called once by `start_runtime.ts` after
 *   `resourcesCapabilities` is created.
 * - `getResourceLoaderService()` — called by `ResourceViewer.tsx` to load rows.
 *
 * Configuration API:
 * - No configuration; the slot is `null` until explicitly set.
 *
 * Communication API:
 * - No events; pure synchronous getter/setter.
 */

/** Function signature matching `resourcesCapabilities.listGamesForResource`. */
export type ListGamesForResourceFn = (resourceRef: unknown) => Promise<unknown[]>;

let _service: ListGamesForResourceFn | null = null;

/**
 * Register the `listGamesForResource` implementation.
 * Called once from `start_runtime.ts` after `resourcesCapabilities` is created.
 */
export const setResourceLoaderService = (fn: ListGamesForResourceFn): void => {
  _service = fn;
};

/**
 * Retrieve the registered `listGamesForResource` function, or `null` if the
 * legacy runtime has not started yet.
 */
export const getResourceLoaderService = (): ListGamesForResourceFn | null => _service;
