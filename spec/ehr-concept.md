# EHR/EPR/EMR System — Concept & Architecture

## 1. Terminology

| Term | Meaning |
|---|---|
| **EMR** | Electronic Medical Record — digital chart within one practice or hospital |
| **EPR** | Electronic Patient Record — broader term common in UK/EU; covers a single provider's full record |
| **EHR** | Electronic Health Record — designed to share across providers and systems |

This document describes a full **EHR** — all functional domains, all patient data, shareable across providers.

---

## 2. Functional Domains

### 2.1 Patient Administration
- Demographics, identifiers (AHV-Nummer / NAVS13 in Switzerland)
- Admissions, discharges, transfers (ADT)
- Scheduling and appointment booking
- Insurance registration and eligibility

### 2.2 Clinical Documentation
- Encounter notes, assessments, care plans
- Discharge summaries
- Structured and unstructured documentation
- Consent records

### 2.3 Orders & Results
- CPOE (computerised physician order entry)
- Laboratory orders and results
- Radiology orders and reports
- Referrals

### 2.4 Medication Management
- Prescribing (with drug interaction and allergy checking)
- Dispensing
- Medication administration records (MAR)
- Reconciliation on admission/discharge

### 2.5 Observations & Vitals
- Vital signs, NEWS2 / early warning scores
- Fluid balance
- Wound care records
- Device-streamed observations (ICU monitors, etc.)

### 2.6 Coding & Billing
- ICD-10 / SNOMED CT diagnosis coding
- SwissDRG (inpatient), TARMED / TARDOC (ambulatory)
- Cost centre allocation
- Insurance claims and invoicing

### 2.7 Clinical Decision Support
- Drug interaction alerts
- Clinical pathways and protocols
- Sepsis and deterioration screening
- Evidence-based order sets

### 2.8 Resource Planning
Resources are first-class entities, not subordinate to scheduling:

- **People**: clinicians, nurses, admin staff, on-call rosters, skill sets, certifications, FTE
- **Teams**: ward teams, MDT groups, on-call groups, shift patterns
- **Locations**: sites, buildings, wards, rooms, beds — hierarchical
- **Devices & equipment**: infusion pumps, ventilators, imaging equipment — with capabilities and maintenance schedules
- **Consumables**: blood products, sterile kits — tracked against care episodes

Resource planning cross-cuts all other domains. An appointment, a procedure, a bed assignment, and a lab draw all consume resources. Resource is a first-class entity in the data model.

---

## 3. Regulatory Context — Switzerland (TakeCH / EPDG)

### 3.1 Key Legislation
- **EPDG** (Bundesgesetz über das elektronische Patientendossier) — federal law mandating EPD participation for hospitals; voluntary for patients
- **EPDV** — implementing ordinance

### 3.2 EPD Communities
Switzerland's EPD is federated through cantonal communities:
- CARA (Romandie)
- axsana (Zurich / Central Switzerland)
- eHealth Aargau
- Others per canton

The system must federate with whichever community serves its patients.

### 3.3 Mandated Standards
- **IHE profiles**: XDS.b (document sharing), PIX/PDQ (patient identity cross-referencing), ATNA (audit trail and node authentication), MHD (mobile health documents), XUA (cross-enterprise user authentication)
- **HL7 FHIR R4** — Swiss national profiles (CH Core, CH EPD)
- **eCH-0107** — Swiss patient identifier (AHV-Nummer / NAVS13 as root identity)
- **Swiss SNOMED CT** national extension
- **Trilingual terminology**: German, French, Italian minimum

### 3.4 Billing Standards
- SwissDRG for inpatient
- TARMED / TARDOC for ambulatory
- Swiss tariff point values per canton

### 3.5 Security & Compliance
- GDPR-compatible data protection (nDSG — revidiertes Datenschutzgesetz)
- Role-based access control to field level
- Full audit trail: every read, write, and delete logged with user identity and timestamp
- Break-glass access for emergencies with post-hoc audit
- Encryption at rest and in transit

---

## 4. Design Principles

Four non-negotiable architectural demands shape all decisions:

1. **Performance** — sub-100ms for common clinical queries; predictable latency under load
2. **Modularity** — domains are independently deployable and independently evolvable
3. **Data model first** — the data model defines structure and meaning; views and forms are derived from it, never the reverse
4. **Extensibility** — new clinical concepts, new resource types, and new billing rules must be addable without schema migrations and without modifying existing code

---

## 5. Data Architecture Philosophy

### 5.1 Data Model First

The system's defining architectural principle: **the data model is the source of truth for structure and meaning**. UI forms, reports, and API responses are derived from the data model. No bespoke form code exists that is not grounded in a formal data definition.

This eliminates a class of common EHR failure: forms that diverge from the underlying model, or data that cannot be queried because it was captured in an ad-hoc string field.

### 5.2 Two-Level Modelling (openEHR Influence)

Clinical knowledge is separated into two levels:

| Level | What it defines | Who controls it | Stability |
|---|---|---|---|
| **Reference Model (RM)** | Generic structures — Composition, Observation, Element, data types | International standard | Stable for years |
| **Archetypes / Schemas** | Clinical knowledge — what data a blood pressure observation must contain | Clinical informaticians | Evolves with practice |

Software only needs to understand the Reference Model. New clinical concepts add archetypes; no software change is required.

### 5.3 Hierarchical Nature of Clinical Data

Clinical data is inherently hierarchical:

```
Patient
  └── Episodes (admission, outpatient, etc.)
        └── Encounters / Compositions
              ├── Observations (vitals, test results)
              ├── Instructions (orders, prescriptions)
              ├── Actions (administered medications, procedures)
              └── Evaluations (diagnoses, care plans)
```

This shape maps poorly to flat relational tables. Forcing it into rows and columns requires many joins to reconstruct a single encounter and introduces impedance mismatch between the clinical model and the storage model.

---

## 6. The MUMPS Lesson — Epic Systems

### 6.1 What Epic Uses

Epic Systems — the dominant EHR in the US — is built on **MUMPS** (Massachusetts General Hospital Utility Multi-Programming System, 1966), implemented via InterSystems Caché / IRIS. This is a persistent, sparse, multidimensional hierarchical key-value store with a built-in programming language.

Data is stored in "globals":

```
^PATIENT(12345, "NAME")              = "Müller, Hans"
^PATIENT(12345, "DOB")               = "19650315"
^PATIENT(12345, "ENC", 1, "DATE")    = "20240115"
^PATIENT(12345, "ENC", 1, "DX", 1)  = "J18.9"
^PATIENT(12345, "ENC", 1, "DX", 2)  = "I10"
^PATIENT(12345, "ENC", 1, "MED", 1) = "Metformin 500mg"
^PATIENT(12345, "ENC", 2, "DATE")    = "20240220"
```

Access is by direct key traversal — no query planner, no JOIN, no ORM.

### 6.2 Why It Works

**Clinical data is naturally hierarchical.** MUMPS maps patient → episode → encounter → data directly. A relational schema requires 6+ joins to reconstruct an encounter; MUMPS traverses a known path in one operation.

**No schema migrations.** New fields are added by simply storing them. Sparse storage means old records without the new field incur no overhead. Epic has added fields for 45 years without ALTER TABLE.

**Predictable performance.** No query planner means no bad plan surprises. Access patterns are explicit in code; latency is consistent.

**Sparse data is free.** A psychiatric record and an oncology record look nothing alike. MUMPS stores exactly what exists — no NULLs, no polymorphic complexity.

### 6.3 The Costs

**Reporting requires a separate system.** Epic's **Clarity** (SQL Server / Oracle relational) is a full ETL copy used for all reporting and analytics. MUMPS cannot support ad-hoc queries efficiently. Two databases, an ETL pipeline, and lagged analytical data are the operational price.

**Proprietary and expensive.** InterSystems IRIS licensing is significant. The developer ecosystem is small.

