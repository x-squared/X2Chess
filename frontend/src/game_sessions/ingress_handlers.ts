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

/**
 * Create ingress handlers for drop/paste game creation.
 *
 * @param {object} deps - Dependencies.
 * @param {HTMLElement|null} deps.appPanelEl - App panel root.
 * @param {Function} deps.isLikelyPgnText - `(value) => boolean`.
 * @param {Function} deps.openGameFromIncomingText - `(pgnText, options?) => boolean|Promise<boolean>`.
 * @param {Function} [deps.setDropOverlayVisible] - Optional callback `(isVisible) => void`.
 * @returns {{bindEvents: Function}} Ingress handlers API.
 */
export const createGameIngressHandlers = ({
  appPanelEl,
  isLikelyPgnText,
  openGameFromIncomingText,
  setDropOverlayVisible,
}: any): any => {
  const inferGameTitleFromFileName = (fileName: any): any => (
    String(fileName || "").replace(/\.[^.]+$/, "").trim()
  );
  const getParentPath = (pathValue: any): any => {
    const normalized = String(pathValue || "").trim().replaceAll("\\", "/");
    const slashIndex = normalized.lastIndexOf("/");
    if (slashIndex <= 0) return "";
    return normalized.slice(0, slashIndex);
  };
  const inferDropSourceRefs = (file: any): any => {
    const maybeAbsolutePath = String(file?.path || "").trim();
    if (maybeAbsolutePath) {
      const folderPath = getParentPath(maybeAbsolutePath);
      const fileName = String(file?.name || "").trim();
      if (folderPath && fileName) {
        return {
          sourceRef: { kind: "file", locator: folderPath, recordId: fileName },
          resourceRef: { kind: "file", locator: folderPath },
        };
      }
    }
    const relativePath = String(file?.webkitRelativePath || "").trim();
    if (relativePath.includes("/")) {
      const folderPath = getParentPath(relativePath);
      const fileName = String(file?.name || "").trim();
      if (folderPath && fileName) {
        return {
          sourceRef: { kind: "file", locator: folderPath, recordId: fileName },
          resourceRef: { kind: "file", locator: folderPath },
        };
      }
    }
    return null;
  };
  const hasTransferFiles = (transfer: any): any => {
    const types = Array.from(transfer?.types || []);
    return Boolean(transfer?.files?.length) || types.includes("Files");
  };
  const collectDroppedFiles = (transfer: any): File[] => {
    const directFiles: File[] = transfer?.files ? Array.from(transfer.files) : [];
    if (directFiles.length > 0) return directFiles;
    const itemSource = transfer?.items;
    const rawItems: DataTransferItem[] = itemSource ? Array.from(itemSource) : [];
    const fromItems = rawItems
      .filter((item: any): any => item?.kind === "file" && typeof item.getAsFile === "function")
      .map((item: any): any => item.getAsFile())
      .filter((file: any): file is File => Boolean(file));
    return fromItems;
  };
  let dragDepth = 0;
  let isDropOverlayVisible = false;
  const setOverlayVisible = (visible: any): any => {
    const next = Boolean(visible);
    if (isDropOverlayVisible === next) return;
    isDropOverlayVisible = next;
    if (typeof setDropOverlayVisible === "function") setDropOverlayVisible(next);
  };
  const hasAcceptedTransfer = (transfer: any): any => {
    const hasText = Array.from(transfer?.types || []).includes("text/plain");
    return hasTransferFiles(transfer) || hasText;
  };

  /**
   * Bind drop and paste event handlers.
   */
  const bindEvents = (): any => {
    if (appPanelEl) {
      appPanelEl.addEventListener("dragenter", (event: any): any => {
        const transfer = event.dataTransfer;
        if (!hasAcceptedTransfer(transfer)) return;
        event.preventDefault();
        dragDepth += 1;
        setOverlayVisible(true);
      });
      appPanelEl.addEventListener("dragover", (event: any): any => {
        const transfer = event.dataTransfer;
        if (!hasAcceptedTransfer(transfer)) return;
        event.preventDefault();
        setOverlayVisible(true);
      });
      appPanelEl.addEventListener("dragleave", (): any => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) setOverlayVisible(false);
      });
      appPanelEl.addEventListener("drop", (event: any): any => {
        dragDepth = 0;
        setOverlayVisible(false);
        event.preventDefault();
        const dt = event.dataTransfer;
        if (!dt) return;
        const files = collectDroppedFiles(dt);
        if (files.length > 0) {
          void Promise.all(files.map(async (file: File): Promise<any> => {
            if (!/\.pgn$/i.test(file.name) && !/^text\//i.test(file.type || "")) return;
            const text = await file.text();
            if (!isLikelyPgnText(text)) return;
            const sourceHints = inferDropSourceRefs(file) as Record<string, unknown> | null;
            const hints = sourceHints || {};
            openGameFromIncomingText(text, {
              preferredTitle: inferGameTitleFromFileName(file.name),
              sourceRef: (hints.sourceRef as object | null | undefined) || null,
              resourceRef: (hints.resourceRef as object | null | undefined) || null,
              preferInsertIntoActiveResource: false,
            });
          }));
          return;
        }
        const plainText = dt.getData("text/plain");
        if (!isLikelyPgnText(plainText)) return;
        openGameFromIncomingText(plainText, { preferInsertIntoActiveResource: true });
      });
    }

    window.addEventListener("paste", (event: any): any => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
      }
      const plainText = event.clipboardData?.getData("text/plain") || "";
      if (!isLikelyPgnText(plainText)) return;
      openGameFromIncomingText(plainText, { preferInsertIntoActiveResource: true });
    });
  };

  return {
    bindEvents,
  };
};

