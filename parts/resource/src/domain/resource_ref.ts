import { PGN_RESOURCE_KINDS, type PgnResourceKind } from "./kinds";

/**
 * Canonical resource reference contract.
 *
 * Integration API:
 * - Primary exports: `PgnResourceRef`, `isPgnResourceRef`.
 *
 * Configuration API:
 * - `kind` selects adapter routing; `locator` identifies a concrete resource container.
 *
 * Communication API:
 * - Value-object contract used across client and adapter boundaries.
 */
export type PgnResourceRef = {
  kind: PgnResourceKind;
  locator: string;
};

/**
 * Runtime type guard for canonical resource references.
 *
 * @param value Unknown candidate value.
 * @returns True when the value has a valid canonical kind and non-empty locator.
 */
export const isPgnResourceRef = (value: unknown): value is PgnResourceRef => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { kind?: unknown; locator?: unknown };
  return (
    typeof candidate.kind === "string"
    && (PGN_RESOURCE_KINDS as readonly string[]).includes(candidate.kind)
    && typeof candidate.locator === "string"
    && candidate.locator.trim().length > 0
  );
};
