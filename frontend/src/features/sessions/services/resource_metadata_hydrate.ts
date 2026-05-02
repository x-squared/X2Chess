/**
 * resource_metadata_hydrate — merge resource-list metadata into a live PGN model.
 *
 * Listing adapters expose denormalized metadata (for example SQLite `game_metadata` keyed
 * alongside `games.pgn_text`). The canonical editable game in a session is still the
 * in-memory `PgnModel` + serialized PGN. On open, any resource field whose PGN tag is
 * missing or blank is written into the model so save/export round-trips every field
 * without a second parallel “session metadata” source.
 *
 * Integration API:
 * - `hydratePgnModelFromResourceMetadata(model, resourceMetadata)` — returns updated model
 *   and the list of header keys that were filled from the resource row.
 *
 * Configuration API:
 * - None; pure functions.
 *
 * Communication API:
 * - None; no I/O.
 */

import type { PgnModel } from "../../../../../parts/pgnparser/src/pgn_model";
import { getHeaderValue, setHeaderValue } from "../../../../../parts/pgnparser/src/pgn_headers";

export type PgnResourceMetadataHydrateResult = {
  /** Model with missing/blank tags filled from the resource row. */
  model: PgnModel;
  /** Header keys that were set because the PGN had no non-blank value for that key. */
  keysFilled: string[];
};

/**
 * For each key in `resourceMetadata`, set the PGN header when the current value is empty.
 * Non-empty PGN values win (user text and saved PGN are authoritative).
 *
 * @param pgnModel - Parsed game model from loaded PGN text.
 * @param resourceMetadata - Normalized string map from the resource list row.
 * @returns New model and which keys were applied.
 */
export const hydratePgnModelFromResourceMetadata = (
  pgnModel: PgnModel,
  resourceMetadata: Record<string, string>,
): PgnResourceMetadataHydrateResult => {
  let next: PgnModel = pgnModel;
  const keysFilled: string[] = [];
  for (const [key, val] of Object.entries(resourceMetadata)) {
    if (!key) continue;
    const current: string = getHeaderValue(next, key, "").trim();
    if (current !== "") continue;
    const v: string = String(val ?? "").trim();
    if (v === "") continue;
    next = setHeaderValue(next, key, v);
    keysFilled.push(key);
  }
  return { model: next, keysFilled };
};
