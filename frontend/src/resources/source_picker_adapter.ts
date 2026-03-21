import type { TauriInvokeFn } from "./tauri_invoke_types";
import { extractPgnMetadata, PGN_STANDARD_METADATA_KEYS } from "../../../resource/domain/metadata";
import type {
  SourceAdapter,
  SourceCreateResult,
  SourceListEntry,
  SourceLoadResult,
  SourceSaveResult,
  SourceRef,
} from "./source_types";

type PickerState = {
  gameDirectoryHandle: unknown | null;
  gameDirectoryPath: string;
  gameRootPath: string;
};

type SourcePickerDeps = {
  state: PickerState;
};

type PermissionDescriptor = { mode: "read" | "readwrite" };

type PermissionHandleLike = {
  queryPermission?: (descriptor: PermissionDescriptor) => Promise<string>;
  requestPermission?: (descriptor: PermissionDescriptor) => Promise<string>;
};

type FileLike = {
  text: () => Promise<string>;
  lastModified?: number;
};

type WritableLike = {
  write: (content: string) => Promise<void>;
  close: () => Promise<void>;
};

type FileHandleLike = PermissionHandleLike & {
  getFile: () => Promise<FileLike>;
  createWritable: () => Promise<WritableLike>;
};

type DirectoryEntryLike = {
  kind?: string;
  name?: string;
  getFile?: () => Promise<FileLike>;
};

type DirectoryHandleLike = PermissionHandleLike & {
  getDirectoryHandle: (name: string, options: { create: boolean }) => Promise<DirectoryHandleLike>;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<FileHandleLike>;
  values: () => AsyncIterable<DirectoryEntryLike>;
};

type DirectoryHandleWithMethods = {
  getDirectoryHandle: (name: string, options: { create: boolean }) => Promise<unknown>;
  getFileHandle: (name: string, options: { create: boolean }) => Promise<unknown>;
  values?: () => AsyncIterable<DirectoryEntryLike>;
};

const asDirectoryHandle = (value: unknown): DirectoryHandleWithMethods | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as DirectoryHandleWithMethods;
  if (typeof candidate.getDirectoryHandle !== "function" || typeof candidate.getFileHandle !== "function") {
    return null;
  }
  return candidate;
};

type RuntimeWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandleLike>;
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
};

type BrowserSourceRoot = {
  kind: "browser";
  rootPath: string;
  gamesPath: string;
  rootHandle: unknown;
};

type TauriSourceRoot = {
  kind: "tauri";
  rootPath: string;
  gamesPath: string;
};

type SourceRoot = BrowserSourceRoot | TauriSourceRoot;

type ResourceTargetFolder = {
  type: "folder";
  title: string;
  sourceRoot: SourceRoot;
};

type ResourceTargetFileOrDb = {
  type: "file" | "db";
  title: string;
  locator: string;
};

type ResourceTarget = ResourceTargetFolder | ResourceTargetFileOrDb;

type FileSourceRef = {
  kind: "file";
  locator: string;
  recordId: string;
  createIfMissing?: boolean;
};

type TauriRootResolution = {
  rootPath: string;
  gamesPath: string;
  folderName: string;
};

type MetadataPayload = ReturnType<typeof extractPgnMetadata>;

