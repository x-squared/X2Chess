/**
 * Wiring module.
 *
 * Integration API:
 * - Primary exports from this module: `createAppWiringCapabilities`.
 *
 * Configuration API:
 * - Configuration is provided via typed function parameters/options in these exports
 *   (for example `deps`, `state`, callbacks, and option objects declared in this file).
 *
 * Communication API:
 * - This module communicates through shared `state`, DOM; interactions are explicit in
 *   exported function signatures and typed callback contracts.
 */

type AppWiringState = {
  moves: string[];
};

type AppWiringElements = {
  btnFirst: Element | null;
  btnPrev: Element | null;
  btnNext: Element | null;
  btnLast: Element | null;
  btnLoad: Element | null;
  btnCommentBold: Element | null;
  btnCommentItalic: Element | null;
  btnCommentUnderline: Element | null;
  btnUndo: Element | null;
  btnRedo: Element | null;
  btnCommentLeft: Element | null;
  btnCommentRight: Element | null;
  btnLinebreak: Element | null;
  btnIndent: Element | null;
  btnPgnLayoutPlain: Element | null;
  btnPgnLayoutText: Element | null;
  btnPgnLayoutTree: Element | null;
  btnDefaultIndent: Element | null;
  devTabBtnAst: Element | null;
  devTabBtnDom: Element | null;
  devTabBtnPgn: Element | null;
  pgnInput: Element | null;
  btnGameInfoEdit: Element | null;
  gameInfoInputs: Element[];
  gameInfoSuggestionEls: Element[];
};

type AppWiringActions = {
  [key: string]: unknown;
  isPlayerNameField: (key: string) => boolean;
  gotoPly: (ply: number, options?: { animate?: boolean }) => void | Promise<void>;
  gotoRelativeStep: (direction: number) => Promise<void>;
  loadPgn: () => void;
  formatCommentStyle: (style: "bold" | "italic" | "underline") => void;
  performUndo: () => void;
  performRedo: () => void;
  insertAroundSelectedMove: (side: "before" | "after", text: string) => void;
  setPgnLayoutMode: (mode: "plain" | "text" | "tree") => void;
  setSaveStatus?: (message?: string, kind?: string) => void;
  applyDefaultIndent: () => void;
  selectDevTab: (tab: "ast" | "dom" | "pgn") => void;
  handleLivePgnInput: () => void;
  toggleGameInfoEditor: () => void;
  handlePlayerNameInput: (key: string, input: HTMLInputElement, event: InputEvent) => void;
  handlePlayerNameKeydown: (event: KeyboardEvent, key: string, input: HTMLInputElement) => void;
  commitPlayerNameInput: (key: string, value: string) => void;
  updateGameInfoHeader: (key: string, value: string) => void;
  pickPlayerNameSuggestion: (fieldKey: string, playerName: string) => void;
  hydrateVisualAssets: () => void | Promise<void>;
  loadRuntimeConfigFromClientDataAndDefaults: () => Promise<void>;
  loadPlayerStore: () => Promise<void>;
  ensureBoard: () => Promise<void>;
  initializeWithDefaultPgn: () => void;
};

type AppWiringDeps = {
  state: AppWiringState;
  t: (key: string, fallback?: string) => string;
  els: AppWiringElements;
  actions: AppWiringActions;
};

type AppWiringCapabilities = {
  bindDomEvents: () => void;
  startApp: () => void;
};

/**
 * Create app wiring capabilities for event registration and startup orchestration.
 */
