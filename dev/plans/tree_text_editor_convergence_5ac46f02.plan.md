---
name: Tree Text Editor Convergence
overview: Extend buildTextEditorPlan with a tree branch projection strategy, add a numbering module and depth CSS classes, then wire collapse state into PgnTextEditor as React useState — no changes to text_editor_reconcile.ts or text_editor.ts.
todos:
  - id: export-plan-types
    content: Export PlanBlock/PlanToken types from text_editor_plan.ts and add optional tree metadata fields (variationPath, isCollapsible, isMainLine) plus branch_header tokenType.
    status: done
  - id: implement-tree-plan
    content: Add tree branch emitter inside buildTextEditorPlan — one block per variation, branch-header token, variationPath, break/indent markers ignored.
    status: done
  - id: add-numbering-module
    content: Add tree_numbering.ts with VariationNumberingStrategy interface and default alphaNumericPathStrategy (A, A.1, A.1.1 …).
    status: done
  - id: add-depth-style-system
    content: Add CSS depth classes tree-depth-1 through tree-depth-3 and tree-depth-4plus in editor/styles.css; style .tree-branch-header token.
    status: done
  - id: wire-tree-collapse-in-component
    content: Add BranchHeader sub-component and useState<ReadonlySet<string>> collapse state to PgnTextEditor.tsx; filter collapsed descendant blocks; reset on model change.
    status: done
  - id: add-targeted-tests
    content: Add tests for variation projection, numbering by path, collapse block-filtering, and mode-switch marker preservation.
    status: done
isProject: false
---

# Tree/Text Editor Convergence Plan

## Goals

- Add tree view to the React PGN editor without changing the PGN model.
- Keep PGN model structure authoritative; tree mode is a view strategy only.
- Enforce tree requirements:
  - variations always on separate lines,
  - hierarchical indentation,
  - collapsible branches with triangle affordance,
  - flexible depth styles and numbering strategy,
  - comment edits only (no structural edits from tree mode),
  - mode switching that preserves source semantics.

## Confirmed Design Decisions

- **No `\intro` marker**: first comment of a variation is styled as intro in structured modes
(text, tree) automatically; no in-source marker needed.
- **Unified marker syntax**: canonical form is `[[br]]` (break) and `[[indent]]` (indent).
Legacy aliases `\n`, `<br>`, and `\i` are accepted on read for backwards compatibility;
new user input should use canonical forms.
- **Tree mode comment rendering**: break/indent markers appear as greyed literal text —
they survive edits and round-trip intact. The tree layout ignores them; layout is driven
entirely by RAV structure.
- **Collapse state**: UI-only `useState` in `PgnTextEditor.tsx`; never written to model or PGN text.
- **Variation numbering**: display-only, derived at render time from `variationPath`.

## Viewing Modes

Three modes, all editing the same underlying PGN model:


| Mode  | Comment text  | `[[br]]` / `[[indent]]`     | Layout driver       |
| ----- | ------------- | --------------------------- | ------------------- |
| plain | raw literal   | shown as literal characters | none (flat blocks)  |
| text  | markers strip | `[[indent]]` drives indent  | indent directives   |
| tree  | raw literal   | shown as greyed literal     | RAV nesting (paths) |


In **plain** mode the raw PGN comment text is shown verbatim for editing.
In **text** mode `[[indent]]` before a RAV causes the RAV to be indented as an inner block;
`[[br]]` in comment text is kept as literal (block splits inside a comment token are not implemented).
In **tree** mode all markers are visible as muted literal characters — they are irrelevant to
layout but must survive edits intact so that switching back to text mode restores them.

## Current Architecture (post-React-migration)

The editor pipeline has two layers. Only these two layers are touched by this plan:

**Plan layer** — `frontend/src/editor/text_editor_plan.ts`

- `buildTextEditorPlan(pgnModel, { layoutMode }) → PlanBlock[]`
- Pure function; no DOM, no React imports.
- Called via `useMemo` in `PgnTextEditor.tsx`.
- Prior to this plan, `tree` mode was passed through but reused the text strategy.

**React render layer** — `frontend/src/components/PgnTextEditor.tsx`

