## 24. Patient Data Management System (PDMS)

### 24.1 What a PDMS Is

A **Patient Data Management System** is the clinical computing environment of the intensive care unit. It replaces paper charts at the bedside with:

- Continuous automated collection of data from all bedside devices (monitor, ventilator, infusion pumps, dialysis machine)
- Real-time display of trends, alarms, and scores at the bedside
- Clinical charting: nursing assessment, fluid balance, drug administration
- Automated calculation of severity scores (SOFA, APACHE II, SAPS III)
- Medication safety: weight-based dosing, infusion rate calculation, drug interaction checking
- Fluid balance: continuously computed from infusion pump rates and output measurements

The PDMS is the most data-intensive domain in the EHR. A single ICU patient on full monitoring generates on the order of 10 million data points per day from continuous parameter streams alone.

### 24.2 PDMS as an Integrated Domain, Not a Silo

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

### 24.3 Device Integration Gateway

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

### 24.4 Real-Time Display

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

### 24.5 Fluid Balance

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

### 24.6 Severity Scores

SOFA, APACHE II, and SAPS III are computed from data already in the system — labs, vitals, ventilator parameters, GCS assessment. Score computation is:

- Triggered by each relevant composition stored or time series update
- Runs as a background task (not on the critical write path)
- Writes the result as a new composition (`severity_score.v1`) and updates a projection
- Exposed in the bedside view as a trending value with contributing factors

Because all inputs are already in the composition store and time series, the score calculation requires no additional data capture. It is a pure derivation — like the projections discussed in earlier sections, but with more complex logic.

### 24.7 Data Intensity and Throughput

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

### 24.8 The Timeline: Three Zones

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

TimescaleDB compressed chunks. Raw values are no longer served. Only continuous aggregates (1-minute, 1-hour) are available. Medicolegally flagged windows (see §24.9) are exempted.

**Zone transitions in the UI** must be seamless. When a user scrolls the bedside trend left from real-time into history, the WebSocket subscription is released and the view switches to API-fetched aggregated data. Scrolling back to now reconnects the WebSocket and stitches the gap. The user perceives a single continuous timeline.

### 24.9 Rendering: Strip Chart vs Historical Chart

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

### 24.10 Data Retention and Compression

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

### 24.11 ICU and Anaesthesia Dashboard

The ICU and anaesthesia dashboard is the primary clinical interface at the bedside — a purpose-built, context-sensitive view designed around the information needs of intensive care and anaesthesia professionals.

**Display modalities:**

| Modality | Use case |
|---|---|
| **Strip chart** | Real-time continuous parameters (HR, BP, SpO₂, EtCO₂, ICP). Oscilloscope model — new data scrolls in from right. Canvas-rendered; sub-second latency. |
| **Trend curve** | Historical parameter view over configurable windows (1 h, 4 h, 8 h, 24 h, 7 days). LTTB-downsampled. Supports overlay of multiple parameters on dual-axis. |
| **Numeric panel** | Large-format current value with colour coding (normal / warning / critical bands). Visible from 3 m. |
| **Tabular / flowsheet** | Hourly columns × parameter rows. Standard ICU chart view; manual entry cells alongside device-fed cells. |
| **Score timeline** | SOFA, APACHE II, NEWS2 plotted as a step chart over the ICU stay. Annotated with clinical events (intubation, vasopressors, surgery). |
| **Text sidebar** | Latest nursing note, latest physician note, open clinical notices (§9.4) — visible without leaving the bedside view. |

**ICU dashboard layout — bedside view:**

