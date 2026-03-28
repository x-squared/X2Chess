## 13. Clinical Pathways

### 13.1 What a Clinical Pathway Is

A clinical pathway is a structured, evidence-based plan that specifies the sequence of clinical interventions, their timing, responsible roles, and expected outcomes for a specific diagnosis or procedure. It is the bridge between clinical guidelines and the actual care delivered to a specific patient.

Examples:
- **Hip replacement pathway**: pre-op assessment → day of surgery → PACU → ward day 1–3 with physio targets → discharge criteria → community follow-up
- **Sepsis bundle**: screening → blood cultures within 1 hour → antibiotics within 1 hour → fluid resuscitation → reassessment → ICU escalation criteria
- **Stroke pathway**: CT within 30 minutes → thrombolysis decision → stroke unit → daily rehabilitation milestones → discharge planning
- **Diabetic foot**: wound assessment → microbiological swab → imaging → vascular surgery consult → wound care protocol selection

Clinical pathways are distinct from SOPs (§14): a pathway tracks an individual patient through a care episode; an SOP defines how a specific procedure is performed by any staff member in any context.

### 13.2 The Three Layers of a Pathway

```
PathwayDefinition    — the template (authored by clinicians, versioned)
      │
PathwayInstance      — one per patient per episode (active tracking)
      │
StepInstance         — one per step per patient (actual vs expected)
```

### 13.3 Data Model

```sql
CREATE TABLE pathway_definitions (
  id          UUID PRIMARY KEY,
  code        TEXT NOT NULL,        -- 'hip_replacement_v3'
  title       TEXT NOT NULL,
  version     INT NOT NULL,
  status      TEXT NOT NULL,        -- 'draft','active','retired'
  department  TEXT,
  review_date DATE
);

CREATE TABLE pathway_steps (
  id                  UUID PRIMARY KEY,
  definition_id       UUID NOT NULL REFERENCES pathway_definitions,
  sequence            INT NOT NULL,
  name                TEXT NOT NULL,
  role                TEXT,         -- 'physician','nurse','physio',…
  expected_offset_h   INT,          -- hours after pathway start (or after prior step)
  offset_anchor       TEXT,         -- 'pathway_start' | 'previous_step'
  required_archetypes TEXT[],       -- archetypes that must be recorded to complete step
  order_set_id        UUID,         -- order set to fire on step activation (nullable)
  sop_id              UUID          -- linked SOP for this step (nullable)
);

CREATE TABLE pathway_instances (
  id              UUID PRIMARY KEY,
  definition_id   UUID NOT NULL REFERENCES pathway_definitions,
  patient_id      UUID NOT NULL,
  episode_id      UUID NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  current_step_id UUID REFERENCES pathway_steps,
  status          TEXT NOT NULL     -- 'active','completed','abandoned','variance'
);

CREATE TABLE pathway_step_instances (
  id              UUID PRIMARY KEY,
  instance_id     UUID NOT NULL REFERENCES pathway_instances,
  step_id         UUID NOT NULL REFERENCES pathway_steps,
  status          TEXT NOT NULL,    -- 'pending','active','completed','skipped','variance'
  activated_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,      -- computed: started_at + expected_offset
  variance_reason TEXT,
  composition_ids UUID[]            -- compositions recorded at this step
);
```

### 13.4 Pathway Execution Engine

The engine is event-driven and sits within the clinical domain. It watches the composition event stream — it does not watch the UI. A pathway advances whenever the right clinical data is recorded, regardless of whether the clinician was in a pathway context at the time.

A nurse doing a routine morning vitals round records `vital_signs.v3` from the standard ward board view. The engine sees the event, finds an active pathway step for that patient waiting for `vital_signs.v3`, checks the constraints, and advances the pathway. The nurse's workflow is unchanged. The pathway reflects reality.

