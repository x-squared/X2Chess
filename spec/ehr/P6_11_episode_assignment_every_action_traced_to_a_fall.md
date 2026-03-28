## 53. Episode Assignment — Every Action Traced to a Fall

### 53.1 The Core Principle

Every clinical action in the system carries an explicit `episode_id` at the moment of creation. It is a required field — non-nullable in the schema, mandatory in the API contract, enforced by the UI. It is never inferred, never defaulted, never assigned retroactively.

This is the mechanism that makes billing, audit, and EPD document attribution reliable in the Swiss context.

### 53.2 The Swiss "Fall"

A *Fall* (episode / case) is the administrative and billing unit:

| Domain | Use of the Fall |
|---|---|
| **SwissDRG** | One DRG grouping per inpatient Fall — Hauptdiagnose + procedures |
| **TARMED / TARDOC** | Consultations billed per ambulatory Fall |
| **EPD** | XDS.b document metadata references the episode; service start/stop times |
| **Insurer communication** | The Fallnummer appears on every claim and correspondence |
| **Audit** | Every action attributable to a specific episode for insurer and cantonal review |

Episode types: inpatient admission, outpatient consultation series, day case, emergency, rehabilitation, psychiatric stay. A patient may have multiple episodes active simultaneously — an inpatient hip replacement admission running in parallel with an ongoing outpatient oncology episode.

### 53.3 Data Model

```sql
CREATE TABLE episodes (
  id                        UUID PRIMARY KEY,
  patient_id                UUID NOT NULL,
  episode_type              TEXT NOT NULL,   -- 'inpatient','outpatient','day_case',
                                             --   'emergency','rehab','psychiatric'
  episode_number            TEXT NOT NULL,   -- Fallnummer — unique, on all billing/EPD
  status                    TEXT NOT NULL,   -- see lifecycle below
  opened_at                 TIMESTAMPTZ NOT NULL,
  closed_at                 TIMESTAMPTZ,
  department_id             UUID,
  responsible_physician_id  UUID,
  cost_center_id            UUID REFERENCES cost_centers,
  referred_from_episode_id  UUID REFERENCES episodes   -- cross-episode link (nullable)
);
```

Every action table has:

```sql
episode_id  UUID NOT NULL REFERENCES episodes
```

This applies to: `compositions`, `orders`, `slots`, `tasks`, `invoice_items`, `sop_executions`, `pathway_instances`, `roster` entries where patient-linked. The foreign key is non-nullable. The schema physically cannot store an action without an episode.

### 53.4 Patient-Scoped vs Episode-Scoped

Not all records belong to an episode. The distinction is structural and enforced by which table the record lives in:

| Scope | Examples | Table |
|---|---|---|
| **Patient** | Allergy, blood group, advance directive, long-term problem list | `patient_records` — no `episode_id` |
| **Episode** | Compositions, orders, vitals, procedures, billing items, pathway instances | Domain tables — `episode_id NOT NULL` |

There is no ambiguity at query time. The schema makes scope unambiguous.

### 53.5 Episode Lifecycle

The episode follows an explicit state machine. State transitions are events on the event bus. Downstream domains react to transitions — billing listens for `episode.coded`; the EPD adapter listens for `episode.discharged`.

```
planned
  → admitted        (patient physically present)
  → active          (care underway)
  → discharge_pending
  → discharged      (patient left; EPD document generation triggered)
  → coded           (ICD-10 / CHOP coded by clinical coder)
  → billed          (SwissDRG / TARMED claim submitted)
  → closed
```

**Clinical actions cannot be added to an episode in `billed` or `closed` status.** This is enforced at the service layer — not just the UI. A composition write attempt against a closed episode returns a 409 Conflict with the episode status in the error body.

**Billing can only be submitted from `coded` status.** The billing domain's `submit_claim` function checks this precondition. It cannot be bypassed.

### 53.6 UI Enforcement — Episode Context

The UI makes it impossible to act without an explicit episode context.

**Single active episode**: the workspace opens directly into it. The Fallnummer is shown persistently in the header.

**Multiple active episodes**: an episode picker is mandatory before the clinical workspace opens. The system never guesses.

```
Patient: Müller, Hans   DOB: 1965-03-15

Active episodes:
  ● 2026-001234   Inpatient — Hüftersatz rechts          opened 2026-03-15
  ● 2025-001189   Ambulant  — Onkologie Nachsorge         opened 2025-11-02

Welche Episode bearbeiten Sie? →
```

The selected episode is held in application state for the duration of the session. Switching episode is an explicit act — a button in the header, always visible — and is logged in the audit trail with the user, timestamp, and both episode identifiers.

### 53.7 Cross-Episode Links

Some actions span episodes. These are explicit foreign key references, never automatic:

| Situation | Mechanism |
|---|---|
| Outpatient referral leading to an inpatient admission | `episodes.referred_from_episode_id` |
| Medication started inpatient, continued outpatient | Composition carries originating `episode_id`; continuation composition references it via `continuation_of_id` |
| Follow-up appointment booked at discharge | Slot carries `originating_episode_id` (the admission) and `target_episode_id` (the future outpatient episode, created on presentation) |
| Pathway spanning multiple episodes (e.g., surgical + rehab) | `pathway_instances.episode_id` is the current active episode; pathway definition may specify episode-type transitions |

Cross-episode links are navigable in the UI — a reference badge opens the linked episode in a read-only side panel without changing the active context.

### 53.8 Audit Capability

Because every action carries `episode_id`, the audit trail answers any question an insurer or cantonal authority may ask:

| Question | Query |
|---|---|
| What happened during Fall 2026-001234? | All compositions, orders, tasks, slots filtered by `episode_id` |
| What was billed for this episode? | `invoice_items` where `source_id` traces to this `episode_id` |
| Who acted on this episode and when? | `audit_log` filtered by `episode_id` |
| Which episodes used OR 3 on this date? | `slots` by resource + date joined to `episodes` |
| Which episodes are uncoded more than 3 days post-discharge? | `episodes` where `status = 'discharged'` and `discharged_at < now() - interval '3 days'` |

### 53.9 The Rule

> **The episode is the root context. The UI enforces it. The schema enforces it. Billing derives from it. Audit traces through it.**

---

