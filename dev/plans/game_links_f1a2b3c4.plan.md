# Game Links — Plan

**ID:** game_links_f1a2b3c4
**Status:** planned

## Goal

Allow any move comment to carry one or more `[%link ...]` PGN annotations that
reference another game in the same resource.  A chip renders inline in the
comment area; clicking the chip opens the linked game in a new session tab.
A hover tooltip shows the game title (White vs Black) fetched lazily on hover.
A small link icon is also rendered in tree/text-mode token output.

---

## PGN encoding

```
[%link recordId="abc-123" label="See also: Nimzo-Indian trap"]
```

- `recordId` — required; identifies the game within the current resource.
- `label` — optional; display text for the chip.  When absent, the chip shows a
  generic link icon and the hover tooltip provides the full title.
- The current resource is implicit (same `resourceRef` as the open game).
  Cross-resource links are deferred to a later phase.

---

## Architecture overview

```
resources_viewer/link_parser.ts        Pure parser (mirrors qa_parser / todo_parser)
editor/useLinkDialog.ts                Hook managing game-picker dialog state
components/GamePickerDialog.tsx        Standalone modal with searchable game list
components/PgnTextEditor.tsx           Wires useLinkDialog; renders GamePickerDialog
components/CommentChips.tsx            Inline chips rendered inside comment tokens
state/ServiceContext.ts                New service: openGameFromRecordId(recordId)
hooks/useAppStartup.ts                 Implements openGameFromRecordId (new session)
editor/plan/types.ts                   CommentToken gets linkAnnotations field
```

---

## Phase 1 — Parser + data layer

### 1.1 `resources_viewer/link_parser.ts`

New file, identical structure to `qa_parser.ts` / `todo_parser.ts`.

```ts
export type LinkAnnotation = {
  recordId: string;
  label: string;          // empty string when omitted
};

// [%link recordId="..." label="..."]
export const parseLinkAnnotations(commentText: string): LinkAnnotation[]
export const hasLinkAnnotations(commentText: string): boolean
export const stripLinkAnnotations(commentText: string): string
export const formatLinkAnnotation(link: LinkAnnotation): string
export const replaceLinkAnnotation(rawText, index, annotation | null): string
export const appendLinkAnnotation(rawText, annotation): string
```

### 1.2 `CommentToken` — carry parsed links

In `editor/plan/types.ts`, add to `CommentToken`:

```ts
linkAnnotations: LinkAnnotation[];   // parsed from rawText at plan-build time
```

In `editor/plan/text_mode.ts` (and `plain_mode.ts`), when emitting a comment
token, call `parseLinkAnnotations(rawText)` and include the result.

This keeps rendering pure — the component reads pre-parsed data from the token.

---

## Phase 2 — Game-picker dialog + service

### 2.1 `ServiceContext.ts` — new service method

```ts
/**
 * Load the game identified by `recordId` from the resource that owns the
 * currently active session, and open it as a new session tab.
 * Resolves to the new sessionId, or null on failure.
 */
openGameFromRecordId: (recordId: string) => Promise<string | null>;
```

No-op default (`async () => null`) in `defaultServices`.

### 2.2 `useAppStartup.ts` — implement the service

```ts
openGameFromRecordId: async (recordId: string): Promise<string | null> => {
  // 1. Resolve the resource ref of the active session (from sourceRef on active session).
  // 2. Call bundle.resources.loadGameBySourceRef({ ...resourceRef, recordId }).
  // 3. Call bundle.sessionStore.openSession({ snapshot, title, sourceRef }).
  // 4. Activate the new session (switchToSession).
  // 5. syncStateToReact(); return new sessionId.
}
```

### 2.3 `components/GamePickerDialog.tsx`

Standalone modal (`<dialog>` element, `showModal()` on mount).

Props:
```ts
{
  resourceRef: ResourceRef;          // used to load game list
  onSelect: (row: ResourceRow) => void;
  onCancel: () => void;
  t: (key: string, fallback?: string) => string;
}
```

Behaviour:
- On mount: calls `getResourceLoaderService().loadRows(resourceRef)` to obtain
  game list (same path as `ResourceTable`).
- Renders a filterable list of game rows (White vs Black, date, result).
- Search input filters by White/Black/Event substring (case-insensitive).
- Arrow keys / Enter to select; Escape to cancel.
- On row click or Enter: calls `onSelect(row)`.

No new state in the React reducer — dialog state lives in the hook.

### 2.4 `editor/useLinkDialog.ts`

Mirrors `useQaDialog.ts`.

```ts
export type LinkDialogState = {
  commentId: string;
  rawText: string;
  editIndex: number;           // -1 for insert
  initial?: LinkAnnotation;
};

export type UseLinkDialogResult = {
  linkDialog: LinkDialogState | null;
  handleInsertLink: (moveId: string) => void;
  handleEditLink: (commentId: string, index: number, rawText: string) => void;
  handleLinkDialogSelect: (moveId: string, row: ResourceRow) => void;
  handleLinkDialogClose: () => void;
  handleDeleteLink: (commentId: string, index: number, rawText: string) => void;
};
```

`handleLinkDialogSelect` extracts `recordId` from `row.sourceRef`, asks the user
for an optional label (or derives it from White/Black metadata), then calls
`appendLinkAnnotation` / `replaceLinkAnnotation` and `services.saveCommentText`.

