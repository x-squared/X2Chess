/**
 * Runtime to React bridge events.
 */

export const RUNTIME_BOARD_SNAPSHOT_EVENT = "x2chess:runtime-board-snapshot";

export type RuntimeBoardSnapshot = {
  currentPly: number;
  moveCount: number;
  selectedMoveId: string | null;
  moveDelayMs: number;
  soundEnabled: boolean;
  pgnLayoutMode: "plain" | "text" | "tree";
  statusMessage: string;
  errorMessage: string;
};

const normalizeLayoutMode = (value: unknown): "plain" | "text" | "tree" => {
  if (value === "text" || value === "tree") return value;
  return "plain";
};

const toSnapshot = (value: unknown): RuntimeBoardSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const currentPlyRaw: number = Number(candidate.currentPly);
  const moveCountRaw: number = Number(candidate.moveCount);
  const moveDelayMsRaw: number = Number(candidate.moveDelayMs);
  const soundEnabledRaw: boolean = Boolean(candidate.soundEnabled);
  const selectedMoveIdRaw: string | null = typeof candidate.selectedMoveId === "string"
    ? candidate.selectedMoveId
    : null;
  const statusMessageRaw: string = typeof candidate.statusMessage === "string" ? candidate.statusMessage : "";
  const errorMessageRaw: string = typeof candidate.errorMessage === "string" ? candidate.errorMessage : "";

  return {
    currentPly: Number.isFinite(currentPlyRaw) ? Math.max(0, Math.floor(currentPlyRaw)) : 0,
    moveCount: Number.isFinite(moveCountRaw) ? Math.max(0, Math.floor(moveCountRaw)) : 0,
    selectedMoveId: selectedMoveIdRaw,
    moveDelayMs: Number.isFinite(moveDelayMsRaw) ? Math.max(0, Math.floor(moveDelayMsRaw)) : 0,
    soundEnabled: soundEnabledRaw,
    pgnLayoutMode: normalizeLayoutMode(candidate.pgnLayoutMode),
    statusMessage: statusMessageRaw,
    errorMessage: errorMessageRaw,
  };
};

export const publishRuntimeBoardSnapshot = (snapshot: RuntimeBoardSnapshot): void => {
  window.dispatchEvent(new CustomEvent<RuntimeBoardSnapshot>(RUNTIME_BOARD_SNAPSHOT_EVENT, { detail: snapshot }));
};

export const subscribeRuntimeBoardSnapshot = (
  onSnapshot: (snapshot: RuntimeBoardSnapshot) => void,
): (() => void) => {
  const listener = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const snapshot = toSnapshot(event.detail);
    if (!snapshot) return;
    onSnapshot(snapshot);
  };
  window.addEventListener(RUNTIME_BOARD_SNAPSHOT_EVENT, listener);
  return (): void => {
    window.removeEventListener(RUNTIME_BOARD_SNAPSHOT_EVENT, listener);
  };
};


export const RUNTIME_EDITOR_SNAPSHOT_EVENT = "x2chess:runtime-editor-snapshot";

export type RuntimeEditorSnapshot = {
  pgnLayoutMode: "plain" | "text" | "tree";
  pendingFocusCommentId: string | null;
  isGameInfoEditorOpen: boolean;
  pgnTextLength: number;
};

const toEditorSnapshot = (value: unknown): RuntimeEditorSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const pendingFocusCommentIdRaw: string | null = typeof candidate.pendingFocusCommentId === "string"
    ? candidate.pendingFocusCommentId
    : null;
  const isGameInfoEditorOpenRaw: boolean = Boolean(candidate.isGameInfoEditorOpen);
  const pgnTextLengthRaw: number = Number(candidate.pgnTextLength);
  return {
    pgnLayoutMode: normalizeLayoutMode(candidate.pgnLayoutMode),
    pendingFocusCommentId: pendingFocusCommentIdRaw,
    isGameInfoEditorOpen: isGameInfoEditorOpenRaw,
    pgnTextLength: Number.isFinite(pgnTextLengthRaw) ? Math.max(0, Math.floor(pgnTextLengthRaw)) : 0,
  };
};

