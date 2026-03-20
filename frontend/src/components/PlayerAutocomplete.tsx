/**
 * PlayerAutocomplete — suggestion dropdown container for player-name fields.
 *
 * Renders the container element that `player_autocomplete.ts` populates with
 * suggestion items and toggles visible on user input.
 *
 * Integration API:
 * - `<PlayerAutocomplete fieldKey="White" />` — one instance per player field.
 * - Rendered by `GameInfoEditor` inside the matching `<label>`.
 *
 * Configuration API:
 * - `fieldKey` — the PGN header key this dropdown belongs to (e.g. `"White"`).
 *
 * Communication API:
 * - Outbound: none.
 * - Inbound: visibility managed by `player_autocomplete.ts` via `element.hidden`.
 */

import type { ReactElement } from "react";

/** Props for the PlayerAutocomplete component. */
type PlayerAutocompleteProps = {
  /** PGN header key identifying which field owns this dropdown. */
  fieldKey: string;
};

/** Container element for player-name suggestions; initially hidden. */
export const PlayerAutocomplete = ({ fieldKey }: PlayerAutocompleteProps): ReactElement => (
  <div
    className="game-info-player-suggestions"
    data-player-suggestions-for={fieldKey}
    hidden
  />
);
