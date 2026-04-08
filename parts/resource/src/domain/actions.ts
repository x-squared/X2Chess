import type { PgnGameEntry } from "./game_entry";
import type { PgnGameRef } from "./game_ref";

/**
 * Canonical resource action/result contracts.
 *
 * Integration API:
 * - Primary exports: `PgnListGamesResult`, `PgnLoadGameResult`, `PgnSaveGameResult`,
 *   `PgnCreateGameResult`, `PgnResourceErrorCode`, `PgnResourceError`.
 *
 * Configuration API:
 * - Result objects are fully described by typed fields; no hidden options.
 *
 * Communication API:
 * - Shared DTOs and error type exchanged by client/adapters.
 */
export type PgnListGamesResult = {
  entries: PgnGameEntry[];
};

export type PgnLoadGameResult = {
  gameRef: PgnGameRef;
  pgnText: string;
  revisionToken: string;
  title: string;
};

export type PgnSaveGameResult = {
  gameRef: PgnGameRef;
  revisionToken: string;
};

export type PgnCreateGameResult = {
  gameRef: PgnGameRef;
  revisionToken: string;
  title: string;
};

export type PgnResourceErrorCode =
  | "unsupported_operation"
  | "not_found"
  | "conflict"
  | "schema_outdated"
  | "validation_failed"
  | "io_failure";

/**
 * Canonical resource-layer error.
 *
 * @param code Stable error code for programmatic handling.
 * @param message Human-readable diagnostic message.
 */
export class PgnResourceError extends Error {
  code: PgnResourceErrorCode;

  constructor(code: PgnResourceErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "PgnResourceError";
  }
}
