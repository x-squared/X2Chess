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
   * Update a single PGN header tag value.
   * @param key - Header key, e.g. "White", "Date".
   * @param value - Raw value from the UI (will be normalized before applying).
   */
  updateGameInfoHeader: (key: string, value: string) => void;

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
  setMenuOpen: (open: boolean) => void;
  setDevDockOpen: (open: boolean) => void;
  setActiveDevTab: (tab: "ast" | "dom" | "pgn") => void;
  setLayoutMode: (mode: "plain" | "text" | "tree") => void;
  setLocale: (locale: string) => void;
  setMoveDelayMs: (value: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDeveloperToolsEnabled: (enabled: boolean) => void;
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
  loadPgnText: noop,
  insertComment: (): null => null as null,
  focusCommentAroundMove: noop,
  saveCommentText: noop,
  applyDefaultIndent: noop,
  updateGameInfoHeader: noop,
  applyPgnModelEdit: noop,
  undo: noop,
  redo: noop,
  openGameFromRef: noop,
  openResource: noop,
  openPgnText: noop,
  reorderGameInResource: async () => {},
  searchByPosition: async () => [],
  searchByText: async () => [],
  explorePosition: async () => [],
  switchSession: noop,
  closeSession: noop,
  setMenuOpen: noop,
  setDevDockOpen: noop,
  setActiveDevTab: noop,
  setLayoutMode: noop,
  setLocale: noop,
  setMoveDelayMs: noop,
  setSoundEnabled: noop,
  setDeveloperToolsEnabled: noop,
  setSaveMode: noop,
  saveActiveGameNow: noop,
  saveSessionById: noop,
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
