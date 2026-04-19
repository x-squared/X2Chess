/**
 * NagPicker — compact three-button annotation control for setting move symbols,
 * evaluation symbols, and positional annotation symbols (NAGs).
 *
 * Each button represents one NAG group.  The button face shows the currently
 * active symbol for that group (or a default icon when none is set).  Clicking
 * opens a small floating panel with all symbols in the group; clicking a symbol
 * toggles it and closes the panel.
 *
 * Integration API:
 * - `<NagPicker moveId={...} currentNags={...} moveSide={...} onToggle={...} />`
 *   Rendered inside `PgnTextEditor` when a move is selected.
 * - `<NagRow defs={...} currentNags={...} moveSide={...} onToggle={...} />`
 *   Re-exported for inline use in the move context menu.
 *
 * Configuration API:
 * - `moveId`      — ID of the currently selected move node.
 * - `currentNags` — Current NAG codes on this move (read from PGN model).
 * - `moveSide`    — Side to play for this move ("white" | "black").
 * - `onToggle`    — Callback invoked with the resolved NAG code to toggle.
 *
 * Communication API:
 * - Fires `onToggle(resolvedNagCode)` on each symbol click.
 * - Does not maintain persistent state; open-dropdown state is local and
 *   discarded on unmount.
 */

import { useState, useEffect, useRef, useCallback, type ReactElement } from "react";
import {
  NAG_MOVE_QUALITY,
  NAG_EVALUATION,
  NAG_POSITIONAL,
  colorPairCode,
  type NagDef,
  type NagGroup,
} from "../../../../../parts/pgnparser/src/nag_defs";
import { UI_IDS } from "../../../core/model/ui_ids";

// ── Shared row component ───────────────────────────────────────────────────────

type NagRowProps = {
  defs: readonly NagDef[];
  currentNags: readonly string[];
  moveSide: "white" | "black";
  onToggle: (nag: string) => void;
};

/** A flat row of NAG symbol buttons for one group. Re-exported for the context menu. */
export const NagRow = ({ defs, currentNags, moveSide, onToggle }: NagRowProps): ReactElement => (
  <div className="nag-picker-row">
    {defs.map((def) => {
      const resolvedCode = def.colorSpecific
        ? colorPairCode(def.code, moveSide)
        : def.code;
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

// ── Group dropdown buttons ─────────────────────────────────────────────────────

type GroupConfig = {
  group: NagGroup;
  defs: readonly NagDef[];
  /** Default button face when no symbol in this group is active. */
  defaultGlyph: string;
  label: string;
};

const GROUPS: readonly GroupConfig[] = [
  { group: "move_quality", defs: NAG_MOVE_QUALITY, defaultGlyph: "!",  label: "Move symbol" },
  { group: "evaluation",   defs: NAG_EVALUATION,   defaultGlyph: "=",  label: "Evaluation" },
  { group: "positional",   defs: NAG_POSITIONAL,   defaultGlyph: "△", label: "Position" },
];

// ── NagPicker ──────────────────────────────────────────────────────────────────

type NagPickerProps = {
  moveId: string;
  currentNags: readonly string[];
  moveSide: "white" | "black";
  onToggle: (nag: string) => void;
};

/**
 * Three compact dropdown-buttons, one per NAG group.
 * Replaces the previous full three-row panel.
 */
export const NagPicker = ({
  moveId,
  currentNags,
  moveSide,
  onToggle,
}: NagPickerProps): ReactElement => {
  const [openGroup, setOpenGroup] = useState<NagGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep TS happy — moveId is part of the public API but not used internally.
  void moveId;

  const handleToggle = useCallback(
    (nag: string): void => {
      onToggle(nag);
      setOpenGroup(null);
    },
    [onToggle],
  );

  // Close dropdown on outside click.
  useEffect((): (() => void) => {
    if (!openGroup) return (): void => {};
    const handler = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    document.addEventListener("mousedown", handler, true);
    return (): void => { document.removeEventListener("mousedown", handler, true); };
  }, [openGroup]);

  return (
    <div
      className="nag-picker"
      ref={containerRef}
      data-ui-id={UI_IDS.NAG_ANNOTATION_BUTTONS}
    >
      {GROUPS.map(({ group, defs, defaultGlyph, label }) => {
        const activeDef = defs.find((def): boolean => {
          if (def.colorSpecific) {
            return (
              currentNags.includes(def.code) ||
              currentNags.includes(colorPairCode(def.code, "black"))
            );
          }
          return currentNags.includes(def.code);
        });
        const isOpen = openGroup === group;

        return (
          <div key={group} className="nag-group-wrap">
            <button
              type="button"
              className={`nag-group-btn${activeDef ? " nag-group-btn--active" : ""}`}
              title={label}
              aria-label={label}
              aria-haspopup="true"
              aria-expanded={isOpen}
              onClick={(): void => { setOpenGroup(isOpen ? null : group); }}
            >
              <span className="nag-group-symbol">
                {activeDef ? activeDef.glyph : defaultGlyph}
              </span>
              <span className="nag-group-arrow">▾</span>
            </button>
            {isOpen && (
              <div className="nag-dropdown" role="group" aria-label={label}>
                <NagRow
                  defs={defs}
                  currentNags={currentNags}
                  moveSide={moveSide}
                  onToggle={handleToggle}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
