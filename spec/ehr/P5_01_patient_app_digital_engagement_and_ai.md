## 36. Patient App, Digital Engagement, and AI

This chapter covers the cross-cutting digital platform layer — the patient-facing app and portal, the 24/7 digital assistant, bedside devices, telemedicine, remote care, and the clinical decision support and AI infrastructure that runs across all clinical modules.

---

### 36.1 Patient App and Patient Portal

#### 36.1.1 Delivery Channels

The patient-facing platform is available on:

| Channel | Notes |
|---|---|
| **Native iOS app** | App Store distribution; push notifications, biometric login |
| **Native Android app** | Play Store distribution; push notifications, biometric login |
| **Mobile web app** | Responsive, no install required; accessible from any smartphone browser |
| **Web portal** | Desktop browser; full feature parity with native apps for document-heavy workflows |
| **Bedside terminal / ward tablet** | Kiosk mode on institution-provided hardware (§36.3) |

All channels share a single backend and data model; data entered on one channel is immediately visible on all others.

#### 36.1.2 Core Functional Scope

| Function | Description |
|---|---|
| **Demographics management** | Patient can review and request updates to name, address, language preference, emergency contact |
| **Appointments** | View upcoming and past appointments; receive reminders; cancel or reschedule within permitted windows |
| **Secure messaging** | Asynchronous text messaging with the care team; attachments (photos, documents) supported |
| **Clinical documents** | Access to discharge summaries, specialist reports, imaging reports, lab results — released per institution's publication rules |
| **Lab results** | Structured display with reference ranges, trend charts, and plain-language explanations |
| **Imaging** | Thumbnail viewer for released DICOM studies; link to full viewer |
| **Medications** | View active medication list; discharge prescription visible after sign-off |
| **Questionnaires and forms** | Pre-admission anamnesis, consent forms, PROMs/PREMs, research surveys |
| **Consent management** | Sign, withdraw, or review consent records (§36.1.6) |
| **Notifications** | Push and in-app alerts for new results, messages, appointment reminders, and task completions |

#### 36.1.3 Pre-Admission Preparation and Self-Check-In

Before a planned inpatient admission or ambulatory visit the app guides the patient through a structured preparation workflow:

- **Pre-admission checklist:** Institution-configured tasks (complete anamnesis questionnaire, upload insurance card photo, sign general consent, confirm medication list, review fasting instructions, arrange transport).
- **Onboarding:** Directions to the relevant entrance, parking or public transport options, what to bring, estimated stay duration.
- **Menu pre-selection:** For planned inpatient stays, patients select meals for the first days (subject to dietary prescriptions) before arriving (§26.4.2).
- **Home self-check-in:** Patients confirm their identity, insurance data, and current medications from home in advance. On arrival, a QR-code wristband is generated immediately from the pre-completed registration — no desk interaction required for routine admissions.
- **Continuity of experience:** The same app that guides pre-admission preparation transitions seamlessly into the inpatient companion (§36.3) during the stay and continues as the post-discharge follow-up tool.

**Status and to-do tracker:** A traffic-light dashboard in the app shows the patient's progress along their care pathway:

- Green: completed tasks and received results
- Amber: pending items requiring patient action (outstanding questionnaire, unsigned consent, missing document)
- Red: urgent items or overdue tasks

Questions answered: *Where am I in my care pathway? What documents do I still need to complete? What is the status of my referral?*

#### 36.1.4 Waiting-List and Waiting-Status Display

For ambulatory appointments:
- Current queue position or estimated waiting time is displayed in real time, updated from the ADT and patient-flow systems.
- Patients are notified by push message when it is their turn or when delays exceed a configurable threshold.
- **Waiting-list functionality:** Patients can opt in to a waiting list for earlier slots. When a cancellation creates an opening, eligible waiting-list patients are notified by push message in priority order and can claim the slot within a configurable response window. Unclaimed slots move to the next patient automatically.

**Automated patient call:** The system supports configurable automated calling of the next patient in an ambulatory queue based on clinical priority, appointment type, and room readiness — reducing manual coordination and minimising time in the waiting room.

#### 36.1.5 Proxy Access and Family Management

Patients can grant controlled access to designated proxies (relatives, legal guardians, trusted persons):

| Proxy type | Typical access granted |
|---|---|
| Legal guardian (children < 16) | Full access to minor's record |
| Parent (child 16–18) | Configurable; minor's consent governs |
| Designated trusted person (adult) | Patient-defined scope: appointments only / results / messaging / all |
| Healthcare proxy (Vorsorgeauftrag) | Activated by clinical team; full access |

**Parent multi-child management:** A parent's single app account displays a child-selector; each child's record is maintained under the parent's login with separate consent and access settings per child. Switching between children requires no re-authentication within a session.

Proxy relationships are established in the clinical system by registration staff or by the patient via the portal with identity verification. Proxies can be granted access to specific information categories (results, reports, appointments) but not to others (e.g. psychiatry notes excluded by default unless explicitly enabled).

