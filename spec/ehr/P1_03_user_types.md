## 3. User Types

The system serves a broad population of users with distinct roles, authorization scopes, and interaction patterns. Understanding who uses the system — and why — shapes every architectural and UX decision.

User types fall into four categories: clinical staff, administrative staff, external parties, and operational/management roles.

---

### 3.1 Clinical Staff

#### Physician (Arzt / Médecin)

Physicians bear clinical responsibility for diagnosis, treatment planning, and prescribing. They use the system for documentation, order entry, results review, and report generation. Interaction is primarily read-heavy and context-rich: a physician needs the full picture of one patient at a time. On ward rounds the primary device is mobile; at the workstation the three-panel desktop layout is standard. Physicians have the broadest read access to clinical data and exclusive write access to orders and prescriptions.

| | |
|---|---|
| Primary interface | Desktop (§51.4.3), Mobile (§51.4.4) |
| Authorization | Full clinical record read; orders, prescriptions, diagnoses write |
| Key touchpoints | CPOE, dictation/notes, results, pathways, referrals |

---

#### Nurse (Pflegefachperson / Infirmière)

Nurses execute care — administering medications, recording observations, managing fluid balance, performing wound care, and escalating deteriorating patients. Their workflow is task-driven and time-pressured across multiple patients simultaneously. The ward overview is their primary screen; patient detail is opened per task. The mobile device is essential — nurses move continuously. Write access covers observations, MAR, nursing assessments, and care tasks; prescribing and diagnosis are physician-only.

| | |
|---|---|
| Primary interface | Mobile / tablet (§51.5), Ward overview (§51.9.1) |
| Authorization | Observations, MAR, nursing assessments write; clinical record read |
| Key touchpoints | Vital signs capture, medication scanning, NEWS2, escalation |

---

#### MPA (Medizinische Praxisassistentin / Assistante médicale)

The MPA is the backbone of the Swiss outpatient polyclinic. Unlike a ward nurse, the MPA's role spans clinical assistance and administrative coordination within the ambulatory encounter: preparing the patient, assisting during examination, capturing service codes for billing, managing the appointment flow, and handling correspondence. The MPA works at the intersection of clinical and administrative domains. She is typically the first and last person the patient interacts with at a polyclinic visit. Authorization covers patient intake, vital signs, service capture, and administrative tasks; prescribing and clinical documentation are physician scope.

| | |
|---|---|
| Primary interface | Desktop (clinic workstation), shared kiosk for patient check-in |
| Authorization | Intake, vitals, checklists, service block capture, scheduling |
| Key touchpoints | Self check-in kiosks, checklist management, Leistungserfassung, patient flow status |

---

#### MTRA (Medizinisch-Technische Radiologieassistentin)

The MTRA operates imaging equipment — CT, MRI, X-ray, fluoroscopy — and acquires DICOM images under the radiologist's prescription. In the system, the MTRA works from the radiology order work queue, marks examinations as started and completed, associates DICOM series with the order, and may complete a technical acquisition report. They do not write clinical interpretations. Access is scoped to the imaging orders assigned to their modality and department.

| | |
|---|---|
| Primary interface | RIS work queue integrated in desktop |
| Authorization | Imaging orders read/execute; DICOM association; technical report |
| Key touchpoints | Order work queue, RIS/PACS integration, DICOM upload |

---

#### BMA (Biomedizinische Analytikerin / Analyste biomédicale)

The BMA processes laboratory samples: receipt, centrifugation, analysis, quality control, and result entry. In the system, she works from the LIS order queue. She marks samples as received, enters or confirms analyser-generated results, applies quality control rules, and releases results. Released results flow automatically to the ordering clinician and update the patient record. Access is scoped to laboratory orders and result entry.

| | |
|---|---|
| Primary interface | LIS integrated in desktop |
| Authorization | Lab orders read/execute; result entry and release |
| Key touchpoints | Sample receipt, result validation, LIS integration |

---

