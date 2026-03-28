## 22. Operating Theatre Management

This chapter covers the operational layer of the perioperative domain: OR scheduling and programme derivation, real-time patient tracking, situation dashboards, pre-operative preparation workflows, and intraoperative procedure documentation. Together these modules span the full perioperative episode from booking through to post-anaesthesia recovery.

### 22.1 OR Scheduling and OR Programme

The system provides discipline-specific OR scheduling that coordinates persons, operating rooms, equipment, and instruments across the full perioperative pathway.

#### 22.1.1 Slot Management

| Capability | Description |
|---|---|
| **Reservation** | Slots can be reserved for a named person, team, or specialty and released when no longer needed. |
| **Block booking** | Entire time blocks can be assigned to a specialty; the block is opened to general bookings if unused by a configurable deadline. |
| **Slot requests** | Clinical teams can submit requests with scheduling preferences (e.g. first case of the day, specific OR room, desired surgeon). A planner reviews and confirms or proposes an alternative. |
| **Urgency assignment** | Each booking carries a priority level (elective / urgent / emergency). Emergency cases can displace elective slots via a structured bump workflow with automatic notifications. |
| **Conflict detection** | The system validates every booking against all relevant dimensions — person availability, room occupancy, instrument and equipment reservation, and patient scheduling — before confirming. Conflicts are surfaced with specific reasons and suggested resolutions. |

#### 22.1.2 Resource Planning

Each procedure type carries a configurable **resource template** that pre-populates the booking request with expected requirements:

- OR room type and minimum duration (base time + setup/turnover time)
- Surgical team composition (specialty, minimum grades)
- Anaesthesia type and associated equipment
- Standard instrument sets and disposable packs
- Imaging or other ancillary equipment

Individual bookings can override any template value. Changes to a template propagate forward to future bookings with a review flag.

**Free-slot search:** Given a set of resource requirements (room, surgeon, instrument set) and a time window, the system returns available slots ranked by fit, utilisation impact, and requested preferences. The search explicitly supports finding slots across different OR suites, filterable by clinic-owned operating tracts.

**Utilisation prompts:** When a block or period has open capacity below a configurable threshold, the planner receives a prompt listing suitable elective cases awaiting scheduling that could fill the gap.

#### 22.1.3 Rescheduling and Cancellation

- Move or cancel any confirmed booking via a guided workflow that notifies all affected parties.
- Cascade impact is shown before confirming a move: downstream appointments (pre-op assessments, consults, bed bookings) that must also shift are listed and can be rescheduled in bulk.
- Cancellation reasons are structured and captured for quality reporting.

#### 22.1.4 Learning-Based Duration Prediction

Historical case durations are used as a predictive baseline:

- Average and percentile durations are computed per procedure code × surgeon combination.
- Duration estimates evolve as new cases are completed (rolling window, configurable horizon).
- Predicted duration is shown alongside the planner-entered duration at booking time; deviations are highlighted for review.
- Over- and under-run statistics feed the perioperative performance metrics in §23.4.

#### 22.1.5 OR Programme Derivation and Display

The confirmed bookings for a day or week are assembled into the **OR Programme** — the operational schedule that is distributed to all participating teams.

| View | Content |
|---|---|
| **Daily programme** | All cases for a given date, sequenced per OR room, with patient name/ID, procedure, expected times, team assignment, and urgency level. |
| **Weekly programme** | Condensed view per OR room, showing case load and blocked time across a 5–7 day horizon. |
| **Filtered views** | Planners and clinicians can restrict the display to: all rooms for a single day, a single OR suite, cases involving a specific surgeon or anaesthetist, or cases requiring a particular resource. |

The programme is published at a configurable cut-off time and distributed automatically (print, portal, messaging). Late additions or changes after publication are flagged visually and trigger targeted notifications to the affected team members only.

---

### 22.2 Perioperative Patient Tracking

The system tracks patient location in real time throughout the perioperative episode. Location data is sourced from ADT events, barcode/RFID scans, or manual status updates at clinical workstations.

#### 22.2.1 Location States

The following perioperative location states are recognised:

