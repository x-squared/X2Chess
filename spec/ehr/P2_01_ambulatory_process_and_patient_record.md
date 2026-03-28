## 6. Ambulatory Process and Patient Record

The ambulatory polyclinic visit involves two distinct roles working in concert — the physician and the MPA (§3.1) — across four phases: planning, preparation, encounter, and close. The system supports all four phases without requiring the user to move between disconnected applications.

### 6.1 Ambulatory Patient Record Structure

The ambulatory patient record is a purpose-built view over the same underlying data model as the inpatient record — not a separate record. It is optimised for the outpatient context.

**Physician view** presents, simultaneously: active problem list, current medications, relevant prior findings (last visit summary, outstanding results), open orders, upcoming appointments, and the current encounter composition. The physician never navigates away to find context that belongs on one screen.

**MPA view** presents: today's appointment list with patient statuses, pending administrative tasks (unsigned consents, missing insurance data, isolation flags), checklist states per patient, service capture for billing. Clinical content is visible only at the level needed for the MPA role.

Both views are derived from the same data via role-scoped projection tables — no data duplication.

### 6.2 Ambulatory Treatment Pathway Planning

Ambulatory care is frequently longitudinal. A patient with a chronic condition or post-surgical follow-up has a planned sequence of visits, diagnostics, and reviews extending over months. The system supports this as an ambulatory clinical pathway:

- A sequence of visits and diagnostic orders is planned at the start of the care episode
- Appointment scheduling for subsequent steps is linked to clinical dependencies: "book the follow-up appointment after the MRI result is available" is a first-class scheduling rule, not a free-text instruction
- The patient can view their planned care sequence in the patient app and request changes
- The MPA can advance or adjust the plan from the scheduling context without physician involvement for routine bookings

This reuses the pathway engine (§13) applied at the ambulatory episode level.

### 6.3 Resource-Efficient Planning

The scheduling system promotes efficient use of clinical resources:

- Appointment templates define consultation durations by type: new patient, follow-up, procedure, teleconsultation
- **Clustering**: when a patient needs multiple appointments (bloods + ECG + consultation), the booking coordinator can schedule them in sequence on one visit rather than on separate days — reducing patient journeys and resource fragmentation
- **Capacity dashboards** show utilisation per resource and per time slot; overbooking risks are flagged before confirmation
- **Appointment staggering**: the system identifies windows where predicted arrivals would exceed waiting room capacity and suggests spreading

### 6.4 Efficient Patient Admission

**Self check-in** is supported via kiosk (in the waiting area) and the patient app. On check-in:
- Patient confirms identity (QR code on appointment confirmation, or AHV card)
- Demographics are verified; the patient confirms or updates contact details
- Room assignment is displayed
- The MPA's dashboard updates immediately: patient status changes from "expected" to "arrived"

**Digital pre-admission forms** are sent to the patient via the app at a configurable interval before the appointment (e.g., 48 hours). Forms include:
- Reason for visit update
- Current medication list confirmation
- Consent forms (digital signature)
- Screening questionnaires (fall risk, pain, mood)

Forms completed before arrival are available to the MPA at check-in. The MPA reviews, not re-enters. If forms are not completed before arrival, they can be completed on a waiting area tablet.

Pre-populated intake: returning patients have demographics, medication list, and known allergies pre-populated. The MPA confirms changes; the system never prompts for data that is already known.

### 6.5 Checklists

Checklists are configurable task sets attached to appointment types. They are first-class objects, not free-text notes.

**Standard checklists** are defined per appointment type by clinical informaticians (§3.4):
- All endoscopy appointments: signed consent ✓, fasting confirmed ✓, allergy check ✓, isolation status checked ✓
- All new outpatient consultations: insurance verification ✓, ATCD questionnaire completed ✓, preferred language confirmed ✓

**Patient-specific overrides**: individual items can be added or pre-satisfied based on the patient record. A patient with a known MRSA history has the isolation flag set automatically. A patient who signed a consent form during a prior episode may have that item pre-checked with the prior consent linked.

