## 28. Multi-Resource Planning (MRP)

Multi-resource planning is the horizontal scheduling layer that coordinates all bookable resources — persons, rooms, devices, modalities, and beds — across every clinical domain. It is not limited to a single department; it operates hospital-wide and integrates with departmental systems (OR scheduling §22.1, ED §21, therapy §26, PDMS) as its execution layer.

### 28.1 Conceptual Foundations

**Resource-first model:** Every bookable entity is a typed resource with its own calendar, rule set, and constraints. Appointments are intersections of resource calendars; the scheduling engine resolves these intersections under the configured rule set.

**Resource types:**

| Type | Examples |
|---|---|
| Person | Physician, nurse, therapist, anaesthetist, technician |
| Room | Examination room, OR suite, therapy gym, MRI suite, consultation office |
| Device / modality | MRI, CT, endoscopy tower, OR C-arm, infusion chair |
| Bed | Inpatient bed, day-surgery chair, ICU bed, isolation room |
| Equipment set | Instrument tray, anaesthesia machine, physiotherapy equipment |

Each resource can belong to one or more **resource groups** (e.g. all physiotherapists, all MRI scanners); scheduling rules can target the group, allowing automatic assignment of the best-fit individual resource.

**Constraint types:** Availability hours, skill or certification requirements, room capability flags (e.g. isolation-capable, bariatric-equipped), maintenance windows, gender assignment, insurance-class assignment, patient acuity level.

---

### 28.2 Scheduling Capabilities and Automations

#### 28.2.1 Planning Automations

The scheduler provides the following automated support:

- **Best-fit slot search:** Given a set of resource requirements and a time window, the engine returns ranked available slots. Ranking criteria are configurable: minimise travel time, maximise resource utilisation, respect patient preference (morning/afternoon, location), respect urgency.
- **Chain scheduling (Kettentermine):** Linked sequences of appointments (e.g. physiotherapy 1×/week for 9 sessions, or a pre-op assessment → surgery → post-op review chain) are booked as a group. The system finds a slot for the first appointment and derives all subsequent appointments respecting interval rules. When the prescription is near expiry, a renewal reminder is generated automatically.
- **Dependency resolution:** Pre-conditions for an appointment (laboratory results received, informed consent signed, pre-medication administered) are tracked. The scheduling engine shows an amber/red indicator next to any appointment whose pre-conditions are unmet; optionally, unmet pre-conditions can block confirmation of the appointment.
- **Parallel scheduling:** Where clinical protocol allows, appointments for multiple disciplines can be scheduled concurrently for the same patient (e.g. morning lab draw → simultaneous physiotherapy in adjacent room → afternoon physician review).
- **Urgency tiering:** Each appointment carries a planning urgency tier (routine / elevated / urgent / emergency). The scheduler prioritises waiting-list placement and slot search accordingly; emergency appointments can pre-empt lower-priority bookings with automatic notification to affected parties.

#### 28.2.2 Shift Plan Integration

Staff availability in the scheduler is fed from the duty-planning (Dienstplanung) system via a bidirectional interface. When a nurse or physician is on leave, on night shift, or assigned to a different unit, the scheduling engine reflects their unavailability in real time. Shift plan changes propagate to all open appointments; affected bookings are flagged for review and re-assignment.

---

### 28.3 Integrated Resource Overview

#### 28.3.1 Hospital-Wide Waiting-List

A consolidated waiting-list view aggregates all unscheduled referrals and requests across the institution:

| Level | View |
|---|---|
| Hospital-wide | All pending referrals, sorted by urgency and age |
| Clinic | Pending referrals for the clinic's services |
| Department / unit | Pending referrals for the unit's specific resources |

Each item shows: patient, requested service, urgency, days waiting, responsible clinician, and unmet pre-conditions. Filters and search allow coordinators to identify patients waiting longest or those closest to a clinical deadline.

#### 28.3.2 Integrated Planning Monitor

A real-time planning monitor shows the utilisation state of all resources:

