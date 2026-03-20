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
 * - This module communicates through shared `state`, external I/O; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

import type { PlayerRecord } from "../app_shell/app_state";
import type { TauriInvokeFn } from "./tauri_invoke_types";

type PlayerStoreState = {
  gameRootPath: string;
  playerStore: PlayerRecord[];
};

type RuntimeWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
};

const normalizePlayerNameField = (value: unknown): string => String(value ?? "").trim();

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

const isTauriRuntime = (): boolean => {
  const runtimeWindow: RuntimeWindow = window as RuntimeWindow;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__ || runtimeWindow.__TAURI__);
};

let tauriInvokeFnPromise: Promise<TauriInvokeFn> | null = null;

const getTauriInvoke = async (): Promise<TauriInvokeFn> => {
  if (!tauriInvokeFnPromise) {
    tauriInvokeFnPromise = import("@tauri-apps/api/core").then((mod): TauriInvokeFn => mod.invoke as TauriInvokeFn);
  }
  return tauriInvokeFnPromise;
};

const tauriInvoke = async (command: string, payload: Record<string, unknown> = {}): Promise<unknown> => {
  const invokeFn: TauriInvokeFn = await getTauriInvoke();
  return invokeFn(command, payload);
};

export const createPlayerStoreService = ({ state }: { state: PlayerStoreState }) => {
  const savePlayerStoreToClientData = async (players: PlayerRecord[]): Promise<void> => {
    const normalizedPlayers: PlayerRecord[] = normalizePlayerRecords(players);
    if (!(state.gameRootPath && isTauriRuntime())) return;
    try {
      await tauriInvoke("save_player_list", {
        rootDirectory: state.gameRootPath,
        content: JSON.stringify(normalizedPlayers, null, 2),
      });
    } catch (error: unknown) {
      console.warn("[X2Chess] unable to save player list:", error);
    }
  };

  const loadPlayerStoreFromClientData = async (seedPlayers: PlayerRecord[] = []): Promise<PlayerRecord[]> => {
    const normalizedSeedPlayers: PlayerRecord[] = normalizePlayerRecords(seedPlayers);
    if (!(state.gameRootPath && isTauriRuntime())) {
      state.playerStore = normalizedSeedPlayers;
      return state.playerStore;
    }

    try {
      const rawPlayerList: unknown = await tauriInvoke("load_player_list", {
        rootDirectory: state.gameRootPath,
      });
      if (rawPlayerList) {
        const parsed: unknown = JSON.parse(String(rawPlayerList));
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
