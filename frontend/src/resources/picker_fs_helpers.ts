/**
 * picker_fs_helpers — platform I/O utilities for the source picker adapter.
 *
 * Provides runtime detection, Tauri invoke plumbing, path utilities, and
 * filesystem permission helpers used by `createSourcePickerAdapter`.
 * Separated so the platform-detection and path logic can be reasoned about
 * and tested independently from the picker flow.
 */

import type { TauriInvokeFn } from "./tauri_invoke_types";

// ── DOM / browser handle shape types ─────────────────────────────────────────

export type PermissionDescriptor = { mode: "read" | "readwrite" };

export type PermissionHandleLike = {
  queryPermission?: (descriptor: PermissionDescriptor) => Promise<string>;
  requestPermission?: (descriptor: PermissionDescriptor) => Promise<string>;
};

export type FileLike = {
  text: () => Promise<string>;
  lastModified?: number;
};

export type WritableLike = {
  write: (content: string) => Promise<void>;
  close: () => Promise<void>;
};

export type FileHandleLike = PermissionHandleLike & {
  getFile: () => Promise<FileLike>;
  createWritable: () => Promise<WritableLike>;
};

export type DirectoryEntryLike = {
  kind?: string;
  name?: string;
  getFile?: () => Promise<FileLike>;
};

export type DirectoryHandleLike = PermissionHandleLike & {
  getDirectoryHandle: (name: string, options: { create: boolean }) => Promise<DirectoryHandleLike>;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<FileHandleLike>;
  values: () => AsyncIterable<DirectoryEntryLike>;
};

type DirectoryHandleWithMethods = {
  getDirectoryHandle: (name: string, options: { create: boolean }) => Promise<unknown>;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<unknown>;
  values?: () => AsyncIterable<DirectoryEntryLike>;
};

type RuntimeWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandleLike>;
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
};

export type TauriRootResolution = {
  rootPath: string;
  gamesPath: string;
  folderName: string;
};

// ── Runtime detection ─────────────────────────────────────────────────────────

export const supportsDirectoryPicker = (): boolean => {
  const runtimeWindow: RuntimeWindow = window as RuntimeWindow;
  return typeof runtimeWindow.showDirectoryPicker === "function";
};

export const isTauriRuntime = (): boolean => {
  const runtimeWindow: RuntimeWindow = window as RuntimeWindow;
  return Boolean(runtimeWindow.__TAURI_INTERNALS__ || runtimeWindow.__TAURI__);
};

// ── Tauri invoke plumbing ─────────────────────────────────────────────────────

let tauriInvokeFnPromise: Promise<TauriInvokeFn> | null = null;

const getTauriInvoke = async (): Promise<TauriInvokeFn> => {
  if (!tauriInvokeFnPromise) {
    tauriInvokeFnPromise = import("@tauri-apps/api/core").then((mod): TauriInvokeFn => mod.invoke as TauriInvokeFn);
  }
  return tauriInvokeFnPromise;
};

export const tauriInvoke = async (
  command: string,
  payload: Record<string, unknown> = {},
): Promise<unknown> => {
  const invokeFn: TauriInvokeFn = await getTauriInvoke();
  return invokeFn(command, payload);
};

// ── Filesystem permission helper ──────────────────────────────────────────────

export const ensureFsPermission = async (
  handle: PermissionHandleLike | null | undefined,
  mode: "read" | "readwrite" = "read",
): Promise<boolean> => {
  if (!handle || typeof handle.queryPermission !== "function" || typeof handle.requestPermission !== "function") {
    return true;
  }
  const descriptor: PermissionDescriptor = { mode };
  const current: string = await handle.queryPermission(descriptor);
  if (current === "granted") return true;
  const requested: string = await handle.requestPermission(descriptor);
  return requested === "granted";
};

// ── Path utilities ────────────────────────────────────────────────────────────