- **Occupancy grid:** Resources on the Y-axis, time slots on the X-axis; colour-coded by utilisation (free / reserved / confirmed / occupied / maintenance).
- **Drill-down:** Clicking any cell opens the booked appointment or the resource's rule configuration.
- **Conflict view:** Cells with scheduling conflicts (double-booking, unmet pre-condition, resource under maintenance) are highlighted with the conflict type.

#### 28.3.3 Single-Resource View

Any individual resource (a specific MRI scanner, a named physician, a therapy room) can be viewed in isolation: its weekly calendar, upcoming appointments, maintenance windows, and historical utilisation rate. This view is used for ad-hoc planning, maintenance scheduling, and performance review.

---

### 28.4 Stakeholder Integration

The planning system integrates all relevant parties:

| Stakeholder | Integration |
|---|---|
| **Patient** | Self-service booking and slot confirmation via patient app (§36.1); appointment reminders and status via app |
| **Referring physician (internal)** | Referral orders placed in CPOE flow directly into the waiting list |
| **External referrer** | Referrer portal (external referrer chapter) allows direct slot booking for approved services |
| **Family / proxy** | Appointment visibility and reminder sharing via proxy access (§36.1.5) |
| **External care partner** | Partner portal (§36.7) shows upcoming appointments for their patients; can receive handover tasks |
| **Third-party scheduler** | HL7 SIU/ACK messages for interoperable appointment exchange |

---

### 28.5 Pre-appointment Dependency Tracking

Each appointment type carries a configurable **pre-condition checklist** evaluated automatically before the appointment date:

- Lab results required: specified panels, recency window (e.g. Hb within 14 days)
- Informed consent signed
- Pre-medication prescribed and dispensed
- Imaging available
- Anaesthesia pre-assessment complete (for surgical appointments)
- Insurance authorisation (Kostengutsprache) confirmed

The appointment's status indicator (traffic light) reflects the completeness of pre-conditions:
- Green: all pre-conditions met
- Amber: one or more pre-conditions pending with time remaining
- Red: one or more pre-conditions overdue or failed

The responsible coordinator receives a daily digest of appointments with amber/red status for the coming days, with direct links to the outstanding tasks.

---

### 28.6 Deposit and Self-Pay Management

For self-paying patients and cases where a deposit (Depot) is required:

- The financial module calculates the required deposit based on the planned procedure, expected length of stay, and insurance class.
- A deposit request is generated and sent to the patient (via app, email, or letter) with payment instructions (IBAN, TWINT QR code, online payment link).
- Payment status is tracked in real time via the financial integration (SAP IS-H): confirmed / partially paid / overdue.
- The scheduling module shows the payment status on the appointment record; configurable rules can flag or block appointment confirmation if the deposit is not received by a defined deadline.
- Overdue deposits generate automatic reminders to the patient and a task for the patient administration team.

---

### 28.7 External Appointment Booking Integration

Slots designated for external booking (by patients, referrers, or partners) are managed within the same scheduling engine:

- A subset of capacity is marked as **externally bookable** per service type, time window, and patient class. This designation is managed by the planning coordinator.
- External bookings made via the patient app, referrer portal, or partner portal occupy the same calendar as internal bookings; double-booking is prevented by the same conflict engine.
- The planner has a **parallel view** showing internal vs. externally reserved capacity to monitor balance and adjust the externally bookable quota.

---

### 28.8 Cross-Departmental and Interdisciplinary Planning

The scheduler supports appointments that span multiple departments or involve shared resources:

- **Interdisciplinary consultations and MDT conferences:** A conference appointment books a room, all participating clinicians, and any required AV equipment simultaneously. Participant calendars are checked for conflicts; the system proposes the earliest slot where all required participants are available.
- **Shared equipment:** High-cost devices (MRI, CT, endoscopy towers) are managed as shared resources with their own calendars; any department booking the device is subject to the same conflict checks.
- **Bed management (live view):** Real-time occupancy of all bed types — general ward, semi-private, private, isolation, bariatric, ICU — is visible in the planning module. Bed availability feeds the admission scheduling workflow so that elective admissions can be planned against projected bed availability.

---

### 28.9 Process Planning (Linked Resource Chains)

Procedure-linked resource sequences are managed as **process templates**:

**Example — Knee arthroscopy:**

| Step | Resource | Duration | Dependency |
|---|---|---|---|
| Pre-op assessment | Consultation room + anaesthetist | 30 min | ≥ 7 days before procedure |
| OR booking | OR suite + surgical team + instrument tray (optic, camera, shaver, irrigation) | 75 min | After pre-op complete |
| OR equipment reservation | C-arm + arthroscopy tower | Same slot as OR | Auto-linked |
| PACU | PACU bay + recovery nurse | 60 min | Immediately after OR |
| OR room cleaning | Housekeeping resource | 30 min | Immediately after PACU transfer |
| Post-op review | Consultation room + surgeon | 30 min | 2 weeks post-procedure |

The process template is applied when the procedure is booked; the scheduler books all linked resources simultaneously. The planner can override any individual resource assignment without breaking the chain. Changes to one link (e.g. OR time extended) propagate to downstream links automatically.

---

### 28.10 Workflow Management

#### 28.10.1 Appointment Types

| Type | Characteristics |
|---|---|
| **Single appointment with waiting list** | One patient, one slot; queue managed by urgency and waiting time |
| **Group appointment with waiting list** | Multiple patients per slot; capacity managed per §26.2 |
| **Chain appointments** | Linked sequence; booked together; cancellation of one triggers review of the chain |
| **Protocol-driven series** | Chemotherapy cycles, radiotherapy fractions — schedule derived from clinical protocol with automatic next-dose calculation |

#### 28.10.2 Urgency in Workflow

Urgency drives three scheduling parameters simultaneously:
- **Planning interval:** Maximum permissible wait from referral to appointment (e.g. urgent = ≤ 5 days, routine = ≤ 30 days)
- **Duration:** Urgency-dependent appointment duration (urgent cases may require longer first-contact slots)
- **Temporal adaptation:** Scheduling engine prioritises urgent cases in the slot-search ranking; waiting-list position is dynamically adjusted as new urgent cases arrive

---

### 28.11 Resource Rules Configuration

Resource groups can carry complex rule sets configured without code changes:

| Rule category | Examples |
|---|---|
| **Physical adaptation** | Room for bariatric patients: bed capacity ≥ 250 kg + bariatric-rated bathroom + patient lift available |
| **Skill grade** | Procedures graded by complexity require a resource with the corresponding certification level (e.g. only senior registrar or consultant for category-3 procedures) |
| **Insurance class** | Semi-private and private rooms assigned only to patients with matching insurance class; general rooms as overflow if patient consents |
| **Palliative / terminal care** | Rooms near family area; single-occupancy; family access rules applied |
| **Gender** | Rooms and some therapy resources assigned by gender preference; exceptions with patient consent |
| **Paediatric supervision** | Rooms with paediatric-compatible equipment; visitor policies include childcare escort |
| **Isolation** | Isolation rooms have negative/positive pressure flags; assigned only when isolation order is active; housekeeping protocols auto-triggered |
| **Infectious patient** | Contact-precaution flags applied; shared equipment blocked from re-use without decontamination confirmation |

---

### 28.12 Command Centre

The Command Centre is a real-time operational intelligence platform for hospital management and capacity coordinators.

#### 28.12.1 Real-Time Capacity Display

- **Hospital-wide occupancy:** Ward-by-ward bed occupancy (current and next 24 h projected), OR suite utilisation, ED census, imaging modality queue depth — on a single screen.
- **Prospective capacity:** Predicted admissions (from confirmed surgical lists, ED admission rate model, elective admissions) vs. available beds by specialty and bed type, projected 24–72 h forward.
- **Flow barrier detection:** Automated identification of bottlenecks: patients awaiting discharge placement, delayed discharges awaiting transport, labs holding up a procedure, bed requests with no available match. Each barrier is listed with age, responsible party, and suggested resolution.

#### 28.12.2 Decision Support and Simulation

- **Triage support:** Suggested resource reallocation (e.g. open a surge bay, redirect ED flow) when capacity indicators approach threshold.
- **Role-based resource management:** Staff assignments visible by role and unit; gap coverage suggestions generated when a shift has insufficient staffing.
- **Simulation mode:** Planners can model "what if" scenarios: what happens to bed availability if an additional elective list runs tomorrow; how does adding an extra PACU bay affect OR throughput.

