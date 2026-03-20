import type { SourceRefLike } from "./bootstrap_shared";
import { toResourceTabTitle } from "./resource_ref_utils";

type ResourceViewerCapabilitiesLike = {
  upsertTab: (input: { title: string; resourceRef: SourceRefLike; select: boolean }) => string | null;
  refreshActiveTabRows: () => Promise<void>;
};

type EnsureResourceTabVisibleDeps = {
  resourceViewerCapabilities: ResourceViewerCapabilitiesLike;
  t: (key: string, fallback?: string) => string;
};

export const createEnsureResourceTabVisible = ({
  resourceViewerCapabilities,
  t,
}: EnsureResourceTabVisibleDeps) => {
  return async (resourceRef: SourceRefLike | null, select: boolean = true): Promise<void> => {
    if (!resourceRef) return;
    resourceViewerCapabilities.upsertTab({
      title: toResourceTabTitle(resourceRef, t),
      resourceRef,
      select,
    });
    await resourceViewerCapabilities.refreshActiveTabRows();
  };
};
