/**
 * Source adapter registry.
 *
 * Integration API:
 * - `createSourceRegistry(adapters)`
 *
 * Configuration API:
 * - Callers provide adapter instances keyed by `kind`.
 *
 * Communication API:
 * - Resolves adapter for source references and lists available kinds.
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

