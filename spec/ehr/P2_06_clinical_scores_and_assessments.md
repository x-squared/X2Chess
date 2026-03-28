## 11. Clinical Scores and Assessments

### 11.1 Scores Catalogue

Clinical scores are first-class system entities — not embedded in free-text notes. Each score has a versioned definition (items, weights, thresholds, alert levels) and is evaluated against structured input data. Scores are triggered:

- Automatically on a schedule (e.g., NEWS2 every 4 h on monitoring wards)
- Automatically on a data event (e.g., lab result triggers SOFA recalculation)
- Manually by any clinician or nurse

**Standard scores at admission and during stay:**

| Score | Domain | Alert threshold |
|---|---|---|
| NRS 2002 | Nutritional risk | ≥ 3 → dietitian referral order |
| Braden Scale | Pressure injury risk | ≤ 12 → prevention protocol order |
| Morse Fall Scale | Falls risk | ≥ 45 → falls-prevention flag + order set |
| NEWS2 | Clinical deterioration | ≥ 5 → rapid-response alert; ≥ 7 → critical alert |
| GCS | Consciousness level | Change ≥ 2 → physician alert |
| SOFA / qSOFA | Sepsis severity | qSOFA ≥ 2 → sepsis workup order set |
| Pain (NRS 0–10) | Pain level | ≥ 7 → PRN analgesia review trigger |
| AUDIT-C | Alcohol risk | ≥ 4 → brief intervention referral |
| PHQ-2 / PHQ-9 | Depression screen | PHQ-2 positive → PHQ-9; PHQ-9 ≥ 10 → psychiatric liaison referral |
| CAM | Delirium | CAM positive → delirium care bundle activation |

### 11.2 Score Alert Functions

Each score definition includes a set of **alert functions** — rules that fire when a score crosses a threshold:

- Generate a clinical alert (visible in patient header and nursing board)
- Create a task for a specific role (e.g., "Dietitian assessment requested")
- Activate an order set (e.g., falls-prevention bundle)
- Activate an SOP reference (e.g., "Delirium care bundle — SOP-078")
- Notify via push notification to the responsible clinician's mobile device

Alert functions are configurable per institution without code change — they are rule-set entries (§56.1). New scores can be added by clinical informatics staff using the score definition editor; no developer involvement is required for new scoring instruments.

### 11.3 Assessment Forms Beyond Scores

Beyond numeric scoring tools, the system supports structured assessment forms for domains that require narrative alongside structured data: wound assessment, pain quality (character, radiation, aggravating factors), functional assessment (Barthel Index), and cognitive assessment (MMSE/MoCA). These forms are rendered from a form-definition schema (same mechanism as the admission interview — §16.1) and stored as structured compositions.

### 11.4 ICU Score Visualisation

ICU scores are high-stakes values assessed under cognitive load. Display standards:

- **Current value**: large numeral with colour band — green (low risk) / amber (warning) / red (critical) — sized for visibility at 1–2 m
- **Trend sparkline**: compact 24-hour sparkline with a direction arrow (↑↓→) for the last 4 h
- **Threshold markers**: critical thresholds drawn on the sparkline and any trend chart
- **Component breakdown**: expanding a score shows its contributing items and values (e.g., SOFA by organ system)
- **Staleness indicator**: scores not updated within their scheduled interval are shown with a warning

**Score timeline view:** Each score can be expanded to a full-width chart over the ICU stay, with clinical event annotations (intubation, surgery, antibiotic start, culture results) as vertical markers — providing immediate visual correlation between events and score trajectory.

### 11.5 SOFA Score — Automated Computation Example

SOFA demonstrates how a complex ICU score is derived from data already in the system with no additional manual entry.

**Components and data sources:**

| SOFA component | Points 0→4 | Data source |
|---|---|---|
| Respiratory (P/F ratio) | PaO₂/FiO₂ > 400 → < 100 | Blood gas (PaO₂) from lab + FiO₂ from ventilator device stream |
| Coagulation (platelets) | > 150 → < 20 × 10⁹/L | Lab composition |
| Hepatic (bilirubin) | < 1.2 → > 12 mg/dL | Lab composition |
| Cardiovascular (MAP / vasopressors) | MAP ≥ 70 → dopamine > 15 or adrenaline > 0.1 µg/kg/min | MAP from monitor stream + vasopressor infusion from medication record |
| Neurological (GCS) | 15 → < 6 | GCS composition |
| Renal (creatinine / urine output) | Cr < 1.2 → > 3.5 mg/dL or UO < 0.5 ml/kg/h | Lab composition + urine output from fluid balance projection |

**Computation trigger:** SOFA is recalculated whenever any input is updated. It runs as a background task, writes a new `severity_score.v1` composition, and updates the SOFA projection table. If a component input is unavailable, the last known value is used with a staleness flag; missing values entirely are scored 0 with an explicit "data unavailable" marker.

### 11.6 Score Definition Editor

New scores and revisions are added by clinical informatics staff without developer involvement. The editor produces a versioned score definition stored as a configuration object.

