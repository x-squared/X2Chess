## 26. Therapies

This chapter covers allied health and therapeutic services — physiotherapy, occupational therapy, speech therapy, dietetics, and comparable disciplines — from initial referral through group and individual sessions, nutrition management, and discharge planning.

### 26.1 Therapy Referral and Scheduling

#### 26.1.1 Data-Driven Therapy Proposals

The system generates therapy referral suggestions automatically based on structured clinical data:

- **Trigger inputs:** Medical diagnoses (ICD-10), nursing diagnoses (NANDA / ICNP), assessment scores (e.g. Barthel, FIM, MNA, NRS pain), documented symptoms, planned surgical procedures, and active care pathways.
- **Proposal logic:** A configurable rules engine maps clinical conditions to recommended therapy disciplines and intensities. For example: hip fracture → physiotherapy + occupational therapy + dietetics assessment; dysphagia documented → speech therapy referral; malnutrition risk (NRS ≥ 3) → dietetics.
- **Machine-learning layer:** Over time, accepted and rejected proposals are used to refine the suggestion model per unit and patient population. The model's recommendation confidence score is displayed alongside each proposal; the responsible clinician can accept, modify, or reject each suggestion with a reason. The model is retrained on a configurable schedule; version history is retained.
- **Workflow:** Generated proposals are routed to the responsible therapist for clinical validation (Vidierung) and then to the ordering physician for authorisation (Visierung) before a formal referral order is created. The approval chain is configurable per institution and discipline.

| Approval step | Role | System action |
|---|---|---|
| Proposal generated | System / CDS | Notification to therapist |
| Clinical validation | Therapist | Confirms appropriateness, adjusts intensity |
| Authorisation | Physician | Countersigns referral; CPOE order created |
| Scheduling | Therapist / coordinator | Session booked in therapy calendar |

#### 26.1.2 Referral Parameters

Each therapy referral carries:

- Discipline (physiotherapy, OT, speech therapy, dietetics, psychology, etc.)
- Urgency (routine / urgent / stat)
- Frequency and duration (e.g. 2 × 30 min/day, 5 days/week)
- Clinical question or treatment goal
- Relevant diagnoses and contraindications
- Requesting physician and responsible nurse
- Planned start date and linkage to discharge planning milestones

Referrals can be grouped into **referral sets** (Verordnungssets) for common clinical pathways (e.g. post-hip-replacement rehabilitation protocol) so that multiple disciplines are ordered with a single interaction and individually adjusted as needed.

---

### 26.2 Group Sessions

#### 26.2.1 Group Planning

Therapy groups are first-class scheduling entities, distinct from individual appointments:

- **Group definition:** Name, discipline, therapy type (e.g. balance training, pulmonary rehabilitation, lymphoedema class), default capacity (min/max participants), duration, required room and equipment.
- **Room and resource allocation:** The group session occupies a named therapy room; competing bookings for the same room are blocked. Equipment requirements are reserved alongside the room.
- **Recurrence:** Groups can be scheduled as recurring series (daily, weekly, custom pattern) for the duration of a patient's inpatient stay or a defined treatment episode.
- **Multi-location:** Groups running across more than one physical site (e.g. gym + hydrotherapy pool) are supported with separate room bookings linked to the same session record.

#### 26.2.2 Utilisation Optimisation

The system actively supports high group occupancy:

- When a patient is referred to a therapy type with available group sessions, the scheduler first suggests an existing group with remaining capacity before proposing an individual slot.
- A utilisation indicator shows current fill rate for each group session (e.g. 6/8 participants). Sessions below a configurable minimum occupancy threshold are flagged for review; the coordinator can merge under-subscribed sessions or re-assign participants.
- Waiting-list management: if all sessions for a therapy type are full, the patient is added to a waiting list and receives a slot automatically when a cancellation creates capacity.

#### 26.2.3 Absence Notifications

When a patient does not attend a scheduled group session:

- The ward nurse or patient registers the non-attendance (via task completion or automated absence detection from the location-tracking module §22.2 / §21.2).
- The responsible therapist receives an immediate in-app notification with the patient name, session, and reason (if documented).
- A rescheduling task is created automatically; the therapist confirms, reschedules, or closes the referral as appropriate.
- Repeated non-attendance generates an escalation notification to the treating physician and is documented in the patient's therapy record.

---

### 26.3 Photo Documentation

Photo documentation is integrated throughout the therapy record and the broader clinical documentation system (see also §21.3.6):