**Interoperability is a façade.** Epic's FHIR API translates MUMPS globals into FHIR resources on demand — it is not natively FHIR.

### 6.4 Lessons for Greenfield Design

| MUMPS insight | How to apply |
|---|---|
| Hierarchical storage fits clinical data | Document/JSONB storage for compositions |
| Schema flexibility is operationally critical | JSONB + JSON Schema validation, not rigid columns |
| Explicit access paths outperform query planner | Explicit indexes per query path, not generic SQL |
| OLTP and OLAP must be separated | Operational store + analytical projections from day one |

---

## 7. Technology Stack

### 7.1 Backend — Python

```
FastAPI (async)
  ├── Granian (ASGI server — higher throughput than Uvicorn for sustained load)
  ├── asyncpg (direct PostgreSQL driver — bypasses ORM for hot paths)
  ├── Pydantic v2 (Rust-core validation — fast enough for request-path use)
  ├── Redis (caching, pub/sub, session state)
  └── ARQ / Celery (background tasks — report generation, notifications, projections)
```

### 7.2 Frontend — TypeScript / React

```
React 19
  ├── TanStack Query (server state, cache, background refetch)
  ├── TanStack Router (type-safe, code-split routing)
  ├── TanStack Virtual (virtualised lists — large ward/result grids)
  ├── Zustand (local UI state — lightweight)
  └── Vite (build, code splitting by domain)
```

### 7.3 Database

```
PostgreSQL (primary)
  ├── Clinical compositions    — JSONB document store
  ├── Projection tables        — materialised, typed, fast reads
  ├── Resource / scheduling    — relational with gist exclusion constraints
  ├── Billing                  — relational
  └── Audit log                — append-only, partitioned by month

ClickHouse or DuckDB (analytical)
  — Fed by event stream from PostgreSQL
  — Population health, reporting, billing analytics
  — Never queried by operational code paths

Redis
  — Session state
  — Hot projections (latest vitals per patient)
  — Pub/sub for real-time ward updates
```

### 7.4 Performance-Critical Decisions

- **asyncpg directly** for high-frequency reads — SQLAlchemy ORM adds measurable overhead at scale
- **Archetype schemas cached in memory** at startup — never re-parsed per request
- **Projection tables always current** — updated by PostgreSQL `LISTEN/NOTIFY` event stream asynchronously; operational reads never hit raw compositions
- **Code splitting by domain** — a ward nurse never loads the pharmacy or billing bundle
- **WASM for client-side computation** — drug interaction checking, early warning scores, scheduling conflict detection run in-browser (Rust → WASM), reducing server round-trips and enabling offline use
- **Optimistic UI** for high-frequency actions — observations, medication administration records update immediately; reconciled in background
- **Offline-first for ward devices** — Service Worker + IndexedDB; sync on reconnect

---

## 8. Data Model

### 8.1 Bounded Contexts

Each domain is a bounded context: it owns its schema, its service layer, its projections. Domains communicate through events and shared identifiers — never through cross-domain table joins.

```
┌─────────────────────────────────────────────────────┐
│                   Shared Kernel                     │
│   patient_id · episode_id · user_id · event_log     │
└─────────────────────────────────────────────────────┘
        │              │              │
┌───────────┐  ┌───────────────┐  ┌──────────────┐
│ Clinical  │  │  Scheduling   │  │   Billing    │
│ Records   │  │  & Resources  │  │   & Cost     │
└───────────┘  └───────────────┘  └──────────────┘
        │              │              │
┌───────────┐  ┌───────────────┐  ┌──────────────┐
│  Patient  │  │   Rostering   │  │  Insurance   │
│  Admin    │  │   & Shifts    │  │  & Claims    │
└───────────┘  └───────────────┘  └──────────────┘
```

### 8.2 Clinical Record Store

```sql
-- Append-only composition store — document model
-- One row per clinical record unit (vital signs, medication order, etc.)
CREATE TABLE compositions (
  id             UUID PRIMARY KEY,
  ehr_id         UUID NOT NULL,
  episode_id     UUID NOT NULL,
  archetype_id   TEXT NOT NULL,       -- e.g. 'vital_signs.v3'
  recorded_at    TIMESTAMPTZ NOT NULL,
  recorded_by    UUID NOT NULL,
  content        JSONB NOT NULL       -- full composition, hierarchical, sparse
);

CREATE INDEX ON compositions (ehr_id, episode_id);
CREATE INDEX ON compositions (archetype_id, recorded_at DESC);
CREATE INDEX ON compositions USING GIN (content);

-- Explicit index per known high-frequency query path
CREATE INDEX idx_comp_vitals_hr
  ON compositions ((content -> 'heart_rate' -> 'magnitude'))
  WHERE archetype_id = 'vital_signs.v3';

-- Projection: latest values per patient — always current, never computed on read
CREATE TABLE latest_vitals (
  ehr_id      UUID PRIMARY KEY,
  heart_rate  INT,
  bp_systolic INT,
  bp_diastolic INT,
  temperature NUMERIC,
  spo2        INT,
  updated_at  TIMESTAMPTZ
);
```

Compositions are **immutable and append-only** — corrections create new compositions with a reference to the superseded one. This gives audit for free and makes undo trivial.

Projections are updated asynchronously via the event stream. Operational reads always hit projections, never raw compositions. This is the MUMPS access pattern translated to PostgreSQL.

### 8.3 Resource Domain

```sql
CREATE TABLE resources (
  id            UUID PRIMARY KEY,
  resource_type TEXT NOT NULL,   -- 'person','team','location','device','consumable'
  display_name  TEXT NOT NULL,
  active        BOOLEAN DEFAULT true,
  attributes    JSONB            -- extensible domain-specific metadata
);

-- Typed subtables per resource kind
CREATE TABLE resource_persons (
  resource_id    UUID PRIMARY KEY REFERENCES resources,
  staff_role     TEXT,
  qualifications TEXT[],
  fte            NUMERIC
);

CREATE TABLE resource_locations (
  resource_id   UUID PRIMARY KEY REFERENCES resources,
  parent_id     UUID REFERENCES resource_locations,  -- tree: site→ward→room→bed
  location_type TEXT,
  capacity      INT
);

CREATE TABLE resource_devices (
  resource_id      UUID PRIMARY KEY REFERENCES resources,
  device_type      TEXT,
  serial_number    TEXT,
  capabilities     TEXT[],
  next_maintenance TIMESTAMPTZ
);

-- Extensibility: namespaced per-resource extension fields
CREATE TABLE resource_extensions (
  resource_id UUID NOT NULL REFERENCES resources,
  namespace   TEXT NOT NULL,   -- e.g. 'ch.spital-bern.wound-care'
  key         TEXT NOT NULL,
  value       JSONB NOT NULL,
  PRIMARY KEY (resource_id, namespace, key)
);
```

### 8.4 Scheduling Domain

```sql
CREATE TABLE slots (
  id            UUID PRIMARY KEY,
  resource_id   UUID NOT NULL REFERENCES resources,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  slot_type     TEXT NOT NULL,   -- 'appointment','block','maintenance','on_call'
  episode_id    UUID,            -- nullable: link to clinical domain
  booked_by     UUID,
  status        TEXT NOT NULL,   -- 'available','booked','blocked','completed'
  -- Database-enforced no double-booking:
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
);

CREATE TABLE rosters (
  id          UUID PRIMARY KEY,
  staff_id    UUID NOT NULL REFERENCES resources,
  team_id     UUID REFERENCES resources,
  shift_start TIMESTAMPTZ NOT NULL,
  shift_end   TIMESTAMPTZ NOT NULL,
  role        TEXT
);
```

The `EXCLUDE USING gist` constraint enforces no double-booking at the database level — this invariant cannot be violated regardless of application logic.

### 8.5 Billing & Cost Domain