**Definition components:**
- **Items**: data source binding (composition field or time series parameter), scoring table (value range → points)
- **Aggregation rule**: sum / maximum / custom expression
- **Threshold levels**: named risk levels with colours and alert function bindings (§11.2)
- **Calculation schedule**: event-driven (on data update) and/or time-scheduled (e.g., every 4 h)
- **Staleness policy**: maximum input age before the score is flagged as stale

Score definitions follow the same governance cycle as rule-sets (§56.1): draft → clinical informatics review → attending approval → active. Historical score values are always recalculable from the version active at the time.

---



### 11.7 Scores as Derived Compositions

A clinical score (NEWS2, SOFA, APACHE II, GCS, Wells, CHA₂DS₂-VASc, etc.) is a computed value derived from composition data. It is treated as a first-class composition — stored in the composition store with archetype `score_result.v1`, indexed in the time series table, queryable in the projection store, and available as a pathway condition input (§13.5).

Scores are not computed on read. They are computed by the score engine in response to `composition.created` events and stored. Reading a score is always a fast projection lookup.

### 11.8 Score Definition as Configuration

A score is defined entirely as data — no code required. The definition specifies:
- Which archetype fields feed the score
- The formula or lookup table mapping input values to component scores
- The aggregation function (sum, max, weighted sum)
- The output thresholds and their clinical meaning

```json
{
  "score_id": "news2.v1",
  "name": "NEWS2",
  "description": "National Early Warning Score 2",
  "components": [
    {
      "id": "resp_rate",
      "label": "Respiratory rate",
      "archetype": "vital_signs.v3",
      "path": "/respiratory_rate/magnitude",
      "lookup": [
        { "range": [0, 8],   "points": 3 },
        { "range": [9, 11],  "points": 1 },
        { "range": [12, 20], "points": 0 },
        { "range": [21, 24], "points": 2 },
        { "range": [25, null],"points": 3 }
      ]
    },
    {
      "id": "spo2",
      "label": "SpO₂ (Scale 1)",
      "archetype": "vital_signs.v3",
      "path": "/spo2/magnitude",
      "lookup": [
        { "range": [0, 91],   "points": 3 },
        { "range": [92, 93],  "points": 2 },
        { "range": [94, 95],  "points": 1 },
        { "range": [96, 100], "points": 0 }
      ]
    },
    {
      "id": "consciousness",
      "label": "Consciousness",
      "archetype": "vital_signs.v3",
      "path": "/avpu",
      "lookup": [
        { "value": "A", "points": 0 },
        { "value": "C", "points": 3 },
        { "value": "V", "points": 3 },
        { "value": "P", "points": 3 },
        { "value": "U", "points": 3 }
      ]
    }
  ],
  "aggregation": "sum",
  "thresholds": [
    { "range": [0, 4],   "level": "low",    "label": "Low risk",    "action": "routine" },
    { "range": [5, 6],   "level": "medium", "label": "Medium risk", "action": "urgent_review" },
    { "range": [7, null],"level": "high",   "label": "High risk",   "action": "emergency" }
  ],
  "triggers_on": ["vital_signs.v3"]
}
```

Adding a new score: add a JSON definition to the score registry. No code change. The score engine evaluates it using the same expression evaluator as pathway conditions.

### 11.9 Score Engine

```python
@on_event("composition.created")
async def evaluate_scores(event: dict) -> None:
    # Find all score definitions that trigger on this archetype
    score_defs = score_registry.triggered_by(event["archetype_id"])
    for score_def in score_defs:
        result = await compute_score(score_def, event["patient_id"], event["episode_id"])
        if result is not None:
            await store_score_result(score_def.score_id, event["patient_id"], result)
            await update_score_projection(score_def.score_id, event["patient_id"], result)
            await check_score_thresholds(score_def, result, event["patient_id"])

async def compute_score(score_def: ScoreDef, patient_id: UUID, episode_id: UUID) -> ScoreResult | None:
    components = {}
    for comp in score_def.components:
        value = await get_projection_value(patient_id, comp.archetype, comp.path)
        if value is None and comp.required:
            return None   # insufficient data — score not computable
        components[comp.id] = apply_lookup(comp.lookup, value)
    total = aggregate(score_def.aggregation, components.values())
    threshold = classify(score_def.thresholds, total)
    return ScoreResult(total=total, components=components, threshold=threshold)
```

### 11.10 Threshold Alerts

When a score crosses a threshold, the engine fires an alert via the notification system (§51.7):
- NEWS2 ≥ 7 → Critical alert to responsible nurse + on-call physician
- NEWS2 5–6 → Urgent alert to responsible nurse
- SOFA increase ≥ 2 → Urgent alert in ICU context

Threshold alert definitions are part of the score definition JSON — same configuration pattern.

### 11.11 Score Visualisation

Scores are time series values (stored in the time series infrastructure, §47). They render on the same chart infrastructure as vitals — a NEWS2 trend over 24 hours sits alongside heart rate and respiratory rate, sharing the same time axis. This makes the relationship between raw observations and the computed score immediately visible.

For the progress strip (ward board, mobile), the current score for each patient is shown as a coloured badge — green/amber/red — beside the patient name. This is derived from the score projection table: a single indexed lookup per patient.

---

