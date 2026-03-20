import type { InvokeArgs, InvokeOptions } from "@tauri-apps/api/core";

/** Shape of `invoke` from `@tauri-apps/api/core` (loaded dynamically in browser builds). */
export type TauriInvokeFn = <T>(cmd: string, args?: InvokeArgs, options?: InvokeOptions) => Promise<T>;
