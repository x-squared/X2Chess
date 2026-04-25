import {
  extractPgnMetadataFromSource,
  mergeMetadataCatalogKeys,
} from "../../../parts/resource/src/domain/metadata";
import { materialKeyFromFen } from "../../../parts/resource/src/domain/material_key";
import type {
  LegacyAdapter as SourceAdapter,
  LegacyCreateResult as SourceCreateResult,
  LegacyListEntry as SourceListEntry,
  LegacyLoadResult as SourceLoadResult,
  LegacySaveResult as SourceSaveResult,
  LegacySourceRef as SourceRef,
} from "../../../parts/resource/src/client/compatibility";
import {
  isTauriRuntime,
  supportsDirectoryPicker,
  tauriInvoke,
  ensureFsPermission,
  pathBaseUnix,
  pathJoinUnix,
  asDirectoryHandle,
  tryGetDirectoryHandle,
  resolveTauriRootAndGamesDirectory,
  resolveEffectiveGamesDirectory,
  type PermissionHandleLike,
  type FileLike,
  type WritableLike,
  type FileHandleLike,
  type DirectoryEntryLike,
  type DirectoryHandleLike,
  type TauriRootResolution,
} from "./picker_fs_helpers";
import { log } from "../logger";

// ── Picker-specific types ─────────────────────────────────────────────────────

type PickerState = {
  gameDirectoryHandle: unknown | null;
  gameDirectoryPath: string;
  gameRootPath: string;
};

type SourcePickerDeps = {
  state: PickerState;
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

type MetadataPayload = {
  metadata: Record<string, string>;
  availableMetadataKeys: string[];
};

// ── Small private helpers ─────────────────────────────────────────────────────

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
  availableMetadataKeys: mergeMetadataCatalogKeys([]),
});

/** Augment a metadata payload with a derived `Material` key for position games (still SSOT: FEN read from same header map). */
const withMaterial = (pgnText: string, payload: MetadataPayload): MetadataPayload => {
  const isPosition: boolean = /\[SetUp\s+"1"\]/i.test(pgnText);
  if (!isPosition) return payload;
  const fenValue: string = String(payload.metadata["FEN"] ?? "").trim();
  const materialKey: string = fenValue ? materialKeyFromFen(fenValue) : "";
  if (!materialKey) return payload;
  const metadata: Record<string, string> = { ...payload.metadata, Material: materialKey };
  return {
    metadata,
    availableMetadataKeys: mergeMetadataCatalogKeys(Object.keys(metadata)),
  };
};

// ── Adapter factory ───────────────────────────────────────────────────────────