| State | Description |
|---|---|
| Pre-op ward | Patient on the originating ward, pre-operative preparation in progress |
| Holding area | Patient transferred to the perioperative holding / preparation area |
| Anaesthesia induction | Patient in the induction bay |
| Operating room | Patient in the OR (sub-states: positioning, preparation, time-out, procedure, sign-out) |
| Recovery (PACU) | Patient in the post-anaesthesia care unit |
| Post-op ward / ICU | Patient transferred back to ward or escalated to intensive care |

Each state transition is timestamped, attributed to the triggering user or system event, and appended to the case record.

#### 22.2.2 Automated Notifications

State transitions trigger configurable push notifications to relevant parties:

| Transition | Default recipients |
|---|---|
| Patient arrives in holding area | Anaesthetist, scrub nurse |
| Induction complete / patient in OR | Ward nurse (bed preparation cue), surgical team |
| Procedure sign-out complete | Recovery team, originating ward |
| Patient ready for discharge from PACU | Receiving ward nurse |

Notification channels (in-app, SMS, pager integration) are configurable per role and per institution.

---

### 22.3 OR Dashboards

Operational dashboards provide at-a-glance situational awareness for planners, charge nurses, and waiting-area staff.

#### 22.3.1 Daily OR Programme Dashboard

Targeted at charge nurses and OR coordinators:

- All cases for the current day, sequenced per room, showing scheduled vs. actual start, current state, and running late / on time / completed status.
- Real-time delay propagation: if a case overruns, downstream cases in the same room show a projected new start time.
- Drill-down into any case for team composition, resource status, and checklist completion.
- Turnover time between cases shown as a gap indicator; idle time beyond threshold is highlighted.

#### 22.3.2 Patient Location Board

Targeted at perioperative coordinators and team leads:

- Spatial overview of all active perioperative patients mapped to their current location (holding, induction, OR room 1–N, PACU bays).
- Room and bay occupancy displayed alongside patient state.
- One-click access to the active case record from any patient tile.

#### 22.3.3 Waiting-Area Progress Display

Targeted at patients' relatives in the pre-operative waiting area:

- Anonymised patient identifier (e.g. booking number or colour code) displayed with current perioperative phase.
- No clinical details, names, or diagnoses are shown.
- Display updates automatically as location states change; a completion notification is shown when the patient has left the OR.

---

### 22.4 Pre-operative Preparation

The system structures and monitors the preparatory work required before a patient enters the operating room.

#### 22.4.1 Pre-operative Checklists

Checklists are procedure-type-specific and configured by the institution. A standard template includes:

- Consent signed and documented
- Relevant laboratory results available and within acceptable limits
- Imaging results available and reviewed
- Anaesthesia pre-assessment complete
- Fasting status documented
- Pre-medication prescribed and administered
- Allergies confirmed and reconciled
- Site marked (where applicable)
- Blood products ordered / cross-match available

Each item specifies the responsible role and the latest acceptable completion time relative to procedure start. Incomplete mandatory items prevent the patient from being moved to the OR state. A supervisor override is available with a mandatory reason; it is recorded and generates a quality management notification.

**Status display:** The checklist is visible on the patient's perioperative summary with colour-coded completion status (complete / pending / overdue / blocked). The OR coordinator dashboard aggregates checklist completeness across all planned cases for the day.

#### 22.4.2 Material Packs

Procedure-specific standard material packs can be defined in the instrument and supply catalogue:

- A pack groups disposable materials, consumables, and supplies typically required for a given procedure type.
- Packs are linked to the procedure template (§22.1.2) and pre-selected on the booking request.
- Individual bookings can add, substitute, or remove items; deviations from the standard pack are flagged for supply coordination.
- Pack usage is fed back to the supply module for stock management and reorder triggering.

#### 22.4.3 Patient Positioning

The system records the complete positioning protocol for each case:

| Section | Fields |
|---|---|
| **Pre-operative baseline** | Existing skin integrity issues, pressure injuries, range-of-motion limitations, implants or devices (pacemaker, joint prosthesis) affecting positioning |
| **Planned position** | Named standard position (supine, prone, lateral decubitus, lithotomy, Trendelenburg, …) with position standard linked |
| **Positioning aids** | Each aid or support device used, with body location and responsible person |
| **Intraoperative changes** | Any repositioning or extension during the procedure: new position, reason, time, responsible person |

