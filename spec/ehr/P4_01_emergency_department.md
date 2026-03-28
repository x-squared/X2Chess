## 21. Emergency Department

### 21.1 End-to-End Emergency Process

The emergency department (ED) workflow is modelled as a continuous, state-driven process from pre-arrival notification through to patient disposition. Every transition is timestamped and auditable. Cross-references to other modules are noted at each stage.

#### 21.1.1 Pre-arrival Notification

Ambulance services, referring institutions, and helicopter teams can transmit advance patient information via HL7 FHIR messaging or a structured radio/phone intake form:

- Estimated time of arrival (ETA)
- Mechanism of injury or presenting complaint
- Pre-hospital vital signs and interventions
- NACA score or equivalent pre-hospital triage level
- Crew member and vehicle identifier

On receipt, the system creates a **pre-registration record** (unconfirmed patient identity), reserves an appropriate ED bay (standard, resuscitation, or paediatric), and sends automatic arrival alerts to the designated ED physician and nurse. If resuscitation-level criteria are met, the trauma/shock-room team is activated immediately (§21.4).

#### 21.1.2 Arrival and Registration

On physical arrival the patient is matched to the pre-registration record or registered from scratch:

- Identity established from ID document, health insurance card (KVG/insurance data import), or wristband
- ADT admission event created (§2.1 Patient Administration)
- Wristband with barcode and patient identifier printed automatically
- Walk-in patients enter via self-check-in kiosk or reception desk

For unidentified patients, a temporary pseudonymous identifier is generated immediately (see §21.5 for mass-casualty variant). Identity reconciliation is performed as soon as documents become available; duplicate merges are logged.

#### 21.1.3 Triage

Triage is performed immediately after arrival using a configurable triage scale:

| Scale | Default in Swiss context |
|---|---|
| Manchester Triage System (MTS) | Primary default |
| Emergency Severity Index (ESI) | Configurable alternative |
| Swiss Triage Scale (STS) | Configurable alternative |
| Paediatric variants | Applied automatically based on age |

The triage nurse selects a presenting complaint or chief symptom from a structured discriminator tree. The system computes the triage category (1–5 / immediate–non-urgent) and assigns a target response time. Vital signs captured at triage (HR, BP, SpO₂, RR, GCS, temperature, pain score) are stored as the first observation set of the encounter (§2.5 Observations & Vitals).

Triage category drives:
- Lane assignment on the ED dashboard (§21.2)
- Immediate order sets pre-populated as suggestions (§2.7 CDS)
- Escalation alerts if waiting time exceeds the category target

Re-triage can be performed at any point; each triage event is a separate timestamped record with the responsible clinician.

#### 21.1.4 Assessment, History, and Diagnostics

The attending physician opens the ED encounter from the dashboard. Documentation follows the standard structured encounter note (§2.2) with ED-specific enhancements:

- **Chief complaint** — free text + structured code (SNOMED CT)
- **History** — structured AMPLE template (Allergies, Medications, Past history, Last meal, Events) with voice-recognition and text-block support (§21.3.1)
- **Physical examination** — body-region structured form with avatar annotation (§21.3.2)
- **Problem list update** — new diagnoses added as working diagnoses; existing chronic conditions confirmed or updated
- **CPOE** — laboratory, imaging, and procedure orders placed via ED-specific order sets (§2.3); results return directly into the encounter view
- **Medication** — ED medications prescribed and administered via the MAR (§2.4); weight-based dosing calculator available inline

All diagnostic orders, results, and clinical findings are time-stamped and attributed to the requesting or documenting clinician.

#### 21.1.5 Therapeutic Interventions

Procedures performed in the ED (wound care, suturing, reduction, intubation, cardioversion, etc.) are documented using the procedure documentation module (§22.5 adapted for ED context, without the full OR workflow). Required resources (procedure rooms, specialist consultations) are booked via the resource planning module (§2.8, §22.1).

Specialist consultations are ordered via the referral/consultation workflow (§2.3). The consulting team receives an in-system notification, acknowledges acceptance, and documents their assessment in the shared encounter record.

#### 21.1.6 Disposition and Discharge

At the end of the ED encounter the treating physician selects a disposition:

| Disposition | System action |
|---|---|
| **Discharge home** | Discharge summary generated; patient-facing summary and instructions transmitted to patient (§21.3.5); GP notification sent |
| **Admission** | Bed request placed (§2.1 ADT); handover note pre-populated from ED encounter; patient transferred to ward |
| **Transfer to another institution** | Transfer summary generated; referral letter with relevant results attached; external HL7/FHIR export triggered |
| **Left without being seen (LWBS)** | Structured reason recorded; follow-up task created for nursing coordinator |
| **Deceased in ED** | Death documentation workflow triggered; death certificate process initiated |