```
┌─────────────────────────────────────────────────────────────────────┐
│ PATIENT HEADER: Name | DOB | Episode | Attending | LOS | FLAGS      │
├───────────────┬─────────────────────────────┬───────────────────────┤
│  VITALS STRIP │   INFUSIONS & MEDICATIONS   │  SCORES & ALERTS      │
│  HR ──────╮   │  Noradrenaline  0.08 µg/kg/m│  SOFA  8 ▲            │
│  BP ──────┤   │  Propofol       2.0 mg/kg/h │  NEWS2 7 ⚠            │
│  SpO₂─────╯   │  Insulin        3 IE/h      │  RASS  -2             │
│               │  NaCl 0.9%     125 ml/h     │  SOFA trend ─╮        │
├───────────────┴─────────────────────────────┤  ────────────╯        │
│  FLUID BALANCE                              │  PENDING TASKS (3)    │
│  IN: 1847 ml   OUT: 1320 ml   BAL: +527 ml  │  □ 14:00 BS check     │
├─────────────────────────────────────────────┤  □ 15:00 positioning  │
│  RECENT LABS (last 6 h)                     │  □ 16:00 SOFA recalc  │
│  Hb 8.1↓  K 3.8  Lac 1.4  CRP 142↑  PCT 4.2│                       │
└─────────────────────────────────────────────┴───────────────────────┘
```

The layout is configurable per ward and per user preference. A ward administrator defines the default column layout; individual clinicians can adjust panel sizes and pin preferred parameters.

**Parallel views:** The same patient data is simultaneously accessible in the patient app (§51.6) in a simplified read-only format. The PDMS dashboard and the patient app render from the same underlying data — no duplication.

**Anaesthesia-specific dashboard:** Configured for the operating theatre. Adds over the ICU view:
- Anaesthetic agent: MAC value (end-tidal volatile relative to minimum alveolar concentration)
- BIS / depth-of-anaesthesia index
- Neuromuscular blockade (TOF ratio)
- Airway parameters: peak inspiratory pressure, PEEP, compliance, EtCO₂ waveform
- Infusion totals: cumulative drug doses given over the procedure

### 24.12 Organ-Specific Views

Pre-configured organ-system lenses collapse all parameters and results relevant to one physiological system into a single view, accessible from the dashboard via tab or sidebar selector.

| Organ view | Parameters and data included |
|---|---|
| **Cardiovascular** | HR, BP (arterial, mean), CVP, PAP/PAOP, CO/CI, SVR, lactate trend, ECG strip, vasopressor doses, fluid balance |
| **Respiratory** | SpO₂, FiO₂, P/F ratio, PEEP, plateau pressure, driving pressure, tidal volume, minute volume, compliance, EtCO₂, blood gas trend (pH, pCO₂, pO₂, HCO₃, BE) |
| **Renal** | Urine output ml/h (last 6 h), urine output ml/kg/h, cumulative 24 h, creatinine trend, electrolytes, CRRT parameters (if active): effluent rate, replacement rate, filter age, cumulative fluid removal |
| **Neurological** | GCS trend, pupillary response (size, reactivity), BIS, RASS/SAS sedation score, ICP (if monitored), CPP, sedative and analgesic doses |
| **Haematological** | Hb trend, platelet trend, PT/INR, APTT, fibrinogen, TEG/ROTEM results, blood product administration history |
| **Infectious / Inflammation** | Temperature trend, WBC, CRP, PCT, culture results with organism and resistance pattern, active antibiotics with duration and next review date |
| **Hepatic** | Bilirubin, ALT, AST, GGT, alkaline phosphatase, INR, albumin, ammonia |
| **Nutrition / Metabolic** | Blood glucose trend with insulin overlay, enteral/parenteral nutrition rates, phosphate, magnesium |

Each organ view is the entry point for the relevant PDMS order set (§24.15): e.g., the Respiratory view surfaces the "Ventilator weaning protocol" action.

### 24.13 Backfilling — Offline Data Capture

Clinical monitoring does not pause when a patient leaves the ICU. The backfill mechanism imports retrospectively recorded data with full timestamp fidelity.

**How it works:** The portable monitoring device records locally during the offline period. On network reconnection or ICU admission, the device transmits a historical block. The device gateway:

1. Identifies the message as a historical block (protocol flag or past timestamps)
2. Inserts rows into `observations_ts` with original timestamps; `ingestion_type = 'backfill'`
3. Emits `pdms.backfill_complete`; the bedside display reloads the timeline

Backfilled data is visually distinguished on the trend chart (subtle background tint) so clinicians can identify retrospectively-loaded segments. Alarms that would have fired during the offline window are retrospectively flagged in the alarm log but do not generate live alerts.

**Scenario coverage:**

