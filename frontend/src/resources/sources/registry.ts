/**
 * Registry module.
 *
 * Integration API:
 * - Primary exports from this module: `createSourceRegistry`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through typed return values and callbacks; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

/**
 * Create source adapter registry.
 *
 * @param {Array<{kind: string}>} adapters - Adapter instances.
 * @returns {{getAdapterByKind: Function, getAdapterForSourceRef: Function, listKinds: Function}} Registry API.
 */
export const createSourceRegistry = (adapters: any): any => {
  const adapterByKind = new Map();
  (Array.isArray(adapters) ? adapters : []).forEach((adapter: any): any => {
    if (!adapter || typeof adapter.kind !== "string") return;
    adapterByKind.set(adapter.kind, adapter);
  });

  /**
   * Resolve adapter by kind.
   *
   * @param {string} kind - Source kind.
   * @returns {object} Adapter instance.
   * @throws {Error} Propagates when source kind is missing/unsupported.
   * @throws {Error} When no adapter is registered for `kind`.
   */
  const getAdapterByKind = (kind: any): any => {
    const adapter = adapterByKind.get(String(kind || ""));
    if (!adapter) throw new Error(`Unsupported source kind: ${String(kind || "")}`);
    return adapter;
  };

  /**
   * Resolve adapter for source reference.
   *
   * @param {{kind?: string}} sourceRef - Source reference object.
   * @returns {object} Adapter instance.
   * @throws {Error} When no adapter is registered for `kind`.
   */
  const getAdapterForSourceRef = (sourceRef: any): any => getAdapterByKind(sourceRef?.kind || "");

  return {
    getAdapterByKind,
    getAdapterForSourceRef,
    listKinds: (): any => [...adapterByKind.keys()],
  };
};