export const createSourcePickerAdapter = ({ state }: SourcePickerDeps): SourceAdapter & {
  pickSourceRoot: () => Promise<SourceRoot | null>;
  applySourceRoot: (sourceRoot: SourceRoot | null) => void;
  pickResourceTarget: () => Promise<ResourceTarget | null>;
  pickFileOnlyTarget: () => Promise<ResourceTargetFileOrDb | null>;
  pickDatabaseOnlyTarget: () => Promise<ResourceTargetFileOrDb | null>;
  detectDefaultSourceRoot: () => Promise<SourceRoot | null>;
  createNewDatabase: (suggestedName: string) => Promise<ResourceTargetFileOrDb | null>;
  createNewPgnFile: (suggestedName: string) => Promise<ResourceTargetFileOrDb | null>;
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
      const runtimeWindow = window as Window & {
        showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandleLike>;
      };
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
      const resolved: TauriRootResolution | null = await resolveTauriRootAndGamesDirectory(selectedPath);
      if (!resolved) {
        return {
          kind: "tauri",
          rootPath: selectedPath,
          gamesPath: selectedPath,
        };
      }
      return {
        kind: "tauri",
        rootPath: resolved.rootPath,
        gamesPath: resolved.gamesPath,
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
      return { type: "folder", title: folderTitle, sourceRoot: folderRoot };
    }

    if (supportsDirectoryPicker()) {
      const folderRoot: SourceRoot | null = await pickSourceRoot();
      if (!folderRoot) return null;
      const folderTitle: string = String(folderRoot.rootPath || folderRoot.gamesPath || "Local files")
        .replace(/\\/g, "/")
        .split("/")
        .filter(Boolean)
        .pop() || "Local files";
      return { type: "folder", title: folderTitle, sourceRoot: folderRoot };
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
    return { kind: "tauri", rootPath: resolved.rootPath, gamesPath: resolved.gamesPath };
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
        const fileName: string = String((entry as DirectoryEntryLike).name || "");
        if (!fileName.toLowerCase().endsWith(".pgn")) continue;
        let metadataPayload: MetadataPayload = defaultMetadataPayload();
        try {
          if (typeof (entry as DirectoryEntryLike).getFile !== "function") continue;
          const file: FileLike = await (entry as DirectoryEntryLike).getFile!();
          const pgnText: string = await file.text();
          const fromSource = extractPgnMetadataFromSource(pgnText);
          metadataPayload = withMaterial(pgnText, {
            metadata: fromSource.metadata,
            availableMetadataKeys: mergeMetadataCatalogKeys(fromSource.discoveredKeysInOrder),
          });
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

    let stateGamesHint: string = String(state.gameDirectoryPath || "").trim();
    if (!state.gameDirectoryHandle && preferredLocator && isTauriRuntime() && !stateGamesHint) {
      const resolved: TauriRootResolution | null = await resolveTauriRootAndGamesDirectory(preferredLocator);
      if (resolved?.gamesPath) {
        stateGamesHint = resolved.gamesPath;
        state.gameDirectoryPath = resolved.gamesPath;
        state.gameRootPath = resolved.rootPath;
        log.info("source_picker_adapter", "list: resolved games folder from tab locator (picker state was empty)", {
          gamesPath: resolved.gamesPath,
        });
      }
    }

    let effectiveDirectory: string = resolveEffectiveGamesDirectory(preferredLocator, stateGamesHint);

    if (effectiveDirectory && isTauriRuntime()) {
      let namesRaw: unknown = await tauriInvoke("list_pgn_files", { gamesDirectory: effectiveDirectory });
      let normalizedNames: string[] = (Array.isArray(namesRaw) ? namesRaw : [])
        .map((name: unknown): string => String(name || ""))
        .filter(Boolean);

      const prefEndsGames: boolean = preferredLocator.toLowerCase().endsWith("/games");
      if (normalizedNames.length === 0 && preferredLocator && !prefEndsGames) {
        const nestedGamesPath: string = pathJoinUnix(preferredLocator, "games");
        if (nestedGamesPath !== effectiveDirectory) {
          try {
            const nestedRaw: unknown = await tauriInvoke("list_pgn_files", { gamesDirectory: nestedGamesPath });
            const nestedNames: string[] = (Array.isArray(nestedRaw) ? nestedRaw : [])
              .map((name: unknown): string => String(name || ""))
              .filter(Boolean);
            if (nestedNames.length > 0) {
              log.info("source_picker_adapter", "list: using nested games/ folder (listing at library root was empty)", {
                nestedGamesPath,
              });
              effectiveDirectory = nestedGamesPath;
              normalizedNames = nestedNames;
              state.gameDirectoryPath = nestedGamesPath;
              state.gameRootPath = preferredLocator;
            }
          } catch {
            // Nested `games/` may not exist or is unreadable.
          }
        }
      }

      const results: SourceListEntry[] = [];
      for (const name of normalizedNames) {
        let metadataPayload: MetadataPayload = defaultMetadataPayload();
        try {
          const content: unknown = await tauriInvoke("load_game_file", {
            gamesDirectory: effectiveDirectory,
            fileName: name,
          });
          const pgnText: string = String(content || "");
          const fromSource = extractPgnMetadataFromSource(pgnText);
          metadataPayload = withMaterial(pgnText, {
            metadata: fromSource.metadata,
            availableMetadataKeys: mergeMetadataCatalogKeys(fromSource.discoveredKeysInOrder),
          });
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
      const writable: WritableLike = await fileHandle.createWritable();
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

  const createNewDatabase = async (suggestedName: string): Promise<ResourceTargetFileOrDb | null> => {
    if (!isTauriRuntime()) throw new Error("Database resources require the desktop application.");
    const pathRaw: unknown = await tauriInvoke("create_x2chess_file", { suggestedName });
    const filePath: string = (typeof pathRaw === "string" ? pathRaw : "").trim();
    if (!filePath) return null;
    const baseName: string = pathBaseUnix(filePath);
    return { type: "db", title: baseName.replace(/\.[^.]+$/, ""), locator: filePath };
  };

  const createInResource = async (
    resourceRef: SourceRef | null,
    pgnText: string,
    titleHint: string = "",
  ): Promise<SourceCreateResult> => {
    const refLoc: string = String(resourceRef?.locator || "").trim();
    const stateLoc: string = String(state.gameDirectoryPath || "").trim();
    const locator: string =
      resolveEffectiveGamesDirectory(refLoc, stateLoc) || refLoc || stateLoc;
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

  const pickFileOnlyTarget = async (): Promise<{ type: "file" | "db"; title: string; locator: string } | null> => {
    if (isTauriRuntime()) {
      const selectedFilePathRaw: unknown = await tauriInvoke("pick_resource_file");
      const filePath: string = (typeof selectedFilePathRaw === "string" ? selectedFilePathRaw : "").trim();
      if (!filePath) return null;
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
    throw new Error("File picker is only available in the desktop application.");
  };

  const pickDatabaseOnlyTarget = async (): Promise<{ type: "db"; title: string; locator: string } | null> => {
    if (isTauriRuntime()) {
      const selectedFilePathRaw: unknown = await tauriInvoke("pick_x2chess_file");
      const filePath: string = (typeof selectedFilePathRaw === "string" ? selectedFilePathRaw : "").trim();
      if (!filePath) return null;
      const baseName: string = pathBaseUnix(filePath);
      return { type: "db", title: baseName.replace(/\.[^.]+$/, ""), locator: filePath };
    }
    throw new Error("Database picker is only available in the desktop application.");
  };

  const createNewPgnFile = async (suggestedName: string): Promise<{ type: "file"; title: string; locator: string } | null> => {
    if (!isTauriRuntime()) throw new Error("PGN file creation requires the desktop application.");
    const pathRaw: unknown = await tauriInvoke("create_pgn_file", { suggestedName });
    const filePath: string = (typeof pathRaw === "string" ? pathRaw : "").trim();
    if (!filePath) return null;
    const baseName: string = pathBaseUnix(filePath);
    return { type: "file", title: baseName.replace(/\.[^.]+$/, ""), locator: filePath };
  };

  return {
    kind: "directory",
    applySourceRoot,
    createNewDatabase,
    createNewPgnFile,
    detectDefaultSourceRoot,
    list,
    load,
    createInResource,
    pickDatabaseOnlyTarget,
    pickFileOnlyTarget,
    pickResourceTarget,
    pickSourceRoot,
    save,
  };
};
