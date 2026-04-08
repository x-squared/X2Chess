import { PGN_RESOURCE_KINDS, type PgnResourceKind } from "../domain/kinds";

/**
 * Validate and narrow a kind string to `PgnResourceKind`.
 *
 * @param kind Kind string to validate.
 * @returns Canonical resource kind.
 * @throws Error when the kind is not recognised.
 */
export const resolveKind = (kind: string): PgnResourceKind => {
  if ((PGN_RESOURCE_KINDS as readonly string[]).includes(kind)) return kind as PgnResourceKind;
  throw new Error(`Unsupported resource kind: ${kind}`);
};