#### 28.12.3 Patient Flow Prediction

- **Demand forecasting:** Machine-learning model predicts daily admissions, ED attendances, and OR case volumes based on: historical patterns, day of week, season, public holidays, and local event calendars.
- **Alert:** When predicted demand exceeds capacity by a configurable margin (e.g. bed occupancy projected to exceed 95 % within 48 h), an early-warning notification is sent to the bed management coordinator and hospital administrator on call.

#### 28.12.4 Benchmarking and Cockpit

The Command Centre cockpit provides comparative dashboards:
- Internal benchmark: current unit vs. same unit same period last year/month
- Peer benchmark: where institutional data-sharing agreements permit, performance vs. anonymous peer group
- KPIs tracked: OR first-case on-time start %, average length of stay by DRG, ED door-to-triage time, bed turnover time, imaging turnaround time

---

### 28.13 Trend Analysis and Demand Forecasting

- **Input variables:** Historical appointment and admission data, weekday/weekend patterns, public holidays (Swiss cantonal calendars integrated), school holiday periods, local weather (proxy for respiratory illness demand), and community infection surveillance data (BAG sentinel data feed).
- **Output:** Weekly rolling forecast for the coming 4–6 weeks by service line and resource type, with confidence intervals.
- **Capacity recommendations:** Where the forecast shows a persistent capacity gap, the system generates a structured recommendation (e.g. add one additional clinic session on Thursday afternoons for the next 6 weeks).
- **Retrospective analysis:** Actual vs. forecast variance is computed weekly; systematic over- or under-prediction triggers a model recalibration cycle.

---

### 28.14 Inter-Institutional Capacity Exchange

The planning module supports structured data exchange with external institutions:

- **Outbound:** Bed availability and planned discharge dates can be shared with referral hospitals, rehabilitation facilities, long-term care homes, and Spitex agencies via a secure FHIR-based capacity feed.
- **Inbound:** Receiving institutions signal available capacity (rehabilitation bed, Spitex slots) back to the discharge planning module; this data is visible on the patient's discharge planning record to support timely discharge decisions.
- **Staffing agencies:** For temporary staffing, the system can export shift vacancies to external staffing platforms via configurable API; confirmed placements appear in the shift plan.

---

### 28.15 Bed Planning and Best-Fit Bed Assignment

**Best-fit bed allocation** assigns the optimal bed to each patient at admission based on configured rules:

1. Patient's medical specialty requirement
2. Required bed capability (isolation, bariatric, telemetry)
3. Gender rules (room-level)
4. Insurance class
5. Predicted length of stay (DRG-based model) vs. bed availability over the projected stay
6. Proximity to relevant ward resources (e.g. high-dependency bay for post-surgical patients)

The algorithm returns a ranked list of matching beds; the bed coordinator confirms or overrides. The rationale for the top recommendation (which rules drove the ranking) is displayed.

**Automated bed pre-planning:** For elective admissions with a known admission date, the system pre-allocates a bed based on the criteria above. Pre-allocation is provisional and automatically updated if the patient's clinical profile changes or a higher-priority patient requires the bed. The coordinator is notified of pre-allocation changes.

---

### 28.16 Planning Proposals and Continuous Optimisation

- The scheduler continuously analyses the current planning state and generates **optimisation proposals**: cases that could be moved earlier to fill gaps, cases that can be grouped to improve resource utilisation, cases at risk of missing a clinical deadline.
- Proposals are presented in the planner's work queue with one-click accept/reject; the rationale for each proposal (which optimisation criterion it serves) is shown.
- Accepted proposals are applied; rejected proposals are logged with reason, feeding the optimisation model's learning cycle.
- **Decision explainability:** Every algorithm-generated recommendation (slot suggestion, resource assignment, optimisation proposal) displays the key factors that drove it (e.g. "selected because: earliest available slot for required skill grade, within urgency target, minimises patient travel time"). This allows planners to audit and override with confidence.

---

