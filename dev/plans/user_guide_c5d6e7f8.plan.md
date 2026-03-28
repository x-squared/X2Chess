# User-Guiding Framework — Plan

**ID:** user_guide_c5d6e7f8
**Status:** Draft — concept complete, ready for detailed design.

---

## Goal

Provide a context-sensitive help layer that users can activate on demand.
The user hits a **Guide-me** button, points at any component on screen, presses
Return, and a help dialog appears anchored alongside that component.  Inside the
dialog the user can read a description of the component and type questions; the
system answers by narrowing a full-text search over all guide content.  A future
phase replaces the search with a chat-bot.

The guide layer is **additive** — it overlays the running application without
interrupting any workflow in progress.

---

## The Core Design Problem: Components Shift

The most important architectural constraint is that UI components move over
time.  A button migrates from one toolbar to another.  A panel is split in two.
A feature is reorganised into a different dialog.  A help system coupled to
component identity (React component names, file paths, DOM position) breaks
silently every time this happens.

**The solution is to decouple help content from component identity.**

Guide IDs identify **semantic concepts** — things the user cares about — not
the React components that happen to render them today.

```
  Semantic concept
  ("navigate to previous move")
         │
         │  data-guide-id="navigate.prev"
         ▼
  Whatever DOM element currently renders that concept
```

If the "Previous Move" button moves from one toolbar to another, the developer
carries `data-guide-id="navigate.prev"` with it.  The guide system finds the
concept wherever it lives because it queries the live DOM spatially (where is
the cursor?) not historically (where was the component before?).

---

## Preventing Drift: Typed Constants

The worst silent failure: a developer moves a component and forgets to carry the
`data-guide-id`.  The solution is to make guide IDs **typed constants**:

```typescript
// guide_ids.ts — authoritative list of all guide concepts
export const GUIDE_IDS = {
  NAVIGATE_PREV:  "navigate.prev",
  NAVIGATE_NEXT:  "navigate.next",
  BOARD_ROOT:     "board.root",
  MOVES_PANEL:    "moves.panel",
  // …
} as const;

export type GuideId = typeof GUIDE_IDS[keyof typeof GUIDE_IDS];
```

Every `data-guide-id` usage in component code imports from this registry:

```tsx
import { GUIDE_IDS } from "../guide/guide_ids";
<button data-guide-id={GUIDE_IDS.NAVIGATE_PREV}>◀</button>
```

If a concept is removed from `guide_ids.ts`, TypeScript immediately flags every
component that referenced it.  Raw strings as `data-guide-id` values are
disallowed by convention (enforced in code review).

The typed registry is the **single source of truth** for which concepts exist.

---

## Interaction Flow

```
User presses the floating "?" button  (or Shift+?)
  → Guide mode activates
  → Cursor changes to question-mark style
  → Subtle "GUIDE MODE — point at anything" indicator appears

User moves the mouse over the application
  → document mousemove listener walks up the DOM from event.target
  → Finds the nearest ancestor with data-guide-id
  → A highlight ring (portal-mounted div, pointer-events:none) wraps that element
  → The ring updates on each mousemove — purely spatial, layout-independent

User presses Enter (or clicks)
  → The guide dialog opens anchored alongside the highlighted element
  → Normal app interaction is suspended for the duration of the dialog

Inside the guide dialog
  → Label + short description + full detail text (rendered markdown)
  → "Related" chips: other concepts the user can jump to directly
  → Search field: typing narrows the full guide registry (all concepts,
    not just the one currently open)

User presses Escape or closes the dialog
  → Dialog closes, guide mode deactivates
  → App returns to normal
```

---

## Guide Dialog Placement

The dialog is anchored to the **target element**, not to the cursor.

Placement algorithm (in priority order):
1. Right: if `targetRect.right + dialogWidth ≤ viewportWidth`
2. Left:  if `targetRect.left  − dialogWidth ≥ 0`
3. Below: if `targetRect.bottom + dialogHeight ≤ viewportHeight`
4. Above

Clamp to viewport edges in all cases.  The dialog positions once at open time
and does not reposition on scroll.  The highlight ring remains visible while the
dialog is open so the user always knows which component they are reading about.

---

## Guide Entry Data Model

```typescript
type GuideEntry = {
  id:       GuideId;       // typed constant from guide_ids.ts
  label:    string;        // short display name, e.g. "Previous Move"
  short:    string;        // one-sentence description shown in the tooltip
  detail:   string;        // markdown — full explanation shown in the dialog
  keywords: string[];      // search tokens (synonyms, task names, user vocabulary)
  related?: GuideId[];     // other entries to show as "Related" chips
};
```

Guide entries are a static array in `guide_content.ts`.  All strings are
English for Phase 1 and flagged for i18n in Phase 2.

---

## Search

The search field in the guide dialog queries **all guide entries**, not just
the one currently open.  This gives the user two complementary paths into help:

- **Spatial path** — point at something visible on screen
- **Conceptual path** — type what you are looking for

Search algorithm (client-side, no backend):
1. Tokenise the query into lowercase words
2. For each entry, count how many query tokens match any of
   (label ∪ short ∪ detail ∪ keywords), case-insensitive
3. Sort descending by score; show top results (≤ 8)
4. Clicking a result navigates the dialog to that entry

With ~30–100 entries the scan is instantaneous.

---

## Global Search

The guide layer also provides a **global search entry point** that works
independently of the spatial flow.  Without pointing at any component first,
the user can open guide search directly — via a dedicated keyboard shortcut or
a search icon in the floating guide control — and search the help-text of all
components in one step.

The search algorithm is identical to the per-component search above: query
tokens are matched against label, short, detail, and keywords for every guide
entry; results are ranked by score; the top matches (≤ 8) are displayed as a
list.