---

## Phase 3 — Rendering

### 3.1 `components/CommentChips.tsx`

New component. Receives `linkAnnotations: LinkAnnotation[]` and renders one chip
per annotation.

Chip appearance:
- Label present → `→ {label}`
- Label absent → `→ (link)` (generic; tooltip fills in the title)
- Broken link (hover fetch returns null) → greyed chip with strikethrough icon

Chip behaviour:
- **Click**: calls `services.openGameFromRecordId(annotation.recordId)`.
- **Hover**: lazy fetch of linked game metadata via
  `getResourceLoaderService().loadGameMetadata(resourceRef, recordId)`.
  Shows a small tooltip: `{White} vs {Black} — {Result}, {Date}`.
  Caches result in component state to avoid re-fetching.
- A null/404 result renders the chip as broken.

`CommentChips` is a pure React component; no context reads inside it — callers
pass the `openGameFromRecordId` callback as a prop to keep it testable.

### 3.2 Wiring chips into `PgnTextEditor`

In the comment-rendering section of `PgnTextEditor`:

```tsx
{token.kind === "comment" && token.linkAnnotations.length > 0 && (
  <CommentChips
    linkAnnotations={token.linkAnnotations}
    resourceRef={activeResourceRef}
    openGame={services.openGameFromRecordId}
    t={t}
  />
)}
```

`activeResourceRef` is derived from the active session's `sourceRef`
(available in `AppStoreState`).

### 3.3 Link icon in tree/text token output

In `text_mode.ts` (and `tree_mode.ts`), after emitting the comment token, check
`linkAnnotations.length > 0` and emit an additional `InlineToken` with:

```ts
tokenType: "link_indicator"
className: "text-editor-link-indicator"
dataset: { commentId: comment.id }
```

The `PgnTextEditor` renders this as a small `⇢` icon (or SVG).  Clicking it
is a no-op by itself; it is purely a visual affordance that the comment carries
game links.

---

## Phase 4 — Insert command in editor

### 4.1 Command entry point

In `PgnTextEditor`, add a toolbar button or context-menu item "Insert game link"
(alongside the existing Q/A and Todo insert commands).

Keyboard shortcut: none in phase 1; can be added later.

### 4.2 Hook wiring in `PgnTextEditor`

```tsx
const { linkDialog, handleInsertLink, handleEditLink,
        handleLinkDialogSelect, handleLinkDialogClose,
        handleDeleteLink } = useLinkDialog(services);

// ...

{linkDialog && (
  <GamePickerDialog
    resourceRef={activeResourceRef}
    onSelect={(row) => handleLinkDialogSelect(linkDialog.commentId, row)}
    onCancel={handleLinkDialogClose}
    t={t}
  />
)}
```

### 4.3 Edit / delete from existing chips

`CommentChips` exposes an edit icon (pencil) per chip. Clicking it calls
`handleEditLink(commentId, index, rawText)`, which opens `GamePickerDialog`
in edit mode (same game list, current `recordId` pre-selected).

Delete is a small ✕ button on the chip → `handleDeleteLink`.

---

## Phase 5 — i18n strings

All user-visible strings go through `t()`.  Keys to add:

```
editor.insertGameLink           "Insert game link"
editor.linkChipGeneric          "(link)"
editor.linkChipBroken           "(broken link)"
editor.linkTooltip              "{white} vs {black} — {result}, {date}"
gamePicker.title                "Pick a game"
gamePicker.searchPlaceholder    "Search by player or event…"
gamePicker.noResults            "No games found"
```

---

## Phase 6 — Tests

| File | Coverage |
|------|----------|
| `test/resources_viewer/link_parser.test.ts` | parse / format / strip / replace / append round-trips |
| `test/editor/useLinkDialog.test.ts` | insert, edit, delete mutations on rawText |

No UI tests in phase 1 (component test infrastructure not in place).

---

## Out of scope (deferred)

- Cross-resource links (encode full `resourceRef` in PGN)
- Hover-preview board thumbnail
- Link icon click scrolling to the chip
- Bulk link validation on session load

---

## File checklist

- [ ] `frontend/src/resources_viewer/link_parser.ts` — new
- [ ] `frontend/src/editor/plan/types.ts` — add `linkAnnotations` to `CommentToken`
- [ ] `frontend/src/editor/plan/text_mode.ts` — populate `linkAnnotations`, emit `link_indicator` token
- [ ] `frontend/src/editor/plan/plain_mode.ts` — populate `linkAnnotations`
- [ ] `frontend/src/state/ServiceContext.tsx` — add `openGameFromRecordId`
- [ ] `frontend/src/hooks/useAppStartup.ts` — implement `openGameFromRecordId`
- [ ] `frontend/src/components/GamePickerDialog.tsx` — new
- [ ] `frontend/src/editor/useLinkDialog.ts` — new
- [ ] `frontend/src/components/CommentChips.tsx` — new
- [ ] `frontend/src/components/PgnTextEditor.tsx` — wire dialog + chips
- [ ] `frontend/test/resources_viewer/link_parser.test.ts` — new
- [ ] `frontend/test/editor/useLinkDialog.test.ts` — new