```python
@on_event("composition.created")
async def evaluate_pathway_step(event: dict) -> None:
    # Find active pathway step instances waiting for this archetype —
    # regardless of which UI context the composition was created in.
    instances = await find_waiting_steps(
        patient_id=event["patient_id"],
        archetype_id=event["archetype_id"]
    )
    for step_instance in instances:
        # Temporal constraint: composition must postdate step activation
        if event["recorded_at"] < step_instance.activated_at:
            continue
        # Episode constraint (if step requires it)
        if step_instance.requires_same_episode:
            if event["episode_id"] != step_instance.episode_id:
                continue
        await record_step_composition(step_instance.id, event["composition_id"])
        if await step_criteria_met(step_instance):
            await complete_step(step_instance)
            await activate_next_step(step_instance.instance_id)

async def activate_next_step(instance_id: UUID) -> None:
    next_step = await get_next_step(instance_id)
    if not next_step:
        await complete_pathway(instance_id)
        return
    due_at = utcnow() + timedelta(hours=next_step.expected_offset_h)
    await create_step_instance(instance_id, next_step.id, due_at)
    if next_step.order_set_id:
        await fire_order_set(next_step.order_set_id, instance_id)
    await schedule_overdue_alert(instance_id, next_step.id, due_at)
```

**One composition can advance multiple pathways simultaneously.** A patient on both a hip replacement pathway and a diabetes management pathway: a blood glucose composition advances the relevant diabetes step; it is invisible to the hip replacement pathway. Each step specifies exactly which archetypes it waits for.

**Archetype specificity is the precision mechanism.** Steps that require deliberate clinical action must reference archetypes that are only recorded as deliberate acts:

| Step intent | Wrong archetype | Right archetype |
|---|---|---|
| Formal physician review milestone | `vital_signs.v3` (recorded routinely) | `physician_pathway_review.v1` (recorded only in that context) |
| Wound closure confirmation | `wound_assessment.v2` (any assessment) | `wound_closure_sign_off.v1` (deliberate act) |
| Physiotherapy mobilisation milestone | `observations.v1` | `physio_mobilisation_milestone.v1` |

Routine work advances steps that routine work should advance. Deliberate milestones require archetypes that are only recorded deliberately. The archetype library must be designed with this distinction in mind.

**UI consequence:** if the clinician is viewing the pathway when data is recorded, the step checks off immediately and the next step activates with visual feedback. If they are not viewing the pathway, the advance happens silently. The pathway view always reflects the current state whenever it is opened.

**Order sets** fire automatically when a step activates — the physician sees a pre-populated order set for approval, not a blank order screen. This is how guidelines translate into bedside action without requiring the clinician to remember every component.

**Overdue alerts** fire when a step's due time passes without completion. The alert goes to the responsible role (nurse, physician, or physio) and surfaces in the relevant app inbox.

### 13.5 Conditional Branching

Clinical pathways are directed graphs, not linear lists. A stroke pathway branches immediately at the CT result — ischaemic and haemorrhagic strokes require entirely different care. A sepsis pathway branches on culture results. A hip replacement pathway branches on post-operative complications.

#### Step Types

```sql
CREATE TYPE pathway_step_type AS ENUM (
  'task',       -- standard: activate, record required data, complete
  'decision',   -- evaluate transitions; activate exactly one branch (exclusive OR)
  'parallel',   -- activate all outgoing branches simultaneously
  'merge',      -- wait for all incoming branches before continuing
  'loop_start', -- marks start of a repeating segment
  'loop_end',   -- evaluates exit condition; repeats or exits
  'milestone'   -- informational marker; auto-completes on activation
);
```

#### Transitions and Conditions

Each step has outgoing transitions. A transition has an optional condition; if no condition or condition matches, the transition fires.

```sql
CREATE TABLE pathway_transitions (
  id            UUID PRIMARY KEY,
  definition_id UUID NOT NULL REFERENCES pathway_definitions,
  from_step_id  UUID NOT NULL REFERENCES pathway_steps,
  to_step_id    UUID NOT NULL REFERENCES pathway_steps,
  condition     JSONB,           -- NULL = unconditional
  is_default    BOOLEAN DEFAULT false,  -- taken if no other condition matches
  sequence      INT NOT NULL     -- evaluation order
);
```

Conditions are structured expressions — authorable by clinical informaticians, not programmers. They are evaluated against the projection store (fast typed reads, not raw composition JSONB).

