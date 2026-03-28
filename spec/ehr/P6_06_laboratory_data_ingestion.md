## 48. Laboratory Data Ingestion

### 48.1 The Complexity of Lab Data

Laboratory results appear simple — a number with a unit — but carry significant hidden complexity:

- **Panels vs individual results**: a full blood count is a single order producing 15+ individual observations (Hb, WBC, platelets, MCV, etc.)
- **Reference ranges are not fixed**: the same Hb value has different normal ranges for a male adult, a pregnant woman, a neonate, and a patient at altitude
- **Result status lifecycle**: preliminary → final → corrected (delta check triggered) → cancelled
- **Microbiology is structurally different**: cultures grow over time; sensitivity panels are nested under isolates; qualitative interpretations ("resistant", "sensitive") alongside numeric MIC values
- **Critical values**: certain results require immediate clinician notification regardless of workflow state
- **Units vary by analyser and laboratory**: glucose reported as mmol/L in most of Europe but mg/dL in the US; the system must normalise on ingest

### 48.2 Ingestion Architecture

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

### 48.3 LOINC Mapping

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

### 48.4 Reference Ranges and Critical Values

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

### 48.5 Lab Results as Time Series

Individual numeric analytes are written to `observations_ts` at ingest alongside the full composition. This makes lab trending identical to vital sign trending architecturally — the same chart engine, the same series type registry, the same continuous aggregate mechanism.

The key difference is that lab series are **irregular** (no fixed frequency), so the continuous aggregate produces sparse time buckets. The chart engine must handle missing buckets gracefully, rendering discrete points rather than a continuous line for infrequent analytes such as HbA1c.

---

