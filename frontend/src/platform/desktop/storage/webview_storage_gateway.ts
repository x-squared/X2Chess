import { invoke } from "@tauri-apps/api/core";
import type { StorageGateway } from "../../../core/contracts/storage_gateway";

export const createDesktopWebviewStorageGateway = (): StorageGateway => ({
  exportSnapshot: async (data: Record<string, string>): Promise<void> => {
    const filePath = await invoke<string | null>("pick_storage_export_file");
    if (!filePath) return;
    const content = JSON.stringify(data, null, 2);
    await invoke<void>("write_text_file", { filePath, content });
  },
  importSnapshot: async (): Promise<Record<string, string> | null> => {
    const filePath = await invoke<string | null>("pick_storage_import_file");
    if (!filePath) return null;
    const content = await invoke<string>("load_text_file", { filePath });
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") data[k] = v;
    }
    return Object.keys(data).length > 0 ? data : null;
  },
});
