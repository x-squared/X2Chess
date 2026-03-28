## 46. Multi-Granularity and Multi-Perspective Clinical Data

### 46.1 The Problem

Archetypes define structure and enforce validity, but they do not by themselves solve a deeper problem: the same clinical concept must be captured at different levels of detail in different contexts, and different specialties interpret the same data differently.

**The smoking example** illustrates all three layers of this problem:

| Context | What is needed |
|---|---|
| ED triage | Smoker: yes / no / ex |
| GP chronic disease review | Current status + pack-years |
| Anaesthetics pre-assessment | Pack-years + how long smoke-free |
| Oncology intake | Full lifetime history: types, amounts, quit dates, cessation attempts |

The data captured in one context must be usable in all others — but the system cannot demand oncology-level detail from a triage nurse.

### 46.2 Archetype Specialisation

openEHR's formal answer is **archetype specialisation**: a specialised archetype is a valid instance of its parent. Software that understands the parent can read any specialisation of it.

```
tobacco_use.v1  (base)
  ├── status: current | ex | never
  └── [optional slot]
        └── tobacco_smoking_summary.v1  (specialised)
              ├── pack_years: DV_QUANTITY
              ├── episodes[]
              │     ├── start_date
              │     ├── end_date
              │     ├── tobacco_type: cigarette | pipe | cigar | vaping
              │     └── daily_amount: DV_QUANTITY
              └── cessation_attempts[]
```

**Templates compose archetypes per clinical context.** The triage template includes the base archetype only. The oncology template includes the full specialisation. Same underlying concept; different templates determine what is asked and what is stored.

### 46.3 Derivability Asymmetry

Specialisation handles structure. A further problem is that derivability is asymmetric:

- Full smoking history → current status: **always derivable** ✓
- "Smoker: yes" → pack-years: **not derivable** ✗

The system must know this asymmetry and communicate it to consumers. A **semantic mapping registry** records which fields can be derived from which archetypes and how:

```python
class ArchetypeSemanticMap:
    # Subsumption: which archetypes are specialisations of which
    subsumes = {
        "tobacco_smoking_summary.v1": ["tobacco_use.v1"],
    }

    # Derivation rules: how to derive a simpler field from a richer archetype
    derivations = {
        ("tobacco_use.v1", "status"): [
            DerivationRule(
                source_archetype="tobacco_smoking_summary.v1",
                source_path="/episodes[-1]/end_date",
                logic="if end_date is not null → 'ex', else 'current'"
            )
        ]
    }
```

When a consumer queries for `tobacco_use.v1/status` and only a `tobacco_smoking_summary.v1` composition exists, the query engine derives the answer automatically. When the reverse is requested and only simple data exists, the engine returns the data with a `completeness: false` flag — not a wrong answer, but an honest one.

### 46.4 Projections With Completeness Flags

Projection tables materialise multiple granularities from the same composition store, with explicit provenance:

```sql
CREATE TABLE smoking_summary (
  patient_id       UUID PRIMARY KEY,
  current_status   TEXT,          -- 'current','ex','never' — always available if any record exists
  pack_years       NUMERIC,       -- NULL if only simple capture available
  last_quit_date   DATE,          -- NULL if not recorded
  detail_available BOOLEAN,       -- false if only tobacco_use.v1 base captured
  last_updated     TIMESTAMPTZ,
  source_comp_id   UUID           -- which composition this was derived from
);
```

Consumers know whether the answer is fully grounded or partially derived and can act accordingly — flag "incomplete history" in an oncology workflow, accept it as sufficient for a GP summary.

### 46.5 Named Views Per Clinical Context

Different specialties need different projections of the same data. These are defined as **named view definitions** — data, not code. A new specialty view is a new JSON file, not a new component or query function.

```json
{
  "view_id": "anaesthetics.smoking_cessation",
  "label": "Smoking cessation status",
  "archetype_path": "tobacco_smoking_summary.v1/episodes",
  "derived_field": "most_recent_quit_date",
  "fallback": "tobacco_use.v1/status == 'ex'",
  "completeness_required": false
}
```

```json
{
  "view_id": "oncology.cumulative_tobacco_exposure",
  "label": "Cumulative tobacco exposure",
  "archetype_path": "tobacco_smoking_summary.v1/pack_years",
  "fallback": null,
  "completeness_required": true
}
```

The query engine selects the named view for the consumer's context, resolves derivations and subsumption, and returns a completeness flag alongside the data.

### 46.6 SNOMED CT Subsumption

When smoking status is coded — as it must be for interoperability — a further correctness problem appears. SNOMED CT encodes tobacco use as a hierarchy:

```
77176002  | Smoker |
  ├── 230059006  | Cigarette smoker |
  │     └── 56294008  | Heavy cigarette smoker |
  ├── 228501002  | Pipe smoker |
  └── 722496004  | Cigar smoker |
```

A query for "smoker" using flat code equality silently misses "heavy cigarette smoker." The query engine must resolve codes against a loaded SNOMED CT subsumption table before executing any coded-value query. This is not optional for clinical correctness.

```sql
-- Pre-computed subsumption closure (loaded from SNOMED CT release)
CREATE TABLE snomed_subsumption (
  ancestor_code TEXT NOT NULL,
  descendant_code TEXT NOT NULL,
  PRIMARY KEY (ancestor_code, descendant_code)
);

-- Query for all smokers — catches all subtypes
SELECT DISTINCT c.ehr_id
FROM compositions c
JOIN snomed_subsumption s
  ON s.ancestor_code = '77176002'
 AND c.content @> jsonb_build_object('status_code', s.descendant_code)
WHERE c.archetype_id IN ('tobacco_use.v1', 'tobacco_smoking_summary.v1');
```

### 46.7 Summary: What Archetypes Do and Do Not Solve

| Problem | Solution |
|---|---|
| Structure and validation of clinical data | Archetype definition + validator |
| Same concept at different granularities | Archetype specialisation + templates per context |
| Deriving simple answers from detailed data | Semantic mapping registry with derivation rules |
| Different perspectives on the same data | Named view definitions (data, not code) |
| Communicating incomplete data honestly | Completeness flags on projections |
| Coded value queries matching subtypes | SNOMED CT subsumption table in query engine |

---