export const publishRuntimeEditorSnapshot = (snapshot: RuntimeEditorSnapshot): void => {
  window.dispatchEvent(new CustomEvent<RuntimeEditorSnapshot>(RUNTIME_EDITOR_SNAPSHOT_EVENT, { detail: snapshot }));
};

export const subscribeRuntimeEditorSnapshot = (
  onSnapshot: (snapshot: RuntimeEditorSnapshot) => void,
): (() => void) => {
  const listener = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const snapshot = toEditorSnapshot(event.detail);
    if (!snapshot) return;
    onSnapshot(snapshot);
  };
  window.addEventListener(RUNTIME_EDITOR_SNAPSHOT_EVENT, listener);
  return (): void => {
    window.removeEventListener(RUNTIME_EDITOR_SNAPSHOT_EVENT, listener);
  };
};


export const RUNTIME_SESSIONS_SNAPSHOT_EVENT = "x2chess:runtime-sessions-snapshot";

export type RuntimeSessionItemSnapshot = {
  sessionId: string;
  title: string;
  dirtyState: string;
  saveMode: "auto" | "manual";
  isActive: boolean;
};

export type RuntimeSessionsSnapshot = {
  activeSessionId: string | null;
  sessionCount: number;
  sessions: RuntimeSessionItemSnapshot[];
};

const toSessionItemSnapshot = (value: unknown): RuntimeSessionItemSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const sessionId = typeof candidate.sessionId === "string" ? candidate.sessionId : "";
  if (!sessionId) return null;
  return {
    sessionId,
    title: typeof candidate.title === "string" ? candidate.title : sessionId,
    dirtyState: typeof candidate.dirtyState === "string" ? candidate.dirtyState : "clean",
    saveMode: candidate.saveMode === "manual" ? "manual" : "auto",
    isActive: Boolean(candidate.isActive),
  };
};

const toSessionsSnapshot = (value: unknown): RuntimeSessionsSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const activeSessionId = typeof candidate.activeSessionId === "string" ? candidate.activeSessionId : null;
  const rawSessions = Array.isArray(candidate.sessions) ? candidate.sessions : [];
  const sessions = rawSessions
    .map((entry: unknown): RuntimeSessionItemSnapshot | null => toSessionItemSnapshot(entry))
    .filter((entry: RuntimeSessionItemSnapshot | null): entry is RuntimeSessionItemSnapshot => Boolean(entry));
  const sessionCountRaw = Number(candidate.sessionCount);
  return {
    activeSessionId,
    sessionCount: Number.isFinite(sessionCountRaw) ? Math.max(0, Math.floor(sessionCountRaw)) : sessions.length,
    sessions,
  };
};

export const publishRuntimeSessionsSnapshot = (snapshot: RuntimeSessionsSnapshot): void => {
  window.dispatchEvent(new CustomEvent<RuntimeSessionsSnapshot>(RUNTIME_SESSIONS_SNAPSHOT_EVENT, { detail: snapshot }));
};

export const subscribeRuntimeSessionsSnapshot = (
  onSnapshot: (snapshot: RuntimeSessionsSnapshot) => void,
): (() => void) => {
  const listener = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const snapshot = toSessionsSnapshot(event.detail);
    if (!snapshot) return;
    onSnapshot(snapshot);
  };
  window.addEventListener(RUNTIME_SESSIONS_SNAPSHOT_EVENT, listener);
  return (): void => {
    window.removeEventListener(RUNTIME_SESSIONS_SNAPSHOT_EVENT, listener);
  };
};


export const RUNTIME_RESOURCE_VIEWER_SNAPSHOT_EVENT = "x2chess:runtime-resource-viewer-snapshot";

export type RuntimeResourceViewerSnapshot = {
  activeSourceKind: string;
  tabCount: number;
  activeTabId: string | null;
  activeTabTitle: string;
  activeTabKind: string;
  activeTabLocator: string;
  activeRowCount: number;
  activeErrorMessage: string;
};

