/**
 * Player Store Service module.
 *
 * Integration API:
 * - Primary exports from this module: `createPlayerStoreService`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state` and `localStorage`;
 *   interactions are explicit in exported function signatures and typed callback contracts.
 */

import type { PlayerRecord } from "../app/shell/model/app_state";

/** localStorage key under which the player list is stored. */
export const PLAYER_LIST_KEY = "x2chess.playerList";

type PlayerStoreState = {
  playerStore: PlayerRecord[];
};

const normalizePlayerNameField = (value: unknown): string => (typeof value === "string" ? value : "").trim();

const normalizePlayerRecord = (record: unknown): PlayerRecord | null => {
  if (!record || typeof record !== "object") return null;
  const candidate: Record<string, unknown> = record as Record<string, unknown>;
  const lastName: string = normalizePlayerNameField(candidate.lastName || candidate.name || "");
  const firstName: string = normalizePlayerNameField(candidate.firstName || "");
  if (!lastName) return null;
  return { lastName, firstName };
};

const normalizePlayerRecords = (records: unknown): PlayerRecord[] => {
  const byKey: Map<string, PlayerRecord> = new Map<string, PlayerRecord>();
  (Array.isArray(records) ? records : []).forEach((record: unknown): void => {
    const normalized: PlayerRecord | null = normalizePlayerRecord(record);
    if (!normalized) return;
    const key: string = `${normalized.lastName.toLowerCase()}|${normalized.firstName.toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, normalized);
  });
  return [...byKey.values()].sort((left: PlayerRecord, right: PlayerRecord): number => {
    const lastCmp: number = left.lastName.localeCompare(right.lastName);
    if (lastCmp !== 0) return lastCmp;
    return left.firstName.localeCompare(right.firstName);
  });
};

export const createPlayerStoreService = ({ state }: { state: PlayerStoreState }) => {
  const savePlayerStoreToClientData = async (players: PlayerRecord[]): Promise<void> => {
    const normalizedPlayers: PlayerRecord[] = normalizePlayerRecords(players);
    try {
      globalThis.localStorage?.setItem(PLAYER_LIST_KEY, JSON.stringify(normalizedPlayers));
    } catch (error: unknown) {
      console.warn("[X2Chess] unable to save player list:", error);
    }
  };

  const loadPlayerStoreFromClientData = async (seedPlayers: PlayerRecord[] = []): Promise<PlayerRecord[]> => {
    const normalizedSeedPlayers: PlayerRecord[] = normalizePlayerRecords(seedPlayers);
    try {
      const raw: string | null = globalThis.localStorage?.getItem(PLAYER_LIST_KEY) ?? null;
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        state.playerStore = normalizePlayerRecords(parsed);
      } else {
        state.playerStore = normalizedSeedPlayers;
      }
    } catch (error: unknown) {
      console.warn("[X2Chess] unable to load player list, using seed list:", error);
      state.playerStore = normalizedSeedPlayers;
    }

    if (state.playerStore.length === 0 && normalizedSeedPlayers.length > 0) {
      state.playerStore = normalizedSeedPlayers;
    }

    await savePlayerStoreToClientData(state.playerStore);
    return state.playerStore;
  };

  return {
    loadPlayerStoreFromClientData,
    savePlayerStoreToClientData,
  };
};
