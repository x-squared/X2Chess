/**
 * App shell component.
 *
 * Integration API:
 * - Build shell behavior with `createAppShellCapabilities(deps)`.
 * - Call `bindShellEvents()` once after layout refs are available.
 * - Use `setMenuOpen`, `setDeveloperToolsEnabled`, and `setDevDockOpen` for
 *   programmatic shell state changes.
 *
 * Configuration API:
 * - Configure by passing:
 *   - shared `state`,
 *   - shell DOM refs (menu, dock, save controls),
 *   - callbacks for locale change, undo/redo, tab switching, and save actions.
 *
 * Communication API:
 * - Mutates shell-oriented state fields (`isMenuOpen`, `moveDelayMs`,
 *   `soundEnabled`, developer dock toggles/height).
 * - Emits user intents via injected callbacks (`onUndo`, `onRedo`,
 *   `onChangeLocale`, `onSaveActiveGameNow`, ...).
 * - Binds global keyboard shortcuts for menu/undo/redo/dev-dock tabs.
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
 * @param {HTMLSelectElement|null} deps.localeInput - Locale selector input.
 * @param {HTMLInputElement|null} deps.developerToolsInput - Developer-tools toggle input.
 * @param {HTMLButtonElement|null} deps.btnDevDockToggle - Developer dock open/close button.
 * @param {HTMLButtonElement|null} deps.btnDevDockClose - Developer dock close button.
 * @param {HTMLSelectElement|null} deps.saveModeInput - Active-session save-mode input.
 * @param {HTMLButtonElement|null} deps.btnSaveActiveGame - Explicit save button.
 * @param {HTMLElement|null} deps.developerDockEl - Developer dock root.
 * @param {HTMLElement|null} deps.devDockResizeHandleEl - Developer dock resize handle.
 * @param {HTMLElement|null} deps.boardEditorBoxEl - Game-Viewer board/editor grid root.
 * @param {HTMLElement|null} deps.boardEditorResizeHandleEl - Board/editor divider resize handle.
 * @param {HTMLElement|null} deps.resourceViewerResizeHandleEl - Resource-Viewer resize handle.
 * @param {HTMLElement|null} deps.resourceViewerCardEl - Resource-Viewer card root.
 * @param {Function} deps.onHandleSelectedMoveArrowHotkey - Callback `(event) => boolean`.
 * @param {Function} deps.onUndo - Callback invoked for undo shortcut.
 * @param {Function} deps.onRedo - Callback invoked for redo shortcut.
 * @param {Function} deps.onChangeLocale - Callback `(localeCode) => void`.
 * @param {Function} deps.onChangeDeveloperTools - Callback `(enabled) => void`.
 * @param {Function} deps.onChangeDeveloperDockOpen - Callback `(isOpen) => void`.
 * @param {Function} deps.onSwitchDeveloperDockTab - Callback `(tab) => void`.
 * @param {Function} deps.onChangeActiveSaveMode - Callback `(mode) => void`.
 * @param {Function} [deps.onChangeBoardColumnWidth] - Callback `(widthPx) => void`.
 * @param {Function} [deps.onChangeResourceViewerHeight] - Callback `(heightPx) => void`.
 * @param {Function} deps.onSaveActiveGameNow - Callback `() => void|Promise<void>`.
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
  localeInput,
  developerToolsInput,
  btnDevDockToggle,
  btnDevDockClose,
  saveModeInput,
  btnSaveActiveGame,
  developerDockEl,
  devDockResizeHandleEl,
  boardEditorBoxEl,
  boardEditorResizeHandleEl,
  resourceViewerResizeHandleEl,
  resourceViewerCardEl,
  onHandleSelectedMoveArrowHotkey,
  onUndo,
  onRedo,
  onChangeLocale,
  onChangeDeveloperTools,
  onChangeDeveloperDockOpen,
  onSwitchDeveloperDockTab,
  onChangeActiveSaveMode,
  onChangeBoardColumnWidth,
  onChangeResourceViewerHeight,
  onSaveActiveGameNow,
}) => {
  const minDockHeight = 180;
  const maxDockHeight = () => Math.max(300, Math.min(640, Math.floor(window.innerHeight * 0.76)));
  const clampDockHeight = (value) => Math.max(minDockHeight, Math.min(maxDockHeight(), Math.round(Number(value) || 0)));
  const minResourceViewerHeight = 180;
  const maxResourceViewerHeight = () => Math.max(220, Math.min(560, Math.floor(window.innerHeight * 0.52)));
  const clampResourceViewerHeight = (value) => (
    Math.max(minResourceViewerHeight, Math.min(maxResourceViewerHeight(), Math.round(Number(value) || 0)))
  );
  const minBoardColumnWidth = 320;
  const maxBoardColumnWidth = () => {
    const viewportBased = Math.floor(window.innerWidth * 0.65);
    return Math.max(420, Math.min(760, viewportBased));
  };
  const clampBoardColumnWidth = (value) => (
    Math.max(minBoardColumnWidth, Math.min(maxBoardColumnWidth(), Math.round(Number(value) || 0)))
  );

  const syncDevDockControls = () => {
    const enabled = Boolean(state.isDeveloperToolsEnabled);
    if (developerToolsInput) developerToolsInput.checked = enabled;
    if (btnDevDockToggle) {
      btnDevDockToggle.hidden = !enabled;
      btnDevDockToggle.disabled = !enabled;
      btnDevDockToggle.textContent = t(
        state.isDevDockOpen ? "controls.closeDeveloperDock" : "controls.openDeveloperDock",
        state.isDevDockOpen ? "Close Developer Dock" : "Open Developer Dock",
      );
    }
    if (btnDevDockClose) btnDevDockClose.disabled = !enabled;
    if (saveModeInput) saveModeInput.value = state.defaultSaveMode === "manual" ? "manual" : "auto";
    if (btnSaveActiveGame) btnSaveActiveGame.disabled = false;
    if (document.body) document.body.classList.toggle("dev-dock-open", enabled && state.isDevDockOpen);
    const rootStyle = document.documentElement?.style;
    if (rootStyle) {
      rootStyle.setProperty("--dev-dock-height", `${clampDockHeight(state.devDockHeightPx)}px`);
      rootStyle.setProperty("--resource-viewer-height", `${clampResourceViewerHeight(state.resourceViewerHeightPx)}px`);
      rootStyle.setProperty("--board-column-width", `${clampBoardColumnWidth(state.boardColumnWidthPx)}px`);
    }
  };

  /**
   * Set developer-tools toggle and enforce dependent state.
   *
   * @param {boolean} enabled - Target developer-tools state.
   */
  const setDeveloperToolsEnabled = (enabled) => {
    state.isDeveloperToolsEnabled = Boolean(enabled);
    if (!state.isDeveloperToolsEnabled) state.isDevDockOpen = false;
    syncDevDockControls();
    if (typeof onChangeDeveloperTools === "function") onChangeDeveloperTools(state.isDeveloperToolsEnabled);
  };

  /**
   * Toggle developer dock visibility.
   *
   * @param {boolean} open - True to show dock.
   */
  const setDevDockOpen = (open) => {
    if (!state.isDeveloperToolsEnabled) {
      state.isDevDockOpen = false;
      syncDevDockControls();
      return;
    }
    state.isDevDockOpen = Boolean(open);
    syncDevDockControls();
    if (typeof onChangeDeveloperDockOpen === "function") onChangeDeveloperDockOpen(state.isDevDockOpen);
  };

  /**
   * Set dock height in pixels.
   *
   * @param {number} px - Requested dock height in pixels.
   */
  const setDevDockHeight = (px) => {
    state.devDockHeightPx = clampDockHeight(px);
    syncDevDockControls();
  };

  /**
   * Set Resource-Viewer table height in pixels.
   *
   * @param {number} px - Requested Resource-Viewer table height in pixels.
   */
  const setResourceViewerHeight = (px) => {
    state.resourceViewerHeightPx = clampResourceViewerHeight(px);
    syncDevDockControls();
    if (typeof onChangeResourceViewerHeight === "function") {
      onChangeResourceViewerHeight(state.resourceViewerHeightPx);
    }
  };

  /**
   * Set board column width in pixels.
   *
   * @param {number} px - Requested board column width in pixels.
   */
  const setBoardColumnWidth = (px) => {
    state.boardColumnWidthPx = clampBoardColumnWidth(px);
    syncDevDockControls();
    if (typeof onChangeBoardColumnWidth === "function") {
      onChangeBoardColumnWidth(state.boardColumnWidthPx);
    }
  };

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
    if (localeInput) {
      localeInput.addEventListener("change", () => {
        const localeCode = String(localeInput.value || "").trim();
        if (!localeCode || localeCode === state.locale) return;
        onChangeLocale(localeCode);
      });
    }
    if (developerToolsInput) {
      developerToolsInput.addEventListener("change", () => {
        setDeveloperToolsEnabled(Boolean(developerToolsInput.checked));
      });
    }
    if (btnDevDockToggle) {
      btnDevDockToggle.addEventListener("click", () => {
        setDevDockOpen(!state.isDevDockOpen);
      });
    }
    if (btnDevDockClose) {
      btnDevDockClose.addEventListener("click", () => {
        setDevDockOpen(false);
      });
    }
    if (saveModeInput) {
      saveModeInput.addEventListener("change", () => {
        const mode = saveModeInput.value === "manual" ? "manual" : "auto";
        state.defaultSaveMode = mode;
        if (typeof onChangeActiveSaveMode === "function") onChangeActiveSaveMode(mode);
      });
    }
    if (btnSaveActiveGame) {
      btnSaveActiveGame.addEventListener("click", () => {
        if (typeof onSaveActiveGameNow === "function") {
          void Promise.resolve(onSaveActiveGameNow());
        }
      });
    }
    syncDevDockControls();

    if (devDockResizeHandleEl && developerDockEl) {
      let resizeState: { bottomPx: number } | null = null;
      const onPointerMove = (event) => {
        if (!resizeState) return;
        const nextHeight = resizeState.bottomPx - event.clientY;
        setDevDockHeight(nextHeight);
      };
      const clearResize = () => {
        resizeState = null;
      };
      devDockResizeHandleEl.addEventListener("pointerdown", (event) => {
        if (!state.isDeveloperToolsEnabled) return;
        if (!state.isDevDockOpen) return;
        const dockRect = developerDockEl.getBoundingClientRect();
        resizeState = { bottomPx: dockRect.bottom };
        devDockResizeHandleEl.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", clearResize);
      window.addEventListener("pointercancel", clearResize);
    }
    if (resourceViewerResizeHandleEl && resourceViewerCardEl) {
      let resizeState: { startY: number; startHeight: number } | null = null;
      const onPointerMove = (event) => {
        if (!resizeState) return;
        const deltaY = resizeState.startY - event.clientY;
        setResourceViewerHeight(resizeState.startHeight + deltaY);
      };
      const clearResize = () => {
        resizeState = null;
      };
      resourceViewerResizeHandleEl.addEventListener("pointerdown", (event) => {
        resizeState = {
          startY: event.clientY,
          startHeight: clampResourceViewerHeight(state.resourceViewerHeightPx),
        };
        resourceViewerResizeHandleEl.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", clearResize);
      window.addEventListener("pointercancel", clearResize);
    }
    if (boardEditorResizeHandleEl && boardEditorBoxEl) {
      let resizeState: { leftPx: number; handleHalfWidthPx: number } | null = null;
      const onPointerMove = (event) => {
        if (!resizeState) return;
        const nextWidth = event.clientX - resizeState.leftPx - resizeState.handleHalfWidthPx;
        setBoardColumnWidth(nextWidth);
      };
      const clearResize = () => {
        resizeState = null;
      };
      boardEditorResizeHandleEl.addEventListener("pointerdown", (event) => {
        const boxRect = boardEditorBoxEl.getBoundingClientRect();
        const handleRect = boardEditorResizeHandleEl.getBoundingClientRect();
        resizeState = {
          leftPx: boxRect.left,
          handleHalfWidthPx: Math.max(2, Math.round(handleRect.width / 2)),
        };
        boardEditorResizeHandleEl.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", clearResize);
      window.addEventListener("pointercancel", clearResize);
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
      if (isModifierPressed && !event.altKey && state.isDeveloperToolsEnabled) {
        const tabByNumber = {
          "1": "ast",
          "2": "dom",
          "3": "pgn",
        };
        const targetTab = tabByNumber[event.key];
        if (targetTab) {
          event.preventDefault();
          if (typeof onSwitchDeveloperDockTab === "function") onSwitchDeveloperDockTab(targetTab);
          else {
            state.activeDevTab = targetTab;
            setDevDockOpen(true);
          }
          return;
        }
      }
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
    setDevDockOpen,
    setDeveloperToolsEnabled,
    setMenuOpen,
  };
};