const toResourceViewerSnapshot = (value: unknown): RuntimeResourceViewerSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const tabCountRaw: number = Number(candidate.tabCount);
  const activeRowCountRaw: number = Number(candidate.activeRowCount);
  return {
    activeSourceKind: typeof candidate.activeSourceKind === "string" ? candidate.activeSourceKind : "directory",
    tabCount: Number.isFinite(tabCountRaw) ? Math.max(0, Math.floor(tabCountRaw)) : 0,
    activeTabId: typeof candidate.activeTabId === "string" ? candidate.activeTabId : null,
    activeTabTitle: typeof candidate.activeTabTitle === "string" ? candidate.activeTabTitle : "",
    activeTabKind: typeof candidate.activeTabKind === "string" ? candidate.activeTabKind : "",
    activeTabLocator: typeof candidate.activeTabLocator === "string" ? candidate.activeTabLocator : "",
    activeRowCount: Number.isFinite(activeRowCountRaw) ? Math.max(0, Math.floor(activeRowCountRaw)) : 0,
    activeErrorMessage: typeof candidate.activeErrorMessage === "string" ? candidate.activeErrorMessage : "",
  };
};

export const publishRuntimeResourceViewerSnapshot = (snapshot: RuntimeResourceViewerSnapshot): void => {
  window.dispatchEvent(
    new CustomEvent<RuntimeResourceViewerSnapshot>(RUNTIME_RESOURCE_VIEWER_SNAPSHOT_EVENT, { detail: snapshot }),
  );
};

export const subscribeRuntimeResourceViewerSnapshot = (
  onSnapshot: (snapshot: RuntimeResourceViewerSnapshot) => void,
): (() => void) => {
  const listener = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const snapshot = toResourceViewerSnapshot(event.detail);
    if (!snapshot) return;
    onSnapshot(snapshot);
  };
  window.addEventListener(RUNTIME_RESOURCE_VIEWER_SNAPSHOT_EVENT, listener);
  return (): void => {
    window.removeEventListener(RUNTIME_RESOURCE_VIEWER_SNAPSHOT_EVENT, listener);
  };
};


export const RUNTIME_SHELL_SNAPSHOT_EVENT = "x2chess:runtime-shell-snapshot";

export type RuntimeShellSnapshot = {
  locale: string;
  isMenuOpen: boolean;
  isDeveloperToolsEnabled: boolean;
  isDevDockOpen: boolean;
  activeDevTab: "ast" | "dom" | "pgn";
};

const normalizeDevTab = (value: unknown): "ast" | "dom" | "pgn" => {
  if (value === "dom" || value === "pgn") return value;
  return "ast";
};

const toShellSnapshot = (value: unknown): RuntimeShellSnapshot | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  return {
    locale: typeof candidate.locale === "string" ? candidate.locale : "en",
    isMenuOpen: Boolean(candidate.isMenuOpen),
    isDeveloperToolsEnabled: Boolean(candidate.isDeveloperToolsEnabled),
    isDevDockOpen: Boolean(candidate.isDevDockOpen),
    activeDevTab: normalizeDevTab(candidate.activeDevTab),
  };
};

export const publishRuntimeShellSnapshot = (snapshot: RuntimeShellSnapshot): void => {
  window.dispatchEvent(new CustomEvent<RuntimeShellSnapshot>(RUNTIME_SHELL_SNAPSHOT_EVENT, { detail: snapshot }));
};

export const subscribeRuntimeShellSnapshot = (
  onSnapshot: (snapshot: RuntimeShellSnapshot) => void,
): (() => void) => {
  const listener = (event: Event): void => {
    if (!(event instanceof CustomEvent)) return;
    const snapshot = toShellSnapshot(event.detail);
    if (!snapshot) return;
    onSnapshot(snapshot);
  };
  window.addEventListener(RUNTIME_SHELL_SNAPSHOT_EVENT, listener);
  return (): void => {
    window.removeEventListener(RUNTIME_SHELL_SNAPSHOT_EVENT, listener);
  };
};