#### Allied Health Professional (Physiotherapist, Occupational Therapist, Speech Therapist, Dietitian)

Allied health professionals execute therapy orders within their discipline. They document sessions, record progress against therapeutic goals, and communicate findings to the referring physician. They see the clinical context relevant to their role (diagnoses, relevant history, prior therapy notes) but not the full clinical record. Their documentation flows back as compositions into the patient record, visible to the care team.

| | |
|---|---|
| Primary interface | Desktop or tablet |
| Authorization | Therapy orders read/execute; therapy notes write; limited clinical context read |
| Key touchpoints | Therapy order queue, session documentation, goal tracking |

---

#### Hospital Pharmacist (Spitalapotheker/in)

The hospital pharmacist reviews medication orders for safety — dose checking, interaction screening, and allergy verification. They approve or flag orders before dispensing. In the system they work from the pharmacy order queue and have full read access to the medication record, allergy list, and relevant lab values (renal function, liver function). They can annotate and return orders to the prescribing physician with a query; they cannot modify a clinical prescription directly.

| | |
|---|---|
| Primary interface | Desktop pharmacy workstation |
| Authorization | Medication orders read/annotate; allergy and relevant lab read |
| Key touchpoints | Pharmacy order queue, drug interaction alerts, dispensing confirmation |

---

### 3.2 Administrative Staff

#### Booking Coordinator (Terminkoordinator/in)

The booking coordinator manages appointment availability, handles inbound referral requests that require manual processing, and operates the referrer portal configuration. They see the scheduling system in full — all resources, all slots, all pending requests — but have no access to clinical record content beyond what is necessary to assign the correct appointment type (e.g., reason for referral, urgency).

| | |
|---|---|
| Primary interface | Desktop — scheduling and referrer portal admin |
| Authorization | Scheduling full write; referral requests; portal configuration |
| Key touchpoints | Slot management, referrer portal, CTI telephony integration (§37.3) |

---

#### Patient Administration Clerk (Patientenadministration)

Patient administration handles registration, episode creation, insurance verification, and demographic master data. They are the gatekeepers of the patient identity record and the episode lifecycle. They create and close episodes, manage the Fallnummer, and submit episodes to clinical coding at discharge. They do not access clinical content.

| | |
|---|---|
| Primary interface | Desktop — patient admin module |
| Authorization | Patient demographics write; episode lifecycle management; insurance |
| Key touchpoints | MPI, episode state machine, insurer communication, Swiss AHV/NAVS13 |

---

#### Clinical Coder (Kodierfachkraft)

The clinical coder assigns ICD-10 and CHOP codes to inpatient episodes after discharge, enabling SwissDRG grouping and billing. They read the full clinical record for the episode — discharge summary, diagnoses, procedures — but do not write clinical content. They write coding annotations and submit the coded episode to billing. Billing cannot proceed until coding is complete.

| | |
|---|---|
| Primary interface | Desktop — coding module |
| Authorization | Full episode clinical record read (read-only); coding annotations write |
| Key touchpoints | Episode coding, SwissDRG grouper, billing handoff |

---

#### Billing Clerk

The billing clerk prepares and submits invoices to insurers, reviews rejected claims, and manages the billing lifecycle per episode. They work with coded episodes and service records; they do not access clinical content. They interact with SAP for financial settlement.

| | |
|---|---|
| Primary interface | Desktop — billing module |
| Authorization | Coded episodes and service records read; invoice management write |
| Key touchpoints | TARMED/SwissDRG, insurer EDI, SAP integration |

---

### 3.3 External Parties

#### Referring Physician (Zuweiser)

A GP, specialist, or outpatient clinic that refers patients to the institution. The referring physician accesses the system exclusively through the referrer portal (§37.1) and, where integrated, through their own PIS (§37). They can see appointment availability, the status of their active referrals, and clinical reports released by the institution for their referred patients. They cannot access the full patient record. Authentication is via HIN identity as the primary trust anchor.

