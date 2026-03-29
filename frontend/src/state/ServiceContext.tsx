/**
 * ServiceContext — provides service callbacks to the React component tree.
 *
 * Exposes all app-level operations (navigation, PGN editing, session management,
 * shell state) as stable callback references so that components can call service
 * methods without prop-drilling.
 *
 * Integration API:
 * - `<ServiceContext.Provider value={services}>` — wrap component tree; done in `AppShell`.
 * - `useServiceContext()` — consume service callbacks inside any component.
 *
 * Configuration API:
 * - No configuration.  All callbacks are supplied by `useAppStartup`.
 *
 * Communication API:
 * - Inbound: callbacks are set once by `useAppStartup` on mount.
 * - Outbound: callbacks mutate the mutable app state then dispatch to the React
 *   reducer via the stable render function inside `useAppStartup`.
 */

import { createContext, useContext } from "react";
import type { ReactNode, ReactElement } from "react";
import type { PgnModel } from "../model/pgn_model";
import type { PositionSearchHit, TextSearchHit } from "../../../resource/client/search_coordinator";
import type { MoveFrequencyEntry } from "../../../resource/domain/move_frequency";
import type { PgnResourceRef } from "../../../resource/domain/resource_ref";
import type { BoardShape } from "../board/board_shapes";
import type { ShapePrefs } from "../runtime/shape_prefs";

