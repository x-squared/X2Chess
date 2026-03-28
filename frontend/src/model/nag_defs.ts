/**
 * nag_defs — NAG (Numeric Annotation Glyph) registry.
 *
 * Integration API:
 * - Primary exports: `NAG_DEFS`, `NAG_BY_CODE`, `NAG_MOVE_QUALITY`, `NAG_EVALUATION`,
 *   `NAG_POSITIONAL`, `nagGlyph`, `nagGroup`.
 *
 * Configuration API:
 * - None; the registry is a static lookup table.
 *
 * Communication API:
 * - Pure data; no side effects.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type NagGroup = "move_quality" | "evaluation" | "positional";

export type NagDef = {
  /** PGN code, e.g. "$1". */
  code: string;
  /** Unicode glyph shown in UI and editor output. */
  glyph: string;
  /** Human-readable label. */
  label: string;
  /** Mutual-exclusivity group. */
  group: NagGroup;
  /**
   * True when this NAG has a color-pair counterpart.
   * The correct variant (white/black) is selected by the service layer.
   */
  colorSpecific: boolean;
};

// ── Registry ──────────────────────────────────────────────────────────────────

export const NAG_DEFS: readonly NagDef[] = [
  // ── Move quality ─────────────────────────────────────────────────────────
  { code: "$1",  glyph: "!",   label: "Good move",        group: "move_quality", colorSpecific: false },
  { code: "$2",  glyph: "?",   label: "Mistake",          group: "move_quality", colorSpecific: false },
  { code: "$3",  glyph: "!!",  label: "Brilliant move",   group: "move_quality", colorSpecific: false },
  { code: "$4",  glyph: "??",  label: "Blunder",          group: "move_quality", colorSpecific: false },
  { code: "$5",  glyph: "!?",  label: "Interesting move", group: "move_quality", colorSpecific: false },
  { code: "$6",  glyph: "?!",  label: "Dubious move",     group: "move_quality", colorSpecific: false },

  // ── Evaluation ───────────────────────────────────────────────────────────
  { code: "$10", glyph: "=",   label: "Equal position",           group: "evaluation", colorSpecific: false },
  { code: "$13", glyph: "∞",   label: "Unclear position",         group: "evaluation", colorSpecific: false },
  { code: "$14", glyph: "⩲",   label: "Slight advantage (White)", group: "evaluation", colorSpecific: false },
  { code: "$15", glyph: "⩱",   label: "Slight advantage (Black)", group: "evaluation", colorSpecific: false },
  { code: "$16", glyph: "±",   label: "Better for White",         group: "evaluation", colorSpecific: false },
  { code: "$17", glyph: "∓",   label: "Better for Black",         group: "evaluation", colorSpecific: false },
  { code: "$18", glyph: "+-",  label: "Winning for White",        group: "evaluation", colorSpecific: false },
  { code: "$19", glyph: "-+",  label: "Winning for Black",        group: "evaluation", colorSpecific: false },

  // ── Positional / other ───────────────────────────────────────────────────
  /**
   * Color-specific pairs (colorSpecific: true):
   * White variant has lower code number, Black has higher.
   * The NagPicker shows a single button; the service layer resolves the
   * correct code at toggle time based on the move's side to play.
   *
   * Initiative: $32 (White) / $33 (Black) — shown as →
   * Attack:     $36 (White) / $37 (Black) — shown as ↑
   * Counterplay: $40 (White) / $41 (Black) — shown as ⇆
   */
  { code: "$32", glyph: "→",   label: "With initiative (White)", group: "positional", colorSpecific: true },
  { code: "$33", glyph: "→",   label: "With initiative (Black)", group: "positional", colorSpecific: true },
  { code: "$36", glyph: "↑",   label: "With attack (White)",     group: "positional", colorSpecific: true },
  { code: "$37", glyph: "↑",   label: "With attack (Black)",     group: "positional", colorSpecific: true },
  { code: "$40", glyph: "⇆",   label: "Counterplay (White)",     group: "positional", colorSpecific: true },
  { code: "$41", glyph: "⇆",   label: "Counterplay (Black)",     group: "positional", colorSpecific: true },

  // Non-color-specific positional annotations:
  { code: "$44", glyph: "=/∞", label: "With compensation",       group: "positional", colorSpecific: false },
  { code: "$20", glyph: "⊠",   label: "Zugzwang",                group: "positional", colorSpecific: false },
  { code: "$22", glyph: "□",   label: "Weak point / space",      group: "positional", colorSpecific: false },
  { code: "$140",glyph: "△",   label: "With the idea of",        group: "positional", colorSpecific: false },
  { code: "$142",glyph: "⊞",   label: "Better was",              group: "positional", colorSpecific: false },
  { code: "$146",glyph: "N",   label: "Novelty",                 group: "positional", colorSpecific: false },
];

/** Fast lookup by NAG code. */
export const NAG_BY_CODE: ReadonlyMap<string, NagDef> = new Map(
  NAG_DEFS.map((d) => [d.code, d]),
);

// ── Filtered views ────────────────────────────────────────────────────────────

/** All move-quality NAGs in display order. */
export const NAG_MOVE_QUALITY: readonly NagDef[] = NAG_DEFS.filter(
  (d) => d.group === "move_quality",
);

/** All evaluation NAGs in display order. */
export const NAG_EVALUATION: readonly NagDef[] = NAG_DEFS.filter(
  (d) => d.group === "evaluation",
);

/**
 * Positional NAGs for display.
 * Color-specific pairs are deduplicated: only the White variant ($32, $36, $40)
 * is included here; the Black variant ($33, $37, $41) is selected automatically
 * by the service layer.
 */
export const NAG_POSITIONAL: readonly NagDef[] = NAG_DEFS.filter(
  (d) => d.group === "positional" && (!d.colorSpecific || d.code.endsWith("2") || d.code === "$40"),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return the glyph for a NAG code, or the raw code if unknown. */
export const nagGlyph = (code: string): string =>
  NAG_BY_CODE.get(code)?.glyph ?? code;

/** Return the group for a NAG code, or null if unknown. */
export const nagGroup = (code: string): NagGroup | null =>
  NAG_BY_CODE.get(code)?.group ?? null;

/**
 * Given a color-specific "white" NAG code, return the corresponding "black" code.
 * For non-color-specific codes, returns the code unchanged.
 */
export const colorPairCode = (whiteCode: string, side: "white" | "black"): string => {
  if (side === "white") return whiteCode;
  const pairs: Record<string, string> = {
    "$32": "$33", // initiative
    "$36": "$37", // attack
    "$40": "$41", // counterplay
  };
  return pairs[whiteCode] ?? whiteCode;
};

/**
 * Return all NAG codes in a group that are NOT the given code.
 * Used to enforce single-selection within a group.
 */
export const siblingCodesInGroup = (code: string): readonly string[] => {
  const def = NAG_BY_CODE.get(code);
  if (!def) return [];
  return NAG_DEFS
    .filter((d) => d.group === def.group && d.code !== code)
    .map((d) => d.code);
};