| | |
|---|---|
| Primary interface | Referrer portal (web); PIS integration |
| Authorization | Own referred patients only; released reports; appointment booking within trust level |
| Key touchpoints | Referrer portal, HIN auth, PIS integration, report release |

---

#### Patient / Proxy Carer

The patient accesses their own record through the patient app and web portal (§51.6). They see released results, appointments, medications, and documents in plain language. They can submit pre-appointment questionnaires, book and manage appointments, record home monitoring data, and manage EPD consent. A proxy carer (parent, legal guardian, authorised carer) accesses a scoped subset of another patient's record with explicit consent.

| | |
|---|---|
| Primary interface | Patient app (iOS/Android), web portal |
| Authorization | Own record read (released data only); home data write; EPD consent management |
| Key touchpoints | Appointment booking, PRO questionnaires, results (released), EPD |

---

#### EMS Personnel (Rettungsdienst, Rega, AAA)

Emergency medical service personnel transmit pre-arrival patient data to the institution en route (§37.1 in the EMS referral context, §4 for regulatory standard eCH-0207). They are not regular system users — their interaction is system-to-system via the eCH-0207 FHIR interface. The data they transmit is received and displayed in the emergency department before the patient arrives, and pre-populates the admission record.

| | |
|---|---|
| Primary interface | EMS system-to-system (eCH-0207 / CH EMS FHIR) |
| Authorization | Write: pre-arrival composition only; no read access to patient history |
| Key touchpoints | eCH-0207 receiver, ED pre-arrival display, admin pre-population |

---

#### External Order Requestor

An external laboratory, pathology service, or imaging centre that submits orders to the institution and retrieves results (§37.2). Interaction is via the orders portal or PIS integration. They see their own submitted orders and the results of those orders. They have no access to the broader patient record beyond what is necessary for order context.

| | |
|---|---|
| Primary interface | Orders portal (web); PIS/FHIR integration |
| Authorization | Own submitted orders; results of own orders; order guidance |
| Key touchpoints | Orders portal, FHIR ServiceRequest, LIS/RIS result retrieval |

---

### 3.4 Operational and Management Roles

#### Clinical Informatician (Klinische Informatikerin / Informaticien clinique)

The clinical informatician maintains the clinical knowledge layer: archetypes, order sets, pathway definitions, SOP content, checklist templates, prevention rules, and form definitions. This is a configuration role, not a developer role — all changes are made through the system's authoring interfaces without code deployment. Access to live patient data is limited to what is needed for testing and validation.

| | |
|---|---|
| Primary interface | Desktop — authoring and configuration tools |
| Authorization | Archetype/template authoring; pathway and SOP definition; no routine patient data access |
| Key touchpoints | Archetype registry, pathway designer, SOP editor, order set builder |

---

#### Department Head / Abteilungsleiter/in

The department head needs reporting and oversight: how is the department performing against targets, what is the current capacity, which patients are at risk of delayed discharge. They use dashboards and reports rather than individual patient records. They may access individual patient data in a supervisory capacity with explicit audit logging.

| | |
|---|---|
| Primary interface | Desktop — reporting and dashboard |
| Authorization | Department-scoped reporting; supervisory patient record access (audited) |
| Key touchpoints | Capacity dashboards, quality indicators, resource utilisation reports |

---

#### Quality Manager

The quality manager monitors SOP compliance, pathway adherence, clinical indicator trends, and safety events. They have read access to de-identified aggregate data and, with explicit authorization, to specific audited cases for quality review. They do not write clinical content.

| | |
|---|---|
| Primary interface | Desktop — quality and audit module |
| Authorization | Aggregate and de-identified reporting; audited case review |
| Key touchpoints | SOP compliance tracking, pathway completion rates, safety event registry |

---

#### IT / System Administrator

The system administrator manages infrastructure configuration, user account provisioning, integration monitoring, and audit log access. They do not access clinical content in the course of normal administration. Access to clinical data for diagnostic purposes (e.g., investigating a data integrity issue) is a break-the-glass action, logged and auditable.

