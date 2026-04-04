/**
 * default_layout_prefs — user-configurable behaviour for the "Default Layout" button.
 *
 * Integration API:
 * - `readDefaultLayoutPrefs()` — call once on startup to obtain initial preferences.
 * - `writeDefaultLayoutPrefs(prefs)` — persist updated preferences; call from the
 *   `setDefaultLayoutPrefs` service callback.
 * - `DEFAULT_DEFAULT_LAYOUT_PREFS` — shipped defaults.
 *
 * Configuration API:
 * - Storage key: `"x2chess.defaultLayoutPrefs.v1"`.
 * - Version 1 — initial versioned form; no migrations required.
 *
 * Communication API:
 * - Pure module; no React, no DOM.
 */

import { createVersionedStore } from "../storage";
import type { VersionedStore } from "../storage";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * User-configurable behaviour for the "Default Layout" toolbar action.
 *
 * When the button is clicked, `applyDefaultLayout` is called on the active
 * game model with these preferences.
 */
export type DefaultLayoutPrefs = {
  /**
   * When true, a comment reading `introText` is inserted at the very start of
   * the game if no comment exists there yet.  The inserted comment automatically
   * receives intro styling because it is the first comment before the first move.
   */
  addIntroIfMissing: boolean;
  /** Text placed in the auto-generated intro comment. */
  introText: string;
  /**
   * When true, every comment in the main line (excluding the intro) gets
   * `[[br]]` prepended, creating a visible paragraph break before the text
   * in text / plain modes.  Comments inside variations are left untouched.
   */
  addBrToMainLineComments: boolean;
  /**
   * PGN source shown in the DefaultLayoutDialog preview pane.
   * The user may replace this with any game of their choice.
   */
  previewPgn: string;
};

// ── Default preview game ──────────────────────────────────────────────────────

const DEFAULT_PREVIEW_PGN = `[Event "Annotated Study Game"]
[White "White"]
[Black "Black"]
[Result "*"]

{ This game illustrates the Default Layout feature. The intro block sets the scene; each subsequent comment begins on its own line, making the analysis easy to follow. }
1. e4 { A classical opening choice. The king pawn controls the center at once. }
1... e5 { The symmetrical response, equally fighting for the center. }
2. Nf3 { Developing the knight with tempo, targeting the e5 pawn. }
( 2. Nc3 { The Vienna Game, a rich and underestimated alternative. }
  2... Nf6 { Counterattacking in the center immediately. }
  ( 2... Bc5 { The Vienna Gambit setup — Black invites complications. }
    3. f4 { Aggressive! White grabs space at the cost of some development. }
    3... d6 { Solid — Black shores up the center. } )
  3. f4 { The Vienna Gambit proper. } )
2... Nc6 { The most natural developing move, supporting the e5 pawn. }
3. Bb5 { The Ruy Lopez — one of the most deeply studied openings. This pin on the knight creates lasting positional pressure. }
( 3. Bc4 { The Italian Game, targeting the f7 pawn directly. }
  3... Bc5 { The Giuoco Piano: "the quiet game". }
  ( 3... Nf6 { The Two Knights Defense — leading to sharp tactical play. }
    4. Ng5 { Attacking f7 directly! }
    4... d5 { The only principled response, striking back in the center. } )
  4. c3 { Preparing d4 to build a powerful pawn center. } )
3... a6 { The Morphy Defense — Black asks the bishop to declare its intentions. }
4. Ba4 { The bishop retreats but keeps the indirect pressure on c6. }
4... Nf6 { Counterattacking e4 while continuing development. }
5. O-O { White castles to safety and prepares to open the game. }
5... Be7 { Solid and sound — Black prepares to castle. }
6. Re1 { Reinforcing the e4 pawn and preparing central expansion. }
6... b5 { Chasing the bishop away and gaining queenside space. }
7. Bb3 { To b3, where it maintains pressure on the f7 square. }
7... d6 { Solidifying the pawn structure before further action. }
8. c3 { Preparing d4, the key central break. }
8... O-O { Black completes development and tucks the king away. } *`;

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_DEFAULT_LAYOUT_PREFS: DefaultLayoutPrefs = {
  addIntroIfMissing: true,
  introText: "Introduction goes here...",
  addBrToMainLineComments: true,
  previewPgn: DEFAULT_PREVIEW_PGN,
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT_PREFS_KEY = "x2chess.defaultLayoutPrefs.v1";

export const defaultLayoutPrefsStore: VersionedStore<DefaultLayoutPrefs> =
  createVersionedStore<DefaultLayoutPrefs>({
    key: DEFAULT_LAYOUT_PREFS_KEY,
    version: 1,
    defaultValue: DEFAULT_DEFAULT_LAYOUT_PREFS,
    migrations: [],
  });

/** Read persisted preferences, falling back to defaults for any missing field. */
export const readDefaultLayoutPrefs = (): DefaultLayoutPrefs =>
  defaultLayoutPrefsStore.read();

/** Write preferences to localStorage. */
export const writeDefaultLayoutPrefs = (prefs: DefaultLayoutPrefs): void =>
  defaultLayoutPrefsStore.write(prefs);
