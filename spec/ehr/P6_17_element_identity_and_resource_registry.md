# P6_17 Element Identity and Resource Registry

## Overview

Every addressable part of the system — whether a major screen, a minor panel, a button, or a data service — must carry a **stable, typed identifier**. This identifier is the single key that connects otherwise independent subsystems: the contextual guide layer, role-based access control (RBAC), the audit log, keyboard navigation, and deep-linking. Without a shared identity layer these concerns each invent their own naming, which diverges silently over time.

This chapter defines the identity model, the element taxonomy, the naming convention, the typed registry pattern, and the lifecycle rules that keep identities stable as the application evolves.

---

## Element Taxonomy

System elements are classified into two root categories: **GUI elements** and **Services**.

### GUI Elements

| Type | Definition | Examples |
|---|---|---|
| `view` | A full-screen or primary workspace — the largest addressable unit of the UI. A view occupies the main content area and corresponds to a distinct user task. | Patient chart, Medication administration record, Scheduling board |
| `panel` | A significant sub-region within a view — independently meaningful to the user and independently controllable (collapsible, dockable, or navigable by keyboard). | Vital signs panel, Problem list panel, Order entry panel |
| `widget` | A self-contained interactive unit smaller than a panel. Widgets are the leaf-level GUI elements. | NEWS2 score display, Medication dose field, Order set button |
| `dialog` | A modal or non-modal overlay that interrupts or supplements the current view. | Allergy confirmation dialog, Discharge checklist modal |
| `toolbar` | A row or column of action controls associated with a view or panel. Toolbars are typed separately because they are frequent migration targets — they often move between views during redesign. | Patient chart action bar, Panel-level filter row |

### Services

Services are backend or in-process operations that read, write, or delete data. They are identified because RBAC must be able to grant or deny each operation independently, and the audit log must record which operation was invoked.

| Type | Definition | Examples |
|---|---|---|
| `service.read` | A query that returns data without side effects. | `medication.read.current_list`, `vitals.read.news2` |
| `service.write` | A command that creates or modifies a record. | `medication.write.administration`, `orders.write.new_order` |
| `service.delete` | A command that removes or voids a record. Typed separately from `write` because delete permissions are almost always narrower. | `orders.delete.draft`, `medication.delete.administration` |

---

## Naming Convention

All element identifiers follow the same dot-separated scheme:

```
<domain>.<type>.<concept>
```

- **domain** — the functional domain this element belongs to (matches the domain boundaries defined in P6_13). Examples: `vitals`, `orders`, `medication`, `episode`, `scheduling`.
- **type** — one of the element types above: `view`, `panel`, `widget`, `dialog`, `toolbar`, `service.read`, `service.write`, `service.delete`.
- **concept** — a short, stable, human-readable name for the specific element. Use `snake_case`. Prefer noun phrases that describe what the element *is* over what it looks like today.

Examples:

```
vitals.panel.news2_summary
vitals.widget.news2_score
orders.view.active_orders
orders.widget.order_set_picker
medication.service.read.current_list
medication.service.write.administration
episode.toolbar.patient_chart_actions
episode.dialog.discharge_checklist
```

### Stability Rules

- An ID is **permanent** once it appears in a production release. It may be deprecated but never silently reused for a different concept.
- Renaming a concept requires a migration entry in the registry (old ID → new ID, effective date) so that stored RBAC rules and audit records remain interpretable.
- Moving a GUI element to a different location in the UI does **not** change its ID. The ID reflects what the element *is*, not where it happens to live.

---

## Typed Registry

All identifiers live in a single authoritative module — the **element registry**. No subsystem may use a raw string where a registry constant is available. Raw strings are forbidden in component code and flagged in code review.

```typescript
// element_ids.ts — authoritative registry of every addressable system element

export const ELEMENT_IDS = {

  // Views
  ORDERS_VIEW:                    "orders.view.active_orders",
  PATIENT_CHART_VIEW:             "episode.view.patient_chart",

  // Panels
  VITALS_NEWS2_PANEL:             "vitals.panel.news2_summary",
  ORDERS_ACTIVE_PANEL:            "orders.panel.active_orders",
  MEDICATION_MAR_PANEL:           "medication.panel.administration_record",

  // Widgets
  VITALS_NEWS2_SCORE:             "vitals.widget.news2_score",
  ORDERS_ORDER_SET_PICKER:        "orders.widget.order_set_picker",
  EPISODE_CONTEXT_HEADER:         "episode.widget.context_header",

  // Dialogs
  EPISODE_DISCHARGE_CHECKLIST:    "episode.dialog.discharge_checklist",
  MEDICATION_ALLERGY_CONFIRM:     "medication.dialog.allergy_confirmation",

  // Toolbars
  EPISODE_CHART_TOOLBAR:          "episode.toolbar.patient_chart_actions",

  // Services — read
  MEDICATION_READ_CURRENT:        "medication.service.read.current_list",
  VITALS_READ_NEWS2:              "vitals.service.read.news2",

  // Services — write
  MEDICATION_WRITE_ADMIN:         "medication.service.write.administration",
  ORDERS_WRITE_NEW:               "orders.service.write.new_order",

  // Services — delete
  ORDERS_DELETE_DRAFT:            "orders.service.delete.draft",

} as const;

export type ElementId = typeof ELEMENT_IDS[keyof typeof ELEMENT_IDS];

// Narrow type helpers — useful for RBAC rule declarations
export type GuiElementId  = Extract<ElementId, `${string}.view.${string}` | `${string}.panel.${string}` | `${string}.widget.${string}` | `${string}.dialog.${string}` | `${string}.toolbar.${string}`>;
export type ServiceId     = Extract<ElementId, `${string}.service.${string}`>;
export type ReadServiceId = Extract<ElementId, `${string}.service.read.${string}`>;
```

