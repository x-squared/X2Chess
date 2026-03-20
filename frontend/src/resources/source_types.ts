import {
  createCanonicalAdapter,
  mapCompatKind,
  toCanonicalGameRefFromCompat,
  toCanonicalResourceRefFromCompat,
  type CompatAdapter,
  type CompatCreateResult,
  type CompatListEntry,
  type CompatLoadResult,
  type CompatSaveResult,
  type CompatSourceRef,
} from "../../../resource/client/compatibility";

export type SourceAdapter = CompatAdapter;
export type SourceCreateResult = CompatCreateResult;
export type SourceListEntry = CompatListEntry;
export type SourceLoadResult = CompatLoadResult;
export type SourceSaveResult = CompatSaveResult;
export type SourceRef = CompatSourceRef;

export const mapSourceKind = mapCompatKind;
export const toCanonicalGameRefFromSource = toCanonicalGameRefFromCompat;
export const toCanonicalResourceRefFromSource = toCanonicalResourceRefFromCompat;


export const createSourceCanonicalAdapter = createCanonicalAdapter;