```sql
CREATE TABLE tariff_codes (
  id          UUID PRIMARY KEY,
  system      TEXT NOT NULL,   -- 'TARMED','SwissDRG','TARDOC'
  code        TEXT NOT NULL,
  description TEXT,
  valid_from  DATE,
  valid_to    DATE
);

CREATE TABLE cost_centers (
  id        UUID PRIMARY KEY,
  name      TEXT NOT NULL,
  parent_id UUID REFERENCES cost_centers   -- tree
);

CREATE TABLE invoices (
  id         UUID PRIMARY KEY,
  patient_id UUID NOT NULL,
  episode_id UUID NOT NULL,
  issued_at  TIMESTAMPTZ,
  status     TEXT,            -- 'draft','submitted','paid','rejected'
  insurer_id UUID
);

CREATE TABLE invoice_items (
  id             UUID PRIMARY KEY,
  invoice_id     UUID NOT NULL REFERENCES invoices,
  tariff_code_id UUID REFERENCES tariff_codes,
  quantity       NUMERIC,
  unit_price     NUMERIC,
  cost_center_id UUID REFERENCES cost_centers,
  source_type    TEXT,    -- 'composition','slot','device_use' — polymorphic ref
  source_id      UUID
);
```

`source_type` / `source_id` traces every charge back to the clinical or resource event that generated it. Billing derives from clinical and resource data without importing their schemas.

### 8.6 PostgreSQL Schema Layout

```
One PostgreSQL cluster, multiple schemas:

  shared.*        patient_id master, user_id master, event_log
  clinical.*      compositions, projections, archetype registry
  scheduling.*    slots, rosters
  resources.*     resource registry, subtables, extensions
  billing.*       invoices, tariff codes, cost centres
  patient_admin.* demographics, episodes, insurance
  audit.*         append-only, partitioned by month
```

One schema per bounded context. Cross-domain foreign keys only via `shared.*` identifiers.

---

## 9. Archetype System

### 9.1 What an Archetype Is

An archetype is a formal, versioned definition of a clinical concept — what data a "blood pressure observation" must contain, what data types are used, what units are valid, what terminology codes apply.

Archetypes are stored as JSON Schema (derived from the international openEHR Archetype Definition Language / ADL format):

```json
{
  "archetype_id": "openEHR-EHR-OBSERVATION.blood_pressure.v2",
  "description": "Blood pressure measurement",
  "items": {
    "/data/events/data/items[at0004]/value": {
      "rm_type": "DV_QUANTITY",
      "units": ["mmHg"],
      "range": { "min": 0, "max": 300 }
    },
    "/data/events/data/items[at0005]/value": {
      "rm_type": "DV_QUANTITY",
      "units": ["mmHg"],
      "range": { "min": 0, "max": 200 }
    }
  }
}
```

### 9.2 Archetype Registry

Archetypes are loaded and cached at application startup. No archetype is parsed per request.

```python
class ArchetypeRegistry:
    _cache: dict[str, ArchetypeSchema] = {}

    @classmethod
    def load(cls, path: Path) -> None:
        for f in path.glob("*.json"):
            schema = ArchetypeSchema.model_validate_json(f.read_text())
            cls._cache[schema.archetype_id] = schema

    @classmethod
    def validate(cls, archetype_id: str, content: dict) -> None:
        schema = cls._cache.get(archetype_id)
        if not schema:
            raise UnknownArchetypeError(archetype_id)
        schema.validate(content)   # raises ValidationError if invalid
```

### 9.3 Form Generation

Forms are derived from archetypes via FHIR Questionnaire descriptors — one per archetype. The frontend form engine takes a Questionnaire JSON and renders the form without any form-specific code.

```typescript
// Any clinical form, no bespoke component:
function ClinicalForm({ archetypeId }: { archetypeId: string }) {
  const { data: questionnaire } = useQuery(
    ["questionnaire", archetypeId],
    () => fetchQuestionnaire(archetypeId)
  );
  if (!questionnaire) return <Spinner />;
  return <FormEngine items={questionnaire.item} />;
}
```

Adding a new clinical concept: add an archetype JSON + a Questionnaire JSON. No code change.

---

## 10. Multi-Granularity and Multi-Perspective Clinical Data

### 10.1 The Problem

Archetypes define structure and enforce validity, but they do not by themselves solve a deeper problem: the same clinical concept must be captured at different levels of detail in different contexts, and different specialties interpret the same data differently.

**The smoking example** illustrates all three layers of this problem:

| Context | What is needed |
|---|---|
| ED triage | Smoker: yes / no / ex |
| GP chronic disease review | Current status + pack-years |
| Anaesthetics pre-assessment | Pack-years + how long smoke-free |
| Oncology intake | Full lifetime history: types, amounts, quit dates, cessation attempts |

The data captured in one context must be usable in all others — but the system cannot demand oncology-level detail from a triage nurse.

### 10.2 Archetype Specialisation

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

### 10.3 Derivability Asymmetry

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

### 10.4 Projections With Completeness Flags

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

### 10.5 Named Views Per Clinical Context

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

### 10.6 SNOMED CT Subsumption

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

### 10.7 Summary: What Archetypes Do and Do Not Solve

| Problem | Solution |
|---|---|
| Structure and validation of clinical data | Archetype definition + validator |
| Same concept at different granularities | Archetype specialisation + templates per context |
| Deriving simple answers from detailed data | Semantic mapping registry with derivation rules |
| Different perspectives on the same data | Named view definitions (data, not code) |
| Communicating incomplete data honestly | Completeness flags on projections |
| Coded value queries matching subtypes | SNOMED CT subsumption table in query engine |

---

## 11. Time Series Data

### 11.1 The Landscape of Clinical Time Series

Clinical time series differ by three independent axes: frequency, regularity, and source.

| Series | Typical frequency | Regularity | Source |
|---|---|---|---|
| ECG waveform | 250–1000 Hz | Continuous | Monitor |
| Ventilator parameters | 1 Hz | Continuous | Ventilator |
| Continuous glucose (CGM) | 1 per 5 min | Continuous | Sensor |
| ICU vital signs | 1 per 1–5 min | Continuous | Monitor |
| Ward vital signs | 1 per 4–8 h | Scheduled | Manual / device |
| POCT blood glucose | Episodic | Irregular | Point-of-care device |
| Laboratory results | Hours to days | Irregular | LIS |
| Body weight | Daily or less | Scheduled | Scale / manual |
| HbA1c | Weeks to months | Irregular | LIS |

A single ICU patient generates tens of millions of data points per day from continuous monitoring alone. The storage and query architecture must handle this without degrading operational performance for the rest of the system.

### 11.2 Storage: TimescaleDB

**TimescaleDB** (a PostgreSQL extension) is the right foundation. It remains within the PostgreSQL ecosystem — no separate infrastructure — while providing:

- **Hypertables**: automatically partitioned by time and optionally by patient space, eliminating full-table scans for time-range queries
- **Compression**: 90–95% compression ratio on older time-series partitions; cold data costs almost nothing
- **Continuous aggregates**: pre-computed time-bucket rollups maintained automatically as new data arrives
- **`time_bucket` function**: server-side aggregation at any granularity in a single query

```sql
-- Core time series table
CREATE TABLE observations_ts (
  time        TIMESTAMPTZ NOT NULL,
  patient_id  UUID        NOT NULL,
  series_type TEXT        NOT NULL,   -- references series_type_registry
  component   TEXT,                   -- e.g. 'systolic','diastolic' for BP
  value       NUMERIC,
  unit        TEXT,
  source_id   UUID                    -- device_id or composition_id
);

SELECT create_hypertable('observations_ts', 'time',
  partitioning_column => 'patient_id',
  number_partitions   => 16);

-- Compress chunks older than 7 days
SELECT add_compression_policy('observations_ts', INTERVAL '7 days');

-- Continuous aggregate: 1-minute buckets — served to ICU trend views
CREATE MATERIALIZED VIEW obs_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  patient_id,
  series_type,
  component,
  AVG(value)  AS mean,
  MIN(value)  AS min,
  MAX(value)  AS max
FROM observations_ts
GROUP BY 1, 2, 3, 4;

-- 1-hour buckets — ward overview, outpatient trending
CREATE MATERIALIZED VIEW obs_1hour
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  patient_id, series_type, component,
  AVG(value) AS mean, MIN(value) AS min, MAX(value) AS max
FROM observations_ts
GROUP BY 1, 2, 3, 4;
```