**Positioning standards:** Institutions define named positioning standards with diagrams, recommended aids, pressure-point precautions, and maximum duration guidelines. Standards are linked to procedure types and pre-populated at booking.

**Accountability:** Each positioning action is attributed to the responsible practitioner; the record is signed at case close.

---

### 22.5 Operative and Procedure Documentation

Procedure documentation is structured by discipline — surgery, anaesthesia, nursing, and positioning — with each discipline's view configured independently per institution and specialty.

#### 22.5.1 Discipline-Specific Configurability

Each institution can tailor documentation forms for their specialties. Two illustrative examples:

**Transplant surgery (e.g. renal transplant):**
- Cold ischaemia time, warm ischaemia time (measured and calculated)
- Donor organ details (source, preservation solution, transport conditions)
- Vascular anastomosis sequence and times
- Perfusion assessment findings
- Mandatory fields for SwissTransplant reporting

**Arthroscopic orthopaedics (e.g. knee arthroscopy):**
- Tourniquet application details (§22.5.7)
- Scope portal positions (named and diagrammatic)
- Intra-articular findings structured by compartment
- Implants placed (§23.3 implant record automatically linked)
- Physiotherapy instructions generated as a post-op task

Any specialty can be configured through the form builder without code changes.

#### 22.5.2 Diagnoses

Operative diagnoses are explicitly marked as such and distinguished from the pre-operative working diagnosis. The record captures:

- **Operative diagnosis** — confirmed findings at surgery (cannot be edited after sign-out without an amendment workflow)
- **Co-morbidities affecting surgery or recovery** — e.g. diabetes mellitus, anticoagulation, chronic kidney disease — recorded as contextual diagnoses for the episode
- The state of each diagnosis at the time of the procedure is frozen in the operative record; subsequent changes to the patient's problem list do not alter the signed operative record.

#### 22.5.3 Procedure Note

| Section | Content |
|---|---|
| **Indication** | Reason for surgery, linked to operative diagnosis |
| **Procedure performed** | Structured procedure code (CHOP) + free-text description |
| **Operative team** | Surgeon, assistant(s), scrub nurse, circulating nurse, anaesthetist (linked to user records) |
| **Operative technique** | Step-by-step narrative; supports structured templates for common procedures |
| **Post-operative instructions** | Analgesia, wound care, activity restrictions, follow-up appointments |

The procedure note is co-authored; team members sign their respective sections. The note is locked after attending surgeon sign-off; amendments require an amendment workflow with reason.

#### 22.5.4 Process Times

The following time-points are captured, validated for chronological order, and displayed on the case timeline:

| Time-point | Description |
|---|---|
| Patient arrives in holding | |
| Anaesthesia start | |
| Patient in OR | |
| Positioning complete | |
| Time-Out complete | |
| Incision (knife-to-skin) | |
| Wound closure start | |
| Wound closure end | |
| Anaesthesia end | |
| Patient out of OR | |
| Patient ready for discharge from PACU | |

Times can be entered manually or captured automatically from the patient tracking module (§22.2). Retrospective time entry is supported within a configurable grace period; later corrections require a supervisor override.

#### 22.5.5 Services and Material Consumption

- **Services:** Procedure codes (CHOP) are selected intraoperatively by the scrub or circulating nurse. Multiple procedures within the same case are supported, each attributed to the responsible surgeon and the relevant time window.
- **Materials:** Disposables, implants, and supplies consumed are recorded item by item with lot number and quantity. Pre-selected material packs (§22.4.2) are confirmed or adjusted; items added ad hoc are flagged for supply reconciliation.
- **Automation:** The system pre-populates service and material fields from the procedure template. Barcode scanning at the scrub table or supply trolley captures lot numbers and quantities without manual entry. Pre-populated items require positive confirmation rather than free-text entry, reducing transcription errors.

#### 22.5.6 Team Member Attendance

For each person in the operative team:

- **Presence periods:** In-time and out-time for each person (supports partial attendance, breaks, and handovers).
- **Role at each phase:** Scrubbed surgeon / first assistant / observer; scrub nurse / runner; attending anaesthetist / resident.

Presence records feed role-based competency logs and are used in billing (attributed service codes) and forensic audit.