```json
{
  "type": "and",
  "conditions": [
    {
      "type": "composition_value",
      "archetype": "troponin.v1",
      "path": "/value/magnitude",
      "operator": ">",
      "value": 99
    },
    {
      "type": "composition_value",
      "archetype": "ecg.v1",
      "path": "/interpretation",
      "operator": "in",
      "value": ["STEMI", "LBBB"]
    }
  ]
}
```

Supported operators: `equals`, `not_equals`, `>`, `>=`, `<`, `<=`, `in`, `not_in`, `exists`, `not_exists`. Compound: `and`, `or`, `not`. This covers all clinically meaningful conditions without requiring code.

#### Execution Engine — Branching Logic

```python
async def activate_next_steps(instance_id: UUID, completed_step_id: UUID) -> None:
    step = await get_step(completed_step_id)
    transitions = await get_transitions(step.definition_id, completed_step_id)

    if step.step_type == "parallel":
        # Activate all outgoing branches simultaneously
        for t in transitions:
            await activate_step(instance_id, t.to_step_id)

    elif step.step_type == "decision":
        # Evaluate conditions in sequence order; activate first match
        for t in sorted(transitions, key=lambda t: t.sequence):
            if t.condition is None:
                continue
            if await evaluate_condition(t.condition, instance_id):
                await activate_step(instance_id, t.to_step_id)
                return
        # Fall through to default branch
        default = next((t for t in transitions if t.is_default), None)
        if default:
            await activate_step(instance_id, default.to_step_id)
        else:
            await mark_decision_pending(instance_id, completed_step_id)

    elif step.step_type == "merge":
        # Only advance if all incoming branches are complete
        if await all_incoming_complete(instance_id, completed_step_id):
            for t in transitions:
                await activate_step(instance_id, t.to_step_id)

    elif step.step_type == "loop_end":
        condition = step.exit_condition
        if await evaluate_condition(condition, instance_id):
            for t in transitions:
                await activate_step(instance_id, t.to_step_id)  # exit loop
        else:
            await reset_loop(instance_id, step.loop_start_id)   # repeat

    else:
        # Sequential task: activate single next step
        for t in transitions:
            await activate_step(instance_id, t.to_step_id)
        if not transitions:
            await complete_pathway(instance_id)
```

#### Decision Pending

When a decision step's conditions cannot be evaluated (the required data has not yet been captured), the pathway pauses and surfaces a **"decision pending"** task to the responsible clinician. The task shows: what decision is needed, what data is missing, and the available branches to choose from.

Manual branch selection is always available — the clinician selects a branch with a documented reason. This is recorded as a variance. The pathway then continues on the manually selected branch.

#### Condition Evaluation

```python
async def evaluate_condition(condition: dict, instance_id: UUID) -> bool:
    match condition["type"]:
        case "composition_value":
            value = await get_projection_value(
                patient_id=...,
                archetype=condition["archetype"],
                path=condition["path"]
            )
            if value is None:
                return False  # data absent → condition not met
            return compare(value, condition["operator"], condition["value"])
        case "and":
            return all(
                await evaluate_condition(c, instance_id)
                for c in condition["conditions"]
            )
        case "or":
            return any(
                await evaluate_condition(c, instance_id)
                for c in condition["conditions"]
            )
        case "not":
            return not await evaluate_condition(condition["condition"], instance_id)
        case "score_value":
            # Computed scores (§12) are also queryable as condition inputs
            score = await get_latest_score(instance_id, condition["score_id"])
            return compare(score, condition["operator"], condition["value"])
```

Note: computed clinical scores (NEWS2, SOFA, etc.) are first-class inputs to pathway conditions — see §12.

---

### 13.6 Visual Presentation of Pathways

The same underlying pathway data serves two fundamentally different visual representations. Both are derived views — the data model does not change.

#### Full Graph View (authoring and clinical overview)

Presents the complete pathway structure: all steps, all branches, all possible routes. Used by:
- Clinical informaticians designing and reviewing pathways
- Clinicians who want to understand the full care plan for a patient before enrolment
- Quality review of pathway design

**Technology: React Flow + Dagre layout**

React Flow renders a node/edge graph with zoom, pan, and custom node components. Dagre automatically computes a left-to-right DAG layout from the step/transition data — no manual positioning required.