**Wound and skin assessment (physiotherapy, nursing):**
- Photos taken from a mobile device are uploaded directly to the patient record within the wound care or therapy note.
- Each photo is linked to the relevant body region on the avatar (§21.3.2), timestamped, and attributed to the capturing clinician.
- Sequential photos for the same wound site are displayed as a timeline, supporting visual progress tracking across dressing changes and therapy sessions.

**Functional assessment (physiotherapy, OT):**
- Short video clips of gait, balance tasks, ADL performance, or range-of-motion exercises are uploaded alongside the numerical assessment scores.
- Videos are stored encrypted and are accessible only to authorised clinical roles.

**Nutritional assessment (dietetics):**
- Meal photos captured by the patient (via the patient app §51.8) or by nursing staff are attached to the nutrition record. AI-assisted portion estimation (food recognition model) generates a draft calorie and macronutrient estimate that the dietitian reviews and confirms (see §26.4.4).

**Viewing and sharing:**
- All clinical photos and videos are viewable inline within the respective clinical note.
- Export for MDT discussions or medicolegal purposes follows the document export workflow with access logging.

---

### 26.4 Nutrition, Meal Ordering, and Dietary Management

#### 26.4.1 Nutritional Assessment and Planning

The system supports full nutritional care planning:

- **Screening:** Validated malnutrition screening tools (NRS-2002, MUST, MNA for geriatrics, STAMP for paediatrics) are embedded as structured assessments, computed automatically where input data (weight, BMI, intake history) is available in the record.
- **Nutritional prescription:** The dietitian documents the calculated energy and macronutrient targets:
  - Total energy (kcal/day), protein (g/day), carbohydrates (g/day), fat (g/day)
  - Fluid balance target (ml/day)
  - Electrolyte targets (Na, K, Ca, Mg, phosphate) where clinically relevant
  - Route of delivery (oral / enteral / parenteral / mixed)
- **Restrictions:** Documented allergies, intolerances (lactose, gluten, nut, etc.), religious or cultural dietary requirements, and physician-ordered restrictions (fasting, nil-by-mouth, renal diet, dysphagia-modified texture IDDSI level) are automatically applied as constraints on the meal order system.
- **Nil-by-mouth and fasting:** A physician order for fasting or nil-by-mouth immediately suspends all pending meal orders and blocks new orders for the duration; the kitchen system is notified in real time. The restriction is lifted explicitly by a physician order; the system does not auto-lift.

#### 26.4.2 Meal Ordering

- **Daily meal selection:** Patients select meals from the available menu via the patient app or a ward tablet. The menu presented is pre-filtered to exclude items prohibited by active dietary restrictions or allergies.
- **Portion and texture:** The system enforces IDDSI texture levels and portion sizes per the nutritional prescription.
- **Kitchen interface:** Confirmed meal orders are transmitted to the kitchen management / catering system via a configurable integration (HL7 or proprietary API). The kitchen receives a structured order including: patient identifier, ward, room/bed, meal type, texture level, allergen flags, and portion size.
- **Example integration:** A bidirectional interface to a hospital catering system (e.g. Eurest, Compass, or a custom kitchen MIS) receives orders at a configurable cut-off time and returns delivery confirmations; the nurse workstation shows confirmed delivery status per patient.

#### 26.4.3 Actual Intake Recording

Actual food and fluid intake is documented by nursing staff or the patient:

- **Structured intake form:** For each meal and between-meal intake, the nurse selects the percentage consumed (0 / 25 / 50 / 75 / 100 %) per food category (solid, liquid, supplement). Alternatively, free-text portions are entered by weight or volume.
- **Photo documentation:** The patient or nurse photographs the plate before and after eating. An AI food recognition model estimates consumed portions from the photo pair and proposes an intake record; the nurse confirms or adjusts. If photo recognition is used, the confidence score is shown.
- **Fluid balance integration:** Oral fluid intake is automatically added to the fluid balance record (§2.5), contributing to the total intake side of the balance calculation.
- **Manual IV and enteral:** Parenteral nutrition volumes and enteral feed volumes are imported from the infusion pump integration (§ICU device chapter) and contribute to the nutritional totals.

#### 26.4.4 Nutritional Monitoring and Blood Glucose