#### 36.1.6 Digital Signatures and Consent

The system supports multiple signature mechanisms for clinical and administrative documents:

| Mechanism | Use case | Legal basis |
|---|---|---|
| **Simple electronic signature** (SES) | Routine documents (appointment confirmation, satisfaction surveys) | Identity verified by app login |
| **Advanced electronic signature** (AES) | Informed consent, treatment plans, data sharing agreements | Qualified identity provider (SwissID, HIN, or MTAN) |
| **Qualified electronic signature** (QES) | General consent (Generalkonsent), statutory declarations | Recognised trust service provider per ZertES / eIDAS |

Integration with third-party signing services (e.g. DocuSign, SwissSign, Skribble) is supported via API. Signed documents are stored as PDF/A with embedded signature metadata in the patient's document library. The institution configures which document types require which signature level.

#### 36.1.7 PROMs and PREMs

Patient-reported outcome and experience measures are managed as scheduled questionnaire campaigns:

- The clinical team assigns a PROM instrument and schedule to the patient (e.g. KOOS at 6 weeks, 3 months, and 12 months post-knee-replacement).
- Due questionnaires appear as tasks in the app with a deadline and reminder push notifications.
- Completed responses are transmitted to the clinical record; threshold-based alerts notify the responsible clinician of scores indicating deterioration or unmet expectations.
- PREM (experience) surveys are triggered automatically at configurable points (e.g. 48 hours after discharge). Aggregated PREM data feeds the quality management dashboard (§23.4).

#### 36.1.8 Plain-Language Clinical Information

Medical results and reports can be presented in two modes switchable by the patient:

- **Clinical mode:** Full clinical text and terminology as authored by the clinician.
- **Plain-language mode:** AI-generated lay summary in the patient's preferred language, highlighting key findings and recommended follow-up actions. The summary is generated at document release and reviewed for accuracy by the responsible clinician before publication (configurable: auto-publish or require manual review).

The plain-language layer is never the sole source of clinical information; the original clinical document is always accessible.

#### 36.1.9 Research Participation

The app supports clinical research engagement:

- Eligible patients are invited to research studies based on their clinical characteristics (diagnosis, age, care pathway), with appropriate consent workflows (eConsent).
- Study-specific questionnaires, assessments, and reminders are delivered within the standard app framework.
- Research data is stored in a logically separate research data store with pseudonymisation applied before any export to research systems.
- Patients can withdraw research consent at any time from the app; withdrawal triggers automatic data handling per the study protocol.

#### 36.1.10 Patient Class Differentiation

The app and its integration with clinical workflows respects the patient's insurance class (General / Semi-private / Private):

- **Private and semi-private patients** may have access to additional features: direct physician messaging, named physician selection, premium room selection.
- **Fast-track pathways** for certain patient classes are supported in the scheduling module and reflected in the app's appointment view.
- The configuration of class-based differentiation is managed by the institution without code changes.

#### 36.1.11 Non-Patient (Public) Functions

The following capabilities are available to users who are not current patients:

- **Prevention content:** Health literacy articles, screening programme information, risk calculators (cardiovascular, diabetes, osteoporosis) in lay language.
- **Symptom check / triage guidance:** Structured symptom checker providing non-diagnostic guidance and recommending the appropriate care setting (GP / urgent care / ED / self-care). Output is advisory; it does not generate a clinical record.
- **Self-referral:** Unregistered users can submit a referral request for specific outpatient services; the request is processed by the administrative team and the user is contacted to complete registration.
- **Account creation:** Any person can create a portal account; a patient record is created only on first clinical contact.

---

### 36.2 24/7 Digital Assistant

The 24/7 digital assistant is an AI-powered conversational interface embedded in the patient app and portal. It supports patients in navigating their care, answering questions, and escalating to the right person when needed.

#### 36.2.1 Interaction Model

- **Natural language chat:** Patients interact via free-text or voice input in the app. The assistant responds in the patient's preferred language.
- **Scope-bounded responses:** The assistant answers questions within a defined knowledge boundary:
  - General health information and prevention
  - Institution-specific information (opening hours, locations, contact numbers, service descriptions)
  - Patient's own data (appointment status, pending tasks, recent results — presented as a summary with a link to the full record)
  - Navigation of the app and portal
- **Escalation:** When the question is outside the assistant's scope, requires clinical judgment, or the patient expresses distress, the assistant immediately escalates: it offers to connect the patient to a nurse on call (asynchronous message), the duty triage line (phone link), or in genuine emergency, provides the emergency services number.

#### 36.2.2 Institutional Configuration

The institution configures:
- Knowledge base articles and institutional content (clinic pages, service descriptions, FAQs) — managed by the communications or quality team via a content management interface.
- Escalation routing rules (which department or person receives escalated queries by topic and time of day).
- Response tone, branding, and language defaults.
- Topics or question types the assistant will not handle (configurable exclusion list).

#### 36.2.3 Pre-loaded Knowledge and Quality Assurance

