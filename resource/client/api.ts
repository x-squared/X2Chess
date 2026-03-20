import type { ResourceCapabilities } from "./capabilities";
import type { PgnResourceAdapter } from "../domain/contracts";
import { PGN_RESOURCE_KINDS, type PgnResourceKind } from "../domain/kinds";
import type { PgnGameRef } from "../domain/game_ref";
import type { PgnResourceRef } from "../domain/resource_ref";

/**
 * Resource client factory.
 *
 * Integration API:
 * - Primary exports: `ResourceClient`, `createResourceClient`.
 * - Consumed by frontend gateways to route canonical operations by kind.
 *
 * Configuration API:
 * - Caller provides `adapters` indexed by canonical `PgnResourceKind`.
 *
 * Communication API:
 * - Dispatches `list/load/save/create` to an adapter for the selected kind.
 * - No own storage or I/O; side effects happen inside adapters.
 */
export type ResourceClient = ResourceCapabilities;

/**
 * Resolve an adapter from a kind-indexed adapter map.
 *
 * @param adapters Adapter map keyed by canonical resource kind.
 * @param kind Canonical resource kind.
 * @returns Adapter instance for that kind.
 */
const resolveAdapter = (
  adapters: Record<PgnResourceKind, PgnResourceAdapter>,
  kind: PgnResourceKind,
): PgnResourceAdapter => adapters[kind];

/**
 * Build a canonical resource client.
 *
 * @param adapters Adapter map that implements all canonical kinds.
 * @returns Capability object delegating operations to matching adapters.
 */
export const createResourceClient = (
  adapters: Record<PgnResourceKind, PgnResourceAdapter>,
): ResourceClient => ({
  getKinds: (): PgnResourceKind[] => [...PGN_RESOURCE_KINDS],
  listGames: async (resourceRef: PgnResourceRef) => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, resourceRef.kind);
    return adapter.list(resourceRef);
  },
  loadGame: async (gameRef: PgnGameRef) => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, gameRef.kind);
    return adapter.load(gameRef);
  },
  saveGame: async (gameRef: PgnGameRef, pgnText: string, options) => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, gameRef.kind);
    return adapter.save(gameRef, pgnText, options);
  },
  createGame: async (resourceRef: PgnResourceRef, pgnText: string, title: string) => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, resourceRef.kind);
    return adapter.create(resourceRef, pgnText, title);
  },
});
