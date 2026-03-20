import type { SourceRefLike } from "./bootstrap_shared";
import { normalizeResourceRefForInsert } from "./resource_ref_utils";

type NormalizeFn = typeof normalizeResourceRefForInsert;

type NormalizeState = Parameters<NormalizeFn>[1];

export const createNormalizeResourceRefAdapter = (
  normalizeFn: NormalizeFn,
): ((resourceRef: SourceRefLike | null, runtimeState: unknown) => SourceRefLike | null) => {
  return (resourceRef: SourceRefLike | null, runtimeState: unknown): SourceRefLike | null => {
    return normalizeFn(resourceRef, runtimeState as NormalizeState);
  };
};
