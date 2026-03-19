/**
 * Game ingress handlers.
 *
 * Integration API:
 * - `createGameIngressHandlers(deps)`
 *
 * Configuration API:
 * - Uses PGN detector callback and open callback injected by caller.
 *
 * Communication API:
 * - Binds drag/drop and paste behavior to open-game callback.
 */

/**
 * Create ingress handlers for drop/paste game creation.
 *
 * @param {object} deps - Dependencies.
 * @param {HTMLElement|null} deps.appPanelEl - App panel root.
 * @param {Function} deps.isLikelyPgnText - `(value) => boolean`.
 * @param {Function} deps.openGameFromIncomingText - `(pgnText, preferredTitle?) => boolean`.
 * @returns {{bindEvents: Function}} Ingress handlers API.
 */
export const createGameIngressHandlers = ({
  appPanelEl,
  isLikelyPgnText,
  openGameFromIncomingText,
}) => {
  const inferGameTitleFromFileName = (fileName) => (
    String(fileName || "").replace(/\.[^.]+$/, "").trim()
  );

  /**
   * Bind drop and paste event handlers.
   */
  const bindEvents = () => {
    if (appPanelEl) {
      appPanelEl.addEventListener("dragover", (event) => {
        const hasFiles = Boolean(event.dataTransfer?.files?.length);
        const hasText = Array.from(event.dataTransfer?.types || []).includes("text/plain");
        if (hasFiles || hasText) event.preventDefault();
      });
      appPanelEl.addEventListener("drop", (event) => {
        event.preventDefault();
        const dt = event.dataTransfer;
        if (!dt) return;
        const files = Array.from(dt.files || []);
        if (files.length > 0) {
          void Promise.all(files.map(async (file) => {
            if (!/\.pgn$/i.test(file.name) && !/^text\//i.test(file.type || "")) return;
            const text = await file.text();
            if (!isLikelyPgnText(text)) return;
            openGameFromIncomingText(text, inferGameTitleFromFileName(file.name));
          }));
          return;
        }
        const plainText = dt.getData("text/plain");
        if (!isLikelyPgnText(plainText)) return;
        openGameFromIncomingText(plainText);
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
      openGameFromIncomingText(plainText);
    });
  };

  return {
    bindEvents,
  };
};

