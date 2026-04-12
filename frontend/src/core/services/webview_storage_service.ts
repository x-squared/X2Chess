import type { Dispatch } from "react";
import type { AppAction } from "../state/actions";
import type { StorageGateway } from "../contracts/storage_gateway";

export const buildLocalStorageSnapshot = (): Record<string, string> => {
  const snapshot: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key: string | null = localStorage.key(i);
    if (key === null) continue;
    const value: string | null = localStorage.getItem(key);
    if (value !== null) snapshot[key] = value;
  }
  return snapshot;
};

export const exportWebviewStorage = async (gateway: StorageGateway): Promise<void> => {
  await gateway.exportSnapshot(buildLocalStorageSnapshot());
};

export const importWebviewStorage = async (
  gateway: StorageGateway,
  dispatch: Dispatch<AppAction>,
): Promise<void> => {
  const data = await gateway.importSnapshot();
  if (!data) return;
  dispatch({ type: "set_storage_import_pending", data });
};
