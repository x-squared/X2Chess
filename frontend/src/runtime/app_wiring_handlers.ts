import {
  applyDefaultIndentDirectives,
  ensureRequiredPgnHeaders,
  getHeaderValue,
  normalizeX2StyleValue,
  resolveEcoOpeningName,
  setHeaderValue,
  X2_STYLE_HEADER_KEY,
} from "../editor";
import { normalizeGameInfoHeaderValue } from "../app_shell/game_info";
import { handleLivePgnInputFromRuntime } from "./live_pgn_input";
import { initializeDefaultPgnFlow } from "./default_pgn_init";

/**
 * App wiring action handlers.
 *
 * Integration API:
 * - Exports focused handler factories used by runtime app wiring actions.
 *
 * Configuration API:
 * - Handlers are built from typed dependency objects.
 *
 * Communication API:
 * - Handlers mutate shared runtime `state` and call typed update callbacks.
 */
type HandlerState = {
  pgnModel: unknown;
  activeDevTab: string;
};

type PgnModelUpdateFn = (
  nextModel: unknown,
  focusCommentId?: string | null,
  options?: Record<string, unknown>,
) => void;

type SetDevDockOpenFn = (open: boolean) => void;

export const createApplyDefaultIndentHandler = <TState extends HandlerState>({
  state,
  applyPgnModelUpdate,
}: {
  state: TState;
  applyPgnModelUpdate: PgnModelUpdateFn;
}): (() => void) => {
  return (): void => {
    const nextModel: unknown = applyDefaultIndentDirectives(state.pgnModel);
    applyPgnModelUpdate(nextModel);
  };
};

export const createSetPgnLayoutModeHandler = <TState extends HandlerState>({
  state,
  applyPgnModelUpdate,
}: {
  state: TState;
  applyPgnModelUpdate: PgnModelUpdateFn;
}): ((mode: "plain" | "text" | "tree") => void) => {
  return (mode: "plain" | "text" | "tree"): void => {
    const next: string = normalizeX2StyleValue(mode);
    const nextModel: unknown = setHeaderValue(state.pgnModel, X2_STYLE_HEADER_KEY, next);
    applyPgnModelUpdate(nextModel, null, { preferredLayoutMode: next });
  };
};

export const createUpdateGameInfoHeaderHandler = <TState extends HandlerState>({
  state,
  applyPgnModelUpdate,
}: {
  state: TState;
  applyPgnModelUpdate: PgnModelUpdateFn;
}): ((key: string, value: string) => void) => {
  return (key: string, value: string): void => {
    const normalizedValue: string = normalizeGameInfoHeaderValue(key, value);
    const currentValue: string = normalizeGameInfoHeaderValue(key, getHeaderValue(state.pgnModel, key, ""));
    if (currentValue === normalizedValue) return;

    let nextModel: unknown = setHeaderValue(state.pgnModel, key, normalizedValue);
    if (key === "ECO") {
      const currentOpening: string = getHeaderValue(nextModel, "Opening", "");
      if (!currentOpening.trim()) {
        const fallbackOpening: string = resolveEcoOpeningName(normalizedValue);
        if (fallbackOpening) {
          nextModel = setHeaderValue(nextModel, "Opening", fallbackOpening);
        }
      }
    }

    nextModel = ensureRequiredPgnHeaders(nextModel);
    applyPgnModelUpdate(nextModel);
  };
};

export const createSelectDevTabHandler = <TState extends HandlerState>({
  state,
  setDevDockOpen,
}: {
  state: TState;
  setDevDockOpen: SetDevDockOpenFn;
}): ((tabId: "ast" | "dom" | "pgn") => void) => {
  return (tabId: "ast" | "dom" | "pgn"): void => {
    const normalized: "ast" | "dom" | "pgn" = tabId === "dom" || tabId === "pgn" ? tabId : "ast";
    state.activeDevTab = normalized;
    setDevDockOpen(true);
  };
};


type HandleLivePgnInputDeps = Parameters<typeof handleLivePgnInputFromRuntime>[0];

type InitializeDefaultPgnDeps = Parameters<typeof initializeDefaultPgnFlow>[0];

export const createHandleLivePgnInputHandler = (
  deps: HandleLivePgnInputDeps,
): (() => void) => {
  return (): void => {
    handleLivePgnInputFromRuntime(deps);
  };
};

export const createInitializeDefaultPgnHandler = (
  deps: InitializeDefaultPgnDeps,
): (() => void) => {
  return (): void => {
    initializeDefaultPgnFlow(deps);
  };
};
