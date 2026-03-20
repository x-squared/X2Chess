import { createGameIngressHandlers } from "../game_sessions/ingress_handlers";
import { type SourceRefLike } from "./bootstrap_shared";

type IngressState = {
  activeSourceKind: string;
  gameDirectoryPath: string;
};

type SessionOpenFlowLike = {
  openSessionFromPgnText: (pgnText: string, title?: string, sourceRef?: SourceRefLike, revisionToken?: string) => void;
};

type ResourceViewerCapabilitiesLike = {
  getActiveResourceRef: () => SourceRefLike | null;
};

type ResourcesCapabilitiesLike = {
  createGameInResource: (resourceRef: SourceRefLike, pgnText: string, title: string) => Promise<{
    sourceRef: SourceRefLike;
    titleHint?: string;
    revisionToken?: string;
  }>;
};

type UiAdaptersLike = {
  setSaveStatus: (message?: string, kind?: string) => void;
};

type IngressBootstrapDeps<TState extends IngressState> = {
  appPanelEl: Element | null;
  gameDropOverlayEl: Element | null;
  state: TState;
  t: (key: string, fallback?: string) => string;
  render: () => void;
  isLikelyPgnTextFn: (value: string) => boolean;
  sessionOpenFlow: SessionOpenFlowLike;
  ensureResourceTabVisible: (resourceRef: SourceRefLike | null, select?: boolean) => Promise<void>;
  resourceViewerCapabilities: ResourceViewerCapabilitiesLike;
  resourcesCapabilities: ResourcesCapabilitiesLike;
  normalizeResourceRefForInsertFn: (resourceRef: SourceRefLike, state: TState) => SourceRefLike | null;
  uiAdapters: UiAdaptersLike;
};

export const createIngressBootstrap = <TState extends IngressState>({
  appPanelEl,
  gameDropOverlayEl,
  state,
  t,
  render,
  isLikelyPgnTextFn,
  sessionOpenFlow,
  ensureResourceTabVisible,
  resourceViewerCapabilities,
  resourcesCapabilities,
  normalizeResourceRefForInsertFn,
  uiAdapters,
}: IngressBootstrapDeps<TState>): ReturnType<typeof createGameIngressHandlers> => {
  return createGameIngressHandlers({
    appPanelEl,
    isLikelyPgnText: isLikelyPgnTextFn,
    setDropOverlayVisible: (isVisible: boolean): void => {
      if (gameDropOverlayEl) {
        (gameDropOverlayEl as HTMLElement).hidden = !isVisible;
      }
    },
    openGameFromIncomingText: async (sourceText: string, options: Record<string, unknown> = {}): Promise<boolean> => {
      const pgnText: string = String(sourceText || "").trim();
      if (!isLikelyPgnTextFn(pgnText)) return false;

      const preferredTitle: string = String(options?.preferredTitle || "").trim();
      const droppedSourceRefRaw: unknown = options?.sourceRef;
      const droppedResourceRefRaw: unknown = options?.resourceRef;
      const droppedSourceRef: SourceRefLike | null = droppedSourceRefRaw && typeof droppedSourceRefRaw === "object"
        ? droppedSourceRefRaw as SourceRefLike
        : null;
      const droppedResourceRef: SourceRefLike | null = droppedResourceRefRaw && typeof droppedResourceRefRaw === "object"
        ? droppedResourceRefRaw as SourceRefLike
        : null;

      if (droppedSourceRef) {
        sessionOpenFlow.openSessionFromPgnText(pgnText, preferredTitle, droppedSourceRef, "");
        if (droppedResourceRef) {
          await ensureResourceTabVisible(droppedResourceRef, true);
        }
        render();
        return true;
      }

      if (options?.preferInsertIntoActiveResource) {
        const activeResourceRef: SourceRefLike | null = normalizeResourceRefForInsertFn(
          resourceViewerCapabilities.getActiveResourceRef()
            || { kind: state.activeSourceKind || "directory", locator: state.gameDirectoryPath || "" },
          state,
        );
        if (activeResourceRef) {
          try {
            const created = await resourcesCapabilities.createGameInResource(
              activeResourceRef,
              pgnText,
              preferredTitle || "imported-game",
            );
            sessionOpenFlow.openSessionFromPgnText(
              pgnText,
              preferredTitle || created.titleHint || t("games.new", "New game"),
              created.sourceRef,
              created.revisionToken || "",
            );
            await ensureResourceTabVisible(
              {
                kind: created.sourceRef?.kind || activeResourceRef.kind,
                locator: created.sourceRef?.locator || activeResourceRef.locator,
              },
              true,
            );
            render();
            return true;
          } catch (error: unknown) {
            const message: string = error instanceof Error ? error.message : String(error);
            uiAdapters.setSaveStatus(message || t("resources.error", "Unable to load resource games."), "error");
          }
        }
      }

      sessionOpenFlow.openSessionFromPgnText(pgnText, preferredTitle || t("games.new", "New game"));
      render();
      return true;
    },
  });
};