export const createAppWiringCapabilities = ({ state, t: _t, els, actions }: AppWiringDeps): AppWiringCapabilities => {
  /**
   * Bind DOM event handlers to host action callbacks.
   */
  const bindDomEvents = (): void => {
    const isPlayerNameField = (key: string): boolean => actions.isPlayerNameField(key);

    if (els.btnFirst) els.btnFirst.addEventListener("click", (): void => {
      void actions.gotoPly(0, { animate: false });
    });
    if (els.btnPrev) els.btnPrev.addEventListener("click", (): void => {
      void actions.gotoRelativeStep(-1);
    });
    if (els.btnNext) els.btnNext.addEventListener("click", (): void => {
      void actions.gotoRelativeStep(1);
    });
    if (els.btnLast) els.btnLast.addEventListener("click", (): void => {
      void actions.gotoPly(state.moves.length, { animate: false });
    });
    if (els.btnLoad) els.btnLoad.addEventListener("click", (): void => actions.loadPgn());
    if (els.btnCommentBold) els.btnCommentBold.addEventListener("click", (): void => actions.formatCommentStyle("bold"));
    if (els.btnCommentItalic) els.btnCommentItalic.addEventListener("click", (): void => actions.formatCommentStyle("italic"));
    if (els.btnCommentUnderline) els.btnCommentUnderline.addEventListener("click", (): void => actions.formatCommentStyle("underline"));
    if (els.btnUndo) els.btnUndo.addEventListener("click", (): void => actions.performUndo());
    if (els.btnRedo) els.btnRedo.addEventListener("click", (): void => actions.performRedo());
    if (els.btnCommentLeft) els.btnCommentLeft.addEventListener("click", (): void => actions.insertAroundSelectedMove("before", ""));
    if (els.btnCommentRight) els.btnCommentRight.addEventListener("click", (): void => actions.insertAroundSelectedMove("after", ""));
    if (els.btnLinebreak) els.btnLinebreak.addEventListener("click", (): void => actions.insertAroundSelectedMove("after", "\n"));
    if (els.btnIndent) els.btnIndent.addEventListener("click", (): void => actions.insertAroundSelectedMove("after", "\\i"));

    const bindPgnLayout = (btn: Element | null): void => {
      if (!btn) return;
      if (!(btn instanceof HTMLElement)) return;
      btn.addEventListener("click", (): void => {
        const mode: string | undefined = btn.dataset?.pgnLayout;
        if (mode === "plain" || mode === "text" || mode === "tree") {
          actions.setPgnLayoutMode(mode);
        }
      });
    };

    bindPgnLayout(els.btnPgnLayoutPlain);
    bindPgnLayout(els.btnPgnLayoutText);
    bindPgnLayout(els.btnPgnLayoutTree);

    if (els.btnDefaultIndent) els.btnDefaultIndent.addEventListener("click", (): void => actions.applyDefaultIndent());
    if (els.devTabBtnAst) els.devTabBtnAst.addEventListener("click", (): void => actions.selectDevTab("ast"));
    if (els.devTabBtnDom) els.devTabBtnDom.addEventListener("click", (): void => actions.selectDevTab("dom"));
    if (els.devTabBtnPgn) els.devTabBtnPgn.addEventListener("click", (): void => actions.selectDevTab("pgn"));

    if (els.pgnInput) {
      els.pgnInput.addEventListener("input", (): void => actions.handleLivePgnInput());
      els.pgnInput.addEventListener("drop", (): void => {
        window.setTimeout((): void => {
          actions.loadPgn();
        }, 0);
      });
    }

    if (els.btnGameInfoEdit) {
      els.btnGameInfoEdit.addEventListener("click", (): void => actions.toggleGameInfoEditor());
    }

    if (Array.isArray(els.gameInfoInputs)) {
      els.gameInfoInputs.forEach((input: Element): void => {
        if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
        const key: string | undefined = input.dataset.headerKey;
        if (!key) return;

        if (input instanceof HTMLInputElement && isPlayerNameField(key)) {
          input.addEventListener("input", (event: Event): void => {
            if (event instanceof InputEvent) actions.handlePlayerNameInput(key, input, event);
          });
          input.addEventListener("keydown", (event: KeyboardEvent): void => {
            actions.handlePlayerNameKeydown(event, key, input);
          });
          input.addEventListener("blur", (): void => {
            actions.commitPlayerNameInput(key, input.value);
          });
        }

        input.addEventListener("change", (): void => {
          if (input instanceof HTMLInputElement && isPlayerNameField(key)) {
            actions.commitPlayerNameInput(key, input.value);
            return;
          }
          actions.updateGameInfoHeader(key, input.value);
        });
      });
    }

    if (Array.isArray(els.gameInfoSuggestionEls)) {
      els.gameInfoSuggestionEls.forEach((container: Element): void => {
        if (!(container instanceof HTMLElement)) return;
        const fieldKey: string | undefined = container.dataset.playerSuggestionsFor;
        if (!fieldKey) return;
        container.addEventListener("mousedown", (event: MouseEvent): void => {
          event.preventDefault();
          const target: EventTarget | null = event.target;
          if (!(target instanceof HTMLElement)) return;
          const optionEl: HTMLElement | null = target.closest("[data-player-suggestion-value]");
          if (!(optionEl instanceof HTMLElement)) return;
          const playerName: string | undefined = optionEl.dataset.playerSuggestionValue;
          if (!playerName) return;
          actions.pickPlayerNameSuggestion(fieldKey, playerName);
        });
      });
    }
  };

  /**
   * Run app startup sequence.
   */
  const startApp = (): void => {
    void actions.hydrateVisualAssets();
    void (async (): Promise<void> => {
      await actions.loadRuntimeConfigFromClientDataAndDefaults();
      await actions.loadPlayerStore();
      await actions.ensureBoard();
      actions.initializeWithDefaultPgn();
    })();
  };

  return {
    bindDomEvents,
    startApp,
  };
};
