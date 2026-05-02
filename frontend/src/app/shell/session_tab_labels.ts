/**
 * session_tab_labels — pure helpers for session tab primary/secondary labels.
 *
 * When a resource rendering profile (GRP) applies, labels must come from profile output,
 * not from a fallback to White/Black headers. Empty compact (`renderedLine1`) strings must
 * not trigger player-name substitution — that previously hid GRP entirely when metadata
 * produced blank rendered lines.
 */

import type { SessionItemState } from "../../core/state/app_reducer";

/** Return true when a PGN player-name value is a genuine name (not a placeholder). */
export const isRealPlayerName = (name: string): boolean =>
  name !== "" && name !== "?" && name !== "White" && name !== "Black";

/**
 * Primary tab label: GRP lines when `grpProfileApplied`, else player names / title.
 *
 * @param session - Session row from React state.
 * @returns Single-line primary string for the tab pill.
 */
export const buildSessionTabPrimaryLabel = (session: SessionItemState): string => {
  if (session.grpProfileApplied) {
    const l1: string = session.renderedLine1?.trim() ?? "";
    const l2: string = session.renderedLine2?.trim() ?? "";
    if (l1 !== "") return l1;
    if (l2 !== "") return l2;
    return session.title;
  }
  if (session.renderedLine1 !== undefined && session.renderedLine1.trim() !== "") {
    return session.renderedLine1;
  }
  const { white, black } = session;
  if (isRealPlayerName(white) && isRealPlayerName(black)) return `${white} — ${black}`;
  if (isRealPlayerName(white)) return white;
  if (isRealPlayerName(black)) return black;
  return session.title;
};

/**
 * Secondary tab label: GRP second line, or Event/Date when no profile, plus markers.
 *
 * @param session - Session row from React state.
 * @param unsavedLabel - Localised “unsaved” suffix when applicable.
 * @returns Secondary line text (may be empty).
 */
export const buildSessionTabSecondaryLabel = (session: SessionItemState, unsavedLabel: string): string => {
  const parts: string[] = [];
  if (session.grpProfileApplied) {
    const l1: string = session.renderedLine1?.trim() ?? "";
    const l2: string = session.renderedLine2?.trim() ?? "";
    if (l1 !== "" && l2 !== "") {
      parts.push(l2);
    }
  } else if (session.renderedLine1 === undefined) {
    if (session.event && session.event !== "?" && session.event !== "Sample") parts.push(session.event);
    if (session.date && session.date !== "?" && session.date !== "????.??.??") parts.push(session.date);
  } else if (session.renderedLine2) {
    parts.push(session.renderedLine2);
  }
  if (session.isUnsaved) parts.push(unsavedLabel);
  if (session.saveMode === "manual") parts.push("M");
  return parts.join(" · ");
};
