# P6_18 Dev Forum — In-App Feedback Loop

The system embeds an in-app feedback loop directly accessible to all users during normal operation. This is the **Dev Forum** — a lightweight, context-capturing ticket system that connects clinical users to the development team without breaking the clinical workflow.

The design is based on the AppSpec DevForum implementation (AppSpace/AppSpec), adapted for the EHR clinical context.

---

## The Problem It Solves

Clinical users identify usability issues and missing functionality during real work — not in training or testing sessions. Capturing that context precisely is difficult:
- A nurse notices a missing checklist item while standing at the bedside
- A physician wants to flag that a result view is missing a critical trend
- An MPA notices the appointment flow requires an unnecessary extra step

Without a built-in mechanism, feedback is lost, arrives without context, or is communicated through slow channels (email, helpdesk ticket). The Dev Forum captures the request with full context at the moment of insight.

---

## Architecture

```
User triggers Dev Forum (keyboard shortcut or persistent floating button)
  → Current context captured automatically:
      — Current URL and route
      — Current patient_id, episode_id (from app state)
      — Current module / screen
      — Current user role
      — Selected UI component (optional — user picks a specific element)
  → User writes request in rich text editor
  → Request stored as DevRequest with captured context JSON

Developer receives request (Dev tab, DEV role):
  → Sees full context: patient/episode/screen at time of submission
  → Can copy structured AI prompt (MODE: IMPLEMENT TICKET ONLY) to clipboard
  → Claims, implements, responds

User receives developer response (Review tab):
  → Accepts (closes) or rejects with feedback
  → Rejection creates a child DevRequest — full lineage preserved
```

**Privacy safeguard**: the context capture records identifiers (patient_id, episode_id, screen name) but never captures clinical values. A developer seeing "patient_id: abc123, screen: vitals_entry" knows where the user was — they do not see any clinical data from that patient's record.

---

## EHR-Specific Context Capture

The standard AppSpec context capture is extended for the EHR:

```typescript
interface EhrCaptureContext {
  url: string;
  module: string;             // 'vitals_entry' | 'order_entry' | 'pathway_view' | ...
  patient_id: string | null;  // present when in patient context
  episode_id: string | null;  // present when in episode context
  episode_type: string | null; // 'inpatient' | 'outpatient' | ...
  user_role: string;          // from authenticated session
  selected_component: DomDescriptor | null; // if user picked an element
  captured_at: string;        // ISO timestamp
}
```

The `data-element-id` attributes (see [P6_17](P6_17_element_identity_and_resource_registry.md)) double as context anchors for Dev Forum — the element the user picks is identified by its element ID, which maps to a human-readable description of what the component is.

---

## Request Lifecycle

```
PENDING
  → IN_DEVELOPMENT (developer claims)
  → IMPLEMENTED_REVIEW or REJECTED_REVIEW (developer decides)
  → CLOSED_ACCEPTED (user accepts)
     or
  → CLOSED_REOPENED (user rejects — new child DevRequest created)
       → PENDING (cycle repeats; lineage preserved)
```

Full lineage is viewable by all participants at any point — the complete iteration history of a request is one click away. Every request in the chain is read-only after it is closed; history is immutable.

---

## AI Integration

The Dev Forum structures each ticket as an AI-ready prompt for direct use with Claude Code or Cursor:

```
MODE: IMPLEMENT TICKET ONLY — do not refactor surrounding code

TICKET #47
SCOPE: Vitals entry form — ECG button is missing from the quick-action bar
DONE WHEN: ECG order can be placed from the vitals entry screen in ≤ 2 taps
CONTEXT: module=vitals_entry, episode_type=inpatient, user_role=nurse
REQUIREMENT: [user's request text, HTML → Markdown converted]
```

The developer copies this to the clipboard and pastes it directly into the AI coding assistant. The structured format prevents scope creep (MODE: IMPLEMENT TICKET ONLY) and provides all necessary context.
