## 47. Time Series Data

### 47.1 The Landscape of Clinical Time Series

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

### 47.2 Storage: TimescaleDB

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

### 47.3 Extensibility: Series Type Registry

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

### 47.4 Mapping to a Visual Curve

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