/** All service operations available to the component tree. */
export type AppStartupServices = {
  // ── Navigation ─────────────────────────────────────────────────────────
  gotoFirst: () => void;
  gotoPrev: () => void;
  gotoNext: () => void;
  gotoLast: () => void;
  /**
   * Navigate to the move identified by `moveId` and update `currentPly`.
   * @param moveId - PGN model node ID of the target move.
   */
  gotoMoveById: (moveId: string) => void;
  /**
   * Handle editor arrow-key navigation shortcuts in selected-move context.
   * Returns true when the key event was handled.
   */
  handleEditorArrowHotkey: (event: KeyboardEvent) => boolean;

  // ── PGN editing ────────────────────────────────────────────────────────
  /**
   * Load an arbitrary PGN string as the active game.
   * @param pgnText - Raw PGN source text.
   */
  loadPgnText: (pgnText: string) => void;
  /**
   * Insert a new comment node around the given move, or focus the existing one.
   * Returns `{ id, rawText }` for the comment (new or existing), or null on failure.
   * @param moveId - Target move node ID.
   * @param position - Whether to insert before or after the move.
   */
  insertComment: (moveId: string, position: "before" | "after") => { id: string; rawText: string } | null;
  /**
   * Focus an existing comment around the given move without creating a new one.
   * No-op when no comment exists at that position.
   * @param moveId - Target move node ID.
   * @param position - Whether to look before or after the move.
   */
  focusCommentAroundMove: (moveId: string, position: "before" | "after") => void;
  /**
   * Persist the user's typed comment text back into the PGN model.
   * @param commentId - PGN comment node ID.
   * @param text - New plain-text content of the comment.
   */
  saveCommentText: (commentId: string, text: string) => void;
  /** Apply default indentation directives to the current model. */
  applyDefaultIndent: () => void;
  /**
   * Persist board shape annotations (`[%csl]`/`[%cal]`) for the given move
   * into the move's "after" comment.  Creates the comment if absent; strips
   * and replaces any existing shape blocks.  Passing an empty array removes
   * all shape annotations for the move.
   *
   * @param moveId - PGN model node ID of the move to annotate.
   * @param shapes - New full set of shapes for this move.
   */
  saveBoardShapes: (moveId: string, shapes: BoardShape[]) => void;
  /**
   * Update a single PGN header tag value.
   * @param key - Header key, e.g. "White", "Date".
   * @param value - Raw value from the UI (will be normalized before applying).
   */
  updateGameInfoHeader: (key: string, value: string) => void;
  /**
   * Toggle a NAG symbol on the given move with within-group exclusivity.
   * Selecting an already-active NAG removes it; selecting a different NAG in
   * the same group replaces the previous one.
   * @param moveId - PGN model node ID of the target move.
   * @param nag    - NAG code to toggle, e.g. "$1". Color-specific codes
   *                 ($32/$33, $36/$37, $40/$41) should be pre-resolved to the
   *                 correct side by the caller using `colorPairCode`.
   */
  toggleMoveNag: (moveId: string, nag: string) => void;

  // ── Move entry ─────────────────────────────────────────────────────────
  /**
   * Apply an edited PGN model (result of appendMove, replaceMove, etc.) and
   * navigate the board cursor to `targetMoveId` if provided.
   */
  applyPgnModelEdit: (newModel: PgnModel, targetMoveId: string | null) => void;

  // ── Undo / Redo ────────────────────────────────────────────────────────
  undo: () => void;
  redo: () => void;

  // ── Resource rows ──────────────────────────────────────────────────────
  /**
   * Load the game identified by `sourceRef` and open it in the editor.
   * @param sourceRef - Source reference from a resource row.
   */
  openGameFromRef: (sourceRef: unknown) => void;
  /** Open the resource picker and add the chosen resource as a viewer tab. */
  openResource: () => void;
  /** Open the drop/paste ingress with a raw PGN text string. */
  openPgnText: (pgnText: string) => void;
  /**
   * Swap the display order of two games in a resource.
   * @param sourceRef - First game source reference.
   * @param neighborSourceRef - Second game source reference (the swap target).
   */
  reorderGameInResource: (sourceRef: unknown, neighborSourceRef: unknown) => Promise<void>;

  /**
   * Search for games containing the given position across multiple resources.
   * @param positionHash - 16-char FNV-1a hex hash of the first four FEN fields.
   * @param resourceRefs - Canonical resource refs to fan out to.
   */
  searchByPosition: (positionHash: string, resourceRefs: PgnResourceRef[]) => Promise<PositionSearchHit[]>;
  /**
   * Search across resources for games whose metadata contains the query string.
   * @param query Substring matched against White, Black, Event, Site fields.
   * @param resourceRefs Canonical resource refs to fan out to.
   */
  searchByText: (query: string, resourceRefs: PgnResourceRef[]) => Promise<TextSearchHit[]>;
  /**
   * Return aggregated move-frequency statistics for the current position across
   * the provided resource refs, merged by UCI key.
   * @param positionHash 16-char FNV-1a hex hash of the position.
   * @param resourceRefs Canonical resource refs to fan out to.
   */
  explorePosition: (positionHash: string, resourceRefs: PgnResourceRef[]) => Promise<MoveFrequencyEntry[]>;

  // ── Game links ─────────────────────────────────────────────────────────
  /**
   * Load the game identified by `recordId` from the resource that owns the
   * active session and open it as a new session tab.
   * @param recordId - Record ID of the game within the active session's resource.
   */
  openGameFromRecordId: (recordId: string) => Promise<void>;
  /**
   * Fetch display metadata for a game by its record ID from the active
   * session's resource.  Returns `null` when the game cannot be found or
   * the active session has no persisted source.
   * @param recordId - Record ID of the game to look up.
   */
  fetchGameMetadataByRecordId: (recordId: string) => Promise<Record<string, string> | null>;
  /**
   * Return the resource ref `{ kind, locator }` of the active session's
   * persisted source, or `null` when the session has no source yet.
   */
  getActiveSessionResourceRef: () => { kind: string; locator: string } | null;
  /**
   * Return ranked player-name suggestions matching the query string.
   * Reads from the in-memory player store (bundled + session-accumulated names).
   * @param query - Current user input to match against.
   * @returns Up to 8 matching `"Last-name, First-name"` strings, ranked by relevance.
   */
  getPlayerNameSuggestions: (query: string) => string[];

  // ── Session management ─────────────────────────────────────────────────
  /**
   * Activate a different open session.
   * @param sessionId - Target session ID from `AppStoreState.sessions`.
   */
  switchSession: (sessionId: string) => void;
  /**
   * Close an open session (removes it from the tab bar).
   * @param sessionId - Session ID to close.
   */
  closeSession: (sessionId: string) => void;

  // ── Shell state ────────────────────────────────────────────────────────
  /** Open the training curriculum panel (.x2plan). */
  openCurriculumPanel: () => void;
  setMenuOpen: (open: boolean) => void;
  setDevDockOpen: (open: boolean) => void;
  setActiveDevTab: (tab: "ast") => void;
  setLayoutMode: (mode: "plain" | "text" | "tree") => void;
  /** Toggle whether engine evaluation pills are visible in text/tree mode. */
  setShowEvalPills: (show: boolean) => void;
  setLocale: (locale: string) => void;
  setMoveDelayMs: (value: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setPositionPreviewOnHover: (enabled: boolean) => void;
  setDeveloperToolsEnabled: (enabled: boolean) => void;
  /**
   * Persist updated board decoration preferences (shape colors, highlight style,
   * move hints toggle) to localStorage and propagate into app state.
   * @param prefs - Complete new preferences object.
   */
  setShapePrefs: (prefs: ShapePrefs) => void;
  setSaveMode: (mode: string) => void;
  saveActiveGameNow: () => void;
  /**
   * Save the game session identified by `sessionId`.
   * Switches to it first if it is not currently active.
   * @param sessionId - Session ID to save.
   */
  saveSessionById: (sessionId: string) => void;
};

/** No-op service implementation used as context default (before `useAppStartup` fires). */
const noop = (): void => {};

const defaultServices: AppStartupServices = {
  gotoFirst: noop,
  gotoPrev: noop,
  gotoNext: noop,
  gotoLast: noop,
  gotoMoveById: noop,
  handleEditorArrowHotkey: (): boolean => false,
  loadPgnText: noop,
  insertComment: (): null => null as null,
  focusCommentAroundMove: noop,
  saveCommentText: noop,
  applyDefaultIndent: noop,
  saveBoardShapes: noop,
  updateGameInfoHeader: noop,
  toggleMoveNag: noop,
  applyPgnModelEdit: noop,
  undo: noop,
  redo: noop,
  openGameFromRef: noop,
  openResource: noop,
  openPgnText: noop,
  openGameFromRecordId: async (): Promise<void> => {},
  fetchGameMetadataByRecordId: async (): Promise<Record<string, string> | null> => null,
  getActiveSessionResourceRef: (): null => null,
  reorderGameInResource: async () => {},
  searchByPosition: async () => [],
  searchByText: async () => [],
  explorePosition: async () => [],
  switchSession: noop,
  closeSession: noop,
  openCurriculumPanel: noop,
  setMenuOpen: noop,
  setDevDockOpen: noop,
  setActiveDevTab: noop,
  setLayoutMode: noop,
  setShowEvalPills: noop,
  setLocale: noop,
  setMoveDelayMs: noop,
  setSoundEnabled: noop,
  setPositionPreviewOnHover: noop,
  setDeveloperToolsEnabled: noop,
  setShapePrefs: noop,
  setSaveMode: noop,
  saveActiveGameNow: noop,
  saveSessionById: noop,
  getPlayerNameSuggestions: (): string[] => [],
};

/** React context carrying the startup-initialised service callbacks. */
export const ServiceContext = createContext<AppStartupServices>(defaultServices);

/** Consume the service context inside any descendant component. */
export const useServiceContext = (): AppStartupServices => useContext(ServiceContext);

/** Convenience provider component. */
export const ServiceContextProvider = ({
  value,
  children,
}: {
  value: AppStartupServices;
  children: ReactNode;
}): ReactElement => (
  <ServiceContext.Provider value={value}>{children as ReactElement}</ServiceContext.Provider>
);
