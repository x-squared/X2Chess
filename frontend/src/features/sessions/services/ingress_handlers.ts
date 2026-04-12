/**
 * Ingress Handlers — pure-logic helpers for drop/paste game ingress.
 *
 * Integration API:
 * - `createIngressEventHandlers`: factory that returns individual handler functions;
 *   consumed by `useGameIngress` which binds them to DOM elements.
 * - Pure helper exports (`inferDropSourceRefs`, `collectDroppedFiles`, etc.) are
 *   available for independent use or testing.
 *
 * Configuration API:
 * - All factories are stateless; inputs are function arguments only.
 *
 * Communication API:
 * - No DOM binding in this module. All event handler binding lives in
 *   `hooks/useGameIngress.ts`.
 */

export type SourceRefLike = {
  kind: string;
  locator: string;
  recordId?: string;
};

export type OpenGameOptions = {
  preferredTitle?: string;
  sourceRef?: SourceRefLike | null;
  resourceRef?: SourceRefLike | null;
  preferInsertIntoActiveResource?: boolean;
};

export type DropSourceHints = {
  sourceRef: SourceRefLike;
  resourceRef: SourceRefLike;
};

export type FileWithOptionalPath = File & {
  path?: string;
  webkitRelativePath?: string;
};

type IngressDeps = {
  isLikelyPgnText: (value: string) => boolean;
  openGameFromIncomingText: (pgnText: string, options?: OpenGameOptions) => void;
  setDropOverlayVisible?: (isVisible: boolean) => void;
  resolveUrl?: (url: string) => Promise<void>;
};

/**
 * Derive a display title from a dropped file name by stripping the extension.
 *
 * @param fileName File name string.
 * @returns Display title without extension.
 */
export const inferGameTitleFromFileName = (fileName: string): string =>
  String(fileName || "").replace(/\.[^.]+$/, "").trim();

/**
 * Return the parent directory path from an absolute or relative file path.
 *
 * @param pathValue File path string.
 * @returns Parent directory portion, or empty string when not determinable.
 */
export const getParentPath = (pathValue: string): string => {
  const normalized: string = String(pathValue || "").trim().replaceAll("\\", "/");
  const slashIndex: number = normalized.lastIndexOf("/");
  if (slashIndex <= 0) return "";
  return normalized.slice(0, slashIndex);
};

/**
 * Attempt to infer source and resource refs from a dropped file's path metadata.
 *
 * @param file Dropped file, possibly carrying an absolute `path` or `webkitRelativePath`.
 * @returns Source/resource ref hints when a folder path can be determined, otherwise null.
 */