- Calls `buildTextEditorPlan()` inside `useMemo`.
- Reads `layoutMode` from `selectLayoutMode(state)` (sourced from `AppStoreState.pgnLayoutMode`,
updated when user changes the `X2Style` PGN header via `services.updateGameInfoHeader`).
- Renders `PlanBlock[]` as React JSX: `<CommentBlock>`, `<MoveSpan>`, plain `<span>`.

**Not touched by this plan:**

- `text_editor.ts` — legacy facade, not used by `PgnTextEditor.tsx`.
- `text_editor_reconcile.ts` — legacy DOM reconciler, not used by `PgnTextEditor.tsx`.
- Mode switching already flows through `AppStoreState` without additional wiring.

## Architecture Diagram

```mermaid
flowchart TD
  PgnModel[PgnModel]
  LayoutMode[layoutMode from AppStoreState]
  buildPlan[buildTextEditorPlan]
  TextStrategy[text/plain strategy — existing]
  TreeStrategy[tree branch emitter — new]
  PlanBlocks[PlanBlock[] with optional tree metadata]
  PgnTextEditor[PgnTextEditor.tsx]
  CollapseState[useState collapseSet]
  BranchHeader[BranchHeader — new sub-component]
  BlockRender[block / token render — existing]
  ServiceContext[ServiceContext callbacks]
  PgnCommands[pgn_commands comment edits]

  PgnModel --> buildPlan
  LayoutMode --> buildPlan
  buildPlan -->|layoutMode != tree| TextStrategy
  buildPlan -->|layoutMode == tree| TreeStrategy
  TextStrategy --> PlanBlocks
  TreeStrategy --> PlanBlocks
  PlanBlocks --> PgnTextEditor
  PgnTextEditor --> CollapseState
  PgnTextEditor --> BranchHeader
  PgnTextEditor --> BlockRender
  BlockRender --> ServiceContext
  ServiceContext --> PgnCommands
  PgnCommands --> PgnModel
```



## Implementation

### Slice 1 — Export plan types and add tree metadata fields

File: `frontend/src/editor/text_editor_plan.ts`

- Export `PlanBlock`, `PlanToken`, `InlineToken`, `CommentToken`.
- Extend `PlanBlock` with optional tree fields:
  - `variationPath?: readonly number[]` — positional path from root:
  `[0]` = mainline, `[0, 0]` = first RAV of mainline, `[0, 0, 0]` = first sub-RAV of that.
  - `isCollapsible?: boolean` — true on non-mainline branch blocks.
  - `isMainLine?: boolean` — true for the root mainline block.
- Add `"branch_header"` as a recognised `InlineToken.tokenType` (string is already wide enough;
this is a documentation contract).
- `PgnTextEditor.tsx`: replace `ReturnType<typeof buildTextEditorPlan>` aliases with exported types.

### Slice 2 — Marker unification and `\intro` removal

File: `frontend/src/editor/text_editor_plan.ts`

- Remove `INTRO_DIRECTIVE_PREFIX`, `hasIntroDirective()`, `stripIntroDirective()`.
- Intro styling is now: `isFirstComment && (layoutMode === "text" || layoutMode === "tree")`.
- Update `INDENT_BLOCK_DIRECTIVE_PREFIX` to canonical `[[indent]]` with `\i` as read alias:

```
  /^\s*(?:(?:\[\[indent\]\]|\\i)(?:\s+|$))+/
  

```

- Update `getIndentDirectiveDepth` to count `[[indent]]` and `\i` in the matched prefix.
- `addComment` in tree mode: emit `rawText` as the visible text (literal, no stripping),
set `plainLiteralComment: true` so the tree CSS can mute markers.
Intro styling and `focusFirstCommentAtStart` still apply to the first comment of each variation.

### Slice 3 — Tree branch emitter

File: `frontend/src/editor/text_editor_plan.ts`

When `layoutMode === "tree"`, `buildTextEditorPlan` calls `buildTreeEditorPlan` instead of
`emitVariation`. Text/plain path unchanged.

`buildTreeEditorPlan` / `emitTreeVariation` behaviour:

- One block per variation (DFS order). The current block for each variation is set up before
calling `emitTreeVariation`.
- Mainline block: `variationPath = [0]`, `isMainLine = true`, `isCollapsible = false`.
- Each child RAV: `variationPath = parentPath + [childIndex]`, `isCollapsible = true`.
First token: `branch_header` inline token with `label` from the numbering strategy.
- Child RAVs are collected during the walk of a variation's entries, then emitted recursively
after the variation's own content (DFS post-order per branch level).
- `state.firstCommentId` is saved/reset per variation so the first comment of each branch
receives intro styling independently.
- `[[br]]` and `[[indent]]` markers are not processed — `addComment` in tree mode uses the
raw text path directly.

### Slice 4 — Numbering module

New file: `frontend/src/editor/tree_numbering.ts`

```typescript
export type VariationNumberingStrategy = (path: readonly number[]) => string;

// path[0] = index at top RAV level (0 → "A", 1 → "B", …)
// path[1+] = 1-based integer sub-levels
// Examples: [0] → "A"  [0,0] → "A.1"  [0,1] → "A.2"  [1,0] → "B.1"
export const alphaNumericPathStrategy: VariationNumberingStrategy = (path) => { … };
```

The path passed to the strategy is the structural `variationPath` with the leading root `[0]`
stripped: `[0, i, j, …]` → numbering path `[i, j, …]`.

### Slice 5 — Depth-based CSS

File: `frontend/src/editor/styles.css`

- Depth classes on `.text-editor-block`:
  - `.tree-depth-1` — mainline.
  - `.tree-depth-2` — first RAV level.
  - `.tree-depth-3` — second RAV level.
  - `.tree-depth-4plus` — all deeper levels (subdued).
- Style `.tree-branch-header` span: label text + triangle glyph, clickable affordance.
- Muted literal markers in tree mode:
`[data-layout-mode="tree"] .text-editor-comment.plain` → `color: var(--text-muted)`.
- `PgnTextEditor.tsx` applies depth class:
`variationPath.length >= 4 ? "tree-depth-4plus" : \`tree-depth-${variationPath.length}`

### Slice 6 — Collapse UI in `PgnTextEditor.tsx`

File: `frontend/src/components/PgnTextEditor.tsx`

```tsx
const [collapsedPaths, setCollapsedPaths] = useState<ReadonlySet<string>>(new Set());
useEffect(() => { setCollapsedPaths(new Set()); }, [pgnModel]);
```

- Path key: `path.join(".")`.
- A block is hidden when any proper prefix of its `variationPath` is in `collapsedPaths`.
- `BranchHeader` sub-component renders toggle button (▶/▼ + label); calls `onToggle(pathKey)`.
- Block render: skip hidden blocks; prepend `<BranchHeader>` for collapsible blocks.
- Toggle adds/removes key from `collapsedPaths`. No service calls from the toggle.

### Slice 7 — Tests

`**test/editor/tree_editor_plan.test.ts**`

- N RAVs at mainline → N+1 blocks (1 mainline + N branches).
- `[[br]]` inside a comment is not split into separate blocks in tree mode.
- `variationPath` values are unique per block.
- Branch header token is first token of each RAV block with correct label.

`**test/editor/tree_numbering.test.ts**`

- `[0]` → "A", `[1]` → "B", `[0,0]` → "A.1", `[0,1]` → "A.2", `[0,0,0]` → "A.1.1", `[1,0]` → "B.1".

`**test/editor/tree_collapse.test.ts**` (pure logic)

- `filterHiddenBlocks(blocks, collapsedPaths)` hides descendants of collapsed paths.
- Collapsing `"0.1"` hides `[0,1]`, `[0,1,0]` but not `[0,0]`.

`**test/editor/text_editor_plan.test.ts**`

- Plain/text mode unaffected by refactor.
- `[[indent]]` alias: `\i` in raw comment still triggers indent block in text mode.
- Mode-switch: raw comment text still contains `[[br]]` after tree-mode render.

## Risk Controls

- Do not alter parser/serializer topology contracts.
- Keep all structural edits routed through `pgn_commands` only.
- Keep tree collapse and numbering strictly in the view layer.
- `text_editor_reconcile.ts` and `text_editor.ts` are not touched.
- Keep `tsc --noEmit` green after each slice.