High-frequency waveform data (ECG, raw ventilator flow) that exceeds clinical archival needs is down-sampled to 1-minute aggregates after 24 hours and retained at 1-second resolution for 24 hours only, unless a clinical event (arrhythmia, alarm) triggers permanent retention of a window.

### 11.3 Extensibility: Series Type Registry

Adding a new time series is a data operation, not a code change. A **series type registry** defines every known series:

```json
{
  "series_type": "heart_rate",
  "label": "Heart Rate",
  "components": [{ "name": "value", "unit": "bpm", "range": [20, 300] }],
  "archetype_id": "vital_signs.v3",
  "archetype_path": "/data/events/data/items[at0004]/value/magnitude",
  "reference_ranges": [
    { "context": "adult",   "low": 60,  "high": 100 },
    { "context": "neonate", "low": 100, "high": 160 }
  ],
  "alarm_thresholds": { "critical_low": 30, "critical_high": 180 }
}
```

```json
{
  "series_type": "blood_pressure",
  "label": "Blood Pressure",
  "components": [
    { "name": "systolic",  "unit": "mmHg", "range": [40, 300] },
    { "name": "diastolic", "unit": "mmHg", "range": [20, 200] }
  ],
  "archetype_id": "blood_pressure.v2",
  "reference_ranges": [
    { "context": "adult", "systolic": [90, 140], "diastolic": [60, 90] }
  ]
}
```

New series types are registered here. The ingestion pipeline, the projection builder, and the curve renderer all consume this registry — no code change required.

### 11.4 Mapping to a Visual Curve

Rendering a time series across a time range requires server-side aggregation matched to the viewport. Sending raw data to the client is impractical for any range beyond a few minutes of continuous data.

**The API contract**:

```
GET /api/patients/{id}/series/{series_type}
  ?from=2024-01-15T08:00Z
  &to=2024-01-15T20:00Z
  &resolution=300        # seconds per bucket — client sends viewport width / desired points
```

The server selects the pre-computed continuous aggregate that best satisfies the requested resolution, falling back to raw data only for very short recent windows.

**Down-sampling for rendering**: when the continuous aggregate resolution is finer than needed, the **LTTB (Largest Triangle Three Buckets)** algorithm reduces point count while preserving the visual shape of the curve — inflection points, peaks, and troughs are retained; flat regions are compressed. LTTB is computed server-side in Python or, for client-side real-time rendering, in WASM.

**Multi-series chart composition**: different series live on independent Y axes with their own scales. The chart configuration is also data-driven from the series type registry:

```json
{
  "chart_id": "icu_vitals_overview",
  "panels": [
    {
      "series": ["heart_rate", "spo2"],
      "y_axes": [
        { "series": "heart_rate", "min": 0,   "max": 220, "color": "#e74c3c" },
        { "series": "spo2",       "min": 80,  "max": 100, "color": "#3498db" }
      ]
    },
    {
      "series": ["blood_pressure.systolic", "blood_pressure.diastolic"],
      "y_axes": [{ "shared": true, "min": 40, "max": 200, "color": "#2ecc71" }]
    }
  ],
  "event_overlays": ["medication_administered", "procedure_performed"]
}
```

Clinical events (medications given, procedures, alarm events) are overlaid on the timeline as vertical markers, linked back to their source compositions.

---

## 12. Laboratory Data Ingestion

### 12.1 The Complexity of Lab Data

Laboratory results appear simple — a number with a unit — but carry significant hidden complexity:

- **Panels vs individual results**: a full blood count is a single order producing 15+ individual observations (Hb, WBC, platelets, MCV, etc.)
- **Reference ranges are not fixed**: the same Hb value has different normal ranges for a male adult, a pregnant woman, a neonate, and a patient at altitude
- **Result status lifecycle**: preliminary → final → corrected (delta check triggered) → cancelled
- **Microbiology is structurally different**: cultures grow over time; sensitivity panels are nested under isolates; qualitative interpretations ("resistant", "sensitive") alongside numeric MIC values
- **Critical values**: certain results require immediate clinician notification regardless of workflow state
- **Units vary by analyser and laboratory**: glucose reported as mmol/L in most of Europe but mg/dL in the US; the system must normalise on ingest

### 12.2 Ingestion Architecture

```
LIS (Laboratory Information System)
  │
  ├── HL7 v2 ORU^R01 (dominant legacy format)
  ├── FHIR DiagnosticReport + Observation (modern)
  └── ASTM (some point-of-care analysers)
        │
        ▼
  Lab Ingest Adapter
  ├── Parse message format
  ├── Validate required fields
  ├── Map local lab codes → LOINC
  ├── Normalise units (e.g. mg/dL → mmol/L where needed)
  ├── Resolve patient identity (MRN → internal patient_id)
  ├── Resolve ordering provider
  └── Emit internal LabResultReceived event
        │
        ▼
  Lab Domain Service
  ├── Store as composition (archetype: lab_result.v1 or microbiology_result.v1)
  ├── Write individual analytes to observations_ts (time series)
  ├── Update lab projection tables (latest_results, result_history)
  ├── Apply reference ranges from patient context
  ├── Check for critical values → emit CriticalValueAlert if triggered
  ├── Compute delta check (change from previous result)
  └── Emit composition.created event
```

### 12.3 LOINC Mapping

Every analyte is mapped to a **LOINC code** at ingest. The local lab code (LIS-specific or analyser-specific) is preserved but is not the canonical identifier. This enables:

- Cross-laboratory trending (same patient, different labs, same analyte)
- Swiss EPD document conformance
- Clinical decision support rules that reference standard codes

```sql
CREATE TABLE loinc_mappings (
  lab_code        TEXT NOT NULL,
  lab_system      TEXT NOT NULL,   -- 'LIS_KISIM', 'COBAS_8000', etc.
  loinc_code      TEXT NOT NULL,
  loinc_long_name TEXT,
  unit_canonical  TEXT,            -- target unit after normalisation
  unit_factor     NUMERIC,         -- multiply source value by this
  PRIMARY KEY (lab_code, lab_system)
);
```

### 12.4 Reference Ranges and Critical Values

Reference ranges are patient-context-dependent and must be evaluated at result time, not stored as static thresholds:

```sql
CREATE TABLE reference_ranges (
  loinc_code    TEXT NOT NULL,
  lab_system    TEXT,             -- NULL = global default
  sex           TEXT,             -- NULL = any
  age_min_days  INT,
  age_max_days  INT,
  pregnancy     BOOLEAN,
  low_normal    NUMERIC,
  high_normal   NUMERIC,
  low_critical  NUMERIC,
  high_critical NUMERIC
);
```

At ingest, patient demographics are used to select the matching row. The evaluated interpretation (`normal`, `high`, `low`, `critical_high`, `critical_low`) is stored with the result and drives both UI rendering and notification routing.

### 12.5 Lab Results as Time Series

Individual numeric analytes are written to `observations_ts` at ingest alongside the full composition. This makes lab trending identical to vital sign trending architecturally — the same chart engine, the same series type registry, the same continuous aggregate mechanism.

The key difference is that lab series are **irregular** (no fixed frequency), so the continuous aggregate produces sparse time buckets. The chart engine must handle missing buckets gracefully, rendering discrete points rather than a continuous line for infrequent analytes such as HbA1c.