TypeScript's `as const` + `Extract` pattern means that a function that accepts only `ServiceId` cannot receive a `GuiElementId` by mistake. RBAC rule declarations can enforce that read-only roles receive only `ReadServiceId` values at compile time.

---

## How Each Subsystem Uses the Registry

### Contextual Guide Layer (see P6_14)

GUI elements annotate themselves with `data-element-id`. The guide layer queries the live DOM spatially — it finds whichever element is under the cursor and resolves its guide content from the registry.

```tsx
import { ELEMENT_IDS } from "../registry/element_ids";

<NewsScoreDisplay
  score={news2}
  data-element-id={ELEMENT_IDS.VITALS_NEWS2_SCORE}
/>
```

The guide content store is keyed on `ElementId`. When the CI pipeline cross-checks compiled output against the content store, it uses the same registry — unknown IDs are build errors; orphaned IDs are pull-request warnings.

### Role-Based Access Control (RBAC)

RBAC rules are expressed as grants over `ElementId` values. A role definition lists which elements a role may see (GUI) or invoke (services):

```typescript
const NURSE_ROLE: RoleDefinition = {
  id: "nurse",
  allow: [
    ELEMENT_IDS.VITALS_NEWS2_PANEL,        // may see the panel
    ELEMENT_IDS.VITALS_NEWS2_SCORE,        // may see the score widget
    ELEMENT_IDS.MEDICATION_READ_CURRENT,   // may read the medication list
    ELEMENT_IDS.MEDICATION_WRITE_ADMIN,    // may record an administration
    // ELEMENT_IDS.ORDERS_DELETE_DRAFT     // not granted — compile-time omission
  ],
};
```

The RBAC engine receives the user's resolved role set and the element being accessed. For GUI elements it returns `visible | hidden | read-only`. For services it returns `allowed | denied`. Because `ElementId` is a TypeScript union type, a misconfigured grant (e.g. a typo in an ID) is a compile-time error, not a runtime permission bypass.

### Audit Log

Every service invocation records the `ElementId` of the service called, the user, the episode context, and the outcome. Because IDs are stable and typed, audit queries can be expressed in terms of meaningful concepts rather than raw strings:

```
SELECT * FROM audit_log
WHERE element_id = 'medication.service.write.administration'
  AND episode_id = ?
ORDER BY timestamp DESC;
```

The registry's migration table (old ID → new ID) ensures that audit queries spanning a rename period can still join across both values.

### Keyboard Navigation and Deep-Linking

The shell can navigate to any `view` or `panel` by ID. Deep links and keyboard shortcuts reference `ELEMENT_IDS` constants rather than route strings, so a route change does not silently break either.

```typescript
navigate(ELEMENT_IDS.ORDERS_VIEW);
focusPanel(ELEMENT_IDS.VITALS_NEWS2_PANEL);
```

---

## Lifecycle: Adding, Deprecating, and Migrating IDs

### Adding a new element

1. Add the constant to `element_ids.ts` with a name that reflects the semantic concept, not the current component structure.
2. Annotate the component with `data-element-id={ELEMENT_IDS.YOUR_NEW_CONSTANT}`.
3. Add a guide content entry keyed on the new ID (may be a stub initially — CI will warn but not fail if coverage is below threshold).
4. Add RBAC grants to all roles that should have access.

### Deprecating an element

1. Mark the constant `@deprecated` in JSDoc; add a comment pointing to the replacement.
2. Do **not** delete the constant — remove it only after all dependent RBAC rules and audit queries have been migrated.
3. Record the deprecation in the registry migration table with an effective date.

### Migrating (renaming) an element

```typescript
// element_ids.ts migration table
export const ELEMENT_ID_MIGRATIONS: Record<string, ElementId> = {
  "vitals.widget.news2":        ELEMENT_IDS.VITALS_NEWS2_SCORE,   // renamed 2026-03
};
```

The audit service uses this table to normalise old IDs in historical records so that queries do not need to know about renames.

---

## Registry Coverage Enforcement

The CI pipeline enforces three rules:

| Check | Failure mode |
|---|---|
| Every `data-element-id` value in compiled output exists in `ELEMENT_IDS` | Build error |
| Every `service.write` and `service.delete` ID has at least one RBAC grant | Build warning |
| Guide content coverage ≥ 90 % of `GuiElementId` values | Build warning (not error, to allow incremental authoring) |

Coverage is reported per domain in the pull-request summary so that teams can see which domain's elements are under-annotated.
