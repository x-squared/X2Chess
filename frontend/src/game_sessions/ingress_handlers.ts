/**
 * Game ingress handlers.
 *
 * Integration API:
 * - Create with `createGameIngressHandlers(deps)` and call `bindEvents()` once
 *   after app panel is mounted.
 *
 * Configuration API:
 * - Configure with:
 *   - `isLikelyPgnText(value)` for PGN detection policy,
 *   - `openGameFromIncomingText(pgnText, preferredTitle?)` for session creation.
 * - Optional `appPanelEl` controls where drag/drop is captured.
 *
 * Communication API:
 * - Listens to drop/paste events, extracts text from files/clipboard, filters by
 *   PGN heuristic, and forwards accepted content through open callback.
 * - Does not parse PGN or mutate session state directly.
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
}) => {
  const inferGameTitleFromFileName = (fileName) => (
    String(fileName || "").replace(/\.[^.]+$/, "").trim()
  );
  const getParentPath = (pathValue) => {
    const normalized = String(pathValue || "").trim().replaceAll("\\", "/");
    const slashIndex = normalized.lastIndexOf("/");
    if (slashIndex <= 0) return "";
    return normalized.slice(0, slashIndex);
  };
  const inferDropSourceRefs = (file) => {
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
  const hasTransferFiles = (transfer) => {
    const types = Array.from(transfer?.types || []);
    return Boolean(transfer?.files?.length) || types.includes("Files");
  };
  const collectDroppedFiles = (transfer): File[] => {
    const directFiles: File[] = transfer?.files ? Array.from(transfer.files) : [];
    if (directFiles.length > 0) return directFiles;
    const itemSource = transfer?.items;
    const rawItems: DataTransferItem[] = itemSource ? Array.from(itemSource) : [];
    const fromItems = rawItems
      .filter((item) => item?.kind === "file" && typeof item.getAsFile === "function")
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    return fromItems;
  };
  let dragDepth = 0;
  let isDropOverlayVisible = false;
  const setOverlayVisible = (visible) => {
    const next = Boolean(visible);
    if (isDropOverlayVisible === next) return;
    isDropOverlayVisible = next;
    if (typeof setDropOverlayVisible === "function") setDropOverlayVisible(next);
  };
  const hasAcceptedTransfer = (transfer) => {
    const hasText = Array.from(transfer?.types || []).includes("text/plain");
    return hasTransferFiles(transfer) || hasText;
  };

  /**
   * Bind drop and paste event handlers.
   */
  const bindEvents = () => {
    if (appPanelEl) {
      appPanelEl.addEventListener("dragenter", (event) => {
        const transfer = event.dataTransfer;
        if (!hasAcceptedTransfer(transfer)) return;
        event.preventDefault();
        dragDepth += 1;
        setOverlayVisible(true);
      });
      appPanelEl.addEventListener("dragover", (event) => {
        const transfer = event.dataTransfer;
        if (!hasAcceptedTransfer(transfer)) return;
        event.preventDefault();
        setOverlayVisible(true);
      });
      appPanelEl.addEventListener("dragleave", () => {
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) setOverlayVisible(false);
      });
      appPanelEl.addEventListener("drop", (event) => {
        dragDepth = 0;
        setOverlayVisible(false);
        event.preventDefault();
        const dt = event.dataTransfer;
        if (!dt) return;
        const files = collectDroppedFiles(dt);
        if (files.length > 0) {
          void Promise.all(files.map(async (file: File) => {
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

    window.addEventListener("paste", (event) => {
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