#### 22.5.7 Count Control (Sponge, Instrument, and Sharp Count)

The system supports structured count management throughout the case:

- **Count events:** Opening count, first closing count, final closing count. Additional counts can be inserted at any time.
- **Count record:** Each item category (sponges, sharps, instruments) is counted by two persons; both sign the count record.
- **Discrepancy workflow:** A count discrepancy triggers a mandatory investigation workflow: re-count, surgical field search, and if unresolved, intraoperative imaging. The case cannot be closed with an unresolved discrepancy without a senior override and documented resolution.
- **Intentionally retained items:** Items knowingly left in situ (e.g. drain, haemostatic agent) are explicitly declared with item type, anatomical location, and clinical rationale; they are excluded from the discrepancy check and tracked for removal at a future encounter.
- **Accountability:** The practitioners responsible for each count record are named; the record is retained for the statutory retention period.

#### 22.5.8 Device and Instrument Documentation

Devices used during a case are documented by category:

| Category | Fields recorded |
|---|---|
| **Radiation-emitting devices** (e.g. C-arm, fluoroscopy) | Device ID, operator, exposure count, cumulative dose (if measurable), radiation protection measures applied |
| **High-frequency / electrosurgical units** (e.g. electrocautery) | Device ID, settings (coagulation / cutting, power level), active electrode type, patient return electrode placement and impedance check |
| **Accessory devices** (e.g. cell saver, warming blanket, pneumatic tourniquet) | Device ID, settings, start/stop times, operator |
| **Surgical instrument sets (trays)** | Tray ID, sterilisation lot number and expiry, set contents confirmed |
| **Loan instruments** | Loan set ID, supplier, delivery date, sterilisation record, return condition |

All device records are linked to the case and retained for traceability.

#### 22.5.9 Tourniquet, Bloodless Field, and Traction

For each tourniquet or bloodless field application:

| Field | Description |
|---|---|
| `body_part` | Anatomical location (e.g. left thigh, right upper arm) |
| `cuff_pressure` | Applied pressure in mmHg |
| `inflation_time` | Time of inflation (HH:MM) |
| `deflation_time` | Time of deflation (HH:MM); duration calculated automatically |
| `limb_occlusion_pressure` | Measured or estimated LOP, if documented |
| `skin_integrity_pre` | Skin condition under cuff site at application |

Multiple inflation–deflation cycles are supported per limb with cumulative ischaemia time calculated and compared against a configurable threshold alert.

For **traction** (e.g. orthopaedic table traction, skeletal traction):

| Field | Description |
|---|---|
| `body_part` | Anatomical location |
| `extension_degree` | Traction force or extension angle, as applicable |
| `start_time` / `end_time` | Duration calculated automatically |

#### 22.5.10 Specimen Documentation

Intraoperative specimens are documented as a structured list linked to the operative record:

| Field | Description |
|---|---|
| `specimen_type` | Tissue type or fluid (e.g. excised lymph node, bone biopsy, peritoneal wash) |
| `quantity` | Count or volume |
| `anatomical_site` | Structured body location |
| `laterality` | Left / right / midline / bilateral |
| `time_of_collection` | Timestamp |
| `collection_method` | Excision, incision, brush, aspiration, … |
| `handling_instructions` | Fresh / formalin-fixed / frozen section / microbiological transport |
| `chain_of_custody` | Person who collected → person who dispatched to lab |

Specimen records generate automatic laboratory orders (histopathology, microbiology, cytology) pre-populated with operative context. Each specimen is assigned a unique barcode printed at the OR workstation and scanned at the laboratory receiving desk to close the chain of custody.

#### 22.5.11 Unintended Intraoperative Events

Unintended events (e.g. intraoperative burn, iatrogenic injury, equipment failure causing patient harm) are documented as structured incident records attached to the case:

- Incident type (from configurable taxonomy)
- Body location affected
- Severity (CTCAE grade or local equivalent)
- Discovery time and circumstances
- Immediate management taken
- Responsible practitioner and witnesses

Records are stored for forensic and medicolegal purposes. Submission to the institutional incident reporting and patient safety system is triggered automatically; the case cannot be closed without at least a preliminary incident description. Incident records are retained for the statutory period regardless of case or patient record retention rules.

---