---

## 13. Patient Data Management System (PDMS)

### 13.1 What a PDMS Is

A **Patient Data Management System** is the clinical computing environment of the intensive care unit. It replaces paper charts at the bedside with:

- Continuous automated collection of data from all bedside devices (monitor, ventilator, infusion pumps, dialysis machine)
- Real-time display of trends, alarms, and scores at the bedside
- Clinical charting: nursing assessment, fluid balance, drug administration
- Automated calculation of severity scores (SOFA, APACHE II, SAPS III)
- Medication safety: weight-based dosing, infusion rate calculation, drug interaction checking
- Fluid balance: continuously computed from infusion pump rates and output measurements

The PDMS is the most data-intensive domain in the EHR. A single ICU patient on full monitoring generates on the order of 10 million data points per day from continuous parameter streams alone.

### 13.2 PDMS as an Integrated Domain, Not a Silo

Many hospitals run a PDMS as a separate, disconnected system — data flows in from devices but does not feed back into the EHR, leading to duplication, transcription errors, and clinical decisions made on incomplete information.

In this architecture the PDMS is an **integrated domain** within the EHR, sharing patient identity, the episode model, the clinical composition store, and the time series infrastructure. It is architecturally distinct only in its:

- Device integration gateway (distinct ingestion path for high-frequency streams)
- Real-time display requirements (WebSocket streaming to bedside terminals)
- Data volumes (orders of magnitude higher than any other domain)
- Alarm management (immediate surfacing, cannot be queued or batched)

```
/domains
  /pdms
    /device_gateway     Adapts device protocols → internal time series + events
    /realtime           WebSocket hub for bedside display
    /charting           ICU-specific composition templates (nursing, fluid balance)
    /alarms             Alarm routing, escalation, acknowledgement
    /scores             SOFA, APACHE II, SAPS III calculation from available data
    /medications        ICU drug calculations, infusion protocols
```

### 13.3 Device Integration Gateway

Medical devices speak many protocols. The gateway normalises them:

| Protocol | Used by |
|---|---|
| **HL7 v2 ORU** | Most modern bedside monitors |
| **IEEE 11073 / SDC** | Modern medical device communication standard |
| **ASTM** | Some analysers and point-of-care devices |
| **Proprietary serial / TCP** | Legacy ventilators, older infusion pumps |
| **FHIR Device / Observation** | Emerging standard |

The gateway is a separate, lightweight process (not part of the main FastAPI application) that:

1. Maintains persistent connections to all active devices
2. Translates device data to the internal `observations_ts` schema
3. Writes directly to TimescaleDB via a high-throughput bulk-insert path (bypassing the normal composition pipeline for raw waveform data)
4. Emits `device.parameter_received` events for alarm evaluation and real-time display
5. Emits `device.alarm_triggered` events immediately on alarm signals — not batched

### 13.4 Real-Time Display

ICU bedside terminals require sub-second latency for current parameter values. The architecture for this is distinct from the request/response pattern used elsewhere:

```
TimescaleDB (writes from device gateway)
    │
    ├── WebSocket hub (FastAPI + async generators)
    │     └── Bedside terminal subscribed to patient_id stream
    │           receives parameter updates at 1–5 second intervals
    │
    └── Alarm evaluator (runs per-device-write, not per-request)
          → emits via WebSocket immediately on threshold breach
          → writes to alarm_log (append-only)
          → routes to nurse station display and mobile device
```

Redis pub/sub is the internal message bus between the device gateway and the WebSocket hub — low-latency, no durability requirement for the real-time display path (raw values are already persisted in TimescaleDB).

### 13.5 Fluid Balance

Fluid balance is continuously computed from:
- **Inputs**: infusion pump rates (ml/h × time), oral intake (manually entered), blood products
- **Outputs**: urine output (catheter sensor or manual), drain outputs, losses (manually estimated)

The running balance is materialised as a projection, updated with every pump rate change or output entry. Hourly and 24-hour totals are pre-computed. Clinical staff see the current balance without any server computation on read.

```sql
CREATE TABLE fluid_balance_projection (
  patient_id        UUID PRIMARY KEY,
  episode_id        UUID NOT NULL,
  balance_ml        NUMERIC,       -- positive = net intake
  total_input_24h   NUMERIC,
  total_output_24h  NUMERIC,
  last_updated      TIMESTAMPTZ
);
```

### 13.6 Severity Scores

SOFA, APACHE II, and SAPS III are computed from data already in the system — labs, vitals, ventilator parameters, GCS assessment. Score computation is:

- Triggered by each relevant composition stored or time series update
- Runs as a background task (not on the critical write path)
- Writes the result as a new composition (`severity_score.v1`) and updates a projection
- Exposed in the bedside view as a trending value with contributing factors

Because all inputs are already in the composition store and time series, the score calculation requires no additional data capture. It is a pure derivation — like the projections discussed in earlier sections, but with more complex logic.

### 13.7 Data Intensity and Throughput

The PDMS is categorically different from every other domain in its data volume. Understanding the numbers is prerequisite to making correct architectural decisions.

**At one point every five seconds per parameter (0.2 Hz), a modest 20-bed ICU with 12 monitored parameters per patient:**

```
12 parameters × 0.2 Hz × 20 beds = 48 rows / second  (sustained, 24 × 7)
                                  = 4,147,200 rows / day
                                  = 1.5 billion rows / year
```

**At one point per second (1 Hz — continuous arterial line, ventilator):**

```
12 parameters × 1 Hz × 20 beds = 240 rows / second
                                = 20,736,000 rows / day
```

These figures are not extreme by database standards — TimescaleDB sustains over 100,000 inserts/second on commodity hardware — but the load is **perfectly relentless**. There are no quiet hours. Any architecture that assumes bursty traffic with recovery time between bursts will fail here.

**Ingestion must be batched.** Individual row-by-row INSERT at 240/sec generates connection and WAL overhead that degrades overall system performance. The device gateway buffers 1–5 seconds of readings in process memory and flushes as a single multi-row INSERT or PostgreSQL `COPY`. This decouples device polling frequency from database write operations. If the database is momentarily slow, the in-process buffer absorbs the spike. The buffer has a hard upper bound; breaching it triggers an alert — data is never silently discarded.

### 13.8 The Timeline: Three Zones

The timeline is not uniform. Access patterns differ so sharply across time that a single storage and retrieval strategy cannot serve all zones correctly.

```
Now ◄──────────────────────────────────────────────────────────► Past

│◄── Real-time ──►│◄───── Near-history ──────►│◄─── Archive ───►│
│    0 – 30 min   │     30 min – 7 days       │    7 days +      │
│                 │                           │                  │
│  WebSocket push │  API pull, optional LTTB  │  Aggregates only │
│  Redis ring buf │  TimescaleDB hot chunks   │  Compressed      │
│  Sub-second     │  Raw or 1-min agg         │  1-min or 1-hour │
│  No DB reads    │  On-demand query          │  Pre-computed    │
```

**Real-time zone (0 – 30 minutes)**

The last 30 minutes of each parameter for each patient live in a **Redis sorted set** (score = Unix timestamp, member = serialised value), maintained as a ring buffer with a rolling trim on every insert. The bedside display subscribes via WebSocket and receives each new data point as it arrives from the device gateway — the TimescaleDB insert and the Redis write happen concurrently; neither blocks the other.

No database read occurs on the hot real-time display path. A bedside terminal reconnecting after a network interruption fetches its backfill from Redis, not from TimescaleDB.

