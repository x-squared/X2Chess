import type { ResourceCapabilities } from "./capabilities";
import type { MetadataSearchMode, PgnResourceAdapter } from "../domain/contracts";
import { PGN_RESOURCE_KINDS, type PgnResourceKind } from "../domain/kinds";
import type { PgnGameRef } from "../domain/game_ref";
import type { PgnResourceRef } from "../domain/resource_ref";
import type { MoveFrequencyEntry } from "../domain/move_frequency";
import { PgnResourceError } from "../domain/actions";

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
    if (typeof adapter.save !== "function") {
      throw new PgnResourceError("unsupported_operation", `Adapter for kind '${gameRef.kind}' does not support saving games.`);
    }
    return adapter.save(gameRef, pgnText, options);
  },
  createGame: async (resourceRef: PgnResourceRef, pgnText: string, title: string) => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, resourceRef.kind);
    if (typeof adapter.create !== "function") {
      throw new PgnResourceError("unsupported_operation", `Adapter for kind '${resourceRef.kind}' does not support creating games.`);
    }
    return adapter.create(resourceRef, pgnText, title);
  },
  deleteGame: async (gameRef: PgnGameRef) => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, gameRef.kind);
    if (typeof adapter.delete !== "function") {
      throw new PgnResourceError("unsupported_operation", `Adapter for kind '${gameRef.kind}' does not support deleting games.`);
    }
    return adapter.delete(gameRef);
  },
  reorderGame: async (gameRef: PgnGameRef, afterRef: PgnGameRef | null) => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, gameRef.kind);
    if (typeof adapter.reorder !== "function") {
      throw new PgnResourceError("unsupported_operation", `Adapter for kind '${gameRef.kind}' does not support reordering.`);
    }
    return adapter.reorder(gameRef, afterRef);
  },
  searchByPositionHash: async (positionHash: string, resourceRef: PgnResourceRef): Promise<PgnGameRef[]> => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, resourceRef.kind);
    if (typeof adapter.searchByPositionHash !== "function") return [];
    return adapter.searchByPositionHash(positionHash, resourceRef);
  },
  searchByText: async (query: string, resourceRef: PgnResourceRef): Promise<PgnGameRef[]> => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, resourceRef.kind);
    if (typeof adapter.searchByText !== "function") return [];
    return adapter.searchByText(query, resourceRef);
  },
  explorePosition: async (positionHash: string, resourceRef: PgnResourceRef): Promise<MoveFrequencyEntry[]> => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, resourceRef.kind);
    if (typeof adapter.explorePosition !== "function") return [];
    return adapter.explorePosition(positionHash, resourceRef);
  },
  searchByMetadataValues: async (
    key: string,
    values: string[],
    mode: MetadataSearchMode,
    resourceRef: PgnResourceRef,
  ): Promise<PgnGameRef[]> => {
    const adapter: PgnResourceAdapter = resolveAdapter(adapters, resourceRef.kind);
    if (typeof adapter.searchByMetadataValues !== "function") return [];
    return adapter.searchByMetadataValues(key, values, mode, resourceRef);
  },
});