| | |
|---|---|
| Primary interface | Admin console; infrastructure tooling |
| Authorization | System configuration; user management; integration monitoring; no routine clinical access |
| Key touchpoints | Identity provider configuration, integration health dashboards, audit log management |

---

### 3.5 Regulated Third Parties

#### Insurer (Krankenversicherung / Assurance maladie)

Insurers receive billing data and may query claim status. They do not have direct access to clinical content — all insurer interaction is through the billing and claims domain, via EDI formats (TARMED XML, SwissDRG DRG-Rechnung). For authorisation queries (Kostengutsprache), the insurer receives a structured summary of the clinical indication; access to the underlying record requires patient consent and is not routine.

| | |
|---|---|
| Primary interface | EDI (billing); portal for authorisation queries |
| Authorization | Billing and claim data only; clinical summaries with patient consent |
| Key touchpoints | TARMED/SwissDRG EDI, authorisation request workflow |

---

#### Health Authority (BAG, Kantone)

Public health and regulatory bodies receive statutory reports: infectious disease notifications, cancer registry submissions, quality indicator data. All submissions are generated by the system from clinical data and transmitted via defined interfaces; the authority does not have interactive access to the system. Data is de-identified or pseudonymised as required by law.

| | |
|---|---|
| Primary interface | Automated regulatory submission interfaces |
| Authorization | Receives statutory report outputs only; no interactive access |
| Key touchpoints | BAG notification interfaces, cantonal registry submissions |

---

#### EPD Community Operator (CARA, axsana, eHealth Aargau, etc.)

The EPD community operator provides the federated infrastructure through which the institution's system connects to the national Electronic Patient Dossier (§38). They are not interactive users — the relationship is system-to-system via IHE profiles (XDS.b, MHD, PIX, ATNA). The EPD community validates the institution's IHE conformance and manages the federated patient identity.

| | |
|---|---|
| Primary interface | IHE XDS.b / MHD system-to-system |
| Authorization | Federated document registry; no direct patient record access |
| Key touchpoints | Swiss EPD federation (§38), ATNA audit, PIX patient identity |

---

#### Research Coordinator / Data Analyst

Research coordinators access de-identified or pseudonymised patient data under an approved ethics protocol. Access is scoped to the approved dataset, time-limited, and fully audited. No re-identification is possible within the system interface. Data extracts are generated by the system; the coordinator does not browse live patient records.

| | |
|---|---|
| Primary interface | Research data extract portal (read-only, scoped) |
| Authorization | De-identified/pseudonymised extract only; ethics-approved scope; time-limited |
| Key touchpoints | Data extract engine, ethics approval registry, audit log |

---

### 3.6 Authorization Summary

| User type | Clinical record | Orders | Prescriptions | Scheduling | Admin/billing | Configuration |
|---|---|---|---|---|---|---|
| Physician | Full read | Write | Write | Read | — | — |
| Nurse | Full read | Limited write | — | Read | — | — |
| MPA | Limited read | — | — | Write | Leistungen | — |
| MTRA / BMA | Role-scoped read | Execute own | — | — | — | — |
| Allied health | Role-scoped read | Execute own | — | — | — | — |
| Pharmacist | Meds + labs read | Annotate | — | — | — | — |
| Booking coordinator | — | — | — | Full write | — | Portal config |
| Patient admin | Demographics only | — | — | Read | Episode write | — |
| Clinical coder | Episode read | — | — | — | Coding write | — |
| Billing clerk | — | — | — | — | Full billing write | — |
| Referring physician | Released reports | — | — | Limited booking | — | — |
| Patient | Own released data | — | — | Own appts | — | — |
| EMS | Write pre-arrival | — | — | — | — | — |
| Clinical informatician | Test/validation | — | — | — | — | Full content config |
| Department head | Dept reporting | — | — | Dept reporting | — | — |
| IT admin | Break-glass only | — | — | — | System config | System config |
| Insurer | Billing data only | — | — | — | Claims read | — |

---