Billing codes (TARMED/TARDOC, DRG grouper) are pre-populated from documented diagnoses and procedures and reviewed by the treating physician before case closure (§2.6).

The full process — from pre-arrival to disposition — is visible as a timeline on the patient's ED encounter record, showing all state transitions, responsible persons, and elapsed times.

---

### 21.2 ED Dashboard

The ED dashboard is the primary operational tool for ED staff. It provides real-time situational awareness across all active patients and tracks throughput, delays, and resource utilisation.

#### 21.2.1 Lane Structure

The ED is organised into configurable **lanes** (Spuren), each representing a care pathway or treatment area:

| Lane | Typical scope |
|---|---|
| Fast Track | Low-acuity ambulatory cases (ESI 4–5 / MTS green-blue) |
| Standard Assessment | Moderate-acuity work-up (ESI 2–3 / MTS yellow-orange) |
| Resuscitation / Shock Room | Critical, immediately life-threatening (ESI 1 / MTS red) |
| Radiology Holding | Patients awaiting or returning from imaging |
| Observation / Short Stay | Patients requiring monitoring beyond the initial assessment |
| Paediatric | Dedicated paediatric track where staffed separately |

Each lane is displayed as a visually distinct column or zone on the dashboard. Patients move between lanes as their clinical status changes; each transfer is logged automatically.

#### 21.2.2 Information Displayed per Patient Tile

Each patient tile on the dashboard shows, at a glance:

- Patient identifier (name or pseudonymous code in public displays)
- Triage category (colour-coded) and triage time
- Lane and bay assignment
- Attending physician and nurse
- Current status (waiting / being assessed / awaiting results / awaiting admission / ready for discharge)
- Waiting time (current duration in lane; colour escalates at triage target thresholds)
- Pending orders summary (labs outstanding, imaging ordered, consults requested)
- Alerts (abnormal results, overdue reassessments, isolation flags)

Clicking a tile opens the full encounter record.

#### 21.2.3 Ward and Personal Dashboard Views

**Ward dashboard:** Visible on large-format displays at the nursing station and triage desk. Shows all lanes simultaneously; optimised for at-a-glance monitoring without mouse interaction. Refreshes every 30–60 seconds (configurable).

**Personal dashboard:** Each clinician sees only patients currently assigned to them, with tasks filtered to their role. Accessible on desktop and mobile devices. Customisable column layout and alert thresholds.

#### 21.2.4 Real-Time Integration

All state changes — triage completion, order placement, result receipt, bay assignment, status updates — are pushed to connected dashboard clients via WebSocket or server-sent events. No page refresh is required. The dashboard connection state is shown in the toolbar; a loss-of-connection warning is surfaced immediately so staff are not misled by a stale view.

#### 21.2.5 Public and Patient-Facing Waiting Displays

Waiting-room monitors show a simplified, anonymised view of current ED demand:

- Estimated waiting time by triage category (updated in real time)
- Current occupancy level per lane (without patient-identifiable information)
- Call-display: patient's token or code is called when it is their turn

Optionally, patients who have consented can see their own status on the patient portal app (§51.8).

#### 21.2.6 Overcrowding Index

The system computes an ED overcrowding index at configurable intervals (default: every 15 minutes). The recommended index is **NEDOCS** (National Emergency Department Overcrowding Score), with CEDIS or Canadian CTAS variant available as alternatives.

Input variables drawn automatically from live data:
- Total ED census (patients present)
- Number on hospital beds waiting for admission
- Number of ventilated patients
- Last patient seen waiting time
- Longest boarding time

The computed score and severity band (normal / busy / overcrowded / severely overcrowded) are displayed prominently on the ED dashboard and on a dedicated capacity management screen visible to hospital management. Historical overcrowding trend charts are available in the ED reporting module. Threshold crossings can trigger automatic notifications to the bed management team and hospital administrator on-call.

---

### 21.3 Documentation and Reporting (ED-Specific)

General documentation and reporting capabilities are described in §2.2 and §2.9. The following requirements are specific to the emergency setting.

#### 21.3.1 Rapid Documentation Aids

Speed of documentation is critical in emergency care. The system provides:

- **Text blocks (Textbausteine):** Pre-configured narrative snippets for common presentations (chest pain, trauma, abdominal pain, etc.) inserted with a single click or voice command. Blocks contain placeholders that the clinician replaces with patient-specific values.
- **ED order sets:** Pre-built bundles of orders for common presentations (STEMI, sepsis, stroke, polytrauma, paediatric fever) that fire a complete diagnostic and therapeutic package with one confirmation. Each set is evidence-based and locally configurable (§2.7 CDS).
- **Voice recognition:** Continuous speech-to-text is available for all free-text fields. The ED encounter note, physical examination, and procedure documentation support dictation-mode entry. Recognised text is immediately editable; a review indicator is shown until the clinician confirms the auto-transcribed content.
- **AI-assisted coding:** After documentation, the system proposes ICD-10 and TARMED/CHOP codes based on the documented text and orders, reducing the coding burden at case closure.
- **Structured quick-capture forms:** One-page rapid assessment forms for common chief complaints (e.g. chest pain, dyspnoea, head injury) surface only the essential fields for the first 5 minutes; full documentation expands progressively.

#### 21.3.2 Avatar-Based Body Documentation

A full-body avatar and regional body diagrams are available for visual clinical documentation:

- **Full-body avatar:** Front and rear views with zone overlay. The clinician taps or clicks to annotate findings directly on the body surface.
- **Regional diagrams:** High-resolution views for head, face, hand, foot, thorax, abdomen, pelvis — selected automatically based on the documented region or accessible from a library.

Annotation types:
- **Wounds:** Location, shape, size (cm), depth, type (laceration, contusion, abrasion, puncture, bite, gunshot), foreign body present
- **Burns:** Area (% BSA, Lund-Browder chart), depth (superficial / partial thickness / full thickness), circumferential flag
- **Pain areas:** Location marked with pain type (sharp, burning, pressure, radiating) and intensity (NRS 0–10 at rest and on movement)
- **Installations:** IV lines (site, gauge, insertion time), drain sites, catheter, ET tube, chest tube — each with insertion details linked to the procedure record

Each annotation is timestamped and attributed to the documenting clinician. The temporal history of the avatar state can be replayed: selecting any past time point shows the annotations active at that moment, supporting forensic review and handover.

#### 21.3.3 Report Generation

Clinical reports are generated from the structured data in the encounter record:

- **ED discharge letter:** Auto-generated from diagnoses, procedures performed, medications prescribed, follow-up instructions. The physician reviews and signs; the document is stored in the patient's document library and dispatched.
- **Inpatient handover note:** Pre-populated from the ED encounter for ward handover; the admitting team can annotate but not alter the ED record.
- **Specialist consultation summary:** Extracted from the consulting team's assessment note, formatted for dispatch.
- **Medicolegal / police report:** Structured template for cases involving assault, road traffic accidents, or child protection concerns; generated on demand with appropriate access controls.

#### 21.3.4 Mandatory Disease Notification

For notifiable conditions (Swiss Epidemics Act / Epidemiengesetz), the system automates reporting:

- A watch-list of notifiable pathogens and conditions is maintained (updated from BAG/FOPH data feeds or manually by the infection control team).
- When a laboratory result, confirmed diagnosis, or clinical code matching the watch-list is documented, a draft notification is generated automatically in the cantonal reporting format (NEMO online / BAG reporting standard).
- The treating physician reviews and electronically submits the notification; submission status and timestamps are stored.
- Notifiable condition triggers apply equally in the inpatient and outpatient domains; the ED module inherits the same watch-list and reporting engine.

**Examples:**
- Positive MRSA culture → notification to cantonal public health authority within 24 h
- Confirmed measles → immediate notification; contact-tracing task generated
- Food-borne salmonellosis cluster → group notification with linked case records

#### 21.3.5 Patient-Facing Report Delivery

After ED encounter closure:
- The discharge summary and relevant result documents are automatically made available in the patient's portal account (§51.8) within a configurable delay (default: immediately on physician signature).
- If the patient does not have a portal account, the summary can be dispatched by secure email (with encryption) or printed at the discharge desk.
- Patients receive an in-app or SMS notification that their documents are available.
- The GP or referring physician receives an automated notification with a secure link to the discharge summary, respecting the patient's consent settings for data sharing.

#### 21.3.6 Image Integration

Diagnostic images and intraoperative / wound photographs are embedded directly in the clinical record:

- **DICOM imaging:** Radiology results (X-ray, CT, MRI, ultrasound) are linked from the RIS/PACS integration and viewable inline in the encounter record without leaving the application (§2.3).
- **Clinical photographs:** Wound images, skin lesions, burns captured via a mobile device are uploaded directly to the encounter record. Images are stored in the document management module with content type `clinical_photo`, encrypted at rest, and associated with the relevant body region.
- **Video:** Short video clips (e.g. range of motion, gait assessment, wound debridement recording) can be attached with the same mechanism.
- Each image is timestamped, geo-tagged to the facility, attributed to the capturing clinician, and linked to the relevant clinical finding or annotation.

---

### 21.4 Resuscitation Room (Shock Room)

