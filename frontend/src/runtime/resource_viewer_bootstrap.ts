import { createResourceViewerCapabilities } from "../resources_viewer";
import { findOpenSessionBySourceRef } from "./session_ref_utils";
import type { SessionLike, SourceRefLike } from "./bootstrap_shared";

type ResourceViewerBootstrapDeps = {
  state: Parameters<typeof createResourceViewerCapabilities>[0]["state"];
  t: Parameters<typeof createResourceViewerCapabilities>[0]["t"];
  btnResourceMetadata: Parameters<typeof createResourceViewerCapabilities>[0]["btnResourceMetadata"];
  btnOpenResource: Parameters<typeof createResourceViewerCapabilities>[0]["btnOpenResource"];
  resourceMetadataDialogEl: Parameters<typeof createResourceViewerCapabilities>[0]["resourceMetadataDialogEl"];
  resourceMetadataFieldsEl: Parameters<typeof createResourceViewerCapabilities>[0]["resourceMetadataFieldsEl"];
  resourceMetadataApplyAllEl: Parameters<typeof createResourceViewerCapabilities>[0]["resourceMetadataApplyAllEl"];
  btnResourceMetadataReset: Parameters<typeof createResourceViewerCapabilities>[0]["btnResourceMetadataReset"];
  btnResourceMetadataCancel: Parameters<typeof createResourceViewerCapabilities>[0]["btnResourceMetadataCancel"];
  btnResourceMetadataSave: Parameters<typeof createResourceViewerCapabilities>[0]["btnResourceMetadataSave"];
  resourceTabsEl: Parameters<typeof createResourceViewerCapabilities>[0]["resourceTabsEl"];
  resourceTableWrapEl: Parameters<typeof createResourceViewerCapabilities>[0]["resourceTableWrapEl"];
  resourcesCapabilities: {
    listGamesForResource: Parameters<typeof createResourceViewerCapabilities>[0]["listGamesForResource"];
    chooseResourceByPicker: () => Promise<{ resourceRef?: SourceRefLike | null } | null>;
  };
  gameSessionStore: {
    listSessions: () => unknown[];
    switchToSession: (sessionId: string) => boolean;
  };
  sessionOpenFlow: {
    openSessionFromSourceRef: (sourceRef: SourceRefLike, requestedRecordId: string) => Promise<void>;
  };
  ensureResourceTabVisible: (resourceRef: SourceRefLike | null, select?: boolean) => Promise<void>;
  render: () => void;
};

export const createResourceViewerBootstrap = ({
  state,
  t,
  btnResourceMetadata,
  btnOpenResource,
  resourceMetadataDialogEl,
  resourceMetadataFieldsEl,
  resourceMetadataApplyAllEl,
  btnResourceMetadataReset,
  btnResourceMetadataCancel,
  btnResourceMetadataSave,
  resourceTabsEl,
  resourceTableWrapEl,
  resourcesCapabilities,
  gameSessionStore,
  sessionOpenFlow,
  ensureResourceTabVisible,
  render,
}: ResourceViewerBootstrapDeps): ReturnType<typeof createResourceViewerCapabilities> => {
  return createResourceViewerCapabilities({
    state,
    t,
    btnResourceMetadata,
    btnOpenResource,
    resourceMetadataDialogEl,
    resourceMetadataFieldsEl,
    resourceMetadataApplyAllEl,
    btnResourceMetadataReset,
    btnResourceMetadataCancel,
    btnResourceMetadataSave,
    resourceTabsEl,
    resourceTableWrapEl,
    listGamesForResource: resourcesCapabilities.listGamesForResource,
    onRequestOpenResource: async (): Promise<void> => {
      const selected = await resourcesCapabilities.chooseResourceByPicker();
      if (!selected?.resourceRef) return;
      await ensureResourceTabVisible(selected.resourceRef, true);
      render();
    },
    onOpenGameBySourceRef: async (sourceRef: SourceRefLike): Promise<void> => {
      const existing: SessionLike | null = findOpenSessionBySourceRef(
        gameSessionStore.listSessions() as SessionLike[],
        sourceRef,
      );
      if (existing) {
        if (gameSessionStore.switchToSession(existing.sessionId)) {
          render();
        }
        return;
      }
      await sessionOpenFlow.openSessionFromSourceRef(sourceRef, String(sourceRef?.recordId || ""));
      render();
    },
  });
};