Custom node components per step type:

| Step type | Visual |
|---|---|
| `task` | Rounded rectangle; colour by status (grey/blue/green/amber/red) |
| `decision` | Diamond; outgoing edges labelled with condition summary |
| `parallel` | Horizontal bar (split); all outgoing edges activate |
| `merge` | Horizontal bar (join); waits for all incoming |
| `loop_end` | Circular arrow indicator on the step |
| `milestone` | Hexagon |

For a patient instance, nodes are coloured by `step_instance.status`: completed (green), active (blue), overdue (red), skipped (grey, dashed border), variance (amber). Unchosen branches are rendered faded but visible — the full graph always shows the complete structure.

#### Progress Strip (bedside and mobile)

A compact linear view showing only the path the patient is actually on. Used at the bedside, in the nurse and physician apps, and in the patient summary panel.

```
[✓] Admission assessment    09:15
[✓] CT scan                 09:47  (+17 min)
[◆] Ischaemic → thrombolysis branch selected
[✓] Thrombolysis decision   10:03
[●] Neurology review        due 11:00   ← active
[ ] 24h imaging             due 09:47 tomorrow
[ ] Stroke unit day 2       ...
```

Algorithm to compute the progress strip:
1. Start from pathway start step
2. Walk forward following only steps that have a `step_instance` for this patient
3. At decision nodes: show the condition result and the branch taken; hide unchosen branches
4. At parallel nodes: show branches inline, collapsed once all complete
5. Show the next N pending steps on the active branch (configurable, default 3)
6. Each step shows: name, expected time, actual time (if complete), delta

Overdue indicator: if `utcnow() > step_instance.due_at` and status is not completed, the step is highlighted in amber (approaching) or red (overdue by > 50% of the time window).

#### Timeline Axis

Both views support a timeline axis: absolute clock time on the horizontal axis, steps positioned at their expected or actual time. This reveals at a glance whether the patient is on schedule, ahead (unusual — may indicate a skipped step), or behind.

The timeline axis is especially useful for time-critical pathways (sepsis: antibiotics within 1 hour; stroke: thrombolysis within 4.5 hours). The visual makes deadline pressure immediately apparent without reading numbers.

#### Pathway Authoring Tool

The full graph view doubles as the authoring tool when in edit mode:
- Drag to create steps and connect them with transitions
- Click a transition to configure its condition using a structured condition builder (no code entry — dropdowns for archetype, path, operator, value)
- Step properties panel: name, type, expected offset, required archetypes, order set, SOP link
- Preview: renders the pathway as it will appear to a patient instance

Authored pathways are serialised to `PathwayDefinition` JSON and loaded into the registry. Version increments are explicit; the previous version remains active for existing patient instances.

---

### 13.7 Variance Management

Variance — deviation from the expected pathway — is clinically important. It is where complications occur and where quality improvement insight lives.

Variance must be documented with minimal friction. The design is:
- When a step is marked skipped or overdue, the app presents a short reason picker (coded reasons, e.g. "patient declined", "clinical contraindication", "patient transferred", "resource unavailable") plus optional free text
- Variance reason is stored on the `step_instance`
- Aggregate variance data feeds a quality dashboard — which steps are most frequently varied, which reasons predominate, which patient subgroups deviate

Variance documentation must take no more than two taps. If it requires more effort than not documenting, it will not be documented.

### 13.8 Pathway and the "Data Model First" Principle

A pathway step that requires data capture references an archetype — not a bespoke form. When a nurse navigates to a patient's active pathway, the current step links directly to the standard form engine (§45.3). The pathway provides the context ("you are on step 3 of the hip replacement pathway"); the archetype provides the structure ("record pain score, mobility assessment, and wound inspection").

No bespoke per-pathway UI is written. The pathway is a sequence of archetype references, timing rules, and role assignments.

### 13.9 Pathway Authoring

Pathways are authored in a structured editor — not as Word documents. The authoring tool produces a `PathwayDefinition` JSON that is loaded into the registry. Version transitions are explicit: when v4 of a pathway is activated, existing patient instances on v3 continue on v3; new patients start on v4. The version in use at any point is always recoverable from the `pathway_instances` table.

---