The resuscitation room (Schockraum) requires a streamlined workflow optimised for simultaneous multi-team response and automatic data capture.

#### 21.4.1 Team Activation and Acknowledgement

When a resuscitation-level patient is pre-notified or arrives, the charge physician or triage nurse triggers a **Schockraum activation**:

- A structured activation message is sent simultaneously to all pre-configured team members (trauma surgeon, anaesthetist, ED nurse, radiographer, blood bank) via in-app push notification, pager integration, and optional SMS.
- Each recipient acknowledges acceptance from their device; ETA or current location can be added.
- A real-time activation board shows which team members have acknowledged and who is still pending; the charge physician can re-alert individuals.
- The resuscitation room record is opened automatically with the pre-notification data pre-populated.

#### 21.4.2 Automated Documentation

Time-critical events during resuscitation are captured with minimal manual input:

- **Timeline auto-capture:** State transitions (team assembled, patient arrived, airway secured, first IV access, first drug given, ROSC, transfer to CT) are time-stamped by button press on a dedicated resuscitation touchscreen or foot pedal interface, without interrupting clinical activity.
- **Vital-sign stream:** Bedside monitors (defibrillator/monitor, ventilator, pulse oximeter, capnograph) are integrated via HL7, MDC/ISO 11073, or proprietary gateway. Continuous vital-sign data streams into the patient record in real time, eliminating manual transcription. Each device measurement is attributed to the device serial number.
- **Medication auto-capture from devices:** Smart infusion pump data (drug, concentration, rate, volume delivered) is imported directly, reducing documentation burden and transcription errors.
- **Procedure prompts:** The active resuscitation protocol (e.g. ATLS primary survey, ACLS) is displayed as a step-by-step checklist; each step completed is acknowledged and time-stamped.

#### 21.4.3 Defibrillator and Rescue Device Data Import

Defibrillators and AEDs from major manufacturers (Zoll, Physio-Control/Stryker, Schiller) are integrated via:

- Direct USB/Bluetooth download at case close
- HL7 device feed during active resuscitation (where hardware supports)
- Manual case-number import from device memory

Imported data includes: shock sequence (energy, impedance, outcome), CPR quality metrics (compression rate, depth, fraction), pacing parameters, 12-lead ECG strips (stored as DICOM waveforms), and drug delivery records where captured by the device.

The imported record is appended to the resuscitation room documentation and is immutable after device import; clinical annotations can be added alongside but cannot alter the device-sourced data.

---

### 21.5 Mass Casualty Situations and Overcrowding

#### 21.5.1 Mass Casualty Activation

The system can be switched into a **mass casualty incident (MCI) mode** by an authorised user (charge physician, ED director, hospital command):

- All normal ED admission and scheduling workflows remain active but are supplemented with MCI-specific screens and identifiers.
- A dedicated MCI dashboard opens showing victim count, triage distribution, resource consumption rate, and available bed capacity in real time.
- The activation event is logged with the activating user and timestamp and notified to hospital management and, optionally, the cantonal emergency operations centre (EOC).

#### 21.5.2 Unidentified Patient Management

In MCI scenarios, patients frequently arrive without identification:

- A **temporary victim identifier** (e.g. MCI-2026-001, MCI-2026-002) is generated automatically for each unidentified patient, printed as a wristband barcode, and used for all clinical documentation and orders.
- The identifier encodes the incident, date, and sequence number so records from multiple facilities receiving casualties from the same incident can be reconciled later.
- As identity information becomes available (documents found, relatives contact, fingerprint check), the temporary record is merged with a confirmed identity record via a supervised merge workflow; all clinical data transfers intact.

#### 21.5.3 Rapid MCI Triage

The system supports the **START** (Simple Triage and Rapid Treatment) and **SALT** (Sort, Assess, Life-saving interventions, Treatment/Transport) triage protocols, selectable at MCI activation:

- A simplified one-screen triage entry form records: breathing present (Y/N), respiratory rate, radial pulse present (Y/N), ability to follow commands — the system auto-assigns the triage colour (black / red / yellow / green).
- Triage entry is optimised for tablet and stylus use in the field; offline mode supported with sync on reconnect.
- The MCI triage board displays all victims colour-coded by triage category, current location, and treatment status, updated in real time as entries are submitted.
- Triage category can be upgraded or downgraded; each change is logged with reason and responsible clinician.

#### 21.5.4 MCI De-activation and After-Action Reporting

MCI mode is de-activated by an authorised user when the surge has resolved. A structured after-action report is generated automatically, including:

- Total victim count by triage category
- Time from activation to first patient treated
- Resource utilisation (blood products, ventilators, OR activations)
- Overcrowding index trend throughout the incident
- Identified bottlenecks (longest waiting times by category and resource)

---