```python
async def ingest_device_reading(patient_id: UUID, param: str, ts: float, value: float):
    key = f"pdms:{patient_id}:{param}"
    pipe = redis.pipeline()
    pipe.zadd(key, {f"{ts}:{value}": ts})
    pipe.zremrangebyscore(key, "-inf", ts - RING_BUFFER_SECONDS)
    await pipe.execute()

    # Concurrent: publish to WebSocket subscribers
    await redis.publish(f"pdms_stream:{patient_id}", json.dumps({
        "param": param, "ts": ts, "value": value
    }))

    # Batch buffer for TimescaleDB — flushed every 2 seconds
    batch_buffer.append((ts, patient_id, param, value))
```

**Near-history zone (30 minutes – 7 days)**

Data lives in TimescaleDB's uncompressed recent chunks, fully queryable at raw resolution. For display over ranges beyond a few minutes, the API applies LTTB down-sampling server-side, returning a display-appropriate point count regardless of the underlying data density.

**Archive zone (7 days+)**

TimescaleDB compressed chunks. Raw values are no longer served. Only continuous aggregates (1-minute, 1-hour) are available. Medicolegally flagged windows (see §13.9) are exempted.

**Zone transitions in the UI** must be seamless. When a user scrolls the bedside trend left from real-time into history, the WebSocket subscription is released and the view switches to API-fetched aggregated data. Scrolling back to now reconnects the WebSocket and stitches the gap. The user perceives a single continuous timeline.

### 13.9 Rendering: Strip Chart vs Historical Chart

These are two distinct display models that must not be conflated architecturally.

**Strip chart (real-time zone)**

The bedside display is an oscilloscope model: a fixed-width canvas where new data enters from the right and old data scrolls off the left. This is not a conventional chart re-rendered on each update.

- The client maintains a fixed-size circular buffer per parameter in JavaScript memory
- New WebSocket points are appended to the right; the left edge is trimmed
- Only the newly arrived right-edge segment is drawn to canvas on each update — the rest of the chart is not re-rendered
- Canvas rendering is mandatory; SVG cannot sustain this update rate with acceptable CPU use
- At 0.2 Hz, this is 1 canvas draw operation per 5 seconds per parameter — trivial
- At 1 Hz on a multi-parameter view: 10–12 canvas operations per second — still well within browser capacity

**Historical trend chart (near-history and archive zones)**

A conventional line chart rendered in full on each navigation event. The server returns a fixed number of points (typically 500–1000 per series) regardless of the underlying data density, via LTTB. Zoom and pan trigger new API calls with updated time bounds and recalculated resolution.

The LTTB algorithm preserves the visual shape of the curve — peaks, troughs, and inflection points — while discarding redundant flat-region samples. This means a 12-hour chart of heart rate looks clinically accurate with 600 points even when the underlying data contains 8,640 raw values.

### 13.10 Data Retention and Compression

ICU time series are retained at tiered resolutions:

| Age | Resolution retained | Rationale |
|---|---|---|
| < 30 min | Full resolution in Redis ring buffer | Real-time display path |
| < 24 h | Full resolution in TimescaleDB (uncompressed) | Active clinical use, alarm replay |
| 1–7 days | Full resolution, compressed | Post-ICU review, incident investigation |
| 7 days – 1 year | 1-minute aggregates | Trend analysis, medicolegal retention |
| > 1 year | 1-hour aggregates | Population data, long-term research |

**Alarm window preservation**: when an alarm fires or a clinical intervention is recorded, the surrounding raw data window (±30 minutes) is flagged for permanent retention at full resolution regardless of age. This creates an immutable, full-fidelity record of the clinical context around any significant event — essential for incident investigation and medicolegal purposes.

TimescaleDB compression policies and retention policies implement the tiering automatically. No application code manages chunk lifecycle.

---

## 14. Mobile Applications

### 14.1 Three Distinct Apps, One Backend

Mobile access is not a single application. Three distinct user populations have fundamentally different needs, different authorization scopes, and different security models:

| App | Users | Authorization | Primary data flow |
|---|---|---|---|
| **Clinician — Physician** | Attending physicians, consultants, on-call | Staff SMART on FHIR scopes | Read-heavy: results, trends, patient lists |
| **Clinician — Nurse** | Ward nurses, ICU nurses | Staff SMART on FHIR scopes | Write-heavy: observations, MAR, assessments |
| **Patient** | Patients, proxy carers | Patient SMART on FHIR scopes | Read: own record; Write: PROs, home monitoring |

All three connect to the same backend through the **FHIR façade** (§15), using SMART on FHIR for authentication and authorization. The FHIR layer acts as the mobile API — purpose-built for exactly this use case. Clinical staff apps may additionally call internal FastAPI endpoints for features not expressible in FHIR (scheduling, resource management).

### 14.2 Technology: React Native

React Native is the right choice for a team already working in React and TypeScript:

- Shared type definitions and FHIR client code between web and mobile
- Single codebase for iOS and Android
- Access to native device capabilities: camera, barcode scanner, biometrics, push notifications, background sync
- React Native's new architecture (JSI / Hermes) is fast enough for the display requirements of all three apps

The PDMS real-time strip chart (§13.9) is the only rendering component that requires a native module — React Native's `Canvas` via `@shopify/react-native-skia` is sufficient for that use case.

### 14.3 Shared Mobile Architecture

All three apps share the same foundation:

```
Authentication
  SMART on FHIR (OAuth 2.0 + OpenID Connect)
  Biometric unlock (Face ID / Touch ID) for session resume
  Certificate pinning for all API connections

Offline-first store
  WatermelonDB (SQLite-backed, React Native optimised)
  Read-heavy data pre-fetched and cached on login/patient selection
  Writes queued locally when offline; synced on reconnect
  Append-only clinical writes (observations, MAR) have no merge conflicts

Push notifications
  APNs (iOS) / FCM (Android) via backend notification service
  Critical alerts use iOS Critical Alert entitlement (bypasses silent mode)
  Notification payload contains patient_id and action type only — no clinical data in push payload (privacy)

Audit
  Every patient record access from mobile logged identically to web access
  Device identifier included in audit log entry
```

**Conflict resolution for offline writes** is straightforward because clinical records are append-only events. A nurse who recorded a medication administration offline and then syncs does not conflict with any other write — the administration is stamped with the time it occurred, not the time it synced. The only case requiring attention is duplicate detection: if a write is re-submitted after an uncertain network failure, idempotency keys prevent double-recording.

---

### 14.4 Physician App

The physician's primary need is fast access to information during ward rounds, on-call response, and consultant review. Data entry is secondary; most physicians prefer to dictate notes rather than type on a phone.

**Core screens:**

```
Patient list
  ├── My patients (primary team)
  ├── On-call list (all ward patients)
  └── Search by name / MRN / room

Patient overview
  ├── Header: name, age, admission date, primary diagnosis
  ├── Active alerts: critical values, NEWS2 deterioration, unacknowledged alarms
  ├── Recent vitals (sparklines — last 24 h per parameter)
  ├── Active medications (simplified — full list on demand)
  ├── Recent lab results (flagged abnormals highlighted)
  └── Active problem list

Results viewer
  ├── Lab trends (time series chart — touch to zoom, pinch)
  ├── Radiology reports
  └── Microbiology (sensitivities, pending cultures)

Notes
  ├── Dictation → server-side transcription → structured note
  ├── Review and sign transcribed note
  └── Read previous notes

Alerts inbox
  ├── Critical lab values (requires acknowledgement)
  ├── Clinical deterioration alerts (NEWS2 threshold breach)
  └── Escalations from nursing staff
```

**Dictation pipeline**: audio recorded on device → uploaded to transcription service (on-premise or cloud, depending on data residency requirements) → returned as draft note text → physician reviews and signs. The transcription is linked to the composition; the original audio is retained for medicolegal purposes.

**On-call specifics**: the on-call physician's app view shows all ward patients grouped by acuity, with the most deteriorating patients surfaced at the top. Alerts arrive as push notifications; tapping opens the patient directly to the relevant result or trend.

---

### 14.5 Nurse App