When the user selects a result the application **navigates to the component**
concerned:

- If the component is currently in the DOM the highlight ring is placed on it
  and the guide dialog opens anchored to it — identical to the result of the
  spatial flow.
- If the component is absent (conditional panel, context-dependent control) the
  dialog opens in a neutral position with a note explaining when and how to
  reach the feature.

Global search and the per-component search field share the same underlying
registry query; they differ only in entry point and in whether a target element
is available to anchor the dialog.

---

## Architectural Layers

```
┌──────────────────────────────────────────────────────────────┐
│  React components  (src/components/)                         │
│    GuideButton   — floating "?" activation control           │
│    GuideOverlay  — hover detection + highlight ring portal   │
│    GuideDialog   — positioned dialog, search, related chips  │
├──────────────────────────────────────────────────────────────┤
│  App state  (new guide_mode slice in app_reducer.ts)         │
│    active:      boolean                                      │
│    hoveredId:   GuideId | null   (updated live on mousemove) │
│    openId:      GuideId | null   (set on Enter / click)      │
│    searchQuery: string                                       │
├──────────────────────────────────────────────────────────────┤
│  Pure-logic guide module  (src/guide/)                       │
│    guide_ids.ts      — typed constant registry               │
│    guide_content.ts  — static entry array                    │
│    guide_registry.ts — lookup(id) and search(query) functions│
├──────────────────────────────────────────────────────────────┤
│  DOM annotation  (across all src/components/)                │
│    data-guide-id="..."  on semantic components               │
│    values are always GUIDE_IDS.* typed constants             │
└──────────────────────────────────────────────────────────────┘
```

The `src/guide/` module is **pure-logic**: no React, no DOM, fully testable.
The React layer reads from it; it never calls back into React.

---

## Conditional Components

Some components are only present in the DOM in certain contexts (e.g., the
analysis panel when an engine is loaded, a training overlay during a session).
When the user points at a region with no `data-guide-id` ancestor, no highlight
ring appears and no dialog opens — this is the correct behaviour.

For guide entries whose component is currently absent, the **search path** still
works.  A result clicked from search shows the entry content with a note "This
panel is not currently visible."  The entry can describe when and how to make it
appear.

---

## Coverage Quality Gate

Guide coverage is tracked as a CI metric.  A script scans all compiled HTML
output for elements with `data-guide-id` and checks that each ID exists in
`guide_ids.ts`.  Unknown IDs (in HTML but not in registry) are build errors.
Orphaned IDs (in registry but no corresponding HTML in any build target) are
warnings surfaced in the PR review.

A coverage percentage (guide-annotated components / total interactive
components) is reported but not gated in Phase 1.  A coverage target
(e.g. ≥ 80% of named interactive components) is set when content authoring is
complete.

---

## Phase 2: AI Companion

When the search field is replaced with a chat input, the architecture does not
change — only what happens to the query string.  Instead of scoring guide
entries locally, the query, the current entry, and a brief app-state summary
(which mode is active, whether a game is loaded, etc.) are sent to an AI API.

The guide registry remains the grounding context: the AI is instructed to answer
within the scope of what the guide entries describe.  This constrains the
response to the application's actual capabilities and prevents hallucination
about features that do not exist.

The Phase 1 content quality investment pays off here: well-written guide entries
become the AI's knowledge base.

---

## Implementation Phases

### Phase 1 — Infrastructure and core UX

1. Create `src/guide/guide_ids.ts` — typed constant registry (initially empty)
2. Create `src/guide/guide_content.ts` — static entry array (initially empty)
3. Create `src/guide/guide_registry.ts` — `lookup()` and `search()` functions
4. Add `guide_mode` slice to app reducer with actions:
   `GUIDE_ACTIVATE`, `GUIDE_DEACTIVATE`, `GUIDE_SET_HOVERED`,
   `GUIDE_OPEN_DIALOG`, `GUIDE_CLOSE_DIALOG`, `GUIDE_SET_SEARCH_QUERY`
5. Implement `GuideOverlay` — document mousemove listener, highlight ring portal
6. Implement `GuideDialog` — positioned dialog, detail display, search field,
   related chips
7. Implement `GuideButton` — floating "?" control wired to `GUIDE_ACTIVATE`
8. Add `GuideButton`, `GuideOverlay`, and `GuideDialog` to the app shell
9. Annotate all major interactive components with `data-guide-id`
10. Author guide content for all annotated concepts

### Phase 2 — Content and i18n

11. Pass guide strings through the i18n translator
12. Externalise content to an OTA-updatable content store (consistent with the
    OTA updates plan) so help text can be revised without app redeployment
13. Guide content authoring tool for non-developer UX authors (browse coverage,
    edit entries, preview dialog appearance)

### Phase 3 — AI companion

14. Replace search with a chat input backed by the Claude API
15. Pass current guide entry + condensed app-state summary as grounding context
16. Surface AI responses in the existing dialog layout
17. Retain the keyword search as a fallback when the AI is unavailable

---

## Open Questions

- **Keyboard-only targeting**: should `Tab` focus traversal highlight
  `data-guide-id` elements while guide mode is active, so keyboard users can
  navigate the guide without a mouse?
- **Touch / mobile**: the hover-and-select model does not map directly to touch;
  a tap could substitute for hover+Enter, requiring no second gesture.
- **Guide for dynamic content**: tables and list rows (e.g. individual games in
  a resource table) may each need a `data-guide-id` template (e.g.
  `"resource_table.row"`) rather than per-row IDs.
- **Escape hatch for covered-up elements**: if a large component covers a
  smaller one, the user cannot hover the inner one.  Right-click context menu
  as an alternative entry point is worth considering.
