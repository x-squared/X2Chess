import {
  publishRuntimeBoardSnapshot,
  publishRuntimeEditorSnapshot,
  publishRuntimeResourceViewerSnapshot,
  publishRuntimeSessionsSnapshot,
  publishRuntimeShellSnapshot,
} from "../hooks/runtime_bridge";
import { normalizeX2StyleValue } from "../editor";

type RuntimeSessionLike = {
  sessionId?: unknown;
  title?: unknown;
  dirtyState?: unknown;
  saveMode?: unknown;
};

type RuntimeResourceTabLike = {
  tabId?: unknown;
  title?: unknown;
  resourceRef?: { kind?: unknown; locator?: unknown } | null;
  rows?: unknown[];
  errorMessage?: unknown;
};

type SnapshotState = {
  currentPly: number;
  moves: unknown[];
  selectedMoveId: string | null;
  moveDelayMs: number;
  soundEnabled: boolean;
  pgnLayoutMode: string;
  statusMessage: string;
  errorMessage: string;
  pendingFocusCommentId: string | null;
  isGameInfoEditorOpen: boolean;
  pgnText: string;
  activeSessionId: string | null;
  resourceViewerTabs: unknown[];
  activeResourceTabId: string | null;
  activeSourceKind: string;
  locale: string;
  isMenuOpen: boolean;
  isDeveloperToolsEnabled: boolean;
  isDevDockOpen: boolean;
  activeDevTab: string;
};

type GameSessionStoreLike = {
  listSessions: () => unknown[];
};

export const publishRuntimeSnapshots = (
  state: SnapshotState,
  gameSessionStore: GameSessionStoreLike | null,
): void => {
  publishRuntimeBoardSnapshot({
    currentPly: Number(state.currentPly || 0),
    moveCount: Number(Array.isArray(state.moves) ? state.moves.length : 0),
    selectedMoveId: state.selectedMoveId ? String(state.selectedMoveId) : null,
    moveDelayMs: Number(state.moveDelayMs || 0),
    soundEnabled: Boolean(state.soundEnabled),
    pgnLayoutMode: normalizeX2StyleValue(state.pgnLayoutMode),
    statusMessage: String(state.statusMessage || ""),
    errorMessage: String(state.errorMessage || ""),
  });

  publishRuntimeEditorSnapshot({
    pgnLayoutMode: normalizeX2StyleValue(state.pgnLayoutMode),
    pendingFocusCommentId: state.pendingFocusCommentId ? String(state.pendingFocusCommentId) : null,
    isGameInfoEditorOpen: Boolean(state.isGameInfoEditorOpen),
    pgnTextLength: String(state.pgnText || "").length,
  });

  const sessions: unknown[] = gameSessionStore ? gameSessionStore.listSessions() : [];
  publishRuntimeSessionsSnapshot({
    activeSessionId: state.activeSessionId ? String(state.activeSessionId) : null,
    sessionCount: Number(Array.isArray(sessions) ? sessions.length : 0),
    sessions: (Array.isArray(sessions) ? sessions : []).map((session: unknown) => {
      const candidate = session as RuntimeSessionLike;
      const sessionId: string = typeof candidate.sessionId === "string" ? candidate.sessionId : "";
      const saveMode: "auto" | "manual" = candidate.saveMode === "manual" ? "manual" : "auto";
      return {
        sessionId,
        title: typeof candidate.title === "string" ? candidate.title : sessionId,
        dirtyState: typeof candidate.dirtyState === "string" ? candidate.dirtyState : "clean",
        saveMode,
        isActive: sessionId !== "" && sessionId === state.activeSessionId,
      };
    }).filter((entry: { sessionId: string }) => entry.sessionId !== ""),
  });

  const resourceTabs: unknown[] = Array.isArray(state.resourceViewerTabs) ? state.resourceViewerTabs : [];
  const activeResourceTab = resourceTabs.find((tab: unknown): boolean => {
    const candidate = tab as { tabId?: unknown };
    return typeof candidate.tabId === "string" && candidate.tabId === state.activeResourceTabId;
  }) as RuntimeResourceTabLike | undefined;

  publishRuntimeResourceViewerSnapshot({
    activeSourceKind: String(state.activeSourceKind || "directory"),
    tabCount: resourceTabs.length,
    activeTabId: activeResourceTab && typeof activeResourceTab.tabId === "string" ? activeResourceTab.tabId : null,
    activeTabTitle: activeResourceTab && typeof activeResourceTab.title === "string" ? activeResourceTab.title : "",
    activeTabKind: activeResourceTab?.resourceRef && typeof activeResourceTab.resourceRef.kind === "string"
      ? activeResourceTab.resourceRef.kind
      : "",
    activeTabLocator: activeResourceTab?.resourceRef && typeof activeResourceTab.resourceRef.locator === "string"
      ? activeResourceTab.resourceRef.locator
      : "",
    activeRowCount: Array.isArray(activeResourceTab?.rows) ? activeResourceTab.rows.length : 0,
    activeErrorMessage: activeResourceTab && typeof activeResourceTab.errorMessage === "string"
      ? activeResourceTab.errorMessage
      : "",
  });

  publishRuntimeShellSnapshot({
    locale: String(state.locale || "en"),
    isMenuOpen: Boolean(state.isMenuOpen),
    isDeveloperToolsEnabled: Boolean(state.isDeveloperToolsEnabled),
    isDevDockOpen: Boolean(state.isDevDockOpen),
    activeDevTab: state.activeDevTab === "dom" || state.activeDevTab === "pgn" ? state.activeDevTab : "ast",
  });
};