The nurse app is write-heavy and workflow-driven. Nurses work under time pressure with multiple simultaneous patients; every interaction must be minimal in steps.

**Core screens:**

```
Ward board
  ├── All assigned patients in one view
  ├── NEWS2 score per patient (colour-coded: green/amber/red)
  ├── Pending tasks highlighted (observations overdue, medications due)
  └── Alarm indicators

Medication administration (MAR)
  ├── Due medications listed with time window
  ├── Scan patient wristband barcode → confirms patient identity
  ├── Scan medication barcode → confirms drug, dose, route
  ├── Five-rights check: patient / drug / dose / route / time
  ├── Record administration (one tap after successful scan)
  └── Record omission with reason (refused, unavailable, etc.)

Observations entry
  ├── Vital signs: HR, BP, SpO2, temperature, RR, GCS
  ├── Fluid balance: intake and output entries
  ├── NEWS2 auto-calculated from entered values
  └── Escalation prompt if NEWS2 exceeds threshold

Patient handover
  ├── Structured handover using SBAR format (Situation, Background, Assessment, Recommendation)
  ├── Outstanding tasks for receiving nurse
  └── Pending results

Tasks
  ├── All outstanding nursing assessments for assigned patients
  ├── Sorted by due time
  └── Mark complete in place
```

**Barcode scanning for medication safety** is the most critical feature. The five-rights check (right patient, right drug, right dose, right route, right time) prevents administration errors. The scan confirms each right independently before recording — the system does not allow recording without a successful patient wristband scan and medication barcode scan. Overrides are possible (damaged barcode) but require an explicit reason, are logged, and are flagged for review.

**NEWS2 and escalation**: when a nurse enters observations that trigger a NEWS2 threshold, the app presents an escalation prompt immediately — not after the observation is saved, but as part of the entry flow. The escalation can be sent directly to the on-call physician from within the prompt, generating an alert in the physician app and logging the escalation event.

**Offline-first is non-negotiable** for the nurse app. Ward Wi-Fi in older hospital buildings is unreliable. Observations entered offline are stored locally and sync transparently. The nurse sees no difference in workflow — offline state is indicated by a status indicator only.

---

### 14.6 Patient App

The patient app is architecturally distinct from the clinical apps in three ways: it presents data for health literacy rather than clinical use; patients control their own data sharing (Swiss EPD consent management); and patients can contribute data into the record (home monitoring, symptom reporting).

**Core screens:**

```
Health summary
  ├── Active conditions (plain language descriptions)
  ├── Current medications (name, purpose, dose, when to take)
  ├── Allergies and adverse reactions
  └── Immunisation history

Appointments
  ├── Upcoming appointments (date, location, clinician)
  ├── Request new appointment
  ├── Reschedule or cancel
  └── Pre-appointment questionnaire (sent by clinic, completed here)

Results
  ├── Recent lab results
  │     — value + reference range shown graphically
  │     — plain language: "Your haemoglobin is slightly below normal"
  │     — not shown until clinician has reviewed and released (configurable)
  ├── Reports available (discharge summary, letters — PDF)
  └── Trend view (Hb over last 12 months)

Medications
  ├── Current medication list with instructions
  ├── Discharge medications with reconciliation notes
  └── Medication reminders (optional, local notifications)

Messages
  ├── Secure messaging with care team
  ├── Read receipts
  └── Attachment support (patient can send photos of wounds, rashes, etc.)

My data (patient-generated)
  ├── Blood pressure (manual entry or connected device)
  ├── Blood glucose (manual or CGM integration)
  ├── Weight
  ├── Symptom diary / PRO questionnaires
  └── All entries flow into the clinical record as patient-reported compositions

Documents
  ├── Discharge summaries
  ├── Referral letters
  ├── Imaging reports
  └── Download / share with another provider

EPD consent (Switzerland)
  ├── View which providers have accessed the EPD
  ├── Grant / revoke access per provider
  ├── Set access level (normal / restricted / emergency-only)
  └── Access log (who viewed what, when)
```

**Plain language presentation** is not cosmetic — it is a patient safety requirement. A raw lab value without context causes anxiety or false reassurance. Every result shown in the patient app includes: the value, the reference range for that patient's demographics, a colour indicator, and one sentence of plain-language context. The plain-language text is authored by clinicians per archetype/series type and stored in the series type registry alongside the clinical definition.

**Result release gating**: lab results are not shown in the patient app until a clinician has reviewed and released them. The release is a deliberate act, not an automatic delay. This is configurable per organisation and per result type — some organisations release routine results immediately; others require clinician review for all results.

**Patient-generated data** enters the clinical record as compositions with `recorder_type: patient`. They are stored in the same composition store with a distinct provenance marker. Clinicians see patient-reported data in the timeline alongside clinically recorded data, clearly distinguished. PRO (Patient Reported Outcome) questionnaires are modelled as FHIR Questionnaire / QuestionnaireResponse — the same form engine used for clinical forms.

**Proxy access**: a parent accessing a child's record, or an adult carer accessing an elderly patient's record, requires explicit consent from the patient (where capacity permits) or from a legal guardian. Proxy access is scoped — a carer may be granted access to appointments and medications but not to mental health or reproductive health records. This is enforced at the FHIR authorization layer, not in the app.

**Swiss EPD integration**: the patient app is the primary interface through which Swiss patients exercise their EPD rights — granting and revoking provider access, viewing the access log, and downloading their EPD documents. This requires the app to integrate with the EPD community's patient portal APIs (IHE MHD for document access, PPQM for consent management).

---

### 14.7 Notification Architecture

Push notifications cross all three apps but with different urgency tiers:

| Tier | Example | Delivery | Clinical app | Patient app |
|---|---|---|---|---|
| **Critical** | Critical lab value, cardiac arrest call | Immediate, bypasses silent mode | Physician + nurse | — |
| **Urgent** | NEWS2 deterioration, medication overdue | Immediate, normal priority | Physician + nurse | — |
| **Standard** | New result available, task assigned | Normal push | All clinical | Result released, message received |
| **Informational** | Appointment reminder, discharge summary available | Scheduled / batched | — | Patient |

**No clinical data in push payloads.** The notification payload contains only patient_id, notification type, and a reference ID. The app fetches the actual data after authentication. This prevents clinical information appearing on lock screens and in notification centres.

**Critical alert implementation (iOS)**: iOS Critical Alerts bypass the device's mute switch and Do Not Disturb settings. This requires an Apple entitlement that must be applied for and justified. It is appropriate for cardiac arrest calls and critical lab values directed at on-call physicians; it is not appropriate for standard clinical notifications.

---

## 15. Inter-Domain Communication

Domains never query each other's schemas. They communicate through events.

```python
# Clinical domain: composition stored → publish event
async def store_composition(episode_id: UUID, data: CompositionInput) -> UUID:
    archetype_registry.validate(data.archetype_id, data.content)
    comp_id = await db.insert_composition(episode_id, data)
    await event_bus.publish("composition.created", {
        "composition_id": str(comp_id),
        "archetype_id": data.archetype_id,
        "episode_id": str(episode_id),
        "patient_id": str(data.patient_id),
        "recorded_at": utcnow().isoformat()
    })
    return comp_id

# Billing domain: listen and derive charges
@on_event("composition.created")
async def handle_composition_for_billing(event: dict) -> None:
    if is_billable(event["archetype_id"]):
        await create_invoice_item(
            episode_id=event["episode_id"],
            source_type="composition",
            source_id=event["composition_id"]
        )

# Projection updater: maintain latest_vitals
@on_event("composition.created")
async def update_vitals_projection(event: dict) -> None:
    if event["archetype_id"] == "vital_signs.v3":
        await refresh_latest_vitals(event["patient_id"])
```

**Transport**: PostgreSQL `LISTEN/NOTIFY` for single-node deployments. NATS or RabbitMQ when scaling horizontally.

