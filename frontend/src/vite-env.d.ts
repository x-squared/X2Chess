/// <reference types="vite/client" />

declare const __X2CHESS_BUILD_TIMESTAMP__: string;
declare const __X2CHESS_MODE__: string;
declare const __X2CHESS_APP_VERSION__: string;

/** Tauri / browser APIs used by resource adapters (optional at runtime). */
interface Window {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
  showDirectoryPicker?: (options?: Record<string, unknown>) => Promise<FileSystemDirectoryHandle>;
}