The assistant is pre-loaded with:
- Swiss medical reference content (selected, curated sources; BAG/FOPH public health guidance; SwissMedic medication information).
- The institution's own published guidelines and patient information leaflets.

**Quality assurance:** The institution's clinical and communications teams can review the assistant's knowledge base and test responses via an admin console. A sample of live conversations (de-identified) is reviewed periodically by a clinical reviewer; flagged responses are used to update the knowledge base. Response provenance (which knowledge article was used) is logged for every answer.

#### 36.2.4 Medical Safety

- The assistant **does not diagnose** and **does not prescribe**. Any output that could be construed as a clinical recommendation includes a mandatory disclaimer and a prompt to contact the clinical team.
- Conversations are stored for audit and safety review. Patients can request deletion per their data rights.
- The assistant is classified as a non-medical-device software under MDR / EU AI Act (general information and navigation only). Any future extension to clinical decision support would require MDR conformity assessment.

---

### 36.3 Bedside App, Terminal, and Patient Companion

#### 36.3.1 Device Strategies

| Strategy | Description |
|---|---|
| **Bring Your Own Device (BYOD)** | Patient uses their personal smartphone or tablet; the patient app provides the interface. No special hardware required. |
| **Institution-provided personal device** | A tablet is issued to the patient on admission (optionally pre-configured with the patient's account), returned at discharge and wiped for the next patient. |
| **Shared kiosk device** | A fixed or mobile tablet at a ward station or corridor kiosk; patients or staff use it for specific transactions (consent signing, meal selection, form completion) without persistent session. Identity verified by QR code, wristband scan, or PIN. |
| **Bedside terminal (wall-mounted)** | A dedicated bedside display integrated with the room infrastructure; patient-personalised on admission via wristband scan. |

#### 36.3.2 Inpatient and Ambulatory Functions

All patient app functions available outside the hospital are available on in-hospital devices. Additionally, when inside the institution the app activates context-sensitive inpatient functions:

- **Treatment process view:** Active medication list, upcoming procedures, today's appointments, treating team members with photos and roles.
- **Pending results:** Results released by the care team appear in the app with plain-language summaries (§36.1.8).
- **Consent and education content:** Procedure-specific information leaflets and digital consent forms are pushed to the device at the appropriate point in the care pathway.
- **Meal ordering:** Menu selection per §26.4.2, with real-time availability filtered by active dietary prescriptions.
- **Communication:** In-app messaging with the nursing station, room service requests (housekeeping, patient transport within the hospital, TV/media control where integrated).
- **Hotel services:** Room temperature preferences, visitor registration, chaplaincy or social work requests — configurable per institution.

#### 36.3.3 Payment Integration

Patient-facing payment (co-payments, private room surcharges, consumables) is integrated via:
- **TWINT** (QR-code and push-payment)
- **Apple Pay / Google Pay**
- **Credit and debit card** (Visa, Mastercard, via a payment gateway)
- **Invoice** (bill generated in ERP/SAP; sent by post or to patient portal)

Payment status is recorded against the billing record in the financial module (§2.6).

---

### 36.4 Telemedicine

#### 36.4.1 Booking and Scheduling

Telemedicine appointments are booked through the same scheduling module as in-person visits:

- Patients book via the app or portal, selecting service type, preferred date/time, and treating clinician (where the institution permits patient-level clinician selection).
- Clinicians and schedulers can convert an in-person slot to a telemedicine slot; the patient receives automatic notification.
- Telemedicine-eligible appointment types are flagged in the scheduling catalogue; the system enforces this flag so that appointment types requiring physical examination cannot be inadvertently booked as teleconsultation.

#### 36.4.2 Consultation Workflow

A telemedicine consultation follows the same clinical documentation workflow as an in-person encounter:

- The clinician opens the encounter record from the standard patient summary view.
- A video call panel opens within the application (picture-in-picture), allowing simultaneous documentation and video interaction without context switching.
- The patient joins from the app or a web link (no software installation required).
- All clinical findings, orders, prescriptions, and the encounter note are documented in the same record as an in-person visit; billing codes are applied per telemedicine tariff (TARMED/TARDOC).

**Supported video platforms:** The video component is provided by an embedded module or integrated via API with enterprise video conferencing systems (e.g. Cisco Webex, Microsoft Teams, Zoom for Healthcare). The integration is configurable; institutions select their preferred platform. Video calls are end-to-end encrypted; no call recording is retained without explicit consent.

#### 36.4.3 Remote Document Exchange and Monitoring

- **Document sharing during consultation:** The clinician can share a document, image, or diagram to the patient's screen in the video call; the patient can share their device camera (e.g. to show a wound or skin lesion).
- **Pre-visit monitoring:** For chronic disease follow-up, remote vital sign measurements (from connected devices §36.5) are uploaded before the call and displayed on the clinician's screen during the consultation.
- **Asynchronous follow-up:** After the visit the clinician can assign exercise programmes, dietary instructions, or educational content (§26.6) visible in the patient app.
- **Coupling with in-person scheduling:** Telemedicine and in-person appointments are interleaved in the same scheduling timeline; the clinician can schedule an in-person follow-up directly from the telehealth encounter screen.

#### 36.4.4 Prevention and Call Centre Integration

- **Prevention teleconsultations:** Preventive health programmes (e.g. smoking cessation, obesity management, diabetes prevention) can be delivered entirely by telemedicine; these are bookable from the public-facing section of the portal by non-patients (§36.1.11).
- **Call centre integration:** Telephone-based triage and navigation services are integrated via computer-telephony integration (CTI): the caller's phone number is matched against the patient registry; on match, the call-centre agent's screen opens the patient's contact history and scheduling view. Calls can be escalated to a video consultation with one click.

#### 36.4.5 Interpretation and Language Support

- **Synchronous interpretation:** For patients whose preferred language differs from the clinician's, a licensed interpreter can be added as a third participant to a video call via the remote interpretation service integration.
- **Pre-configured language access:** Interpreters are bookable through the scheduling module alongside the clinical appointment; the interpreter's availability is shown in the same booking interface.

#### 36.4.6 Automatic Documentation and Billing

- The telemedicine encounter note is generated using the same voice-recognition and text-block tools as in-person encounters (§21.3.1).
- Tariff codes for telemedicine services (TARMED 04.02 variants; future TARDOC equivalents) are pre-populated based on the appointment type and duration; the clinician reviews and confirms before case closure.
- Duration of the video session is automatically captured from the call log and attached to the encounter for audit purposes.

---

### 36.5 Remote Care — Connected Devices

#### 36.5.1 Device Categories and Integration

| Category | Examples | Integration method |
|---|---|---|
| **Consumer wearables** | Apple Watch, Fitbit, Garmin, Withings | HealthKit (iOS), Health Connect (Android), FHIR Observation export |
| **Medical-grade wearables** | Holter ECG (e.g. AliveCor KardiaMobile), CGM (Libre, Dexcom), blood pressure (Omron), pulse oximeter | Direct BLE/USB; manufacturer cloud API with FHIR export; MDM-managed pairing |
| **Therapy devices** | Smart spirometers, digital goniometers (ROM measurement), balance boards | Manufacturer SDK or FHIR device observation |
| **Hospital-grade remote devices** | Telemonitoring hubs, connected infusion pumps, remote ventilators | HL7 / ISO 11073 / MDC protocol via device gateway |

**Supported interoperability protocols:** HL7 FHIR R4 (Device, DeviceMetric, Observation resources), Apple HealthKit, Google Health Connect, IEEE 11073 / MDC, Bluetooth Medical Device Profile (BMDP), IHE PCD-01.

**IoT platforms:** Configurable integration with IoT platform connectors (AWS IoT, Azure IoT Hub, custom on-premise gateway). The institution selects preferred platforms; new device types are onboarded through a configurable device catalogue without requiring platform code changes.

#### 36.5.2 New Device Onboarding

New devices (including USZ spin-off products and study sponsor devices) are onboarded via a self-service device catalogue:

1. Device manufacturer provides FHIR Observation profile and mapping specification.
2. IT or clinical informatics team configures the mapping in the device catalogue (typically 1–5 days for a well-documented FHIR device).
3. Test data is validated against the mapping; approval by clinical informatics and data quality team.
4. Device is published in the catalogue; clinical teams can prescribe it as a monitoring device.

**Data provenance:** Every device-generated observation record carries the device identifier (UDI where applicable), firmware version, calibration date, and transmission timestamp. Provenance is immutable and viewable by clinicians reviewing the data.

#### 36.5.3 Study Device Integration

Sponsor-provided clinical study devices follow the same onboarding process with additional data handling controls:

- Study-specific data flows are isolated in a logically separate research data partition.
- Data quality checks (range validation, completeness, missing-data flagging) are configurable per study protocol.
- Audit trail satisfies 21 CFR Part 11 / ICH E6(R2) requirements where applicable.

---

### 36.6 Remote Care — Care@Home and Remote Monitoring

#### 36.6.1 Central Monitoring Cockpit

A 24/7 remote monitoring console is available for clinical teams managing Care@Home patients:

- **Patient list view:** All patients on the remote monitoring programme with their current vital-sign status, last data transmission time, and alert status.
- **Alert feed:** Incoming device alerts sorted by criticality (critical / warning / informational), with one-click access to the patient's monitoring record and trend charts.
- **Automation:** Routine alerts (e.g. a single mildly elevated blood pressure reading) are processed by a rule engine and suppressed or batched; only alerts meeting clinical significance criteria are surfaced to the on-call clinician. Rules are configurable by the clinical lead without developer involvement.
- **24/7 coverage:** The cockpit supports shift-based coverage with automatic escalation if an alert is not acknowledged within a configurable time window.

#### 36.6.2 Alert Routing

Alerts from remote devices are routed based on:
- **Criticality level** (configurable thresholds per measurement type and patient)
- **Role-based routing:** Routine alerts → assigned community nurse or GP; urgent alerts → on-call clinical team; critical alerts → emergency escalation chain
- **Time of day:** Routing rules can differentiate business hours and out-of-hours
- **Escalation:** If the primary recipient does not acknowledge within the response-time target, the alert automatically escalates to the next tier
- **External messaging integration:** Alerts can be delivered via in-system notification, SMS, pager integration, or push to the clinician's mobile app

#### 36.6.3 Care@Home Equipment Management

Monitoring equipment distributed to home patients is tracked in the device inventory module:
- Equipment dispatch is recorded against the patient record (device ID, dispatch date, configuration).
- Remote configuration updates (firmware, alert thresholds) can be pushed to supported devices.
- On programme end, a return task is generated; returned equipment is logged and queued for maintenance check before redistribution.

---

### 36.7 Remote Care — Partner Access

External care partners (Spitex, rehabilitation facilities, long-term care homes, community nurses) can be granted a structured partner portal access:

#### 36.7.1 Access Scope

| Permission | Description |
|---|---|
| **Read-only clinical summary** | Discharge summaries, medication lists, care plans — scoped to the patient's current episode or a defined date range |
| **Read-only results** | Lab and imaging results explicitly released for partner viewing |
| **Write — care notes** | Partner can document care observations that appear in the patient's record (flagged as external source) |
| **Write — task completion** | Partner can mark home care tasks (wound dressing, medication administration) as completed |

All partner access is patient-consent-governed and audited. The patient can revoke partner access from the patient app.

#### 36.7.2 Partner Integration into Workflows

- Partners can be included in message routing, task assignment, and alert escalation chains (§36.6.2), either within the HIS system (via a partner role) or via integration with the partner's own system.
- Task lists, checklists, and care instructions created in the HIS are published to the partner's portal view; completion status flows back.
- Escalation from partner to hospital (e.g. community nurse identifies clinical deterioration) is supported via a structured escalation message that creates an urgent task for the responsible hospital team.

---

### 36.8 Clinical Decision Support (CDS)

#### 36.8.1 CDS Architecture

CDS in the system operates on a **layered architecture**:

1. **Rule engine layer:** Boolean and threshold rules (e.g. drug interaction checks, allergy matching, critical result alerting) evaluated at point of order entry or data entry — synchronous, sub-second latency.
2. **Scoring and protocol layer:** Evidence-based score computation (NEWS2, SOFA, CHADS₂-VASc, Wells, etc.) triggered by relevant data events — results surfaced in the relevant clinical view.
3. **ML inference layer:** Statistical and machine-learning models (deterioration prediction, readmission risk, therapy suggestion) running asynchronously; results surfaced as advisory notifications.
4. **External CDS services layer:** Third-party certified CDS tools (e.g. radiology AI, ECG interpretation, genomics-based prescribing) integrated via HL7 CDS Hooks, SMART on FHIR, or REST API.

New CDS algorithms are onboarded via a **CDS integration framework**: the algorithm developer provides an HL7 CDS Hooks service endpoint or a FHIR-native service; the clinical informatics team configures trigger events, data inputs, output display template, and alert routing without platform code changes.

#### 36.8.2 Bundled CDS Algorithms

The system includes a configurable catalogue of evidence-based CDS algorithms. For each:
- Scientific basis (guideline, publication, validation study) is documented
- Swiss applicability and regulatory status (CE-marked medical device where applicable) are stated
- Algorithm version and last-updated date are visible to the clinical team

Example included algorithms:

| Algorithm | Evidence base | Swiss usability |
|---|---|---|
| Drug–drug interaction check | WHO drug interaction database + local formulary | Yes |
| Allergy cross-reactivity | ALLERDATA / clinical guidelines | Yes |
| NEWS2 deterioration | RCP UK (2017) | Yes (widely used) |
| Sepsis-3 criteria alert | Singer et al., JAMA 2016 | Yes |
| Pulmonary embolism Wells score | Wells et al., Ann Intern Med 2001 | Yes |
| VTE prophylaxis suggestion | ACCP / NICE guidelines | Yes (with local adaptation) |
| Antibiotic de-escalation prompt | Local antibiogram + Sanford Guide | Institution-configured |
| CHADS₂-VASc / HAS-BLED | ESC guidelines | Yes |
| Readmission risk (ML) | Locally trained on institution's discharge data | Requires local validation |

#### 36.8.3 CDS Validation and Configuration

- **Algorithm validation:** Before activation, each CDS algorithm is reviewed by the responsible clinical specialty team and clinical informatics. Validation tests against a retrospective dataset are documented. Ongoing monitoring (alert fire rate, acceptance rate, override rate) is reported monthly.
- **Threshold and parameter configuration:** Alert thresholds (e.g. creatinine level triggering AKI alert, NEWS2 score triggering escalation) are configurable by the clinical team per unit and patient population. Configuration changes are versioned and attributed.
- **Data access:** CDS algorithms can access all data in the patient's EHR including demographics, diagnoses, medications, lab results, vital signs, imaging reports, and care pathway status. Access to specific data categories is granted per algorithm during onboarding.

#### 36.8.4 CDS in Clinical Workflows

- **Point-of-care presentation:** CDS results are surfaced at the most clinically actionable moment: drug interaction at order entry, deterioration alert on the ward dashboard, therapy suggestion at care plan creation.
- **Alert design:** Alerts use a three-tier severity (informational / warning / critical) with distinct visual treatment. Critical alerts require explicit acknowledgement with a reason; informational alerts are passive displays.
- **Alert fatigue mitigation:**
  - Alerts are routed only to the clinician in the best position to act — the prescribing physician for drug alerts, the primary nurse for vital-sign alerts.
  - Override history is tracked: if the same alert type is overridden repeatedly by the same clinician, a periodic review task is generated for the clinical lead rather than continuing to interrupt the clinician.
  - Alert bundles: multiple simultaneous low-severity alerts for the same patient are grouped into a single notification.
  - The override rate per alert type is reported in the CDS governance dashboard; consistently high override rates trigger a review of the alert threshold.

#### 36.8.5 Override Logging and Decision Documentation

- Every CDS alert override is recorded: alert type, firing data, overriding clinician, reason code, and free-text comment (optional but encouraged for critical alerts).
- Where a CDS recommendation is accepted, the resulting order or action is linked to the alert record — providing an auditable trail from recommendation to clinical decision.
- Override data is available in aggregate for quality management review: alert acceptance rate, most-overridden alert types, clinician-level patterns.

#### 36.8.6 Regulatory Compliance

- **MDR (EU 2017/745):** CDS algorithms that meet the definition of a medical device software (MDSW) under MDCG 2019-11 are classified accordingly. CE-marked third-party algorithms are accepted with their existing certificate. Algorithms providing only non-binding administrative support (e.g. scheduling suggestions) are classified outside MDSW scope, documented in the software safety classification register.
- **EU AI Act (2024):** High-risk AI systems as defined in Annex III (medical devices, clinical management) are identified and managed per the Act's requirements: risk management, data governance, human oversight, transparency, and conformity assessment. The system maintains an AI register documenting each AI algorithm's risk class, validation status, human oversight mechanism, and review cadence.

---

### 36.9 Artificial Intelligence

#### 36.9.1 Existing AI Implementations

AI capabilities currently integrated include:

| Domain | Function | Notes |
|---|---|---|
| Coding assistance | ICD-10 / CHOP / TARMED code suggestion from documentation text | NLP model; codes require clinician confirmation |
| No-show prediction | Probability score for each scheduled appointment; shown on scheduling view | ML model trained on local scheduling history |
| Deterioration prediction | Continuous risk score from vital signs and labs (NEWS2 extension) | Validated on inpatient population |
| Therapy suggestion | Mapping from diagnosis + assessment data to therapy referral proposals (§26.1.1) | Rule-ML hybrid; institution-configurable |
| Nutrition intake estimation | Portion estimation from meal photos (§26.4.3) | Computer vision; estimate confirmed by user |
| Document OCR and extraction | Structured data extraction from uploaded PDFs (§36.10) | Extraction reviewed by user before import |
| Radiology AI | Integration hooks for third-party CE-marked radiology AI (chest X-ray triage, fracture detection) | Delivered by integrated partner tools |

#### 36.9.2 AI Development Roadmap

The platform's AI roadmap is published annually and versioned. Planned near-term additions include: automated prior-authorisation drafting, surgical duration prediction refinement (§22.1.4), automated ED triage augmentation (§21.1.3), and medication reconciliation assistance. Roadmap items are subject to clinical validation and, where applicable, regulatory conformity assessment before deployment.

#### 36.9.3 AI-Assisted Data Curation

- AI models assist with data quality: detecting implausible values (e.g. weight outliers, unit errors), suggesting duplicate patient record merges, and flagging incomplete mandatory fields in real time.
- A data quality dashboard surfaces AI-detected anomalies for review by the clinical informatics or data stewardship team. Each flagged issue is reviewed and resolved or dismissed with a reason; resolution rates are tracked.

#### 36.9.4 Explainability and Provenance

Every AI-generated suggestion or score in the clinical interface includes:
- The model name and version
- The key input data points that drove the output (feature importance or SHAP values, where the model supports it)
- A confidence level or probability score
- A link to the algorithm's validation summary

Clinicians can access this explanation in-context without leaving their workflow.

---

### 36.10 Large Language Models and Generative AI

#### 36.10.1 Supported LLM Technologies

The platform supports integration with:
- Institution-hosted open-weight LLMs (e.g. Llama, Mistral, BioMedLM) deployed on institution infrastructure — no data leaves the premises
- API-based commercial LLMs (OpenAI GPT-4o, Anthropic Claude, Google Gemini) via a configurable LLM gateway that enforces de-identification before data transmission
- The institution selects and configures the LLM provider per use case; clinically sensitive use cases default to on-premise or pseudonymised-data configurations

#### 36.10.2 Training Data and Data Governance

- Base models are pre-trained on general and biomedical corpora by the model provider; the institution does not contribute patient data to external model training.
- For institution-specific fine-tuning (e.g. local drug formulary, specialty-specific coding patterns), training is performed on de-identified local data on institution infrastructure; the resulting model weights remain on-premise.
- All LLM usage is logged: user, timestamp, prompt category (not full text for privacy), model used, and output action taken.

#### 36.10.3 Current LLM-Enabled Features

| Feature | Description |
|---|---|
| **Clinical summarisation** | On-demand summary of a patient's full record or a defined time window (e.g. last 48 h), formatted for shift handover or MDT preparation |
| **Handover note generation** | LLM drafts the ISBAR handover note from structured data; the clinician reviews and edits before finalising |
| **Discharge letter drafting** | LLM pre-populates the discharge letter from the encounter record; physician reviews, edits, and signs |
| **Coding assistance** | LLM proposes ICD-10 and CHOP codes from free-text documentation; coder reviews and confirms |
| **Plain-language report** | Lay summary of reports and results for the patient portal (§36.1.8) |
| **Unstructured data extraction** | Structured field population from uploaded PDFs (referral letters, external reports) — see §36.10.4 |
| **Chatbot (24/7 assistant)** | Institutional knowledge-scoped patient-facing assistant (§36.2) |
| **Voice-to-structured data** | Speech recognition → transcription → LLM-assisted structuring of clinical findings into relevant documentation fields |

#### 36.10.4 Unstructured Data Extraction

Externally received PDFs (referral letters, imaging reports, discharge summaries from other institutions) are processed by an OCR + LLM extraction pipeline:

1. Document uploaded to the document library (manual or via HL7 MDM message)
2. OCR converts scanned pages to text
3. LLM identifies and extracts structured fields: diagnoses, medications, allergies, relevant test results, demographics
4. Extracted data is presented as a proposed import in a review screen; the reviewing clerk or clinician accepts, edits, or rejects each field individually
5. Accepted data is written to the patient record with source provenance (document ID, extraction model, review date, reviewing person)

This workflow shifts the manual extraction task from highly trained clinical staff to administrative staff or, for low-risk fields, to fully automated import with periodic audit.

#### 36.10.5 Data Security in LLM Use

- For on-premise LLMs: no data leaves the institution.
- For API-based LLMs: a de-identification / pseudonymisation step is applied before any data is sent; PII (names, birth dates, AHV numbers, addresses) is replaced with tokens. The LLM provider is contractually bound not to use submitted data for model training (DPA / processing agreement).
- Users are informed when their interaction is processed by an AI; they can opt out of AI-assisted features per their role and the institution's configuration.

---

### 36.11 AI Algorithm Integration (Third-Party and Research)

#### 36.11.1 Integration Standards

Third-party AI algorithms (CE-marked commercial tools, research prototypes) are integrated via:

| Standard | Use case |
|---|---|
| **HL7 CDS Hooks** | Point-of-care decision support; result returned as a card displayed in the clinical UI |
| **SMART on FHIR** | Launch third-party app within the HIS context with patient data available; result written back as FHIR resource |
| **FHIR REST API** | Batch or asynchronous AI inference; results stored as FHIR Observation or RiskAssessment |
| **DICOM SR / AI result DICOM** | Radiology AI output overlaid on imaging viewer |
| **Custom REST / webhook** | For algorithms not yet on standard integration patterns; transition to standards-based integration planned |

#### 36.11.2 Workflow Trigger and Response

- **Inbound trigger:** A clinical event in the HIS (order placed, result received, patient admitted) fires a webhook or CDS Hooks call to the third-party AI service.
- **Outbound trigger:** The third-party AI can initiate a workflow in the HIS via FHIR write (creating a Task, Flag, or RiskAssessment) or CDS Hooks response.

#### 36.11.3 Privacy in Third-Party AI Integration

Before data is sent to any third-party cloud AI service:
- De-identification or pseudonymisation is applied per a configurable de-identification profile (Safe Harbour, Expert Determination, or institution-defined)
- The data transfer is logged with: service name, data category, volume, and de-identification method applied
- The institution can block any data category from leaving the perimeter; the system enforces this at the integration layer

#### 36.11.4 Supported AI Ecosystems

Configurable integration with:
- **AWS HealthLake / Amazon Comprehend Medical**
- **Microsoft Azure AI Health Insights**
- **Google Cloud Healthcare API**
- **NVIDIA Clara / Holoscan** (medical imaging AI)
- Custom on-premise MLOps platforms (MLflow, Kubeflow) for research-grade model serving

---

### 36.12 AI Partnerships, Community, and Regulatory Compliance

#### 36.12.1 AI Regulatory Framework

**EU AI Act (Regulation 2024/1689):**
The system maintains an **AI register** cataloguing every AI system deployed, with:
- Risk classification (unacceptable / high / limited / minimal risk per Annex III)
- Technical documentation reference
- Conformity assessment status and certificate where applicable
- Human oversight mechanism (who reviews AI outputs and how)
- Monitoring metrics and review cadence

High-risk AI systems (clinical decision support meeting MDSW criteria) undergo conformity assessment per the AI Act before deployment. Post-market surveillance data (override rates, adverse event correlation, performance drift) feeds the annual conformity review.

**MDR compliance:**
MDSW (medical device software) classifications follow MDCG 2019-11. Algorithms meeting the MDSW definition are either CE-marked products (third-party) or developed under the institution's in-house manufacturer quality management system. The software safety classification register is maintained by the clinical informatics team and reviewed annually.

#### 36.12.2 Data Community and Research Interoperability

The platform supports participation in federated learning and data-sharing networks:

- **Federated learning:** Model training can be performed locally; only model weights (not patient data) are shared with network participants. Supported frameworks: PySyft, NVIDIA FLARE, TriCo (Swiss federated analytics).
- **FHIR-based data sharing:** De-identified or pseudonymised datasets can be exported in FHIR R4 format for approved research use, complying with Swiss nFADP (nDSG) and cantonal data protection regulations.
- **Interoperability standards used:** HL7 FHIR R4, OMOP CDM (for observational research), DICOM, openEHR (for structured clinical data exchange), IHE profiles.
- **Swiss health data ecosystem:** The platform is compatible with the Swiss Electronic Patient Record (EPR / ePA) requirements under EPDG and supports connection to cantonal EPR communities via the EPR integration profile (XDS.b / MHD).

---


### 36.13 AI — Earlier Architecture Notes


AI capabilities are applied at two distinct points in the system: at the boundary where unstructured data enters the system (document extraction), and within the clinical workspace where staff need to navigate and synthesise large data volumes (search and summarisation). Both are assistive — AI output is always reviewed and confirmed by a human before entering the clinical record.

### 36.14 Document Data Extraction

Referrals, orders, and clinical documents frequently arrive as PDF or image. Manual re-keying is error-prone and consumes qualified staff time. The extraction pipeline minimises manual data entry.

#### Extraction Pipeline

```
Document received (PDF, image, fax)
  → OCR (where needed)
  → NLP / LLM extraction
      — demographics: name, DOB, AHV number, address, insurer
      — clinical: diagnoses → ICD-10/SNOMED mapping
                  medications → drug database mapping
                  allergies, relevant history
      — administrative: referring physician, order type, urgency
  → Structured fields presented as pre-populated form
  → Confidence score per field
  → Low-confidence fields flagged for human review
  → Staff confirms or corrects; original document retained alongside
```

No extracted value enters the record without human confirmation. The source document is permanently linked to every extracted field — the origin of any structured value is always traceable.

#### Confidence and Review Routing

| Confidence level | Routing |
|---|---|
| All fields high | Administrative staff confirmation only |
| One or more fields low | Routed to designated clinical reviewer |
| Extraction failed | Manual entry required; document attached for reference |

This routing enables a shift in who performs data intake: high-confidence extractions move to administrative staff; qualified clinical staff are reserved for interpretation, not transcription.

#### Quality Assurance

- Extraction accuracy is measured continuously against confirmed values
- Systematic errors in specific document formats are flagged for model retraining or rule adjustment
- Correction rate by document source is tracked; sources with high correction rates are escalated for process review

### 36.15 Clinical Data Search and Summarisation

Clinicians need to locate specific information across a patient's full history — which may span many years, many episodes, and many external sources — quickly and with minimal query formulation.

#### Search Scope

Full-text and structured search across:
- All structured clinical data (diagnoses, procedures, medications, results, observations)
- All clinical notes and documents — including OCR-processed external documents
- The full patient history without default date restriction

#### Search Modalities

| Modality | Mechanism |
|---|---|
| **Keyword** | SNOMED CT subsumption — "diabetes" matches all child concepts |
| **Natural language** | AI-interpreted clinical question: "has this patient had a pulmonary embolism?" |
| **Timeline filter** | Results on patient timeline; filter by type, date range, source |
| **Cross-patient** (authorised roles) | Population queries for clinical audit and population health |

Natural language queries are resolved against the composition store and the full-text index. The AI identifies relevant records; the clinician inspects the source records to verify.

#### Patient Summary Generation

From any search result set, an AI-generated narrative summary is available:
- Summarises the patient's history relevant to the search query
- Clearly marked as AI-generated; every claim links to the source record
- Can be included in a clinical note or referral letter as a draft
- Physician reviews and approves before the summary enters the record

The source-linking requirement is non-negotiable: a summary without traceable sources cannot be trusted in a clinical context.

#### Governance

- AI models used for clinical summarisation are documented in the system configuration
- Model version is recorded alongside every AI-generated output
- AI outputs are never automatically promoted to the clinical record — human approval is always required

---