export const pathJoinUnix = (...parts: string[]): string =>
  parts
    .filter(Boolean)
    .map((part: string, index: number): string => {
      if (index === 0) return String(part).replace(/\/+$/, "");
      return String(part).replace(/^\/+|\/+$/g, "");
    })
    .filter(Boolean)
    .join("/");

export const pathParentUnix = (pathValue: string): string => {
  const normalized: string = String(pathValue || "").replace(/\/+$/, "");
  const index: number = normalized.lastIndexOf("/");
  if (index <= 0) return normalized;
  return normalized.slice(0, index);
};

export const pathBaseUnix = (pathValue: string): string =>
  String(pathValue || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop() || "";

/**
 * Normalize a filesystem path for prefix checks (forward slashes, trim).
 */
const normalizePathForCompare = (pathValue: string): string =>
  String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");

/**
 * Choose the directory used for listing and saving `.pgn` games.
 *
 * When the resource tab still points at a library **root** but runtime state was
 * resolved to a nested **`games`** folder (see `resolveTauriRootAndGamesDirectory`),
 * `preferredLocator` is the root and `stateGamesPath` is `root/games`. Listing with
 * only the root misses files stored under `games/` — prefer `stateGamesPath` when it
 * is strictly nested under `preferredLocator`.
 *
 * @param preferredLocator Directory locator from the open resource tab (or empty).
 * @param stateGamesPath Resolved `gameDirectoryPath` from the picker state (or empty).
 * @returns Path string to pass to `list_pgn_files` / `save_game_file`.
 */
export const resolveEffectiveGamesDirectory = (preferredLocator: string, stateGamesPath: string): string => {
  const pTrim: string = String(preferredLocator || "").trim();
  const sTrim: string = String(stateGamesPath || "").trim();
  if (!pTrim) return sTrim;
  if (!sTrim) return pTrim;
  const pn: string = normalizePathForCompare(pTrim);
  const sn: string = normalizePathForCompare(sTrim);
  if (sn === pn) return pTrim;
  if (sn.startsWith(`${pn}/`)) return sTrim;
  return pTrim;
};

// ── Directory handle utilities ────────────────────────────────────────────────

export const asDirectoryHandle = (value: unknown): DirectoryHandleWithMethods | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as DirectoryHandleWithMethods;
  if (typeof candidate.getDirectoryHandle !== "function" || typeof candidate.getFileHandle !== "function") {
    return null;
  }
  return candidate;
};

export const tryGetDirectoryHandle = async (
  parentHandle: unknown,
  childName: string,
): Promise<DirectoryHandleLike | null> => {
  const directoryHandle = asDirectoryHandle(parentHandle);
  if (!directoryHandle) return null;
  try {
    return (await directoryHandle.getDirectoryHandle(childName, { create: false })) as DirectoryHandleLike;
  } catch {
    return null;
  }
};

export const resolveTauriRootAndGamesDirectory = async (selectedPath: string): Promise<TauriRootResolution | null> => {
  const selected: string = String(selectedPath || "").trim();
  if (!selected) return null;
  const selectedIsGames: boolean = selected.toLowerCase().endsWith("/games");
  if (selectedIsGames) {
    return {
      rootPath: pathParentUnix(selected),
      gamesPath: selected,
      folderName: selected.split("/").filter(Boolean).pop() || selected,
    };
  }
  const nestedGamesPath: string = pathJoinUnix(selected, "games");
  try {
    const nestedGames: unknown = await tauriInvoke("list_pgn_files", { gamesDirectory: nestedGamesPath });
    if (Array.isArray(nestedGames)) {
      return {
        rootPath: selected,
        gamesPath: nestedGamesPath,
        folderName: selected.split("/").filter(Boolean).pop() || selected,
      };
    }
  } catch {
    // Use selected folder as games root when nested folder does not exist.
  }
  return {
    rootPath: selected,
    gamesPath: selected,
    folderName: selected.split("/").filter(Boolean).pop() || selected,
  };
};
