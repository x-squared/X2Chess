/**
 * App State module.
 *
 * Integration API:
 * - Primary exports from this module: `DEFAULT_LOCALE`, `DEFAULT_APP_MODE`, `PlayerRecord`.
 */

export const DEFAULT_LOCALE = "en";
export const DEFAULT_APP_MODE = "DEV";

/** Normalized player row used by game-info autocomplete and bundled seed data. */
export type PlayerRecord = { lastName: string; firstName: string };

/** Default height of the resource viewer panel in pixels. */
export const DEFAULT_RESOURCE_VIEWER_HEIGHT_PX = 260;

/** Default width of the board column in pixels. */
export const DEFAULT_BOARD_COLUMN_WIDTH_PX = 520;
