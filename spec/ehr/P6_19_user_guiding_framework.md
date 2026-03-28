# P6_19 User-Guiding Framework

The User-Guiding Framework is a transparent explanatory layer that can be activated on demand, overlaying the running application. When active, every UI component is annotated with a contextual explanation. Users can also ask questions in natural language; the framework answers in the context of the current screen.

---

## Activation

The guide layer is activated without navigating away from the current workflow:
- Keyboard shortcut: `Shift + ?`
- A small floating "?" button always visible in the application chrome
- In the guide layer, a second activation mode enables "question mode" (see below)

Activation never interrupts a clinical workflow. The layer is additive — it overlays the running UI; it does not navigate away or interrupt any form in progress.

---

## How It Works — Guide Definitions

Every meaningful UI component is annotated with a `data-element-id` attribute (see [P6_17](P6_17_element_identity_and_resource_registry.md) for the full element identity system):

```tsx
<NewsScoreDisplay score={news2} data-element-id={ELEMENT_IDS.VITALS_NEWS2_SCORE} />
<OrderSetButton data-element-id={ELEMENT_IDS.ORDERS_ORDER_SET_PICKER} />
<EpisodeHeader data-element-id={ELEMENT_IDS.EPISODE_CONTEXT_HEADER} />
```

Guide definitions are stored in the guide registry — a content store managed by clinical informaticians and UX authors, not developers:

```json
{
  "element_id": "vitals.widget.news2_score",
  "label": "NEWS2 Score",
  "short": "A score measuring how unwell the patient is. Higher is more urgent.",
  "detail": "The National Early Warning Score 2 (NEWS2) is calculated from six physiological parameters. A score of 5 or above should trigger immediate clinical review. Scores are colour-coded: green (0–4), amber (5–6), red (7+).",
  "actions": [
    { "label": "How is this calculated?", "links_to": "guide://vitals.news2_calculation" },
    { "label": "What should I do if it is red?", "links_to": "guide://escalation.news2_red" }
  ]
}
```

Guide content is authored in the same multilingual framework as the rest of the application — German, French, and Italian for Switzerland.

---

## Semantic Identity — Surviving Component Reorganisation

The most important architectural constraint is that UI components move over time. A button migrates from one toolbar to another. A panel is split in two. A feature is reorganised into a different dialog. A help system coupled to component identity (React component names, file paths, DOM position) breaks silently every time this happens.

The solution is to decouple help content from component identity. Element IDs identify **semantic concepts** — things the user cares about — not the components that happen to render them today:

```
  Semantic concept
  ("Activate the NEWS2 score input")
         │
         │  data-element-id="vitals.widget.news2_score"
         ▼
  Whatever DOM element currently renders that concept
```

If a component moves from one area of the screen to another, the developer carries the `data-element-id` attribute with it. The guide system finds the concept wherever it lives because it queries the live DOM **spatially** (where is the cursor right now?) — not historically (where was the component before?).

This also means multiple elements can share the same element ID legitimately — a concept present in both a desktop toolbar and a mobile action sheet is the same concept and should show the same help.

The typed element registry (P6_17) is the compile-time defence against drift: if a concept is removed from the registry, TypeScript immediately flags every component that referenced it. Drift becomes a **compile-time error**, not a silent coverage gap.

---

## Visual Behaviour When Active

When the guide layer is active:
- A subtle highlight ring (`2px solid #005ca9, opacity 0.6`) appears on every component that has a `data-element-id`
- Hovering over a component shows its short description in a tooltip
- Clicking a component shows a side panel with the full description and linked actions
- Components without a `data-element-id` are visually dimmed — signalling to the guide authors that coverage is incomplete

The application remains fully functional while the guide layer is active. A clinician can use the guide to understand a score and then immediately act on it — they do not need to deactivate the guide to continue working.

---

## Guide Dialog Placement

The detail panel is anchored to the **target element**, not to the cursor. When the user clicks a component, the panel's position is computed from the component's bounding rectangle:

1. **Right** — preferred: if `targetRect.right + panelWidth ≤ viewportWidth`
2. **Left** — if `targetRect.left − panelWidth ≥ 0`
3. **Below** — if `targetRect.bottom + panelHeight ≤ viewportHeight`
4. **Above** — fallback

The panel is clamped to viewport edges in all cases. It positions once at open time; it does not reposition on scroll. The highlight ring remains visible while the panel is open so the user always knows which component they are reading about. This placement logic is particularly important for components at the edges of the screen (e.g. a right-side panel or a bottom toolbar).

---

## Two Access Paths

Users reach help through two complementary paths:

| Path | How |
|---|---|
| **Spatial** | Point at something visible — the guide system resolves the concept from the DOM |
| **Conceptual** | Type what you are looking for — the system searches all guide entries by keyword |

Both paths lead to the same guide entries and the same detail panel. A user who cannot find what they are looking for by pointing can always switch to typing, and vice versa. Before the AI companion is available, the conceptual path is served by a **narrowing full-text search** over the guide registry:

- Query is tokenised into lowercase words
- Each entry is scored by how many query tokens appear in (label ∪ short ∪ detail ∪ keywords)
- Results are sorted by score and displayed as a narrowing list
- Clicking a result navigates to that entry — the same view as if the user had pointed at the component

This client-side scan over ~100–300 entries is instantaneous and requires no backend.

---

## Global Search

The guide layer exposes a **global search entry point** that works without first pointing at a component. It is accessible via a dedicated keyboard shortcut or a search icon in the floating guide control, and can be invoked at any time regardless of whether guide mode is already active.

The search covers the full help-text of all components — label, short description, detail, and keywords — using the same algorithm as the per-component search field. The result list ranks entries by match score (top ≤ 8 shown).

When the user selects a result the application **navigates to the component** concerned:

- If the component is currently in the DOM, the highlight ring is placed on it and the detail panel opens anchored to it — identical to the outcome of the spatial path.
- If the component is absent (a panel that only appears in a specific workflow context, a score display only visible when an episode is open), the detail panel opens in a neutral position with a note explaining when and how to reach the feature.

Global search and the per-component search field are backed by the same registry query; they differ only in entry point and in whether a live target element is available to anchor the panel.

---

## Question Mode

Question mode adds a floating chat panel to the guide layer. The user types a question in natural language; the AI answers in the context of the current screen.

```
User: "What does it mean that the NEWS2 is 6?"
AI: "A NEWS2 score of 6 indicates medium-high risk of clinical deterioration.
     For this patient, the score is driven by the respiratory rate of 22 and
     SpO2 of 95%. According to your institution's escalation policy, a score
     of 5 or above should trigger a clinical review by a senior nurse or physician
     within 30 minutes. You can escalate directly from the patient screen —
     use the [Escalate] button in the left panel."
```

The AI's answer is grounded in:
- The guide definition for the current context (`data-element-id`)
- The institution's configured escalation rules (from the rule registry, §56.1)
- The current patient's data (non-identifying summary only — the AI sees values, not names)

**Governance**: the AI is permitted to explain and contextualise; it is not permitted to recommend a specific clinical action or diagnose. Every AI response in question mode ends with: *"This is contextual guidance — clinical decisions remain with the responsible clinician."*

---

## Guide Coverage Enforcement

Guide coverage is tracked as a quality metric:
- The CI pipeline reports the percentage of rendered components that have a `data-element-id`
- A coverage target (e.g., 90% of named components) is set per module
- Falling below the target is a build warning; new components without a `data-element-id` are flagged in the pull request review

This ensures that as the application grows, the guide layer stays complete.

---

## Conditional Components

Some components are only present in the DOM in certain contexts — a panel that appears only when an episode is open, a score display only visible in a specific workflow step. When the user points at a region with no `data-element-id` ancestor, no highlight ring appears and no panel opens. This is intentional: guide-unannotated regions signal a coverage gap to guide authors.

For guide entries whose component is currently absent, the **conceptual (search) path** still works. A result clicked from search shows the entry content with a note describing when and how to reach the feature. This prevents the guide from misleading users into looking for something that is not on screen.

---

## Open Questions

- **Keyboard-only targeting**: should `Tab` focus traversal highlight `data-element-id` elements while guide mode is active so that keyboard users can navigate the guide without a pointer device?
- **Touch / mobile**: the hover-then-confirm model does not map directly to touch; a first tap could substitute for hover, a second tap for Enter, keeping the gesture count the same.
- **Dynamic content rows**: tables and list rows (e.g. individual orders, results) need a template-style element ID (e.g. `"orders.widget.order_row"`) rather than per-row IDs; the guide entry should describe the row type, not an individual row.
- **Deeply nested or occluded elements**: if a large component covers a smaller one, the user cannot hover the inner element. A right-click or long-press context menu as an alternative entry point would resolve this without a blocking overlay.

---

## Guide Authoring Interface

Guide definitions are authored in a dedicated interface accessible to clinical informaticians and UX leads:
- Browse all `data-element-id` values registered in the application
- See which have definitions, which are missing (coverage report)
- Edit definitions with a rich text editor
- Preview how the definition will appear in the overlay
- Publish a new definition without a code deployment

Guide content is stored in the same database as other configuration content and is served at runtime — not compiled into the application bundle.
