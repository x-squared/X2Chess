import { createGameTabsUi } from "../game_sessions/tabs_ui";
import { EMPTY_GAME_PGN, type SourceRefLike } from "./bootstrap_shared";

type GameTabsBootstrapState = {
  activeSessionId: string | null;
  defaultSaveMode: string;
  activeSourceKind: string;
  gameDirectoryPath: string;
};

type GameSessionStoreLike = {
  listSessions: () => unknown[];
  switchToSession: (sessionId: string) => boolean;
  getActiveSession: () => { saveMode?: string } | null;
  closeSession: (sessionId: string) => { emptyAfterClose: boolean };
};

type ResourceViewerCapabilitiesLike = {
  getActiveResourceRef: () => SourceRefLike | null;
};

type SessionOpenFlowLike = {
  openUnsavedSessionFromPgnText: (
    pgnText: string,
    title: string,
    pendingResourceRef: SourceRefLike | null,
  ) => void;
};

type GameTabsBootstrapDeps<TState extends GameTabsBootstrapState> = {
  gameTabsEl: Element | null;
  t: (key: string, fallback?: string) => string;
  state: TState;
  gameSessionStore: GameSessionStoreLike;
  resourceViewerCapabilities: ResourceViewerCapabilitiesLike;
  sessionOpenFlow: SessionOpenFlowLike;
  normalizeResourceRefForInsertFn: (resourceRef: SourceRefLike, state: TState) => SourceRefLike | null;
  render: () => void;
};

export const createGameTabsBootstrap = <TState extends GameTabsBootstrapState>({
  gameTabsEl,
  t,
  state,
  gameSessionStore,
  resourceViewerCapabilities,
  sessionOpenFlow,
  normalizeResourceRefForInsertFn,
  render,
}: GameTabsBootstrapDeps<TState>): ReturnType<typeof createGameTabsUi> => {
  return createGameTabsUi({
    gameTabsEl,
    t,
    getSessions: gameSessionStore.listSessions,
    getActiveSessionId: (): string | null => state.activeSessionId,
    onSelectSession: (sessionId: string): void => {
      if (gameSessionStore.switchToSession(sessionId)) {
        const active = gameSessionStore.getActiveSession();
        if (active) {
          state.defaultSaveMode = active.saveMode || state.defaultSaveMode;
        }
        render();
      }
    },
    onCloseSession: (sessionId: string): void => {
      const result = gameSessionStore.closeSession(sessionId);
      if (result.emptyAfterClose) {
        const pendingResourceRef = normalizeResourceRefForInsertFn(
          resourceViewerCapabilities.getActiveResourceRef()
            || { kind: state.activeSourceKind || "directory", locator: state.gameDirectoryPath || "" },
          state,
        );
        sessionOpenFlow.openUnsavedSessionFromPgnText(EMPTY_GAME_PGN, t("games.new", "New game"), pendingResourceRef);
        return;
      }
      render();
    },
  });
};
