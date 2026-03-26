import { PGN_RESOURCE_KINDS, type PgnResourceKind } from "../domain/kinds";

export const resolveKind = (kind: string): PgnResourceKind => {
  if ((PGN_RESOURCE_KINDS as readonly string[]).includes(kind)) return kind as PgnResourceKind;
  throw new Error(`Unsupported resource kind: ${kind}`);
};
