## 44. Data Model

### 44.1 Bounded Contexts

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

### 44.2 Clinical Record Store

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

-- B-tree indexes only — no GIN on content (see §44.7)
CREATE INDEX ON compositions (episode_id);
CREATE INDEX ON compositions (ehr_id, recorded_at DESC);
CREATE INDEX ON compositions (archetype_id, recorded_at DESC);

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

### 44.3 Resource Domain

```sql
CREATE TABLE resources (
  id            UUID PRIMARY KEY,
  resource_type TEXT NOT NULL,   -- 'person','team','location','device','consumable'
  display_name  TEXT NOT NULL,
  active        BOOLEAN DEFAULT true,
  attributes    JSONB            -- stable, rarely-written extension metadata only
                                 -- never store high-churn fields here (see §44.7)
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

### 44.4 Scheduling Domain

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

### 44.5 Billing & Cost Domain

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

### 44.6 PostgreSQL Schema Layout

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

### 44.7 PostgreSQL JSONB — Limitations and Mitigations

PostgreSQL JSONB is a deliberate choice for clinical content storage, but it carries three specific failure modes that must be designed against explicitly.

#### A. High-churn fields inside JSONB blobs

Every UPDATE to a row rewrites the entire JSONB value (PostgreSQL MVCC). A status transition, a counter increment, or a flag change inside a JSONB blob costs a full blob rewrite and leaves a dead row until VACUUM runs. On high-volume tables this creates write amplification and bloat.

**Mitigation — the append-only contract.**

Clinical compositions are never updated after insertion. A correction is a new composition that references the superseded one. There are no UPDATE statements on the `compositions` table outside of administrative correction workflows. JSONB rewrite cost on `compositions` is therefore zero in normal operation.

For all other tables (`resources`, `episodes`, `slots`, `tasks`, `pathway_step_instances`): **high-churn fields — status, counters, timestamps of state transitions — are typed columns, never inside JSONB.** The `attributes JSONB` column on `resources` holds stable, rarely-written extension metadata. If a field is written more than a few times per day per row, it must be a typed column on a normalised row.

#### B. TOAST and large out-of-line blobs

PostgreSQL moves column values out-of-line once a row exceeds approximately 8 KB (TOAST threshold). Out-of-line values require a separate heap fetch on read and a chunk rewrite on update. For append-only data this is a read overhead; for mutable JSONB it is a write cliff.

**Mitigation — archetype discipline and projection typing.**

Well-designed archetypes model one focused clinical concept. A vital signs composition should contain only vital signs; an anaesthetics induction record only its fields. In practice a disciplined composition remains well under the TOAST threshold. A composition that approaches or exceeds it is a symptom of an archetype that is doing too much.

Projection tables are typed-column tables — never JSONB summaries. A "current medications" projection is not a JSONB array growing with each new medication order; it is a set of rows with typed columns indexed independently. Projections carry no TOAST risk.

If a specific archetype is known to produce large compositions (e.g., a full ICU daily round), the storage strategy for that table can be adjusted:

```sql
ALTER TABLE compositions ALTER COLUMN content SET STORAGE EXTERNAL;
-- EXTERNAL: stored out-of-line uncompressed.
-- Avoids compression round-trip on the occasional large read.
-- Acceptable for append-only data where update cost is irrelevant.
```

#### C. GIN index write cost

A GIN index on a JSONB column inverts every key-value pair in every document. An INSERT to a composition with 40 fields generates 40+ GIN index entries. Under sustained ward load this adds measurable per-write overhead, creates index bloat, and makes VACUUM work harder.

**Mitigation — no GIN on the composition content column.**

```sql
-- Correct: B-tree indexes on structured columns only
CREATE INDEX ON compositions (episode_id);
CREATE INDEX ON compositions (ehr_id, recorded_at DESC);
CREATE INDEX ON compositions (archetype_id, recorded_at DESC);

-- Never:
-- CREATE INDEX ON compositions USING GIN (content);
```

Queries against clinical content go through typed-column projection tables, not through GIN scans of the composition store. The composition table is write-optimised; the projection tables are read-optimised. These are different tables with different index strategies.

GIN indexes may be justified on `resource_extensions` (key lookup by namespace + key) or on specific small lookup tables where containment queries are genuinely needed — but only when a specific query requirement has been identified, never pre-emptively.

#### Summary

| Concern | Root cause | Mitigation |
|---|---|---|
| JSONB rewrite on churn | MVCC rewrites full blob on UPDATE | Compositions are append-only; status fields are typed columns |
| TOAST on large blobs | Out-of-line storage triggers on large rows | Archetype discipline keeps compositions small; projections use typed columns |
| GIN write cost | GIN indexes every key on every INSERT | No GIN on composition content; queries routed through projection tables |

The append-only property of clinical compositions is architecturally load-bearing. It is what makes PostgreSQL JSONB viable for the clinical record under sustained write load.

---