| Scenario | Mechanism |
|---|---|
| **In-house transport** (ICU → CT, ICU → OR) | Transport monitor records offline; backfill on ICU return. No manual re-entry. |
| **Shock room** | Portable unit records from arrival; backfill into ICU episode on admission. |
| **Delivery room** | Neonatal resuscitation unit records from minute 1 of life; backfill into NICU episode on admission, linked to mother's episode via `parent_episode_id`. |
| **Collaboration hospital** | Offline-capable tablet documentation; transmitted on return or via VPN sync. |

Maximum offline window: 24 hours. Beyond this, data is accepted but flagged for clinical review.

### 24.14 Device Tracking and Asset Management

**Device record:**

| Field | Description |
|---|---|
| `device_id` | Internal identifier |
| `serial_number` | Manufacturer serial |
| `device_type` | Ventilator, infusion pump, monitor, dialysis machine, … |
| `last_calibration` / `next_maintenance_due` | |
| `status` | `available` / `in_use` / `out_of_service` / `maintenance` |
| `current_patient_id` | Null if unassigned |
| `current_location` | Ward / room / bay / storage ID |

**Location tracking** — three mechanisms used in combination:
- **Manual check-in/out**: nurse scans device QR/barcode on patient panel at connection/disconnection
- **Network registration**: IP address resolved to room via static IP-to-room mapping
- **BLE beacons** (optional): passive location sensing; updates location record automatically

**Maintenance workflow:** Medical engineering staff log calibration and servicing events via a restricted maintenance view. Status changes to `out_of_service` automatically when maintenance is overdue. Device history is fully auditable — every location change and status transition is logged.

**Ordering and assignment:** When a clinician orders a device for a patient (e.g., "CVVH machine required"), the system suggests available, in-service, appropriately calibrated devices nearest to the patient's room. Assigning a device updates `current_patient_id` and `current_location`.

### 24.15 PDMS Standardised Order Sets

PDMS order sets are ICU-specific protocol bundles activated during ongoing intensive care, distinct from the admission schemas (§16.1).

**Examples:**

| Order set | Contents |
|---|---|
| Sedation and analgesia | Propofol / midazolam infusion, opioid infusion, RASS target, daily sedation interruption reminder |
| Vasopressor protocol | Noradrenaline with escalation steps, vasopressin add-on at threshold dose, MAP target |
| Lung-protective ventilation | Tidal volume 6 ml/kg IBW, PEEP/FiO₂ table, plateau pressure limit, prone trigger criteria |
| Post-cardiac surgery | Chest drain management, temporary pacing settings, anticoagulation start, extubation criteria |
| Sepsis bundle (1-hour) | Blood cultures ×2, lactate, broad-spectrum antibiotics, 30 ml/kg crystalloid, vasopressor if MAP < 65 |
| Ventilator weaning | RSBI check schedule, SBT protocol, extubation readiness checklist |
| Renal replacement (CVVH) | Filter type, blood flow, effluent dose, anticoagulation, electrolyte replacement, filter change schedule |

Each set is versioned and linked to its evidence base. Individual orders within the set can be accepted, adjusted, or declined. Countersignature by an attending physician is required for sets activated by nursing staff.

### 24.16 Data Correction and Wrong-Patient Documentation

Misattributed documentation — data recorded on the wrong patient — must be correctable without silent deletion.

**Correction mechanism:**

1. The correcting clinician identifies the composition(s) to correct and invokes "Correct misattribution"
2. The correct patient is identified (search by name, DOB, or ID)
3. A **correction record** (`correction.v1`) is created, referencing both the original composition(s) and the correct patient
4. The original composition is marked `status = 'corrected'` — never deleted
5. The correct patient record receives a copy with a `corrected_from` reference and the original timestamp
6. Both records display a correction notice; corrections appear in all audit exports

**Closed case correction:** After episode closure, a correction request requires supervisor confirmation with appropriate authority. The request, confirmation, and correction are all stored as immutable records.

**Prevention:** The PDMS surfaces a patient-identity confirmation at every new composition entry point — name, DOB, photograph (if enrolled), and room number. Medication administration and procedure documentation require active confirmation, not passive display.

---