const supportsDirectoryPicker = (): boolean => {
  const runtimeWindow: RuntimeWindow = window as RuntimeWindow;
  return typeof runtimeWindow.showDirectoryPicker === "function";
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

const tauriInvoke = async (
  command: string,
  payload: Record<string, unknown> = {},
): Promise<unknown> => {
  const invokeFn: TauriInvokeFn = await getTauriInvoke();
  return invokeFn(command, payload);
};

const ensureFsPermission = async (
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

const pathJoinUnix = (...parts: string[]): string =>
  parts
    .filter(Boolean)
    .map((part: string, index: number): string => {
      if (index === 0) return String(part).replace(/\/+$/, "");
      return String(part).replace(/^\/+|\/+$/g, "");
    })
    .filter(Boolean)
    .join("/");

const pathParentUnix = (pathValue: string): string => {
  const normalized: string = String(pathValue || "").replace(/\/+$/, "");
  const index: number = normalized.lastIndexOf("/");
  if (index <= 0) return normalized;
  return normalized.slice(0, index);
};

const pathBaseUnix = (pathValue: string): string =>
  String(pathValue || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop() || "";

const tryGetDirectoryHandle = async (
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

const resolveTauriRootAndGamesDirectory = async (selectedPath: string): Promise<TauriRootResolution | null> => {
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

const createFileSourceRef = (locator: string, fileName: string): FileSourceRef => ({
  kind: "file",
  locator,
  recordId: fileName,
});

const sanitizeFileTitle = (rawTitle: string): string => {
  const normalized: string = String(rawTitle || "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `imported-${Date.now()}`;
};

const defaultMetadataPayload = (): MetadataPayload => ({
  metadata: {},
  availableMetadataKeys: [...PGN_STANDARD_METADATA_KEYS],
});

export const createSourcePickerAdapter = ({ state }: SourcePickerDeps): SourceAdapter & {
  pickSourceRoot: () => Promise<SourceRoot | null>;
  applySourceRoot: (sourceRoot: SourceRoot | null) => void;
  pickResourceTarget: () => Promise<ResourceTarget | null>;
  detectDefaultSourceRoot: () => Promise<SourceRoot | null>;
} => {
  const isPlaceholderLocator = (value: string): boolean => {
    const normalized: string = String(value || "").trim().toLowerCase();
    return normalized === "" || normalized === "local-files";
  };

  const resolveLocator = (sourceRef: SourceRef | FileSourceRef | null | undefined): string => {
    const locator: string = String(sourceRef?.locator || "").trim();
    if (locator && !isPlaceholderLocator(locator)) return locator;
    return String(state.gameDirectoryPath || "").trim();
  };

  const pickSourceRoot = async (): Promise<SourceRoot | null> => {
    if (supportsDirectoryPicker()) {
      const runtimeWindow: RuntimeWindow = window as RuntimeWindow;
      const pickDir = runtimeWindow.showDirectoryPicker;
      if (!pickDir) throw new Error("Directory picker is not available.");
      const dirHandle = await pickDir({ mode: "readwrite" });
      const hasPermission: boolean = await ensureFsPermission(dirHandle as PermissionHandleLike, "readwrite");
      if (!hasPermission) throw new Error("Folder permission denied.");
      const gamesSubdir: DirectoryHandleLike | null = await tryGetDirectoryHandle(dirHandle, "games");
      return {
        kind: "browser",
        rootPath: String((dirHandle as { name?: string })?.name || "").trim(),
        gamesPath: gamesSubdir ? "games" : "",
        rootHandle: dirHandle,
      };
    }
    if (isTauriRuntime()) {
      const selectedPathRaw: unknown = await tauriInvoke("pick_games_directory");
      const selectedPath: string = String(selectedPathRaw || "").trim();
      if (!selectedPath) return null;
      // Use the picked path directly — the user chose exactly this folder.
      // The games/ subdirectory heuristic only applies to auto-detection.
      return {
        kind: "tauri",
        rootPath: selectedPath,
        gamesPath: selectedPath,
      };
    }
    throw new Error("Local folder access is not supported in this browser runtime.");
  };

  const pickResourceTarget = async (): Promise<ResourceTarget | null> => {
    if (isTauriRuntime()) {
      const selectedFilePathRaw: unknown = await tauriInvoke("pick_resource_file");
      const filePath: string = String(selectedFilePathRaw || "").trim();
      if (filePath) {
        const baseName: string = pathBaseUnix(filePath);
        const extension: string = baseName.includes(".") ? (baseName.split(".").pop() || "").toLowerCase() : "";
        if (extension === "pgn") {
          return { type: "file", title: baseName.replace(/\.[^.]+$/, ""), locator: filePath };
        }
        if (extension === "x2chess") {
          return { type: "db", title: baseName.replace(/\.[^.]+$/, ""), locator: filePath };
        }
        throw new Error("Unsupported resource file. Choose a .pgn file or an .x2chess database.");
      }
      const folderRoot: SourceRoot | null = await pickSourceRoot();
      if (!folderRoot) return null;
      const folderTitle: string = String(folderRoot.rootPath || folderRoot.gamesPath || "Local files")
        .replace(/\\/g, "/")
        .split("/")
        .filter(Boolean)
        .pop() || "Local files";
      return {
        type: "folder",
        title: folderTitle,
        sourceRoot: folderRoot,
      };
    }

    if (supportsDirectoryPicker()) {
      const folderRoot: SourceRoot | null = await pickSourceRoot();
      if (!folderRoot) return null;
      const folderTitle: string = String(folderRoot.rootPath || folderRoot.gamesPath || "Local files")
        .replace(/\\/g, "/")
        .split("/")
        .filter(Boolean)
        .pop() || "Local files";
      return {
        type: "folder",
        title: folderTitle,
        sourceRoot: folderRoot,
      };
    }

    throw new Error("Local folder/file access is not supported in this browser runtime.");
  };

  const applySourceRoot = (sourceRoot: SourceRoot | null): void => {
    if (!sourceRoot) return;
    if (sourceRoot.kind === "browser") {
      state.gameDirectoryHandle = sourceRoot.rootHandle || null;
      state.gameDirectoryPath = sourceRoot.gamesPath || "";
      state.gameRootPath = String(sourceRoot.rootPath || "");
      return;
    }
    state.gameDirectoryHandle = null;
    state.gameDirectoryPath = sourceRoot.gamesPath || "";
    state.gameRootPath = sourceRoot.rootPath || "";
  };

  const detectDefaultSourceRoot = async (): Promise<SourceRoot | null> => {
    if (!isTauriRuntime()) return null;
    const detectedGamesPathRaw: unknown = await tauriInvoke("detect_default_games_directory");
    const detectedGamesPath: string = String(detectedGamesPathRaw || "").trim();
    if (!detectedGamesPath) return null;
    const resolved: TauriRootResolution | null = await resolveTauriRootAndGamesDirectory(detectedGamesPath);
    if (!resolved) return null;
    return {
      kind: "tauri",
      rootPath: resolved.rootPath,
      gamesPath: resolved.gamesPath,
    };
  };

  const list = async (options: { sourceRef?: SourceRef | null } = {}): Promise<SourceListEntry[]> => {
    const sourceRef: SourceRef | null | undefined = options?.sourceRef;
    const preferredLocatorRaw: string = String(sourceRef?.locator || "").trim();
    const preferredLocator: string = isPlaceholderLocator(preferredLocatorRaw) ? "" : preferredLocatorRaw;

    if (state.gameDirectoryHandle) {
      const gamesSubdir: DirectoryHandleLike | null = await tryGetDirectoryHandle(state.gameDirectoryHandle, "games");
      const gamesDir = (gamesSubdir || state.gameDirectoryHandle) as unknown;
      const gamesDirectoryHandle = asDirectoryHandle(gamesDir);
      if (!gamesDirectoryHandle || typeof gamesDirectoryHandle.values !== "function") return [];
      const entries: SourceListEntry[] = [];
      for await (const entry of gamesDirectoryHandle.values()) {
        if (!entry || entry.kind !== "file") continue;
        const fileName: string = String(entry.name || "");
        if (!fileName.toLowerCase().endsWith(".pgn")) continue;
        let metadataPayload: MetadataPayload = defaultMetadataPayload();
        try {
          if (typeof entry.getFile !== "function") continue;
          const file: FileLike = await entry.getFile();
          metadataPayload = extractPgnMetadata(await file.text());
        } catch {
          // Keep listing robust; metadata is optional.
        }
        entries.push({
          sourceRef: createFileSourceRef("browser-handle", fileName),
          titleHint: fileName.replace(/\.[^.]+$/, ""),
          revisionToken: "",
          metadata: metadataPayload.metadata,
          availableMetadataKeys: metadataPayload.availableMetadataKeys,
        });
      }
      entries.sort((left: SourceListEntry, right: SourceListEntry): number => left.titleHint.localeCompare(right.titleHint));
      return entries;
    }

    const effectiveDirectory: string = preferredLocator || state.gameDirectoryPath;
    if (effectiveDirectory && isTauriRuntime()) {
      const namesRaw: unknown = await tauriInvoke("list_pgn_files", { gamesDirectory: effectiveDirectory });
      const normalizedNames: string[] = (Array.isArray(namesRaw) ? namesRaw : [])
        .map((name: unknown): string => String(name || ""))
        .filter(Boolean);
      const results: SourceListEntry[] = [];
      for (const name of normalizedNames) {
        let metadataPayload: MetadataPayload = defaultMetadataPayload();
        try {
          const content: unknown = await tauriInvoke("load_game_file", {
            gamesDirectory: effectiveDirectory,
            fileName: name,
          });
          metadataPayload = extractPgnMetadata(String(content || ""));
        } catch {
          // Continue listing when metadata extraction fails for a single file.
        }
        results.push({
          sourceRef: createFileSourceRef(effectiveDirectory, name),
          titleHint: name.replace(/\.[^.]+$/, ""),
          revisionToken: "",
          metadata: metadataPayload.metadata,
          availableMetadataKeys: metadataPayload.availableMetadataKeys,
        });
      }
      return results;
    }

    return [];
  };

  const load = async (sourceRef: SourceRef): Promise<SourceLoadResult> => {
    const fileName: string = String(sourceRef?.recordId || "");
    if (!fileName) throw new Error("File source is missing recordId.");
    const locator: string = resolveLocator(sourceRef);

    if (state.gameDirectoryHandle) {
      const gamesSubdir: DirectoryHandleLike | null = await tryGetDirectoryHandle(state.gameDirectoryHandle, "games");
      const gamesDirectoryHandle = asDirectoryHandle(gamesSubdir || state.gameDirectoryHandle);
      if (!gamesDirectoryHandle) throw new Error("Active browser directory handle is unavailable.");
      const fileHandle: FileHandleLike = (await gamesDirectoryHandle.getFileHandle(fileName, { create: false })) as FileHandleLike;
      const file: FileLike = await fileHandle.getFile();
      const pgnText: string = await file.text();
      return {
        pgnText,
        revisionToken: String(file.lastModified || ""),
        titleHint: fileName.replace(/\.[^.]+$/, ""),
      };
    }

    if (locator && isTauriRuntime()) {
      const pgnTextRaw: unknown = await tauriInvoke("load_game_file", {
        gamesDirectory: locator,
        fileName,
      });
      return {
        pgnText: String(pgnTextRaw || ""),
        revisionToken: String(Date.now()),
        titleHint: fileName.replace(/\.[^.]+$/, ""),
      };
    }

    throw new Error("Local folder access is not supported in this browser runtime.");
  };

  const save = async (
    sourceRef: SourceRef & { createIfMissing?: boolean },
    pgnText: string,
    _revisionToken: string,
    _options: Record<string, unknown> = {},
  ): Promise<SourceSaveResult> => {
    const fileName: string = String(sourceRef?.recordId || "");
    if (!fileName) throw new Error("File source is missing recordId.");
    const locator: string = resolveLocator(sourceRef);
    const createIfMissing: boolean = Boolean(sourceRef?.createIfMissing);

    if (state.gameDirectoryHandle) {
      const gamesSubdir: DirectoryHandleLike | null = await tryGetDirectoryHandle(state.gameDirectoryHandle, "games");
      const gamesDirectoryHandle = asDirectoryHandle(gamesSubdir || state.gameDirectoryHandle);
      if (!gamesDirectoryHandle) throw new Error("Active browser directory handle is unavailable.");
      const fileHandle: FileHandleLike = (await gamesDirectoryHandle.getFileHandle(fileName, { create: createIfMissing })) as FileHandleLike;
      const hasPermission: boolean = await ensureFsPermission(fileHandle, "readwrite");
      if (!hasPermission) throw new Error("Write permission denied.");
      const writable = await fileHandle.createWritable();
      await writable.write(String(pgnText || ""));
      await writable.close();
      const file: FileLike = await fileHandle.getFile();
      return { revisionToken: String(file.lastModified || Date.now()) };
    }

    if (locator && isTauriRuntime()) {
      await tauriInvoke("save_game_file", {
        gamesDirectory: locator,
        fileName,
        content: String(pgnText || ""),
      });
      return { revisionToken: String(Date.now()) };
    }

    throw new Error("Local folder access is not supported in this browser runtime.");
  };

  const createInResource = async (
    resourceRef: SourceRef | null,
    pgnText: string,
    titleHint: string = "",
  ): Promise<SourceCreateResult> => {
    const locator: string = String(resourceRef?.locator || "").trim() || String(state.gameDirectoryPath || "").trim();
    if (!locator && !state.gameDirectoryHandle) {
      throw new Error("No active file resource is available to store imported text.");
    }
    const baseName: string = sanitizeFileTitle(titleHint || "imported-game");
    const fileName: string = `${baseName}.pgn`;
    const sourceRef: FileSourceRef = createFileSourceRef(locator || "browser-handle", fileName);
    await save({ ...sourceRef, createIfMissing: true }, pgnText, "", {});
    return {
      sourceRef,
      revisionToken: String(Date.now()),
      titleHint: baseName,
    };
  };

  return {
    kind: "file",
    applySourceRoot,
    detectDefaultSourceRoot,
    list,
    load,
    createInResource,
    pickResourceTarget,
    pickSourceRoot,
    save,
  };
};
