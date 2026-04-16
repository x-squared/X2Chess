/**
 * PlayerAutocomplete — controlled text input with player-name suggestion dropdown.
 *
 * Renders a text input for a player-name header field (White, Black, Annotator)
 * and a suggestion dropdown populated from the player store via
 * `services.getPlayerNameSuggestions`.  Normalizes the value on blur.
 *
 * Integration API:
 * - `<PlayerAutocomplete fieldKey="White" id="..." ... />` — rendered inside
 *   the matching `<label>` in `GameInfoEditor` in place of `<FieldInput>` for
 *   player-name fields.
 *   Requires `<ServiceContextProvider>` in the ancestor tree.
 *
 * Configuration API:
 * - `fieldKey: string` — PGN header key (e.g. `"White"`).
 * - `id: string` — `id` attribute forwarded to the `<input>` for label association.
 * - `defaultVal: string` — initial input value; re-used when the parent remounts.
 * - `placeholder?: string` — placeholder text for the input.
 * - `onCommit: (key: string, value: string) => void` — called with the normalized
 *   value on blur or suggestion selection.
 *
 * Communication API:
 * - Outbound: `onCommit(fieldKey, normalizedValue)` on blur or suggestion click;
 *   `services.getPlayerNameSuggestions(query)` to populate suggestions.
 * - Inbound: re-mounts (via parent `key`) when the active game changes,
 *   resetting `defaultVal`.
 */

import { useState } from "react";
import type { ReactElement, ChangeEvent } from "react";
import { normalizeGameInfoHeaderValue } from "../model/game_info";
import { useServiceContext } from "../../../app/providers/ServiceProvider";

/** Props for the PlayerAutocomplete component. */
type PlayerAutocompleteProps = {
  /** PGN header key identifying which field this input belongs to. */
  fieldKey: string;
  /** HTML id forwarded to the underlying input for label association. */
  id: string;
  /** Initial input value (reset when the parent remounts). */
  defaultVal: string;
  /** Placeholder text. */
  placeholder?: string;
  /** Called with (key, normalizedValue) on blur or suggestion selection. */
  onCommit: (key: string, value: string) => void;
};

/**
 * For Annotator (colon-separated list), extract the entry currently being typed
 * (the last segment after splitting on ":").  For all other fields, the full
 * value is the query.
 */
const currentEntryQuery = (fieldKey: string, raw: string): string => {
  if (fieldKey === "Annotator") {
    const last: string = raw.split(":").at(-1) ?? "";
    return last.trim();
  }
  return raw;
};

/**
 * When a suggestion is accepted for a multi-entry field (Annotator), replace
 * the last colon-separated segment with the chosen name.  For single-entry
 * fields, the suggestion replaces the full value.
 */
const withSuggestionApplied = (fieldKey: string, current: string, name: string): string => {
  if (fieldKey === "Annotator") {
    const parts: string[] = current.split(":");
    parts[parts.length - 1] = ` ${name}`;
    return parts.join(":");
  }
  return name;
};

/** Controlled player-name input with live suggestion dropdown. */
export const PlayerAutocomplete = ({
  fieldKey,
  id,
  defaultVal,
  placeholder,
  onCommit,
}: PlayerAutocompleteProps): ReactElement => {
  const services = useServiceContext();
  const [value, setValue] = useState<string>(defaultVal);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const raw: string = e.target.value;
    setValue(raw);
    setIsDirty(true);
    setSuggestions(services.getPlayerNameSuggestions(currentEntryQuery(fieldKey, raw)));
  };

  const handleBlur = (): void => {
    if (!isDirty) {
      setSuggestions([]);
      return;
    }
    const normalized: string = normalizeGameInfoHeaderValue(fieldKey, value);
    setValue(normalized);
    setSuggestions([]);
    setIsDirty(false);
    onCommit(fieldKey, normalized);
  };

  const handleSelect = (name: string): void => {
    const newValue: string = withSuggestionApplied(fieldKey, value, name);
    setValue(newValue);
    setSuggestions([]);
    setIsDirty(false);
    onCommit(fieldKey, newValue);
  };

  return (
    <>
      <input
        id={id}
        type="text"
        data-header-key={fieldKey}
        data-player-name-input="true"
        placeholder={placeholder ?? fieldKey}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      {suggestions.length > 0 && (
        <div
          className="game-info-player-suggestions"
          data-player-suggestions-for={fieldKey}
        >
          {suggestions.map((name: string): ReactElement => (
            <button
              key={name}
              type="button"
              className="game-info-player-suggestion"
              onMouseDown={(e: React.MouseEvent): void => {
                e.preventDefault(); // Prevent input blur before selection
                handleSelect(name);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </>
  );
};
