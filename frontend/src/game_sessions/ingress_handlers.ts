/**
 * Ingress Handlers module.
 *
 * Integration API:
 * - Primary exports from this module: `createGameIngressHandlers`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type SourceRefLike = {
  kind: string;
  locator: string;
  recordId?: string;
};

type OpenGameOptions = {
  preferredTitle?: string;
  sourceRef?: SourceRefLike | null;
  resourceRef?: SourceRefLike | null;
  preferInsertIntoActiveResource?: boolean;
};

type IngressDeps = {
  appPanelEl: Element | null;
  isLikelyPgnText: (value: string) => boolean;
  openGameFromIncomingText: (pgnText: string, options?: OpenGameOptions) => boolean | Promise<boolean>;
  setDropOverlayVisible?: (isVisible: boolean) => void;
};

type DropSourceHints = {
  sourceRef: SourceRefLike;
  resourceRef: SourceRefLike;
};

type FileWithOptionalPath = File & {
  path?: string;
  webkitRelativePath?: string;
};

const inferGameTitleFromFileName = (fileName: string): string => String(fileName || "").replace(/\.[^.]+$/, "").trim();

const getParentPath = (pathValue: string): string => {
  const normalized = String(pathValue || "").trim().replaceAll("\\", "/");
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex <= 0) return "";
  return normalized.slice(0, slashIndex);
};

const inferDropSourceRefs = (file: FileWithOptionalPath): DropSourceHints | null => {
  const maybeAbsolutePath: string = String(file?.path || "").trim();
  if (maybeAbsolutePath) {
    const folderPath: string = getParentPath(maybeAbsolutePath);
    const fileName: string = String(file?.name || "").trim();
    if (folderPath && fileName) {
      return {
        sourceRef: { kind: "file", locator: folderPath, recordId: fileName },
        resourceRef: { kind: "file", locator: folderPath },
      };
    }
  }

  const relativePath: string = String(file?.webkitRelativePath || "").trim();
  if (relativePath.includes("/")) {
    const folderPath: string = getParentPath(relativePath);
    const fileName: string = String(file?.name || "").trim();
    if (folderPath && fileName) {
      return {
        sourceRef: { kind: "file", locator: folderPath, recordId: fileName },
        resourceRef: { kind: "file", locator: folderPath },
      };
    }
  }

  return null;
};

const hasTransferFiles = (transfer: DataTransfer | null): boolean => {
  const types: string[] = Array.from(transfer?.types || []);
  return Boolean(transfer?.files?.length) || types.includes("Files");
};

const collectDroppedFiles = (transfer: DataTransfer | null): File[] => {
  const directFiles: File[] = transfer?.files ? Array.from(transfer.files) : [];
  if (directFiles.length > 0) return directFiles;
  const itemSource: DataTransferItemList | undefined = transfer?.items;
  const rawItems: DataTransferItem[] = itemSource ? Array.from(itemSource) : [];
  const fromItems: File[] = rawItems
    .filter((item: DataTransferItem): boolean => item?.kind === "file" && typeof item.getAsFile === "function")
    .map((item: DataTransferItem): File | null => item.getAsFile())
    .filter((file: File | null): file is File => Boolean(file));
  return fromItems;
};

const hasAcceptedTransfer = (transfer: DataTransfer | null): boolean => {
  const hasText: boolean = Array.from(transfer?.types || []).includes("text/plain");
  return hasTransferFiles(transfer) || hasText;
};

/**
 * Create ingress handlers for drop/paste game creation.
 */
export const createGameIngressHandlers = ({
  appPanelEl,
  isLikelyPgnText,
  openGameFromIncomingText,
  setDropOverlayVisible,
}: IngressDeps) => {
  let dragDepth = 0;
  let isDropOverlayVisible = false;

  const setOverlayVisible = (visible: boolean): void => {
    const next: boolean = Boolean(visible);
    if (isDropOverlayVisible === next) return;
    isDropOverlayVisible = next;
    if (typeof setDropOverlayVisible === "function") setDropOverlayVisible(next);
  };

  const bindEvents = (): void => {
    if (appPanelEl) {
      appPanelEl.addEventListener("dragenter", (event: Event): void => {
        const dragEvent: DragEvent = event as DragEvent;
        const transfer: DataTransfer | null = dragEvent.dataTransfer || null;
        if (!hasAcceptedTransfer(transfer)) return;
        dragEvent.preventDefault();
        dragDepth += 1;
        setOverlayVisible(true);
      });

      appPanelEl.addEventListener("dragover", (event: Event): void => {
        const dragEvent: DragEvent = event as DragEvent;
        const transfer: DataTransfer | null = dragEvent.dataTransfer || null;
        if (!hasAcceptedTransfer(transfer)) return;
        dragEvent.preventDefault();
        setOverlayVisible(true);
      });

      appPanelEl.addEventListener("dragleave", (): void => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) setOverlayVisible(false);
      });

      appPanelEl.addEventListener("drop", (event: Event): void => {
        const dragEvent: DragEvent = event as DragEvent;
        dragDepth = 0;
        setOverlayVisible(false);
        dragEvent.preventDefault();

        const transfer: DataTransfer | null = dragEvent.dataTransfer || null;
        if (!transfer) return;

        const files: File[] = collectDroppedFiles(transfer);
        if (files.length > 0) {
          void Promise.all(
            files.map(async (file: File): Promise<void> => {
              if (!/\.pgn$/i.test(file.name) && !/^text\//i.test(file.type || "")) return;
              const text: string = await file.text();
              if (!isLikelyPgnText(text)) return;
              const sourceHints: DropSourceHints | null = inferDropSourceRefs(file as FileWithOptionalPath);
              const hints: OpenGameOptions = sourceHints
                ? { sourceRef: sourceHints.sourceRef, resourceRef: sourceHints.resourceRef }
                : {};
              void openGameFromIncomingText(text, {
                preferredTitle: inferGameTitleFromFileName(file.name),
                sourceRef: hints.sourceRef || null,
                resourceRef: hints.resourceRef || null,
                preferInsertIntoActiveResource: false,
              });
            }),
          );
          return;
        }

        const plainText: string = transfer.getData("text/plain");
        if (!isLikelyPgnText(plainText)) return;
        void openGameFromIncomingText(plainText, { preferInsertIntoActiveResource: true });
      });
    }

    window.addEventListener("paste", (event: ClipboardEvent): void => {
      const target: EventTarget | null = event.target;
      if (target instanceof HTMLElement) {
        const tag: string = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
      }
      const plainText: string = event.clipboardData?.getData("text/plain") || "";
      if (!isLikelyPgnText(plainText)) return;
      void openGameFromIncomingText(plainText, { preferInsertIntoActiveResource: true });
    });
  };

  return {
    bindEvents,
  };
};