- **Running totals:** The system calculates cumulative daily energy, protein, and fluid intake from all documented sources (oral, enteral, parenteral) and compares against the prescribed targets. Deficit or surplus is highlighted on the nursing dashboard.
- **Blood glucose estimation:** From the documented (or ordered) carbohydrate intake, the system estimates the expected glycaemic load per meal and displays it alongside the patient's active insulin protocol and most recent glucose measurements. This supports pre-meal insulin dosing decisions but is explicitly advisory — insulin dosing orders require physician or prescribing nurse confirmation per the medication management module (§2.4).
- **Trend reporting:** Weekly nutritional summary reports (intake vs. target, weight trend, BMI) are generated for the dietitian's follow-up note and for multidisciplinary ward rounds.

---

### 26.5 Therapy Discharge

#### 26.5.1 ICF-Based Outcome Documentation

The system supports documentation using the **International Classification of Functioning, Disability and Health (ICF)** as the standardised outcome framework for therapy discharge:

- ICF categories are browsable and searchable by code and description (Body Functions b, Body Structures s, Activities and Participation d, Environmental Factors e).
- Each category is rated using the standard ICF qualifier scale (0 – no impairment to 4 – complete impairment; 8 = not specified; 9 = not applicable).
- Qualifiers for capacity and performance are entered separately for Activities and Participation categories.
- The ICF profile at admission and at discharge are stored as separate snapshots; change between the two is computed and displayed as a discharge outcome summary.
- **Additional catalogues:** Specialty-specific outcome frameworks are configurable alongside ICF. Examples: dietetics (PES statement format; IDNT codes for nutrition diagnoses), speech therapy (ASHA NOMS functional communication measures), occupational therapy (COPM). The framework used is selected at discipline level and can be combined with ICF in the same record.

#### 26.5.2 Transport Planning at Discharge

The system supports optimised patient transport scheduling at therapy discharge and between sites:

- **Transport requests:** A transport request is generated automatically from the discharge planning module when a therapy episode closes or a patient transfer is planned. The request includes: origin location, destination, mobility status (ambulatory / wheelchair / stretcher / ventilated), required escort level, and latest-acceptable time.
- **Optimisation:** The transport coordination module aggregates open transport requests and groups patients with compatible origins, destinations, and time windows into shared transport runs, minimising vehicle journeys.
- **Real-time status:** Transport status (requested / confirmed / en route / delivered) is visible on the ward dashboard and the therapy scheduling view. Delays generate automatic notifications to the sending and receiving units.
- **Inter-site transfers:** For patients moving between campuses or to external rehabilitation or long-term care facilities, the transport module coordinates with external providers via configurable messaging (FHIR transport request, email, or manual confirmation workflow).

---

### 26.6 Patient Education

The system supports continuation of therapeutic interventions beyond the clinical setting (extra-muros):

#### 26.6.1 Educational Content Delivery

- **Content library:** Therapists and dietitians author educational materials (exercise programmes, dietary plans, wound care instructions, medication guides) within the system using a structured content builder.
- **Assignment to patient:** Specific content items are assigned to the patient from the therapy or discharge record. Assigned content is pushed to the patient app (§51.8) and accessible after discharge.
- **Formats:** Text instructions with diagrams, photo sequences, short video demonstrations, and interactive exercise trackers.
- **Language:** Content is available in the institution's supported languages; the patient's preferred language (documented in the demographic record) determines the default delivery language.

#### 26.6.2 Remote Exercise and Adherence Tracking

- **Task completion logging:** Patients mark assigned exercises or dietary tasks as completed in the app. Completion data is transmitted back to the clinical system and is viewable by the responsible therapist.
- **Reminders:** Push notifications remind the patient of scheduled home exercises or dietary logging at configurable intervals.
- **Escalation:** If a patient has not logged any activity for a configurable number of days, a follow-up task is created for the responsible therapist or the care coordinator.

#### 26.6.3 Remote Consultation Support

- **Asynchronous messaging:** Patients can send questions or progress updates (text, photo, video) to their therapist via the patient portal's secure messaging channel. Therapists respond within a configurable response-time target.
- **Video consultation:** Scheduled video appointments (telehealth) are bookable from the standard scheduling module and appear in the patient app as calendar entries with a join link.
- **PROM integration:** Patient-reported outcome measures (e.g. KOOS, DASH, VAS pain, PROMIS) are sent to the patient app as scheduled questionnaires at defined post-discharge time points. Completed PROMs are imported back into the clinical record and trigger a therapist review task if threshold scores are exceeded.

---