**Blocking vs advisory**: each checklist item is configured as blocking (the encounter cannot proceed until resolved) or advisory (displayed but not blocking). The physician and MPA both see checklist state in real time; a blocked item is visually prominent and prevents the encounter from being marked as started.

### 6.6 Real-Time Patient Flow and Communication

The patient's status within the polyclinic visit is tracked and broadcast to staff and, where appropriate, to the patient.

**Status transitions:**
```
Expected → Arrived (self check-in or MPA)
  → In waiting area
  → Called to room (push notification to patient)
  → In examination room (MPA or automatic room sensor)
  → Examination complete
  → Discharged
```

Status transitions are triggered by: self check-in, room assignment actions by MPA, explicit marking by staff. Some transitions can be triggered by room sensors or RTLS (real-time location system) if deployed.

**Patient-facing communications:**
- Current expected waiting time: shown in the patient app and on waiting area screens, updated in real time as the schedule shifts
- Delay notification: if the physician is running more than a configurable threshold late, the system pushes an updated estimate to waiting patients
- Room notification: when the patient's room is assigned and ready, a push notification is sent with the room number

**Wait-elsewhere model**: the patient is not required to sit in the waiting room. They can wait in the cafeteria, pharmacy, or outside — the room notification reaches them wherever they are. This reduces waiting room density and is the default model for appointments with long or unpredictable waiting times.

**Capacity management**: maximum waiting room occupancy is configurable. When the threshold is reached, arriving patients are directed to alternative waiting areas. The appointment staggering tool reduces the frequency of capacity peaks.

### 6.7 Examination Workflow and Documentation

During the encounter the physician and MPA have parallel but coordinated views.

**MPA tasks during encounter**: vital signs entry, equipment setup confirmation, procedure checklist execution, dictation transcription review (where applicable), service block pre-selection.

**Physician tasks during encounter**: history taking (voice or structured entry), physical examination documentation, order entry, prescription, diagnosis coding, and encounter note. The note template is pre-populated from the current encounter context (see §6.8).

Equipment and room resource bookings (ultrasound, ECG machine, procedure room) are managed within the encounter flow using the resource scheduling model (§44.3).

### 6.8 Automated Report and Encounter Note Generation

The encounter note begins as a structured draft, not a blank page. The system assembles:

| Report component | Source |
|---|---|
| Active diagnoses | Problem list + diagnoses entered in this episode |
| Anamnesis synopsis | Structured anamnesis compositions, AI-summarised (§36) |
| Findings at presentation | Examination compositions from current encounter |
| Progress entries | Notes from prior encounters in this episode |
| Vital parameters | Latest projection values + trend |
| Laboratory findings | Released LIS results with reference ranges |
| Interventions | Procedure compositions from this episode |
| Medications | Current medication list |

The physician reviews the draft, edits where necessary, and signs. The signed note enters the record as a composition. The AI-generated portions are clearly marked; every component links to its source record. The original source compositions are never modified.

For referral letters and discharge summaries from an ambulatory episode, the same assembly mechanism applies with an appropriate template.

### 6.9 Service and Billing Capture (Leistungserfassung)

Swiss outpatient billing (TARMED / TARDOC) is captured primarily through **service blocks** (Leistungsblöcke) — predefined bundles of tariff positions corresponding to a consultation or procedure type:

- A "standard outpatient consultation" block captures the base TARMED/TARDOC positions automatically when the encounter is closed
- Procedure blocks (ECG interpretation, minor surgical procedure, spirometry) are added by the MPA or physician during or after the encounter
- Individual tariff positions within a block can be added, removed, or adjusted before finalisation
- The billing close is a distinct step at the end of the encounter, separate from the clinical documentation close

Service capture is a task for the MPA in the outpatient context. The physician focuses on clinical content; the MPA handles billing documentation. Both roles see the same encounter record; service items are a non-clinical overlay on top of it.

---