---

## 16. Swiss EPD Integration

The Swiss EPD layer is a **façade** — it does not pollute the internal data model.

```
Internal clinical store
  → Composition stored
  → FHIR resource generated on demand (or on trigger)
  → Submitted to EPD community XDS.b repository
  → IHE ATNA audit record written

Patient identity
  → Internal patient_id
  → EPD MPI lookup via PIX query → EPD patient identity
  → AHV-Nummer / NAVS13 as national root identifier

Document sharing
  → XDS.b metadata: class code, type code, confidentiality, language
  → Swiss CH EPD FHIR profile compliance
  → MHD for mobile access
```

The FHIR conversion is a mapping layer — internal compositions are projected to FHIR resources using registered archetype → FHIR mappings. The internal model is not constrained to FHIR's resource granularity.

---

## 17. Modularity Structure

Code and deployment are organised as vertical domain slices, not horizontal layers:

```
/domains
  /patient_admin       Demographics, ADT, MPI, insurance registration
  /scheduling          Slots, resource planning, conflict detection, calendars
  /clinical_docs       Compositions, archetype engine, form generation
  /orders              CPOE, lab orders, radiology orders, referrals
  /medications         Prescribing, dispensing, MAR, interaction checking
  /results             Lab, radiology, document inbox, trending
  /resources           Resource registry, device management, rostering
  /billing             SwissDRG, TARMED/TARDOC, invoicing, claims
  /decision_support    Alerts, pathways, early warning scores
  /pdms                Device gateway, realtime hub, ICU charting, alarms, scores
  /mobile_physician    Patient list, results viewer, dictation, alert inbox
  /mobile_nurse        Ward board, MAR + barcode, observations, handover
  /mobile_patient      Health summary, appointments, results, PROs, EPD consent
  /interop             FHIR façade, IHE adapters, Swiss EPD federation
  /audit               Append-only audit log, break-glass, ATNA
```

Each domain owns:
- Its FastAPI router
- Its service layer
- Its PostgreSQL schema
- Its projection tables
- Its frontend bundle (lazy-loaded)

Domains import only from `shared/` for cross-cutting identifiers and the event bus.

---

## 18. Implementation Priorities

Given the "data model first" principle, the critical path is:

1. **Shared kernel** — patient_id master, user_id, event bus, audit log
2. **Archetype registry + validator** — everything depends on this
3. **Archetype specialisation hierarchy + semantic mapping registry** — required before any multi-context queries are meaningful
4. **SNOMED CT subsumption table** — load from SNOMED release; required for correct coded-value queries
5. **Composition store + projection framework** — the clinical record core; projections carry completeness flags from the start
6. **Named view definition registry** — enables context-specific data views without code changes
7. **Resource registry + slot model** — visible early win; scheduling is universally needed
8. **TimescaleDB time series infrastructure + series type registry** — required before PDMS and lab trending
9. **Lab ingest adapter** — HL7 v2 ORU + LOINC mapping; critical path for clinical usability
10. **Form engine** — once archetypes and templates exist, forms become free
11. **PDMS device gateway + realtime hub** — high complexity; start early alongside core clinical store
12. **Nurse mobile app** — offline-first MAR and observations; barcode scanning; highest daily usage volume
13. **Physician mobile app** — results viewer, alert inbox, dictation pipeline
14. **Swiss EPD IHE adapter** — regulatory requirement; long lead time; start early
15. **Patient mobile app** — depends on FHIR façade and EPD integration being stable
16. **Billing domain** — derives from clinical + resource events; can follow once events flow

---

## 19. Summary of Key Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Clinical record storage | JSONB document per composition | Hierarchical data fits document model; schema-free evolution; MUMPS lesson |
| Clinical data structure | openEHR-influenced archetypes | Data model first; international clinical knowledge; extensibility |
| Multi-granularity concepts | Archetype specialisation + templates per context | Same concept captured at different detail levels; simple always derivable from detailed |
| Cross-context data perspectives | Named view definitions (JSON, not code) | Different specialties get different projections; no bespoke query code per context |
| Coded value queries | SNOMED CT subsumption table | Flat equality misses subtypes; subsumption is required for clinical correctness |
| Incomplete data communication | Completeness flags on projections | Consumers know whether answer is fully grounded or partially derived |
| Form generation | FHIR Questionnaire → generic engine | No bespoke form code; new forms are JSON files |
| Non-clinical domains | Relational per domain | Resources, scheduling, billing are structured and relational by nature |
| Cross-domain integration | Event bus (PostgreSQL NOTIFY / NATS) | No cross-schema joins; loose coupling; audit trail of state changes |
| Analytical queries | Separate projection / materialised views | Never compete with operational write path; Clarity lesson from Epic |
| Double-booking prevention | PostgreSQL gist exclusion constraint | Database-enforced invariant; cannot be bypassed by application logic |
| Swiss EPD compliance | FHIR façade over internal model | Internal model not constrained by interop format; EPD is an output, not a core |
| Extensibility | Namespaced extension tables + JSONB attributes | No schema migration for new fields; governed by namespace |
| Time series storage | TimescaleDB hypertable + continuous aggregates | Handles sub-second ICU data to monthly lab trends; compression reduces cold storage cost; stays within PostgreSQL |
| Time series extensibility | Series type registry (JSON) | New series = new registry entry; no code change |
| Curve rendering | Server-side LTTB down-sampling + pre-computed aggregates | Client receives display-ready point count; raw data never sent for long ranges |
| Lab ingestion | HL7 v2 / FHIR adapter → LOINC normalisation → composition + time series | Single ingest pipeline; labs trend identically to vitals |
| Lab reference ranges | Patient-context-matched at ingest | Ranges vary by sex, age, pregnancy; stored with result, not re-evaluated on read |
| PDMS integration | Integrated domain sharing patient/episode model and time series infrastructure | Avoids silo; device data feeds clinical record, scoring, and billing directly |
| PDMS ingestion | Batched INSERT / COPY from device gateway | Sustained 50–250 rows/sec; row-by-row INSERT generates unacceptable WAL overhead |
| PDMS real-time display | Redis ring buffer + WebSocket; no DB reads on hot path | Sub-second latency; DB unavailability does not affect bedside display |
| PDMS timeline zones | Three zones: Redis (0–30 min), TimescaleDB raw (30 min–7 days), aggregates (7 days+) | Access patterns differ too sharply for a single retrieval strategy |
| PDMS strip chart rendering | Canvas circular buffer; only new right-edge segment drawn per update | SVG cannot sustain the update rate; full re-render on every point is unnecessary |
| PDMS data retention | Tiered by age; alarm windows flagged for full-resolution permanent retention | Medicolegal and incident investigation requirements preserved; storage cost controlled |
| Mobile framework | React Native (shared TypeScript/FHIR client with web) | Single codebase iOS + Android; native capabilities; shared type definitions |
| Mobile offline | WatermelonDB + idempotency keys | Clinical writes are append-only events; no merge conflicts; duplicate prevention on sync |
| Mobile API | FHIR façade + SMART on FHIR | Standard healthcare mobile auth; patient and clinician scopes separated |
| Nurse medication safety | Barcode scan (patient wristband + drug) before MAR record | Five-rights check enforced in hardware scan; cannot be bypassed without explicit reason |
| Patient result gating | Clinician review and release before patient-visible | Prevents raw results causing harm without clinical context |
| Patient-generated data | Stored as compositions with recorder_type: patient | Flows into clinical record; provenance clearly marked; same query infrastructure |
| Push notification privacy | No clinical data in payload; app fetches after auth | Prevents PHI on lock screen; required by nDSG / GDPR |
| Backend server | Granian + FastAPI async | Higher throughput than Uvicorn; async throughout; direct asyncpg for hot paths |
| Client-side computation | Rust → WASM | Drug interactions, early warning scores, conflict detection offline-capable |
