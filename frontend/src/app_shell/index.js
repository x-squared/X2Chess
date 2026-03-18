/**
 * App shell component.
 *
 * Integration API:
 * - `createAppShellCapabilities(deps)` returns shell UI/shortcut capabilities.
 *
 * Configuration API:
 * - Receives state, translation callback, and shell DOM references from caller.
 *
 * Communication API:
 * - Mutates shell-related state (`isMenuOpen`, speed/sound values) and delegates
 *   undo/redo and move-hotkey handling through explicit callbacks.
 */

/**
 * Create app shell capabilities for menu, controls, and global shortcuts.
 *
 * @param {object} deps - Host dependencies.
 * @param {object} deps.state - Shared application state.
 * @param {Function} deps.t - Translation function `(key, fallback) => string`.
 * @param {HTMLButtonElement|null} deps.btnMenu - Menu open/close trigger button.
 * @param {HTMLButtonElement|null} deps.btnMenuClose - Menu close button.
 * @param {HTMLElement|null} deps.menuPanel - Menu panel element.
 * @param {HTMLElement|null} deps.menuBackdrop - Menu backdrop element.
 * @param {HTMLInputElement|null} deps.speedInput - Move-speed range input.
 * @param {HTMLElement|null} deps.speedValue - Move-speed value label.
 * @param {HTMLInputElement|null} deps.soundInput - Sound toggle input.
 * @param {Function} deps.onHandleSelectedMoveArrowHotkey - Callback `(event) => boolean`.
 * @param {Function} deps.onUndo - Callback invoked for undo shortcut.
 * @param {Function} deps.onRedo - Callback invoked for redo shortcut.
 * @returns {{setMenuOpen: Function, bindShellEvents: Function}} App shell capabilities.
 */
export const createAppShellCapabilities = ({
  state,
  t,
  btnMenu,
  btnMenuClose,
  menuPanel,
  menuBackdrop,
  speedInput,
  speedValue,
  soundInput,
  onHandleSelectedMoveArrowHotkey,
  onUndo,
  onRedo,
}) => {
  /**
   * Toggle menu open state and synchronize shell DOM attributes.
   *
   * @param {boolean} open - Whether the menu should be open.
   */
  const setMenuOpen = (open) => {
    state.isMenuOpen = Boolean(open);
    if (btnMenu) {
      btnMenu.setAttribute("aria-expanded", state.isMenuOpen ? "true" : "false");
      btnMenu.setAttribute("aria-label", t(state.isMenuOpen ? "menu.close" : "menu.open", state.isMenuOpen ? "Close menu" : "Open menu"));
    }
    if (menuPanel) {
      menuPanel.classList.toggle("open", state.isMenuOpen);
      menuPanel.setAttribute("aria-hidden", state.isMenuOpen ? "false" : "true");
    }
    if (menuBackdrop) {
      menuBackdrop.hidden = !state.isMenuOpen;
    }
    if (document.body) {
      document.body.classList.toggle("menu-open", state.isMenuOpen);
    }
  };

  /**
   * Bind app shell DOM and keyboard listeners.
   */
  const bindShellEvents = () => {
    if (btnMenu) {
      btnMenu.addEventListener("click", () => {
        setMenuOpen(!state.isMenuOpen);
      });
    }
    if (btnMenuClose) {
      btnMenuClose.addEventListener("click", () => {
        setMenuOpen(false);
      });
    }
    if (menuBackdrop) {
      menuBackdrop.addEventListener("click", () => {
        setMenuOpen(false);
      });
    }

    if (speedInput) {
      speedInput.addEventListener("input", () => {
        state.moveDelayMs = Number(speedInput.value) || 0;
        if (speedValue) speedValue.textContent = String(state.moveDelayMs);
      });
    }
    if (soundInput) {
      soundInput.addEventListener("change", () => {
        state.soundEnabled = soundInput.checked;
      });
    }

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.isMenuOpen) {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement
        && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (onHandleSelectedMoveArrowHotkey(event)) return;
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed || event.altKey) return;
      const key = event.key.toLowerCase();
      const wantsRedo = key === "y" || (key === "z" && event.shiftKey);
      const wantsUndo = key === "z" && !event.shiftKey;
      if (wantsUndo) {
        event.preventDefault();
        onUndo();
      } else if (wantsRedo) {
        event.preventDefault();
        onRedo();
      }
    });
  };

  return {
    bindShellEvents,
    setMenuOpen,
  };
};
