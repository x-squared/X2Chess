/**
 * Source adapter registry.
 *
 * Integration API:
 * - Create with `createSourceRegistry(adapters)` and keep returned object in the
 *   gateway/composition layer.
 * - Resolve adapters via `getAdapterByKind(kind)` or
 *   `getAdapterForSourceRef(sourceRef)` before list/load/save calls.
 *
 * Configuration API:
 * - Adapter set is fully caller-defined.
 * - Each adapter must expose a unique string `kind`.
 *
 * Communication API:
 * - Inbound: adapter registration list and lookup requests.
 * - Outbound: adapter instance for the requested kind/sourceRef.
 * - Throws early for unsupported kinds to keep gateway failures explicit.
 */

/**
 * Create source adapter registry.
 *
 * @param {Array<{kind: string}>} adapters - Adapter instances.
 * @returns {{getAdapterByKind: Function, getAdapterForSourceRef: Function, listKinds: Function}} Registry API.
 */
export const createSourceRegistry = (adapters) => {
  const adapterByKind = new Map();
  (Array.isArray(adapters) ? adapters : []).forEach((adapter) => {
    if (!adapter || typeof adapter.kind !== "string") return;
    adapterByKind.set(adapter.kind, adapter);
  });

  /**
   * Resolve adapter by kind.
   *
   * @param {string} kind - Source kind.
   * @returns {object} Adapter instance.
   */
  const getAdapterByKind = (kind) => {
    const adapter = adapterByKind.get(String(kind || ""));
    if (!adapter) throw new Error(`Unsupported source kind: ${String(kind || "")}`);
    return adapter;
  };

  /**
   * Resolve adapter for source reference.
   *
   * @param {{kind?: string}} sourceRef - Source reference object.
   * @returns {object} Adapter instance.
   */
  const getAdapterForSourceRef = (sourceRef) => getAdapterByKind(sourceRef?.kind || "");

  return {
    getAdapterByKind,
    getAdapterForSourceRef,
    listKinds: () => [...adapterByKind.keys()],
  };
};