export const inferDropSourceRefs = (file: FileWithOptionalPath): DropSourceHints | null => {
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

/**
 * Returns true when the DataTransfer contains file items or a "Files" type.
 *
 * @param transfer DataTransfer from a drag event.
 */
export const hasTransferFiles = (transfer: DataTransfer | null): boolean => {
  const types: string[] = Array.from(transfer?.types || []);
  return Boolean(transfer?.files?.length) || types.includes("Files");
};

/**
 * Collect all dropped File objects from a DataTransfer, using items as fallback.
 *
 * @param transfer DataTransfer from a drop event.
 * @returns Array of File objects.
 */
export const collectDroppedFiles = (transfer: DataTransfer | null): File[] => {
  const directFiles: File[] = transfer?.files ? Array.from(transfer.files) : [];
  if (directFiles.length > 0) return directFiles;
  const itemSource: DataTransferItemList | undefined = transfer?.items;
  const rawItems: DataTransferItem[] = itemSource ? Array.from(itemSource) : [];
  return rawItems
    .filter((item: DataTransferItem): boolean => item?.kind === "file" && typeof item.getAsFile === "function")
    .map((item: DataTransferItem): File | null => item.getAsFile())
    .filter((file: File | null): file is File => Boolean(file));
};

/**
 * Returns true when the DataTransfer carries files or plain text.
 *
 * @param transfer DataTransfer from a drag event.
 */
export const hasAcceptedTransfer = (transfer: DataTransfer | null): boolean => {
  const hasText: boolean = Array.from(transfer?.types || []).includes("text/plain");
  return hasTransferFiles(transfer) || hasText;
};

/**
 * Returns true when the string looks like an HTTP or HTTPS URL.
 *
 * @param value String to test.
 */
export const isHttpUrl = (value: string): boolean => /^https?:\/\/\S+/i.test(value.trim());

/**
 * Create individual drag/drop/paste event handler functions.
 *
 * Returns raw handler functions with no DOM binding — callers (e.g. `useGameIngress`)
 * are responsible for attaching and removing them from DOM elements.
 *
 * @param deps Handler dependencies.
 * @param deps.isLikelyPgnText Predicate used to accept/reject incoming text.
 * @param deps.openGameFromIncomingText Called with validated PGN text and optional source hints.
 * @param deps.setDropOverlayVisible Optional callback toggled during drag lifecycle.
 * @param deps.resolveUrl Optional callback invoked when incoming text is an HTTP/HTTPS URL.
 * @returns Object of handler functions: handleDragEnter, handleDragOver, handleDragLeave,
 *          handleDrop, handlePaste.
 */
export const createIngressEventHandlers = ({
  isLikelyPgnText,
  openGameFromIncomingText,
  setDropOverlayVisible,
  resolveUrl,
}: IngressDeps) => {
  let dragDepth = 0;
  let isDropOverlayVisible = false;

  const setOverlayVisible = (visible: boolean): void => {
    const next: boolean = Boolean(visible);
    if (isDropOverlayVisible === next) return;
    isDropOverlayVisible = next;
    if (typeof setDropOverlayVisible === "function") setDropOverlayVisible(next);
  };

  const handleDragEnter = (event: Event): void => {
    const dragEvent: DragEvent = event as DragEvent;
    const transfer: DataTransfer | null = dragEvent.dataTransfer || null;
    if (!hasAcceptedTransfer(transfer)) return;
    dragEvent.preventDefault();
    dragDepth += 1;
    setOverlayVisible(true);
  };

  const handleDragOver = (event: Event): void => {
    const dragEvent: DragEvent = event as DragEvent;
    const transfer: DataTransfer | null = dragEvent.dataTransfer || null;
    if (!hasAcceptedTransfer(transfer)) return;
    dragEvent.preventDefault();
    setOverlayVisible(true);
  };

  const handleDragLeave = (): void => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setOverlayVisible(false);
  };

  const handleDocumentDragLeave = (event: Event): void => {
    const dragEvent: DragEvent = event as DragEvent;
    if (dragEvent.relatedTarget === null) {
      dragDepth = 0;
      setOverlayVisible(false);
    }
  };

  const handleDrop = (event: Event): void => {
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
          openGameFromIncomingText(text, {
            preferredTitle: inferGameTitleFromFileName(file.name),
            sourceRef: sourceHints?.sourceRef ?? null,
            resourceRef: sourceHints?.resourceRef ?? null,
            preferInsertIntoActiveResource: false,
          });
        }),
      );
      return;
    }

    const plainText: string = transfer.getData("text/plain");
    if (resolveUrl && isHttpUrl(plainText)) {
      void resolveUrl(plainText.trim());
      return;
    }
    if (!isLikelyPgnText(plainText)) return;
    openGameFromIncomingText(plainText, { preferInsertIntoActiveResource: true });
  };

  const handlePaste = (event: ClipboardEvent): void => {
    const target: EventTarget | null = event.target;
    const targetAny: unknown = target;
    if (targetAny !== null && typeof (targetAny as Record<string, unknown>).tagName === "string") {
      const tag: string = (targetAny as { tagName: string }).tagName.toLowerCase();
      if (
        tag === "input" ||
        tag === "textarea" ||
        Boolean((targetAny as { isContentEditable?: unknown }).isContentEditable)
      ) return;
    }
    const plainText: string = event.clipboardData?.getData("text/plain") || "";
    if (resolveUrl && isHttpUrl(plainText)) {
      void resolveUrl(plainText.trim());
      return;
    }
    if (!isLikelyPgnText(plainText)) return;
    openGameFromIncomingText(plainText, { preferInsertIntoActiveResource: true });
  };

  return { handleDragEnter, handleDragOver, handleDragLeave, handleDrop, handlePaste, handleDocumentDragLeave };
};
