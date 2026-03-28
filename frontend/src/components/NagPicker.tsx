/**
 * NagPicker — inline annotation toolbar for setting move symbols,
 * evaluation symbols, and positional annotation symbols (NAGs).
 *
 * Integration API:
 * - `<NagPicker moveId={...} currentNags={...} moveSide={...} onToggle={...} />`
 *   Rendered inside `PgnTextEditor` when a move is selected.
 *
 * Configuration API:
 * - `moveId`     — ID of the currently selected move node.
 * - `currentNags` — Current NAG codes on this move (read from PGN model).
 * - `moveSide`   — Side to play for this move ("white" | "black").
 *                  Used to resolve color-specific positional NAGs.
 * - `onToggle`   — Callback invoked with the resolved NAG code to toggle.
 *
 * Communication API:
 * - Fires `onToggle(resolvedNagCode)` on each button click.
 * - Does not maintain local state; all active state is derived from `currentNags`.
 */

import { useCallback, type ReactElement } from "react";
import {
  NAG_MOVE_QUALITY,
  NAG_EVALUATION,
  NAG_POSITIONAL,
  colorPairCode,
  type NagDef,
} from "../model/nag_defs";

type NagPickerProps = {
  moveId: string;
  currentNags: readonly string[];
  moveSide: "white" | "black";
  onToggle: (nag: string) => void;
};

type NagRowProps = {
  defs: readonly NagDef[];
  currentNags: readonly string[];
  moveSide: "white" | "black";
  onToggle: (nag: string) => void;
};

const NagRow = ({ defs, currentNags, moveSide, onToggle }: NagRowProps): ReactElement => (
  <div className="nag-picker-row">
    {defs.map((def) => {
      // Resolve the correct code for color-specific NAGs.
      const resolvedCode = def.colorSpecific
        ? colorPairCode(def.code, moveSide)
        : def.code;

      // A button is active if either the white or black variant is present.
      const isActive = def.colorSpecific
        ? currentNags.includes(def.code) || currentNags.includes(colorPairCode(def.code, "black"))
        : currentNags.includes(def.code);

      return (
        <button
          key={def.code}
          type="button"
          className={`nag-btn${isActive ? " nag-btn--active" : ""}`}
          title={def.label}
          aria-label={def.label}
          aria-pressed={isActive}
          onClick={(): void => { onToggle(resolvedCode); }}
        >
          {def.glyph}
        </button>
      );
    })}
  </div>
);

/**
 * Inline NAG picker toolbar.
 * Shows three rows: move quality, evaluation, positional symbols.
 */
export const NagPicker = ({
  moveId,
  currentNags,
  moveSide,
  onToggle,
}: NagPickerProps): ReactElement => {
  const handleToggle = useCallback(
    (nag: string): void => { onToggle(nag); },
    [onToggle],
  );

  // Keep TS happy — moveId is part of the public API but not used internally.
  void moveId;

  return (
    <div className="nag-picker">
      <NagRow
        defs={NAG_MOVE_QUALITY}
        currentNags={currentNags}
        moveSide={moveSide}
        onToggle={handleToggle}
      />
      <NagRow
        defs={NAG_EVALUATION}
        currentNags={currentNags}
        moveSide={moveSide}
        onToggle={handleToggle}
      />
      <NagRow
        defs={NAG_POSITIONAL}
        currentNags={currentNags}
        moveSide={moveSide}
        onToggle={handleToggle}
      />
    </div>
  );
};
