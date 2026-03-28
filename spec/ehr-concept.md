# EHR/EPR/EMR System — Concept & Architecture

## Table of Contents

**Part I — Introduction and Context**
- [1. Terminology](#1-terminology)
- [2. Functional Domains](#2-functional-domains)
- [3. User Types](#3-user-types)
- [4. Regulatory Context — Switzerland](#4-regulatory-context--switzerland-takech--epdg)
- [5. Design Principles](#5-design-principles)

**Part II — Core Clinical Modules**
- [6. Ambulatory Process and Patient Record](#6-ambulatory-process-and-patient-record)
- [7. Orders — CPOE](#7-orders--cpoe-verordnungen)
- [8. Medication Management](#8-medication-management)
- [9. Interprofessional Documentation and Problem List](#9-interprofessional-documentation-and-problem-list)
- [10. Nursing Process](#10-nursing-process)
- [11. Clinical Scores and Assessments](#11-clinical-scores-and-assessments)
- [12. Anatomical Body Views](#12-anatomical-body-views)
- [13. Clinical Pathways](#13-clinical-pathways)
- [14. Standard Operating Procedures](#14-standard-operating-procedures-sops)

**Part III — Inpatient Care**
- [15. Inpatient Admission](#15-inpatient-admission)
- [16. Admission Schemas, Order Sets, and Pathways](#16-admission-schemas-order-sets-and-pathways)
- [17. Ambulatory–Inpatient Continuity](#17-ambulatoryinpatient-continuity)
- [18. Discharge Management](#18-discharge-management)
- [19. Insurance Authorization — Kostengutsprache](#19-insurance-authorization--kostengutsprache)
- [20. Charge Capture and Coding](#20-charge-capture-and-coding)

**Part IV — Specialty Departments**
- [21. Emergency Department](#21-emergency-department)
- [22. Operating Theatre Management](#22-operating-theatre-management)
- [23. Perioperative Quality Management](#23-perioperative-quality-management)
- [24. Patient Data Management System (PDMS)](#24-patient-data-management-system-pdms)
- [25. Neonatology](#25-neonatology)
- [26. Therapies](#26-therapies)
- [27. Prevention and Population Health](#27-prevention-and-population-health)
- [28. Multi-Resource Planning (MRP)](#28-multi-resource-planning-mrp)
- [29. Logistics](#29-logistics)
- [30. Research and Teaching](#30-research-and-teaching)
- [31. Radiology and Imaging (RIS/PACS)](#31-radiology-and-imaging-rispacs)
- [32. Laboratory Information System (LIS)](#32-laboratory-information-system-lis)
- [33. Pathology](#33-pathology)
- [34. Endoscopy](#34-endoscopy)
- [35. Infection Control and Antimicrobial Stewardship](#35-infection-control-and-antimicrobial-stewardship)

**Part V — Digital Platform**
- [36. Patient App, Digital Engagement, and AI](#36-patient-app-digital-engagement-and-ai)
- [37. External Portals and Referrer Integration](#37-external-portals-and-referrer-integration)
- [38. Swiss EPD Integration](#38-swiss-epd-integration)
- [39. Privacy, Data Protection, and Security](#39-privacy-data-protection-and-security)
- [40. System Administration and Audit](#40-system-administration-and-audit)
- [41. Disaster Recovery and Business Continuity](#41-disaster-recovery-and-business-continuity)
- [42. Interoperability Architecture](#42-interoperability-architecture)

**Part VI — Technical Architecture**
- [43. Data Architecture Philosophy](#43-data-architecture-philosophy)
- [44. Data Model](#44-data-model)
- [45. Archetype System](#45-archetype-system)
- [46. Multi-Granularity and Multi-Perspective Clinical Data](#46-multi-granularity-and-multi-perspective-clinical-data)
- [47. Time Series Data](#47-time-series-data)
- [48. Laboratory Data Ingestion](#48-laboratory-data-ingestion)
- [49. Technology Stack](#49-technology-stack)
- [50. The MUMPS Lesson — Epic Systems](#50-the-mumps-lesson--epic-systems)
- [51. Mobile Applications](#51-mobile-applications)
- [52. Configuration vs Code](#52-configuration-vs-code)
- [53. Episode Assignment — Every Action Traced to a Fall](#53-episode-assignment--every-action-traced-to-a-fall)
- [54. Inter-Domain Communication](#54-inter-domain-communication)
- [55. Modularity Structure](#55-modularity-structure)
- [56. Architecture and Development Considerations](#56-architecture-and-development-considerations)
- [57. Implementation Priorities](#57-implementation-priorities)
- [58. Summary of Key Decisions](#58-summary-of-key-decisions)

---

---

# Part I — Introduction and Context

---

## 1. Terminology

| Term | Meaning |
|---|---|
| **EMR** | Electronic Medical Record — digital chart within one practice or hospital |
| **EPR** | Electronic Patient Record — broader term common in UK/EU; covers a single provider's full record |
| **EHR** | Electronic Health Record — designed to share across providers and systems |

This document describes a full **EHR** — all functional domains, all patient data, shareable across providers.

---


## 2. Functional Domains

The system covers all functional domains required for a comprehensive EHR at a large university hospital. This chapter provides a structured overview of each domain with references to the detailed specification chapters.

### Part I — Introduction and Context
| Chapter | Title |
|---|---|
| §1 | Terminology and definitions |
| §3 | User types and roles |
| §4 | Swiss regulatory context (EPDG, KVG, TARMED, SwissDRG) |
| §5 | Design principles |

### Part II — Core Clinical Modules
| Chapter | Title | Key capabilities |
|---|---|---|
| §6 | Ambulatory process and patient record | Polyclinic workflow, MPA/physician tasks, self check-in, service capture |
| §7 | Orders — CPOE | Laboratory, imaging, referrals, procedure orders, order sets |
| §8 | Medication management | Closed-loop medication, chemo protocols, admission/discharge reconciliation, eMediplan |
| §9 | Interprofessional documentation | Shared problem list, MDT documentation, progress notes |
| §10 | Nursing process | Assessment, care planning, interventions, shift handover |
| §11 | Clinical scores and assessments | NEWS2, SOFA, Barthel, NRS, specialty-specific scores; automated computation |
| §12 | Anatomical body views | Body-map annotation, avatar documentation, wound/burn/pain recording |
| §13 | Clinical pathways | Evidence-based pathway templates, variance tracking, pathway-driven task generation |
| §14 | Standard operating procedures | SOP library, version management, contextual SOP retrieval at point of care |

### Part III — Inpatient Care
| Chapter | Title | Key capabilities |
|---|---|---|
| §15 | Inpatient admission | ADT, bed assignment, admission assessment, ward handover |
| §16 | Admission schemas and order sets | Pre-configured admission packages, pathway activation, routine order sets |
| §17 | Ambulatory–inpatient continuity | Seamless record transition, continuing care plans, outpatient-linked inpatient orders |
| §18 | Discharge management | Discharge planning, social work integration, post-acute placement, discharge letter |
| §19 | Insurance authorisation (Kostengutsprache) | KG request, status tracking, renewal alerts, rejection/reconsideration |
| §20 | Charge capture and coding | ICD-10/CHOP coding, TARMED/TARDOC, SAP IS-H integration, DRG working group |

### Part IV — Specialty Departments
| Chapter | Title | Key capabilities |
|---|---|---|
| §21 | Emergency department | End-to-end ED process, triage, dashboard, shock room, mass casualty |
| §22 | Operating theatre management | OR scheduling, patient tracking, pre-op preparation, procedure documentation |
| §23 | Perioperative quality management | WHO Safe Surgery Checklist, implant documentation, quality reporting |
| §24 | PDMS / Intensive care | ICU-specific documentation, device integration, ICU scores, complex patient management |
| §25 | Neonatology | Neonatal documentation, growth curves, bilirubin management, neonatal medication |
| §26 | Therapies | Therapy referral, group sessions, nutrition management, ICF discharge documentation |
| §27 | Prevention and population health | Preventive care protocols, population screening, risk cohort identification |
| §28 | Multi-resource planning (MRP) | Hospital-wide scheduling, bed management, command centre, demand forecasting |
| §29 | Logistics | Patient transport, inventory, sterile goods, cleaning, hotel services, blood products |
| §30 | Research and teaching | Study management, consent, research data, sample management, eSRA compliance |
| §31 | Radiology and imaging (RIS/PACS) | *Planned — see chapter for detail* |
| §32 | Laboratory information system (LIS) | *Planned — see chapter for detail* |
| §33 | Pathology | *Planned — see chapter for detail* |
| §34 | Endoscopy | *Planned — see chapter for detail* |
| §35 | Infection control and antimicrobial stewardship | *Planned — see chapter for detail* |

### Part V — Digital Platform
| Chapter | Title | Key capabilities |
|---|---|---|
| §36 | Patient app, digital engagement, and AI | Patient portal, 24/7 assistant, bedside devices, telemedicine, remote care, CDS, LLM |
| §37 | External portals and referrer integration | Referrer portal, PIS interface, HIN identity, direct contact support |
| §38 | Swiss EPD integration | EPDG compliance, XDS.b/MHD, cantonal EPR community connection |
| §39 | Privacy, data protection, and security | *Planned — see chapter for detail* |
| §40 | System administration and audit | *Planned — see chapter for detail* |
| §41 | Disaster recovery and business continuity | *Planned — see chapter for detail* |
| §42 | Interoperability architecture | *Planned — see chapter for detail* |

### Part VI — Technical Architecture
| Chapter | Title |
|---|---|
| §43 | Data architecture philosophy |
| §44 | Data model |
| §45 | Archetype system |
| §46 | Multi-granularity and multi-perspective clinical data |
| §47 | Time series data |
| §48 | Laboratory data ingestion |
| §49 | Technology stack |
| §50 | The MUMPS lesson — Epic Systems |
| §51 | Mobile applications |
| §52 | Configuration vs code |
| §53 | Episode assignment |
| §54 | Inter-domain communication |
| §55 | Modularity structure |
| §56 | Architecture and development considerations |
| §57 | Implementation priorities |
| §58 | Summary of key decisions |

---

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


## 4. Regulatory Context — Switzerland (TakeCH / EPDG)

### 4.1 Key Legislation
- **EPDG** (Bundesgesetz über das elektronische Patientendossier) — federal law mandating EPD participation for hospitals; voluntary for patients
- **EPDV** — implementing ordinance

### 4.2 EPD Communities
Switzerland's EPD is federated through cantonal communities:
- CARA (Romandie)
- axsana (Zurich / Central Switzerland)
- eHealth Aargau
- Others per canton

The system must federate with whichever community serves its patients.

### 4.3 Mandated Standards
- **IHE profiles**: XDS.b (document sharing), PIX/PDQ (patient identity cross-referencing), ATNA (audit trail and node authentication), MHD (mobile health documents), XUA (cross-enterprise user authentication)
- **HL7 FHIR R4** — Swiss national profiles (CH Core, CH EPD)
- **eCH-0107** — Swiss patient identifier (AHV-Nummer / NAVS13 as root identity)
- **Swiss SNOMED CT** national extension
- **Trilingual terminology**: German, French, Italian minimum

### 4.4 Billing Standards
- SwissDRG for inpatient
- TARMED / TARDOC for ambulatory
- Swiss tariff point values per canton

### 4.5 Security & Compliance
- GDPR-compatible data protection (nDSG — revidiertes Datenschutzgesetz)
- Role-based access control to field level
- Full audit trail: every read, write, and delete logged with user identity and timestamp
- Break-glass access for emergencies with post-hoc audit
- Encryption at rest and in transit

---


## 5. Design Principles

Four non-negotiable architectural demands shape all decisions:

1. **Performance** — sub-100ms for common clinical queries; predictable latency under load
2. **Modularity** — domains are independently deployable and independently evolvable
3. **Data model first** — the data model defines structure and meaning; views and forms are derived from it, never the reverse
4. **Extensibility** — new clinical concepts, new resource types, and new billing rules must be addable without schema migrations and without modifying existing code

---


---

# Part II — Core Clinical Modules

---

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


## 7. Orders — CPOE (Verordnungen)

### 7.1 Order Model

Every order is a structured composition with a defined set of parameters:

| Parameter | Description |
|---|---|
| Order type | Examination, procedure, consultation, therapy, medication |
| Urgency | Routine / urgent / STAT |
| Clinical question | Structured indication (mapped to ICD-10 / SNOMED) + free text |
| Requested timing | Absolute date, relative ("within 48 hours"), or dependent ("after result X") |
| Ordering clinician | Responsible physician (may differ from entering user) |
| Executing department | Target LIS, RIS, therapy department, or consultant |
| Episode link | `episode_id` — mandatory (§53) |

**Timing dependencies** are first-class. "Book after the next lab result" creates a scheduling dependency that resolves automatically when the triggering event occurs. This is not a free-text annotation — it is a machine-readable constraint.

### 7.2 Order Type Examples

Each order type maps to an archetype that defines its parameters and result structure. Representative examples:

| Order | Archetype | Executing dept | Result type |
|---|---|---|---|
| 12-lead resting ECG | `ecg_order.v1` | Cardiology / MPA | Structured trace + interpretation |
| Pulmonary function (spirometry) | `spirometry_order.v1` | Respiratory | FVC, FEV1, curves |
| Endoscopy | `endoscopy_order.v1` | GI / endoscopy unit | Procedure note + images; sedation sub-order |
| Diagnostic coronary angiography | `coronary_angiography_order.v1` | Cardiology / cath lab | Procedure report + DICOM |
| Occupational therapy | `ot_order.v1` | OT department | Session notes; covers a course of sessions |
| Dermatological consultation | `consultation_order.v1` | Dermatology | Consultation letter |

Each order type's form is generated from its archetype definition — no bespoke UI code per order type.

### 7.3 Order Sets (Verordnungssets)

Order sets bundle multiple orders for a clinical scenario into a single action.

**Definition** (by clinical informaticians):
```
Order set: "Pre-operative work-up — elective hip replacement"
  1. Full blood count                urgency: routine, timing: within 7 days of admission
  2. Coagulation screen              urgency: routine, timing: with FBC
  3. 12-lead resting ECG             urgency: routine, timing: within 14 days of admission
  4. Anaesthetics pre-assessment     urgency: routine, timing: ≥ 7 days before surgery
  5. Chest X-ray (if age ≥ 60)      urgency: routine, condition: patient age ≥ 60
```

**Ordering**: the physician selects the set; all constituent orders are created simultaneously. The ordering interaction is a single action, not five separate order entries.

**Situational adjustment**: before confirmation, the physician reviews the set and can:
- Remove individual orders (e.g., patient had recent bloods)
- Change urgency or timing on specific orders
- Add orders not in the set
- Skip conditional orders (the condition is pre-evaluated from patient data where possible)

Order sets are versioned. Updating a set does not affect orders already placed from prior versions.

### 7.4 Views on Orders

**Patient context view**: all orders for the current patient, grouped by status (pending / in progress / resulted / cancelled / expired), filterable by type and date. Clicking an order shows status, ordering clinician, result when available, and the clinical question.

**Departmental work queue view**: all orders assigned to a given department or user, sorted by urgency and due time. This is the executing department's task list. The MTRA sees all imaging orders assigned to her modality; the BMA sees all lab orders for her section. Overdue orders are highlighted.

**User pending orders view**: all orders placed by the current physician that have not yet been resulted, across all their patients. Used for proactive follow-up — the physician can see at a glance which of their outstanding orders are overdue.

### 7.5 Order Status and Deadline Monitoring

Order status transitions are event-driven:
```
Placed → Acknowledged (by executing dept) → In progress → Resulted → Reviewed
                                          ↓
                                       Cancelled / Expired
```

The ordering clinician can track their orders without calling the executing department. When an order exceeds its requested timing:
1. Automated notification to the ordering clinician (configurable threshold, e.g., 2 hours past due for urgent)
2. If not acknowledged within a second configurable interval: escalation to department supervisor

All notifications are logged. The audit trail for an order includes every status transition, every notification sent, and every acknowledgement received.

---


## 8. Medication Management

### 8.1 Closed-Loop Medication

Full closed-loop medication process: prescribe → verify → prepare/dispense → administer → document. Barcode scanning at each step (patient wristband, drug package). Electronic MAR. Five-rights check (right patient, drug, dose, route, time). Full audit trail.

### 8.2 Chemotherapy and Immunotherapy

- From tumour board decision to administration and billing
- Product substitution (biosimilars, alternative agents)
- Compendium extracts, interaction checks, biosimilar substitution integrated as CDS
- Protocol templates (cycle definitions, dose calculations, premedication, supportive care)
- Magistral / in-house preparations visible in the ordering interface
- Multiple specialty-specific catalogues (ESMO, NCCN, local protocols) — configurable import
- Chemotherapy cycle bound to patient not administrative case; cycles persist across admissions

### 8.3 Oncological and Haematological Systemic Therapies

- Pharmacy preparation workflow: order from ward → pharmacist review → preparation label → dispensing
- Interface to pharmacy system and to infusion pump systems (rate confirmation)
- Protocol creation and update workflow (versioned, approval required before activation)
- Interaction check and contraindication check at order entry and at dispensing
- Same protocols usable in inpatient and outpatient settings

### 8.4 Admission and Discharge Medication Reconciliation

- Patient can review and propose corrections to their medication list in the patient app
- Medication entry before case creation (transport of neonates from other hospitals, shock room, unknown patient) — attached to pre-registration record
- Admission reconciliation: patient's home medications vs. hospital formulary — matching, substitution, and documentation of differences
- Discharge reconciliation: hospital formulary drugs switched to community equivalents; patient receives eMediplan
- eMediplan integration: automatic generation and import (PDF scan via OCR + structured FHIR MedicationStatement); bidirectional
- FHIR MedicationRequest / MedicationStatement for cross-system exchange

### 8.5 Prescribing Authority

- Role-based prescribing permissions configurable without code changes
- Examples: anaesthesia nurses can prescribe post-operative analgesia within defined parameters; can administer intraoperative drugs without prior physician order
- Delegation rules: a physician can delegate specific drug classes to a nurse within defined scope
- All non-standard authority use is logged and reviewable

### 8.6 Prescribing

- Context-aware drug suggestions: system proposes likely drugs based on diagnosis, care pathway, active problems
- Correct formulation/galenic form highlighted at order entry (e.g. crushed tablet warning, IV not IM)
- Ordering by brand name or generic (INN); house formulary preferred; procurement lead time shown for non-formulary items
- Alternative drugs suggested when prescribed drug is unavailable
- Dose validation: weight-based, renal-adjusted, hepatic-adjusted; checks against drug-drug interactions, allergies, lab values
- Off-label use possible with mandatory acknowledgement; neonatal/paediatric off-label supported
- Carrier solutions (diluents) auto-selected per drug and route; wrong diluent blocked; infusion calculations shown
- Multi-dimensional dosing: mg/kg, mg/kg/h, µg/kg/min, U/kg/h, mL/kg, mL/kg/day; units always displayed explicitly alongside value
- Cognitive unit-confusion prevention: visual separator between concentration and volume; confirmation step for high-alert drugs
- Prescriptions can trigger downstream tasks: consent required, cost authorisation needed, monitoring protocol activated
- Verbal/emergency orders: physician can dictate an urgent order; nurse documents it in real time; physician co-signs within configurable time window
- Dosing schedules: fixed intervals, irregular intervals, freely configurable times, sliding-scale protocols, immunosuppression schemas

### 8.7 Preparation and Dispensing (Richten)

- Overview of all open preparation tasks by ward and by priority
- All order details needed for preparation displayed: drug, dose, diluent, concentration, infusion rate, patient weight, allergies
- Drug image displayed alongside preparation details
- Label printing from order: colour per DIVI-norm drug class, Tall Man Lettering, patient identifiers, lot number, expiry, preparer
- Pharmacy and logistics systems notified on order creation; order status visible in real time (ordered / being prepared / ready / dispensed)
- Interface to unit-dose/ward-dose systems (bidirectional: send order, receive status and changes)
- Non-personalised unit-dose dispensing supported for shock room, neonatal, and labour ward scenarios
- Automated dispensing cabinet (ADC) integration: cabinets from major vendors (Omnicell, BD Pyxis, Swisslog) accessible; override events logged; restocking triggered by consumption data

### 8.8 Administration

- Double-check workflow for high-alert drugs (two nurses must scan and confirm)
- Off-label administration possible with acknowledgement and documentation
- Orphan doses (administration without prior prescription in defined emergency situations) supported with full documentation and retrospective physician sign-off
- Full traceability from administration back to order, preparation, and manufacturing lot
- Resuscitation documentation: drugs given with one tap (from a resuscitation drug panel); body-weight-based dosing without prior order; physician countersigns after event
- Fluid balance: automatically updated when drug infusions are started, modified, or stopped
- Controlled substance (Betäubungsmittel): full narcotic prescribing and dispensing workflow per Swiss BetmG; automatic narcotic statistics report generation; access to BM stock log
- Patient self-administration: patient can log own oral medication intake via patient app; nurse confirms or reconciles discrepancy

### 8.9 Paediatric and Neonatal Medication

- PEDeDose integration (pededose.ch): weight-based dose ranges and diluent recommendations retrieved at order entry for paediatric/neonatal drugs
- Paediatric medication module certified as medical device (MDR) where applicable
- Weight-based prescribing: all calculations shown step-by-step (weight entered → mg/kg → total dose → concentration → mL/h)
- Diluent volumes included in fluid balance calculations

### 8.10 Research and Study Medications

- Study drugs (non-approved) can be added to the system catalogue within a reasonable timeframe for active studies
- Dispensing controlled by policy automation: consent confirmed, patient enrolled, prescriber holds study delegation role
- Return of partially used blisters: documented via scan; waste documented; accountability ledger updated automatically
- Investigator's Brochure linked to study drug record (role-restricted access)
- Interaction data for study drugs can be entered manually pending formal database inclusion

---


## 9. Interprofessional Documentation and Problem List

### 9.1 Interprofessional Dossier

The inpatient dossier is a single shared document space — not separate physician notes, nursing notes, and therapy notes stored in disconnected silos. Every discipline writes into the same chronological stream, tagged by author role, discipline, and note type.

**Note types in the shared stream:**

| Note type | Description |
|---|---|
| Physician progress note | Daily attending note; structured: current state, plan, open issues |
| Consultant note | Specialist opinion; linked to the triggering consult order |
| Nursing narrative | Shift-level free-text observation; supplementary to structured nursing documentation |
| Therapy note | Physiotherapy, OT, speech therapy, social work — same structure |
| Handover note | System-generated Einlesebericht (§10) at shift change |
| Procedure note | Attached to the procedure order; covers consent, technique, complications |
| Discharge summary | Auto-populated draft from structured data (§18) |

All notes support structured headers (problem/goal/assessment/plan or SOAP), but free-text paragraphs are permitted where structure adds no value. Any note can be promoted to a clinical notice (§9.4) to give it persistent, header-level visibility.

### 9.2 Problem List

The problem list is a first-class entity — not a derived view. Every active clinical problem (diagnosis, symptom complex, procedure indication, chronic condition, functional limitation) is an explicit record with:

- ICD-10/SNOMED code (with free-text label for uncoded entries)
- Status: active / resolved / inactive / chronic
- Onset date and (if applicable) resolution date
- Responsible clinician
- Episode and encounter links
- Linked orders, notes, and results

Problems can be created from a diagnosis entry, promoted from a note, or imported from a referring document. The list is visible at all times in the patient header; it is the backbone of the discharge summary.

### 9.3 Nursing Documentation

Nursing documentation uses the **nursing process framework** (§10) as its structural scaffold. Within each shift, nursing staff document:

- Vital-sign entries (supplementary to automated PDMS feeds)
- Medication administration records (MAR) — each dose, route, time, nurse, any PRN rationale
- Wound and skin assessment updates (body-map annotations, §12 crossref)
- Activity and mobilisation log
- Patient/family education provided
- Fall, incident, or restraint documentation (structured, with mandatory fields)

MAR entries lock once documented; corrections require an amendment record with reason and approving witness.

### 9.4 Clinical Notices

A clinical notice is a short, free-text message that any clinician — regardless of discipline — can pin to a patient record when something important needs to be visible to everyone who opens that patient's chart. Unlike a note in the shared stream (§9.1), a notice does not scroll away; it remains pinned in the patient header until explicitly resolved.

**Relation to structured flags (§15.2):** Flags are typed, system-enforced, and carry defined clinical behaviour (alert triggers, handover inclusion, order blocks). Notices are free-text and author-initiated — they cover everything clinically significant that does not fit a predefined flag type: a family communication preference, a procedural consideration, an interpreter requirement, a patient-specific safety observation, or anything a professional judges too important to leave only in the note stream.

**Data model:**

| Field | Description |
|---|---|
| `notice_id` | Stable identifier |
| `patient_id` | Patient master reference |
| `episode_id` | Optional — notices may span or precede an episode |
| `author` | Authoring clinician |
| `author_role` | Discipline (physician, nurse, physiotherapist, social worker, pharmacist, …) |
| `authored_at` | Creation timestamp |
| `text` | Free text, ≤ 500 characters |
| `severity` | `info` / `warning` / `critical` — determines display colour and sort order |
| `expires_at` | Optional expiry; system prompts author to review on expiry rather than auto-deleting |
| `resolved_at` / `resolved_by` | Set when the author (or a supervisor) explicitly closes the notice |
| `source_note_id` | Optional back-link if the notice was promoted from a note in the stream |

**Promotion from the note stream:** Any note in the shared stream (§9.1) has a "Pin as notice" action. This copies the note's first paragraph (or a manual excerpt) into a new notice and stores `source_note_id` pointing back to the full note. The notice and the original note then coexist — the notice provides the persistent visibility; the full note provides the clinical context.

**Display:** Clinical notices appear as a pinned band immediately below the structured flags in the patient header, on every screen within the patient context. Multiple notices are shown stacked, sorted by severity (critical first) then by `authored_at` (newest first). Each notice shows the author name, role, discipline colour, and relative time. A collapsed summary ("3 notices") is used on space-constrained screens, expanding on tap/click.

**Acknowledgement vs resolution:**

- Any staff member can **acknowledge** a notice (logged: who, when). Acknowledgement signals "I have read this" but does not remove the notice.
- Only the author or a supervisor can **resolve** a notice. Resolved notices move to a history view accessible from the patient header; they are never deleted.
- The Einlesebericht (§10.2) includes all unresolved notices in its auto-populated content, ensuring handover continuity.

**Scope:** Clinical notices apply in both inpatient and ambulatory contexts. An ambulatory notice created during a consultation persists when the patient is subsequently admitted, and vice versa — notices follow the patient, not the episode, unless explicitly scoped to an episode by the author.

---


## 10. Nursing Process

### 10.1 Lifecycle: Assessment → Diagnosis → Planning → Intervention → Evaluation

The nursing process is the iterative cycle through which nursing care is planned, delivered, and evaluated. It is not a document template — it is a live workflow state machine per patient:

```
Assessment
  ↓
Nursing Diagnosis (NANDA-I or equivalent; mapped to SNOMED)
  ↓
Care Goal (measurable, dated target)
  ↓
Care Planning (nursing orders, delegation to care assistants)
  ↓
Intervention (execution logged against the care plan)
  ↓
Evaluation (goal met / partially met / not met → reassessment trigger)
  ↓ (loop)
```

Nursing diagnoses are distinct from medical diagnoses. The system supports NANDA-I taxonomy codes with free-text supplementation. Each diagnosis drives a set of suggested nursing orders (intervention catalogue), which are accepted, modified, or declined.

### 10.2 Shift Handover — Einlesebericht

The Einlesebericht (read-in report) is a system-generated shift handover document that an incoming nurse reads before accepting responsibility for a patient. It is not a free-text dictation — it is assembled automatically from structured data:

**Auto-populated sections:**

| Section | Source |
|---|---|
| Patient demographics & critical flags | Patient header |
| Active problems | Problem list |
| Active care goals | Nursing care plan |
| Vital sign trend (last 8 h) | PDMS / vital-sign store |
| Outstanding nursing tasks | Care plan + task list |
| Medications due in next 4 h | MAR + medication schedule |
| Recent lab results (abnormal) | Lab result store, filtered to flags |
| Recent physician orders (last 8 h) | Order store |
| Active alerts (early warning, allergy) | Alert store |
| Open issues / handover notes | Free-text addendum by outgoing nurse |

The outgoing nurse adds a free-text addendum and formally closes their shift responsibility. The incoming nurse opens the Einlesebericht, reads it, and confirms acceptance. Acceptance timestamp is stored as the official handover record.

**ISBAR structure:** The Einlesebericht maps to the ISBAR (Identity / Situation / Background / Assessment / Recommendation) handover framework:

| ISBAR component | Einlesebericht section(s) |
|---|---|
| **Identity** | Patient demographics, DOB, room, attending physician, episode ID |
| **Situation** | Active problems, current flags and clinical notices, vital-sign trend (last 8 h), active early-warning alerts |
| **Background** | Admission diagnosis, key events of current stay (last 24 h), active medications |
| **Assessment** | Current scores (SOFA, NEWS2, RASS, pain), outstanding nursing diagnoses and care goals, abnormal lab results |
| **Recommendation** | Outstanding nursing tasks and due times, pending orders awaiting action, open KGS requests, outgoing nurse's free-text addendum |

**Checklist component:** The Einlesebericht includes a confirmation checklist for the incoming nurse:

- Critical flags reviewed
- Active clinical notices (§9.4) acknowledged
- Medication schedule reviewed
- Transfer-readiness status noted (§18.6, if applicable)
- Outstanding tasks accepted

Items cannot be bypassed. Handover is not complete until all checklist items are confirmed.

**Inter-ward handover:** The same mechanism supports ICU → ward and ward → ICU handovers. For inter-ward transfers, the background section is extended with a summary of the prior ward's course, and the receiving physician is added as a co-recipient.

### 10.3 Care Assistant Delegation

Care assistants (Pflegehilfspersonen) have a restricted view: they see only delegated tasks, not the full care plan or medical record. The delegation record includes the task, the delegating nurse, the time window, and any safety constraints. Completion is confirmed by the care assistant; the delegating nurse retains clinical responsibility.

### 10.4 Nursing Workload and Staffing Support

Every nursing intervention in the care catalogue carries a **time estimate** — the expected duration for a trained nurse to perform it. This enables prospective workload calculation.

**Per-patient workload:** The system computes expected nursing time for the next N hours per patient from the active care plan, medication schedule, monitoring frequency, and special requirements (isolation, ventilation).

**Ward workload forecast:** The charge nurse sees an aggregated workload panel for the upcoming shift:

```
Forecast nursing workload — Station 3B — 14:00–22:00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Patient     Acuity   Est. h   Special
Room 3B-1   HIGH      2.8     Ventilated (dipl. required)
Room 3B-2   MEDIUM    1.4
Room 3B-3   HIGH      2.6     Isolation (+20%)
Room 3B-4   LOW       0.8
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 24.3 h    Available: 3 staff × 8 h = 24.0 h  ⚠ borderline
```

**Staffing ratio rules** (configurable):
- Ventilated ICU patient: minimum 1 : 1 diploma nurse
- ICU standard: maximum 2 patients per diploma nurse
- Isolation patient: time estimate uplifted by 20 %

When planned workload exceeds available staff, an alert is generated to the charge nurse and ward manager. Historical workload data supports roster planning and capacity modelling.

---


## 11. Clinical Scores and Assessments

### 11.1 Scores Catalogue

Clinical scores are first-class system entities — not embedded in free-text notes. Each score has a versioned definition (items, weights, thresholds, alert levels) and is evaluated against structured input data. Scores are triggered:

- Automatically on a schedule (e.g., NEWS2 every 4 h on monitoring wards)
- Automatically on a data event (e.g., lab result triggers SOFA recalculation)
- Manually by any clinician or nurse

**Standard scores at admission and during stay:**

| Score | Domain | Alert threshold |
|---|---|---|
| NRS 2002 | Nutritional risk | ≥ 3 → dietitian referral order |
| Braden Scale | Pressure injury risk | ≤ 12 → prevention protocol order |
| Morse Fall Scale | Falls risk | ≥ 45 → falls-prevention flag + order set |
| NEWS2 | Clinical deterioration | ≥ 5 → rapid-response alert; ≥ 7 → critical alert |
| GCS | Consciousness level | Change ≥ 2 → physician alert |
| SOFA / qSOFA | Sepsis severity | qSOFA ≥ 2 → sepsis workup order set |
| Pain (NRS 0–10) | Pain level | ≥ 7 → PRN analgesia review trigger |
| AUDIT-C | Alcohol risk | ≥ 4 → brief intervention referral |
| PHQ-2 / PHQ-9 | Depression screen | PHQ-2 positive → PHQ-9; PHQ-9 ≥ 10 → psychiatric liaison referral |
| CAM | Delirium | CAM positive → delirium care bundle activation |

### 11.2 Score Alert Functions

Each score definition includes a set of **alert functions** — rules that fire when a score crosses a threshold:

- Generate a clinical alert (visible in patient header and nursing board)
- Create a task for a specific role (e.g., "Dietitian assessment requested")
- Activate an order set (e.g., falls-prevention bundle)
- Activate an SOP reference (e.g., "Delirium care bundle — SOP-078")
- Notify via push notification to the responsible clinician's mobile device

Alert functions are configurable per institution without code change — they are rule-set entries (§56.1). New scores can be added by clinical informatics staff using the score definition editor; no developer involvement is required for new scoring instruments.

### 11.3 Assessment Forms Beyond Scores

Beyond numeric scoring tools, the system supports structured assessment forms for domains that require narrative alongside structured data: wound assessment, pain quality (character, radiation, aggravating factors), functional assessment (Barthel Index), and cognitive assessment (MMSE/MoCA). These forms are rendered from a form-definition schema (same mechanism as the admission interview — §16.1) and stored as structured compositions.

### 11.4 ICU Score Visualisation

ICU scores are high-stakes values assessed under cognitive load. Display standards:

- **Current value**: large numeral with colour band — green (low risk) / amber (warning) / red (critical) — sized for visibility at 1–2 m
- **Trend sparkline**: compact 24-hour sparkline with a direction arrow (↑↓→) for the last 4 h
- **Threshold markers**: critical thresholds drawn on the sparkline and any trend chart
- **Component breakdown**: expanding a score shows its contributing items and values (e.g., SOFA by organ system)
- **Staleness indicator**: scores not updated within their scheduled interval are shown with a warning

**Score timeline view:** Each score can be expanded to a full-width chart over the ICU stay, with clinical event annotations (intubation, surgery, antibiotic start, culture results) as vertical markers — providing immediate visual correlation between events and score trajectory.

### 11.5 SOFA Score — Automated Computation Example

SOFA demonstrates how a complex ICU score is derived from data already in the system with no additional manual entry.

**Components and data sources:**

| SOFA component | Points 0→4 | Data source |
|---|---|---|
| Respiratory (P/F ratio) | PaO₂/FiO₂ > 400 → < 100 | Blood gas (PaO₂) from lab + FiO₂ from ventilator device stream |
| Coagulation (platelets) | > 150 → < 20 × 10⁹/L | Lab composition |
| Hepatic (bilirubin) | < 1.2 → > 12 mg/dL | Lab composition |
| Cardiovascular (MAP / vasopressors) | MAP ≥ 70 → dopamine > 15 or adrenaline > 0.1 µg/kg/min | MAP from monitor stream + vasopressor infusion from medication record |
| Neurological (GCS) | 15 → < 6 | GCS composition |
| Renal (creatinine / urine output) | Cr < 1.2 → > 3.5 mg/dL or UO < 0.5 ml/kg/h | Lab composition + urine output from fluid balance projection |

**Computation trigger:** SOFA is recalculated whenever any input is updated. It runs as a background task, writes a new `severity_score.v1` composition, and updates the SOFA projection table. If a component input is unavailable, the last known value is used with a staleness flag; missing values entirely are scored 0 with an explicit "data unavailable" marker.

### 11.6 Score Definition Editor

New scores and revisions are added by clinical informatics staff without developer involvement. The editor produces a versioned score definition stored as a configuration object.

**Definition components:**
- **Items**: data source binding (composition field or time series parameter), scoring table (value range → points)
- **Aggregation rule**: sum / maximum / custom expression
- **Threshold levels**: named risk levels with colours and alert function bindings (§11.2)
- **Calculation schedule**: event-driven (on data update) and/or time-scheduled (e.g., every 4 h)
- **Staleness policy**: maximum input age before the score is flagged as stale

Score definitions follow the same governance cycle as rule-sets (§56.1): draft → clinical informatics review → attending approval → active. Historical score values are always recalculable from the version active at the time.

---



### 11.7 Scores as Derived Compositions

A clinical score (NEWS2, SOFA, APACHE II, GCS, Wells, CHA₂DS₂-VASc, etc.) is a computed value derived from composition data. It is treated as a first-class composition — stored in the composition store with archetype `score_result.v1`, indexed in the time series table, queryable in the projection store, and available as a pathway condition input (§13.5).

Scores are not computed on read. They are computed by the score engine in response to `composition.created` events and stored. Reading a score is always a fast projection lookup.

### 11.8 Score Definition as Configuration

A score is defined entirely as data — no code required. The definition specifies:
- Which archetype fields feed the score
- The formula or lookup table mapping input values to component scores
- The aggregation function (sum, max, weighted sum)
- The output thresholds and their clinical meaning

```json
{
  "score_id": "news2.v1",
  "name": "NEWS2",
  "description": "National Early Warning Score 2",
  "components": [
    {
      "id": "resp_rate",
      "label": "Respiratory rate",
      "archetype": "vital_signs.v3",
      "path": "/respiratory_rate/magnitude",
      "lookup": [
        { "range": [0, 8],   "points": 3 },
        { "range": [9, 11],  "points": 1 },
        { "range": [12, 20], "points": 0 },
        { "range": [21, 24], "points": 2 },
        { "range": [25, null],"points": 3 }
      ]
    },
    {
      "id": "spo2",
      "label": "SpO₂ (Scale 1)",
      "archetype": "vital_signs.v3",
      "path": "/spo2/magnitude",
      "lookup": [
        { "range": [0, 91],   "points": 3 },
        { "range": [92, 93],  "points": 2 },
        { "range": [94, 95],  "points": 1 },
        { "range": [96, 100], "points": 0 }
      ]
    },
    {
      "id": "consciousness",
      "label": "Consciousness",
      "archetype": "vital_signs.v3",
      "path": "/avpu",
      "lookup": [
        { "value": "A", "points": 0 },
        { "value": "C", "points": 3 },
        { "value": "V", "points": 3 },
        { "value": "P", "points": 3 },
        { "value": "U", "points": 3 }
      ]
    }
  ],
  "aggregation": "sum",
  "thresholds": [
    { "range": [0, 4],   "level": "low",    "label": "Low risk",    "action": "routine" },
    { "range": [5, 6],   "level": "medium", "label": "Medium risk", "action": "urgent_review" },
    { "range": [7, null],"level": "high",   "label": "High risk",   "action": "emergency" }
  ],
  "triggers_on": ["vital_signs.v3"]
}
```

Adding a new score: add a JSON definition to the score registry. No code change. The score engine evaluates it using the same expression evaluator as pathway conditions.

### 11.9 Score Engine

```python
@on_event("composition.created")
async def evaluate_scores(event: dict) -> None:
    # Find all score definitions that trigger on this archetype
    score_defs = score_registry.triggered_by(event["archetype_id"])
    for score_def in score_defs:
        result = await compute_score(score_def, event["patient_id"], event["episode_id"])
        if result is not None:
            await store_score_result(score_def.score_id, event["patient_id"], result)
            await update_score_projection(score_def.score_id, event["patient_id"], result)
            await check_score_thresholds(score_def, result, event["patient_id"])

async def compute_score(score_def: ScoreDef, patient_id: UUID, episode_id: UUID) -> ScoreResult | None:
    components = {}
    for comp in score_def.components:
        value = await get_projection_value(patient_id, comp.archetype, comp.path)
        if value is None and comp.required:
            return None   # insufficient data — score not computable
        components[comp.id] = apply_lookup(comp.lookup, value)
    total = aggregate(score_def.aggregation, components.values())
    threshold = classify(score_def.thresholds, total)
    return ScoreResult(total=total, components=components, threshold=threshold)
```

### 11.10 Threshold Alerts

When a score crosses a threshold, the engine fires an alert via the notification system (§51.7):
- NEWS2 ≥ 7 → Critical alert to responsible nurse + on-call physician
- NEWS2 5–6 → Urgent alert to responsible nurse
- SOFA increase ≥ 2 → Urgent alert in ICU context

Threshold alert definitions are part of the score definition JSON — same configuration pattern.

### 11.11 Score Visualisation

Scores are time series values (stored in the time series infrastructure, §47). They render on the same chart infrastructure as vitals — a NEWS2 trend over 24 hours sits alongside heart rate and respiratory rate, sharing the same time axis. This makes the relationship between raw observations and the computed score immediately visible.

For the progress strip (ward board, mobile), the current score for each patient is shown as a coloured badge — green/amber/red — beside the patient name. This is derived from the score projection table: a single indexed lookup per patient.

---


## 12. Anatomical Body Views

### 12.1 The Body View as a Spatial Query Interface

An anatomical body view holds no clinical data. It is a **spatial index** — a rendered map that serves as a query interface into the composition store. When a clinician taps the right knee, the system queries for all compositions referencing that anatomical location. The view colours regions where data exists; clicking a region opens the relevant records.

All body site references in compositions use **SNOMED CT body structure concepts**. SNOMED's body structure hierarchy supports subsumption: a query for "knee structure" returns compositions coded to "right knee", "left knee", "medial meniscus of right knee", etc. The same subsumption engine used for coded clinical values (§46) applies here.

### 12.2 Multiple View Assets

Different clinical specialties require different anatomical maps. Each is an SVG asset with regions mapped to SNOMED CT codes:

| View | Specialties | Regions |
|---|---|---|
| Full body anterior / posterior | General, orthopaedics, dermatology | ~80 major surface regions |
| Lateral (left/right) | Orthopaedics, neurology | Spine, limb lateral surfaces |
| Hand — dorsal / palmar | Orthopaedics, rheumatology, hand surgery | Individual bones, joints, tendons |
| Foot — dorsal / plantar | Orthopaedics, podiatry, diabetic foot | Metatarsals, toes, heel |
| Dental odontogram | Dentistry | Individual teeth, surfaces (mesial, distal, buccal, lingual, occlusal) |
| Skin surface map | Dermatology, wound care | Body surface zones for lesion mapping |
| Eye — anterior / posterior segment | Ophthalmology | Cornea, lens, retinal zones |
| Dermatome map | Neurology, pain | Dermatomal zones (C2–S5) |

### 12.3 Generic Component Architecture

A single generic component handles all views:

```typescript
type BodyRegion = {
  regionId: string;          // SVG element id
  snomedCode: string;        // SNOMED CT body structure concept
  label: string;
};

type BodyViewProps = {
  svgAsset: string;          // path to SVG map
  regions: BodyRegion[];     // region → SNOMED mapping
  patientId: string;
  onRegionSelect: (snomedCode: string, label: string) => void;
};

function BodyView({ svgAsset, regions, patientId, onRegionSelect }: BodyViewProps) {
  const { data: activeRegions } = useQuery(
    ["body_regions", patientId],
    () => fetchActiveBodyRegions(patientId)  // returns set of SNOMED codes with data
  );

  // Colours SVG regions where data exists; handles hover and click
  return (
    <InteractiveSvg
      src={svgAsset}
      regions={regions}
      activeRegions={activeRegions}
      onRegionClick={(region) => onRegionSelect(region.snomedCode, region.label)}
    />
  );
}
```

Adding a new view: provide an SVG file and a region mapping JSON. No new component code.

### 12.4 Region Annotation Layer

Beyond querying existing compositions, clinicians can annotate directly on the body view — placing a marker, drawing a wound outline, or noting pain radiation. These annotations are stored as compositions with:
- The anatomical site (SNOMED CT code)
- The annotation type (marker, outline, area)
- Geometric data (coordinates relative to the SVG viewport, normalised 0–1)
- Clinical content (archetype-defined: wound measurement, pain score, lesion description)

Stored geometry is SVG-asset-agnostic — normalised coordinates are mapped to whichever SVG is rendered, including different-sized displays. Wound outlines captured on a tablet render correctly on a phone.

---


## 13. Clinical Pathways

### 13.1 What a Clinical Pathway Is

A clinical pathway is a structured, evidence-based plan that specifies the sequence of clinical interventions, their timing, responsible roles, and expected outcomes for a specific diagnosis or procedure. It is the bridge between clinical guidelines and the actual care delivered to a specific patient.

Examples:
- **Hip replacement pathway**: pre-op assessment → day of surgery → PACU → ward day 1–3 with physio targets → discharge criteria → community follow-up
- **Sepsis bundle**: screening → blood cultures within 1 hour → antibiotics within 1 hour → fluid resuscitation → reassessment → ICU escalation criteria
- **Stroke pathway**: CT within 30 minutes → thrombolysis decision → stroke unit → daily rehabilitation milestones → discharge planning
- **Diabetic foot**: wound assessment → microbiological swab → imaging → vascular surgery consult → wound care protocol selection

Clinical pathways are distinct from SOPs (§14): a pathway tracks an individual patient through a care episode; an SOP defines how a specific procedure is performed by any staff member in any context.

### 13.2 The Three Layers of a Pathway

```
PathwayDefinition    — the template (authored by clinicians, versioned)
      │
PathwayInstance      — one per patient per episode (active tracking)
      │
StepInstance         — one per step per patient (actual vs expected)
```

### 13.3 Data Model

```sql
CREATE TABLE pathway_definitions (
  id          UUID PRIMARY KEY,
  code        TEXT NOT NULL,        -- 'hip_replacement_v3'
  title       TEXT NOT NULL,
  version     INT NOT NULL,
  status      TEXT NOT NULL,        -- 'draft','active','retired'
  department  TEXT,
  review_date DATE
);

CREATE TABLE pathway_steps (
  id                  UUID PRIMARY KEY,
  definition_id       UUID NOT NULL REFERENCES pathway_definitions,
  sequence            INT NOT NULL,
  name                TEXT NOT NULL,
  role                TEXT,         -- 'physician','nurse','physio',…
  expected_offset_h   INT,          -- hours after pathway start (or after prior step)
  offset_anchor       TEXT,         -- 'pathway_start' | 'previous_step'
  required_archetypes TEXT[],       -- archetypes that must be recorded to complete step
  order_set_id        UUID,         -- order set to fire on step activation (nullable)
  sop_id              UUID          -- linked SOP for this step (nullable)
);

CREATE TABLE pathway_instances (
  id              UUID PRIMARY KEY,
  definition_id   UUID NOT NULL REFERENCES pathway_definitions,
  patient_id      UUID NOT NULL,
  episode_id      UUID NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  current_step_id UUID REFERENCES pathway_steps,
  status          TEXT NOT NULL     -- 'active','completed','abandoned','variance'
);

CREATE TABLE pathway_step_instances (
  id              UUID PRIMARY KEY,
  instance_id     UUID NOT NULL REFERENCES pathway_instances,
  step_id         UUID NOT NULL REFERENCES pathway_steps,
  status          TEXT NOT NULL,    -- 'pending','active','completed','skipped','variance'
  activated_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,      -- computed: started_at + expected_offset
  variance_reason TEXT,
  composition_ids UUID[]            -- compositions recorded at this step
);
```

### 13.4 Pathway Execution Engine

The engine is event-driven and sits within the clinical domain. It watches the composition event stream — it does not watch the UI. A pathway advances whenever the right clinical data is recorded, regardless of whether the clinician was in a pathway context at the time.

A nurse doing a routine morning vitals round records `vital_signs.v3` from the standard ward board view. The engine sees the event, finds an active pathway step for that patient waiting for `vital_signs.v3`, checks the constraints, and advances the pathway. The nurse's workflow is unchanged. The pathway reflects reality.

```python
@on_event("composition.created")
async def evaluate_pathway_step(event: dict) -> None:
    # Find active pathway step instances waiting for this archetype —
    # regardless of which UI context the composition was created in.
    instances = await find_waiting_steps(
        patient_id=event["patient_id"],
        archetype_id=event["archetype_id"]
    )
    for step_instance in instances:
        # Temporal constraint: composition must postdate step activation
        if event["recorded_at"] < step_instance.activated_at:
            continue
        # Episode constraint (if step requires it)
        if step_instance.requires_same_episode:
            if event["episode_id"] != step_instance.episode_id:
                continue
        await record_step_composition(step_instance.id, event["composition_id"])
        if await step_criteria_met(step_instance):
            await complete_step(step_instance)
            await activate_next_step(step_instance.instance_id)

async def activate_next_step(instance_id: UUID) -> None:
    next_step = await get_next_step(instance_id)
    if not next_step:
        await complete_pathway(instance_id)
        return
    due_at = utcnow() + timedelta(hours=next_step.expected_offset_h)
    await create_step_instance(instance_id, next_step.id, due_at)
    if next_step.order_set_id:
        await fire_order_set(next_step.order_set_id, instance_id)
    await schedule_overdue_alert(instance_id, next_step.id, due_at)
```

**One composition can advance multiple pathways simultaneously.** A patient on both a hip replacement pathway and a diabetes management pathway: a blood glucose composition advances the relevant diabetes step; it is invisible to the hip replacement pathway. Each step specifies exactly which archetypes it waits for.

**Archetype specificity is the precision mechanism.** Steps that require deliberate clinical action must reference archetypes that are only recorded as deliberate acts:

| Step intent | Wrong archetype | Right archetype |
|---|---|---|
| Formal physician review milestone | `vital_signs.v3` (recorded routinely) | `physician_pathway_review.v1` (recorded only in that context) |
| Wound closure confirmation | `wound_assessment.v2` (any assessment) | `wound_closure_sign_off.v1` (deliberate act) |
| Physiotherapy mobilisation milestone | `observations.v1` | `physio_mobilisation_milestone.v1` |

Routine work advances steps that routine work should advance. Deliberate milestones require archetypes that are only recorded deliberately. The archetype library must be designed with this distinction in mind.

**UI consequence:** if the clinician is viewing the pathway when data is recorded, the step checks off immediately and the next step activates with visual feedback. If they are not viewing the pathway, the advance happens silently. The pathway view always reflects the current state whenever it is opened.

**Order sets** fire automatically when a step activates — the physician sees a pre-populated order set for approval, not a blank order screen. This is how guidelines translate into bedside action without requiring the clinician to remember every component.

**Overdue alerts** fire when a step's due time passes without completion. The alert goes to the responsible role (nurse, physician, or physio) and surfaces in the relevant app inbox.

### 13.5 Conditional Branching

Clinical pathways are directed graphs, not linear lists. A stroke pathway branches immediately at the CT result — ischaemic and haemorrhagic strokes require entirely different care. A sepsis pathway branches on culture results. A hip replacement pathway branches on post-operative complications.

#### Step Types

```sql
CREATE TYPE pathway_step_type AS ENUM (
  'task',       -- standard: activate, record required data, complete
  'decision',   -- evaluate transitions; activate exactly one branch (exclusive OR)
  'parallel',   -- activate all outgoing branches simultaneously
  'merge',      -- wait for all incoming branches before continuing
  'loop_start', -- marks start of a repeating segment
  'loop_end',   -- evaluates exit condition; repeats or exits
  'milestone'   -- informational marker; auto-completes on activation
);
```

#### Transitions and Conditions

Each step has outgoing transitions. A transition has an optional condition; if no condition or condition matches, the transition fires.

```sql
CREATE TABLE pathway_transitions (
  id            UUID PRIMARY KEY,
  definition_id UUID NOT NULL REFERENCES pathway_definitions,
  from_step_id  UUID NOT NULL REFERENCES pathway_steps,
  to_step_id    UUID NOT NULL REFERENCES pathway_steps,
  condition     JSONB,           -- NULL = unconditional
  is_default    BOOLEAN DEFAULT false,  -- taken if no other condition matches
  sequence      INT NOT NULL     -- evaluation order
);
```

Conditions are structured expressions — authorable by clinical informaticians, not programmers. They are evaluated against the projection store (fast typed reads, not raw composition JSONB).

```json
{
  "type": "and",
  "conditions": [
    {
      "type": "composition_value",
      "archetype": "troponin.v1",
      "path": "/value/magnitude",
      "operator": ">",
      "value": 99
    },
    {
      "type": "composition_value",
      "archetype": "ecg.v1",
      "path": "/interpretation",
      "operator": "in",
      "value": ["STEMI", "LBBB"]
    }
  ]
}
```

Supported operators: `equals`, `not_equals`, `>`, `>=`, `<`, `<=`, `in`, `not_in`, `exists`, `not_exists`. Compound: `and`, `or`, `not`. This covers all clinically meaningful conditions without requiring code.

#### Execution Engine — Branching Logic

```python
async def activate_next_steps(instance_id: UUID, completed_step_id: UUID) -> None:
    step = await get_step(completed_step_id)
    transitions = await get_transitions(step.definition_id, completed_step_id)

    if step.step_type == "parallel":
        # Activate all outgoing branches simultaneously
        for t in transitions:
            await activate_step(instance_id, t.to_step_id)

    elif step.step_type == "decision":
        # Evaluate conditions in sequence order; activate first match
        for t in sorted(transitions, key=lambda t: t.sequence):
            if t.condition is None:
                continue
            if await evaluate_condition(t.condition, instance_id):
                await activate_step(instance_id, t.to_step_id)
                return
        # Fall through to default branch
        default = next((t for t in transitions if t.is_default), None)
        if default:
            await activate_step(instance_id, default.to_step_id)
        else:
            await mark_decision_pending(instance_id, completed_step_id)

    elif step.step_type == "merge":
        # Only advance if all incoming branches are complete
        if await all_incoming_complete(instance_id, completed_step_id):
            for t in transitions:
                await activate_step(instance_id, t.to_step_id)

    elif step.step_type == "loop_end":
        condition = step.exit_condition
        if await evaluate_condition(condition, instance_id):
            for t in transitions:
                await activate_step(instance_id, t.to_step_id)  # exit loop
        else:
            await reset_loop(instance_id, step.loop_start_id)   # repeat

    else:
        # Sequential task: activate single next step
        for t in transitions:
            await activate_step(instance_id, t.to_step_id)
        if not transitions:
            await complete_pathway(instance_id)
```

#### Decision Pending

When a decision step's conditions cannot be evaluated (the required data has not yet been captured), the pathway pauses and surfaces a **"decision pending"** task to the responsible clinician. The task shows: what decision is needed, what data is missing, and the available branches to choose from.

Manual branch selection is always available — the clinician selects a branch with a documented reason. This is recorded as a variance. The pathway then continues on the manually selected branch.

#### Condition Evaluation

```python
async def evaluate_condition(condition: dict, instance_id: UUID) -> bool:
    match condition["type"]:
        case "composition_value":
            value = await get_projection_value(
                patient_id=...,
                archetype=condition["archetype"],
                path=condition["path"]
            )
            if value is None:
                return False  # data absent → condition not met
            return compare(value, condition["operator"], condition["value"])
        case "and":
            return all(
                await evaluate_condition(c, instance_id)
                for c in condition["conditions"]
            )
        case "or":
            return any(
                await evaluate_condition(c, instance_id)
                for c in condition["conditions"]
            )
        case "not":
            return not await evaluate_condition(condition["condition"], instance_id)
        case "score_value":
            # Computed scores (§12) are also queryable as condition inputs
            score = await get_latest_score(instance_id, condition["score_id"])
            return compare(score, condition["operator"], condition["value"])
```

Note: computed clinical scores (NEWS2, SOFA, etc.) are first-class inputs to pathway conditions — see §12.

---

### 13.6 Visual Presentation of Pathways

The same underlying pathway data serves two fundamentally different visual representations. Both are derived views — the data model does not change.

#### Full Graph View (authoring and clinical overview)

Presents the complete pathway structure: all steps, all branches, all possible routes. Used by:
- Clinical informaticians designing and reviewing pathways
- Clinicians who want to understand the full care plan for a patient before enrolment
- Quality review of pathway design

**Technology: React Flow + Dagre layout**

React Flow renders a node/edge graph with zoom, pan, and custom node components. Dagre automatically computes a left-to-right DAG layout from the step/transition data — no manual positioning required.

Custom node components per step type:

| Step type | Visual |
|---|---|
| `task` | Rounded rectangle; colour by status (grey/blue/green/amber/red) |
| `decision` | Diamond; outgoing edges labelled with condition summary |
| `parallel` | Horizontal bar (split); all outgoing edges activate |
| `merge` | Horizontal bar (join); waits for all incoming |
| `loop_end` | Circular arrow indicator on the step |
| `milestone` | Hexagon |

For a patient instance, nodes are coloured by `step_instance.status`: completed (green), active (blue), overdue (red), skipped (grey, dashed border), variance (amber). Unchosen branches are rendered faded but visible — the full graph always shows the complete structure.

#### Progress Strip (bedside and mobile)

A compact linear view showing only the path the patient is actually on. Used at the bedside, in the nurse and physician apps, and in the patient summary panel.

```
[✓] Admission assessment    09:15
[✓] CT scan                 09:47  (+17 min)
[◆] Ischaemic → thrombolysis branch selected
[✓] Thrombolysis decision   10:03
[●] Neurology review        due 11:00   ← active
[ ] 24h imaging             due 09:47 tomorrow
[ ] Stroke unit day 2       ...
```

Algorithm to compute the progress strip:
1. Start from pathway start step
2. Walk forward following only steps that have a `step_instance` for this patient
3. At decision nodes: show the condition result and the branch taken; hide unchosen branches
4. At parallel nodes: show branches inline, collapsed once all complete
5. Show the next N pending steps on the active branch (configurable, default 3)
6. Each step shows: name, expected time, actual time (if complete), delta

Overdue indicator: if `utcnow() > step_instance.due_at` and status is not completed, the step is highlighted in amber (approaching) or red (overdue by > 50% of the time window).

#### Timeline Axis

Both views support a timeline axis: absolute clock time on the horizontal axis, steps positioned at their expected or actual time. This reveals at a glance whether the patient is on schedule, ahead (unusual — may indicate a skipped step), or behind.

The timeline axis is especially useful for time-critical pathways (sepsis: antibiotics within 1 hour; stroke: thrombolysis within 4.5 hours). The visual makes deadline pressure immediately apparent without reading numbers.

#### Pathway Authoring Tool

The full graph view doubles as the authoring tool when in edit mode:
- Drag to create steps and connect them with transitions
- Click a transition to configure its condition using a structured condition builder (no code entry — dropdowns for archetype, path, operator, value)
- Step properties panel: name, type, expected offset, required archetypes, order set, SOP link
- Preview: renders the pathway as it will appear to a patient instance

Authored pathways are serialised to `PathwayDefinition` JSON and loaded into the registry. Version increments are explicit; the previous version remains active for existing patient instances.

---

### 13.7 Variance Management

Variance — deviation from the expected pathway — is clinically important. It is where complications occur and where quality improvement insight lives.

Variance must be documented with minimal friction. The design is:
- When a step is marked skipped or overdue, the app presents a short reason picker (coded reasons, e.g. "patient declined", "clinical contraindication", "patient transferred", "resource unavailable") plus optional free text
- Variance reason is stored on the `step_instance`
- Aggregate variance data feeds a quality dashboard — which steps are most frequently varied, which reasons predominate, which patient subgroups deviate

Variance documentation must take no more than two taps. If it requires more effort than not documenting, it will not be documented.

### 13.8 Pathway and the "Data Model First" Principle

A pathway step that requires data capture references an archetype — not a bespoke form. When a nurse navigates to a patient's active pathway, the current step links directly to the standard form engine (§45.3). The pathway provides the context ("you are on step 3 of the hip replacement pathway"); the archetype provides the structure ("record pain score, mobility assessment, and wound inspection").

No bespoke per-pathway UI is written. The pathway is a sequence of archetype references, timing rules, and role assignments.

### 13.9 Pathway Authoring

Pathways are authored in a structured editor — not as Word documents. The authoring tool produces a `PathwayDefinition` JSON that is loaded into the registry. Version transitions are explicit: when v4 of a pathway is activated, existing patient instances on v3 continue on v3; new patients start on v4. The version in use at any point is always recoverable from the `pathway_instances` table.

---


## 14. Standard Operating Procedures (SOPs)

### 14.1 SOPs vs Clinical Pathways

| | Clinical Pathway | SOP |
|---|---|---|
| **Scope** | One patient, one care episode | Any staff member, any context |
| **Duration** | Days to weeks | Minutes to hours |
| **Patient-specific** | Yes — tracked per patient | No — defines the standard for a procedure |
| **Example** | Hip replacement care plan | How to insert a urinary catheter |

SOPs define *how* a procedure is performed. Pathways define *what* care a patient should receive and in what order. A pathway step may reference an SOP ("perform central line insertion per SOP-CV-001"), and the SOP drives what gets documented.

### 14.2 SOPs as Structured Data

The critical architectural decision is to treat SOPs as structured data, not documents.

Most organisations currently store SOPs as Word or PDF files in a document management system. This is architecturally weak for an EHR:
- A PDF cannot be linked to a specific EHR task or order
- A PDF checklist cannot generate timestamped EHR entries
- The version active at the time of a procedure cannot be automatically recorded

The system supports both: **native structured SOPs** and **linked document SOPs** (PDF/Word) as a migration path. Over time, procedures are migrated to structured format.

A structured SOP:

```sql
CREATE TABLE sops (
  id          UUID PRIMARY KEY,
  code        TEXT NOT NULL,        -- 'SOP-CV-001'
  title       TEXT NOT NULL,        -- 'Central Venous Catheter Insertion'
  version     INT NOT NULL,
  status      TEXT NOT NULL,        -- 'draft','active','retired'
  department  TEXT,
  review_date DATE,
  document_url TEXT                 -- legacy PDF link (nullable)
);

CREATE TABLE sop_steps (
  id              UUID PRIMARY KEY,
  sop_id          UUID NOT NULL REFERENCES sops,
  sequence        INT NOT NULL,
  instruction     TEXT NOT NULL,
  safety_note     TEXT,
  is_checklist    BOOLEAN DEFAULT false,  -- generates a documentable EHR entry
  archetype_ref   TEXT                    -- archetype to capture if is_checklist
);

CREATE TABLE sop_links (
  sop_id           UUID NOT NULL REFERENCES sops,
  linked_type      TEXT NOT NULL,  -- 'pathway_step','order','task_type'
  linked_id        UUID NOT NULL,
  PRIMARY KEY (sop_id, linked_type, linked_id)
);
```

### 14.3 SOP Execution and Documentation

When a clinician performs a procedure governed by a structured SOP:

1. The SOP is surfaced from within the task, order, or pathway step — not as a separate system to navigate to
2. Steps are presented sequentially; the clinician steps through or uses as reference
3. Checklist items generate timestamped compositions in the clinical record
4. The parent composition (e.g. `central_line_insertion.v2`) references the SOP id and version used
5. Departure from any checklist item is documented with a reason

The resulting audit trail answers: what was the standard, which version, who performed the procedure, which steps were completed, and what was documented. This is the complete medicolegal record.

### 14.4 SOP Execution Records

```sql
CREATE TABLE sop_executions (
  id              UUID PRIMARY KEY,
  sop_id          UUID NOT NULL REFERENCES sops,
  sop_version     INT NOT NULL,
  patient_id      UUID NOT NULL,
  episode_id      UUID,
  performed_by    UUID NOT NULL,
  performed_at    TIMESTAMPTZ NOT NULL,
  composition_id  UUID,             -- the composition this execution generated
  status          TEXT NOT NULL     -- 'completed','incomplete','abandoned'
);

CREATE TABLE sop_checklist_entries (
  id              UUID PRIMARY KEY,
  execution_id    UUID NOT NULL REFERENCES sop_executions,
  step_id         UUID NOT NULL REFERENCES sop_steps,
  completed       BOOLEAN NOT NULL,
  completed_at    TIMESTAMPTZ,
  deviation_reason TEXT
);
```

### 14.5 SOP Version Control and Notification

SOPs are versioned. When a new version is activated:
- Staff are notified in the app (standard notification tier)
- The new version becomes the default for new executions
- Existing in-progress executions continue on the version they started
- The previous version is retained and queryable (medicolegal requirement)

Notification of SOP changes is a compliance requirement in regulated clinical environments. The notification system (§51.7) handles this via the standard push infrastructure with an additional in-app acknowledgement requirement — staff must confirm they have read the updated SOP before it clears from their inbox.

### 14.6 SOP Quality and Compliance Reporting

Aggregate SOP execution data feeds the quality dashboard:
- Compliance rate per SOP (what percentage of executions completed all checklist items)
- Most frequent deviation reasons
- Executions per department and per operator
- SOP review dates approaching (governance alert)

This data is derived from `sop_executions` and `sop_checklist_entries` — no manual audit required.

### 14.7 Mapping SOPs to EHR Domains

SOPs are referenced from multiple EHR domains:

| Domain | How SOPs appear |
|---|---|
| **Clinical pathways** | Pathway step references the SOP governing that step's procedure |
| **Orders / CPOE** | Procedure order activates the relevant SOP in the task execution view |
| **Nursing tasks** | Task type links to SOP; nurse opens SOP from within the task |
| **Training / competency** | SOP is the reference standard for skills assessment |
| **Incident management** | Incident report links to the SOP that should have governed the action |
| **Audit** | Every execution references SOP id and version — reconstructible at any time |

The SOP is never a detached document. It is woven into the workflow at the point of action.

---


---

# Part III — Inpatient Care

---

## 15. Inpatient Admission

### 15.1 Interprofessional Anamnesis

Hospital admission triggers a structured, multi-professional anamnesis that is richer and more time-critical than its ambulatory counterpart. Physicians, nursing staff, and other clinical disciplines contribute their own layers to the admission record, each with a dedicated schema, but the composite result is a single unified patient view — not scattered parallel documents.

**Core admission data captured:**

| Domain | Examples |
|---|---|
| Medical history | Current complaints (Hauptbeschwerden), systematic organ review, previous illnesses, operations, allergies |
| Social & family history | Living situation, occupation, next of kin, legal guardian, advance directives (Patientenverfügung) |
| Functional status | Mobility, ADL, cognitive screen (AMT/MMSE), sensory aids, language/interpretation needs |
| Nutritional status | NRS 2002 at admission; formal dietitian referral if score ≥ 3 |
| Skin/wound status | Initial skin inspection (pressure injuries, wounds, lines); documented with body-map annotations (§12) |
| Vital signs baseline | Temperature, pulse, BP, SpO₂, respiration rate, weight, height, BMI |
| Medication reconciliation | All home medications verified, generic substitution noted, high-risk drugs flagged |
| Critical flags | Isolation requirement, DNR/DNAR status, falls risk, drug/latex allergy severity |
| Legal / advance directives | Living will reference, healthcare proxy (Vorsorgeauftrag), court-appointed guardian |

**Genogram:** A structured family history tool — not a free-text field. The genogram data model records family members (generation, relation), their conditions, and ages of onset/death. A React-rendered genogram view is generated from the structured data; clinicians edit relationships directly in the diagram.

**Fluid balance and fluid lines:** From admission, a continuous fluid balance record is maintained. All infusions, drains, urine output, wound drainage, and other fluid inputs/outputs are entered against the patient timeline. The balance accumulates per shift and per 24 h. Peripheral and central venous lines, arterial lines, urinary catheters, and drains are tracked as named devices with insertion date/time, insertion site, responsible clinician, and planned removal date.

**Device integration at admission:** Monitored patients have their bedside monitor, ventilator, or infusion pump auto-discovered via MDI/HL7 device messaging. Vital signs and infusion records begin flowing into the PDMS timeline without manual re-entry (§48).

### 15.2 Critical Flags and Legal Directives

Critical flags are distinct from ordinary clinical findings: they appear as persistent banners on every screen within the patient context and are included in every handover document. Flags have a severity (caution / warning / critical), a creator, a timestamp, and an optional expiry.

Standard flag types:

- **Isolation** — contact, droplet, airborne; includes cohort-flag for ward-level isolation
- **Allergy severity** — risk of anaphylaxis; triggers allergy alert on orders
- **DNR / DNAR / AND** — level of resuscitation; must match advance directive document
- **Falls risk** — generated from Morse or equivalent score (§11); triggers fall-prevention orders
- **Infectious agent** — specific pathogen (MRSA, VRE, C. diff); linked to microbiology results
- **Safeguarding** — child protection, adult protection; restricts information disclosure
- **Legal incapacity** — court-appointed representation; guardian contact details stored

Advance directives are stored as scanned documents linked to the patient record, plus a structured summary (wishes documented yes/no, scope, date of signature, witnesses). At admission the nursing team confirms whether the patient has a Patientenverfügung and whether the electronic copy is current.

Structured flags are distinct from clinical notices (§9.4): flags are typed, system-enforced categories with defined clinical behaviour (alert triggers, order blocks, handover inclusion); notices are free-text messages authored by any clinician for any purpose that warrants persistent visibility.

### 15.3 Continuum of Care — Internal Transfers

The patient record is architecturally continuous across all internal care contexts. There is no "sending" and "receiving" of data between departments — there is one record, and the care context determines which view is presented.

**Cross-department continuity:**

| Transfer path | Continuity |
|---|---|
| Premedication → Anaesthesia | Same surgical episode; anaesthetic record is a domain view on the shared episode |
| Anaesthesia → PACU | PACU inherits the full anaesthetic record; anaesthetic drugs are not re-entered |
| PACU → Ward | Ward view shows full PACU course including vital signs and PACU medications |
| Ward → ICU | ICU PDMS connects to the existing episode; all ward notes, labs, and medications are visible in ICU context |
| ICU → Ward | Ward view shows full ICU course; PDMS data accessible in historical trend mode |
| Neonatology | Neonate record linked to mother's episode via `parent_episode_id`; bidirectional reference (§25) |

**Bidirectional data visibility:** When a patient is transferred, the receiving ward sees all historical data from the prior care context. The sending ward's data is not locked — it remains fully accessible for reference, correction, and legal review. Active orders are explicitly reviewed at transfer: suspend, continue, or modify.

**No record splitting (Aktensplitt):** There is no maximum data volume per patient record. Long-stay patients accumulate more data, but architecture ensures no performance impact:

- **Time series** is automatically tiered (§24 three-zone model): recent data is fast; archived data is compressed but queryable
- **Composition queries** use projection tables that maintain current clinical state — query time is O(1) for current-state reads regardless of stay length
- **Note streams** are paginated; loading today's notes does not require loading years of history
- **Scores and aggregates** are pre-computed; recalculation does not happen on read

Load-testing with a simulated 2-year continuous ICU stay (≈700 million time series points) shows no degradation in clinical query response times.

---


## 16. Admission Schemas, Order Sets, and Pathways

### 16.1 Admission Schema Bundle

Every planned admission is associated with an **admission schema** — a bundle of three artefacts activated simultaneously:

1. **Order set** — a pre-built set of admission orders (lab, imaging, medication, nursing, dietary) appropriate for the diagnosis or procedure. Individual orders within the set can be accepted, modified, or declined during countersignature. The order set is a versioned template; changes require a review/approval cycle before becoming the default.

2. **Structured admission interview** — a diagnosis-specific question set that guides the admitting physician and nurse through the anamnesis, ensuring no domain is omitted. Responses are stored as structured data (not free text) wherever possible, enabling later aggregation and quality measurement.

3. **Admission checklist** — a task list that must be completed before the patient is considered "fully admitted" (e.g., orientation provided, valuables documented, wristband printed, escape-risk assessment complete, family contact verified).

### 16.2 Countersignature Workflow

Order sets created by nursing or allied health staff require physician countersignature before execution. The countersignature UI presents each order with its default parameters, allows amendment, and records the approving physician, timestamp, and any changes. A single screen flow — not a separate module — handles the entire countersignature so that turnaround is measured in minutes, not hours.

### 16.3 AI-Assisted Early Warning

The admission data (vital signs, scores, lab results, medication reconciliation) feeds a continuous early-warning model:

- **NEWS2** score computed automatically from vital-sign entries; threshold alerts generated at ward and critical levels.
- **Sepsis screening** — SIRS / qSOFA computed from vital signs and lab values; alert if criteria met.
- **Deterioration risk** — institution-trained ML model (or configurable rule-set) scoring probability of ICU transfer or rapid-response activation within 24 h; displayed as a risk band in the patient header.
- **Re-admission risk** — relevant at discharge planning (§18).

All AI alerts are soft alerts by default — displayed in the patient banner and nursing board, requiring acknowledgement, not mandatory order entry. The escalation pathway (who to call, what to order) is linked as an SOP reference (§14).

### 16.4 Pathway Activation at Admission

When an admission schema includes a clinical pathway (§13), the pathway is activated as part of the admission workflow. Steps that are time-zero (e.g., post-op monitoring protocol, hip-fracture pathway) begin counting from admission timestamp. The admitting physician can select a different pathway or defer pathway assignment; the choice is logged. Pathways advance asynchronously (§13.3) — the patient does not need to be in a specific application view for pathway steps to advance.

### 16.5 Transfer Order Sets and PDMS Protocol Activation

At the point of ICU admission or transfer between care levels, a **transfer order set** is offered — a bundle of orders appropriate to the receiving environment. This is distinct from the admission schema (§16.1), which applies at hospital admission.

**Examples:**

| Transfer event | Transfer order set activates |
|---|---|
| Ward → ICU (respiratory failure) | Intubation preparation, monitoring parameters, hourly nursing, ICU medication conversion |
| ICU → ward (step-down) | Remove ICU monitoring, convert IV medications to oral, reduce nursing frequency, activate ward pathway |
| PACU → ward | Remove PACU monitoring, transition analgesia to PRN schedule, mobilisation order, diet resumption |
| OR → ICU (post-cardiac surgery) | Post-cardiac surgery PDMS order set (§24.15), chest drain management, anticoagulation start |

Transfer order sets require countersignature by the receiving team's attending physician before orders become active — this handover moment is the formal point at which clinical responsibility transfers.

---


## 17. Ambulatory–Inpatient Continuity

### 17.1 The Concurrent Episode Model

The transition between ambulatory and inpatient care is not a handover — it is an overlap. The patient does not leave one record and enter another. Both the ambulatory episode and the inpatient episode are active concurrently; they share the same patient record.

This is a direct consequence of the episode model (§53): a patient can have multiple concurrent active episodes of different types. Clinical data is patient-scoped and visible across episodes; actions are episode-scoped and attributed to the episode in which they were performed.

### 17.2 Transition Scenario

A representative scenario: a patient with an active outpatient cardiology follow-up episode is admitted for an elective cardiac catheterisation procedure.

**At admission:**
- The inpatient episode is created (Fallnummer assigned, type: day case / inpatient)
- The admitting physician sees the full ambulatory history — active diagnoses, medications, recent results, open orders — without navigating to a separate record
- Active ambulatory orders are reviewed: each is explicitly **continued**, **suspended**, or **cancelled** for the duration of the inpatient stay. This review is a mandatory step in the admission workflow; orders cannot carry over silently
- The ambulatory pathway is visible to the inpatient team and continues to advance if clinical data captured during the inpatient stay satisfies pathway step criteria

**During the inpatient stay:**
- Clinical data captured during the admission is visible in the ambulatory episode timeline and vice versa — there is one patient record, two concurrent episodes, each showing all relevant data
- Suspended ambulatory orders (e.g., outpatient physiotherapy sessions) are visibly suspended with an expected resume date
- Orders that continue (e.g., a blood test series) execute in the inpatient context; results flow to both episodes

**At discharge:**
- Suspended ambulatory orders are reviewed in the discharge workflow: resume / cancel / modify
- A discharge summary is generated and linked to the ambulatory episode as a document
- New diagnoses or medication changes from the inpatient stay are reconciled into the ambulatory problem list and medication record — this is a structured reconciliation step, not a free-text note
- The ambulatory pathway resumes with full awareness of the inpatient episode

### 17.3 Order Management Across Care Settings

The "suspend / resume" order state is a first-class status alongside placed, in-progress, and resulted:

```
Placed → In progress → Resulted
       ↓
     Suspended (reason: inpatient admission; expected resume: discharge date)
       ↓
     Resumed (on discharge review)
       or
     Cancelled (if clinically superseded by inpatient treatment)
```

Suspension and resumption are explicit actions in the admission and discharge workflows respectively. They are logged in the order audit trail with the acting user, timestamp, and reason.

### 17.4 Data Reconciliation at Discharge

The discharge reconciliation workflow ensures the ambulatory record is fully current after an inpatient stay:

| Reconciliation item | Action |
|---|---|
| New diagnoses confirmed during admission | Added to ambulatory problem list with episode reference |
| Diagnoses resolved during admission | Marked resolved in problem list |
| Medication changes | Ambulatory medication list updated; changes highlighted to the ambulatory team |
| Pending ambulatory orders | Each reviewed: resume / cancel / modify |
| Follow-up appointments needed | Created during discharge workflow and linked to the ambulatory episode |
| EPD document | Discharge summary published to Swiss EPD (§38) |

The reconciliation is a structured checklist — the same mechanism as encounter checklists (§6.5). Items cannot be silently skipped; each requires an explicit action. A discharge cannot be finalised while reconciliation items are outstanding.

---


## 18. Discharge Management

### 18.1 Discharge Planning

Discharge planning begins at admission — not on the day of departure. The **anticipated discharge date (ADD)** is set at admission (or updated at the first attending review) and drives bed management, social work referrals, and post-acute care coordination.

**Discharge planning tools:**

| Tool | Description |
|---|---|
| ADD tracker | Visible in bed management board; updated daily by attending; variance flagged |
| Social work referral | Triggered by complexity flags or care needs assessment; social work documents housing, support needs, care home liaison |
| Home care referral (Spitex) | Structured order with care requirements; sent electronically to Spitex provider |
| Rehabilitation referral | Rehab bed request with clinical summary and functional status; sent to rehab facility |
| Post-acute care portal | Receiving facility/service has restricted portal view of relevant transfer documents |

### 18.2 AI-Assisted Length-of-Stay Prediction

An LOS prediction model (institution-trained, periodically retrained against actual LOS data) provides:

- **Predicted remaining LOS** — visible in the patient header to attending and bed management
- **Risk factors** — the top factors driving the prediction (e.g., pending KGS, unresolved social situation, delayed PT mobilisation)
- **Variance alert** — if actual LOS exceeds predicted LOS by > 20 %, a case management review task is created

The LOS model is one of several AI features that require explicit governance (§36.4): approved by clinical informatics committee, version-tracked, performance monitored continuously, and re-trained on a defined schedule.

### 18.3 Discharge Document Generation

On initiation of discharge, the system generates a draft **discharge summary** auto-populated from structured data:

| Section | Source |
|---|---|
| Patient demographics | Patient master |
| Admission diagnosis | Problem list (admission diagnosis flag) |
| Final diagnoses (ICD-10) | Problem list (resolved/confirmed at discharge) |
| Procedures performed (CHOP) | Procedure records |
| Clinical course summary | Physician progress notes (AI-assisted extraction and summarisation) |
| Significant lab/imaging results | Result store, filtered to clinically significant flags |
| Medication at discharge | Discharge medication list (reconciled) |
| Allergies and intolerances | Allergy record |
| Follow-up instructions | Structured follow-up tasks entered during discharge workflow |
| Referring physician details | Episode metadata |

The AI-assisted extraction (§36.1) drafts the clinical course from structured and semi-structured notes. The attending physician reviews and edits the draft before signing. The signed discharge summary is:

- Published to the Swiss EPD (§38)
- Sent electronically to the referring physician's HIN address
- Stored as a PDF rendition in the resource library

### 18.4 eRezept and Discharge Orders

At discharge, all active medications are reviewed and a discharge prescription list produced. The system supports electronic prescription transmission (eRezept) to the patient's pharmacy (or a selected outpatient pharmacy) via the Swiss eMedication service. High-risk medications (anticoagulants, opioids, insulin) are flagged for explicit counselling documentation.

Inpatient orders that do not carry forward are **suspended** at discharge (§17.3). Orders that convert to ambulatory orders (e.g., follow-up lab checks, wound dressing, physiotherapy) are transitioned to the ambulatory episode and handed to the ambulatory team for review.

### 18.5 Discharge Checklist

The discharge workflow includes a mandatory structured checklist — the same mechanism as the admission checklist (§16.1). Checklist items include:

- Reconciliation complete (§17.4)
- Discharge summary signed
- eRezept transmitted
- Patient counselling documented (medications, wound care, activity restrictions)
- Follow-up appointments booked
- Post-acute referrals confirmed (Spitex, rehab, care home)
- Valuable items returned
- Wristband removed

A discharge cannot be finalised while checklist items are outstanding. The bed is not released in the bed management system until the discharge is marked complete.

### 18.6 Transfer Readiness — Ampelsystem

Transfer readiness criteria are a configurable set of physiological and clinical thresholds that must be met before a patient can be transferred to a lower-acuity care level. The system evaluates them automatically and displays a colour-coded readiness indicator.

**Criteria definition:** Each criterion specifies a data source (vital sign, lab, score, order status, or clinical flag), a threshold expression, and a category: **mandatory** (blocks transfer until met or overridden) or **advisory** (informs but does not block).

**Ampel (traffic light) display:**

```
Transfer Readiness — ICU → Ward
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟢  MAP > 65 mmHg              ✓  78 mmHg
🟢  SpO₂ > 92% on FiO₂ ≤ 0.4  ✓  96% on 0.35
🔴  No vasopressors            ✗  Noradrenaline 0.04 µg/kg/min  [MANDATORY]
🟢  GCS ≥ 10                   ✓  14
🟡  Pain NRS < 5               ~  NRS 5  [ADVISORY]
🟢  No pending critical labs   ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall: 🔴 NOT READY — 1 mandatory criterion unmet
```

**Continuous evaluation:** All criteria are re-evaluated on every data update. The indicator in the patient header updates in real-time. When the overall status transitions to GREEN, a notification is sent to the responsible clinician.

**Manual override:** An attending physician can override an unmet mandatory criterion with a documented clinical rationale. The override is logged with identity, timestamp, reason, and the criterion value at override time. The Einlesebericht and discharge summary both reflect the override.

**Integration with bed management:** A GREEN status automatically notifies the bed management system that the patient is transfer-eligible, enabling proactive bed allocation without a separate communication step.

---


## 19. Insurance Authorization — Kostengutsprache

### 19.1 When Authorization Is Required

Swiss health insurers (Krankenkassen) require pre-authorization (Kostengutsprache, KGS) for a defined list of procedures, medications, implants, and certain hospital stays. If a KGS is required and not yet granted, the corresponding order is placed but flagged as **pending authorization** — it cannot be executed until either:

- The KGS is granted (confirmation received via insurer portal or manual entry), or
- The clinician documents a medical emergency override with a reason code

### 19.2 KGS Workflow

```
Order placed
  ↓
System checks KGS requirement (from insurer tariff rules, updated quarterly)
  ↓  [required?]
  ├─ No → order proceeds normally
  └─ Yes → order status = PENDING_KGS
           KGS request auto-generated (pre-filled from order + patient demographics + diagnosis)
             ↓
           Submitted to insurer via electronic channel (insurer-specific API or HL7 FHIR channel)
             ↓
           Insurer responds: GRANTED / PARTIAL / DENIED / INFORMATION_REQUESTED
             ↓
           ├─ GRANTED → order released; KGS reference number stored on order
           ├─ PARTIAL → cost-sharing terms documented; order released with caveat
           ├─ DENIED → order flagged; treating physician receives alert; alternative workflow offered
           └─ INFORMATION_REQUESTED → appeal task created; additional documents attached; resubmitted
```

### 19.3 Insurer Visibility Portal

Insurers are issued a **restricted portal view** (see §37 External Portals). Within their portal, insurer representatives can:

- View pending KGS requests for their insured patients
- Access only the clinical data explicitly submitted as part of the KGS request (not the full record)
- Submit responses (grant, deny, request information) electronically
- View the KGS history for their insured patients

The insurer portal is read-heavy with narrow write access (response submission only). All insurer access is logged with timestamp, user, patient, and data accessed — required for Swiss data protection compliance.

### 19.4 KGS Tracking and Reporting

Finance and case management have a KGS dashboard:

- All pending KGS requests, age-banded (< 24 h, 1–3 days, > 3 days)
- Response rate by insurer
- Denial rate by procedure/diagnosis
- Average approval turnaround time

Denied KGS cases are tracked through appeal. If a denial results in a procedure not being performed, the clinical team is notified and the order is cancelled with a "KGS denied" reason code, preserving the audit trail.

---


## 20. Charge Capture and Coding

### 20.1 Charge Capture Architecture

Billing for both inpatient (SwissDRG) and outpatient (TARMED / TARDOC) cases is executed in **SAP IS-H**. Charge capture — the clinical recording of services performed — occurs directly in the EHR. The integration layer translates EHR-documented activities into the tariff structures expected by SAP IS-H.

**Data flow:**

```
Clinical documentation in EHR
        ↓
Charge capture module (service codes, quantities, responsible persons)
        ↓
Rule engine + tariff catalogue (TARMED / TARDOC / SwissDRG translator)
        ↓
SAP IS-H (billing, cost-centre allocation, invoicing)
```

A configurable **translation engine** (integrated or third-party, e.g. TriMedx, Xplain) maps EHR service codes to TARMED positions, CHOP procedure codes, and LEP nursing time codes. Translation rules are maintained by the billing and clinical informatics teams.

---

### 20.2 Service Catalogue Integration

The EHR maintains its own **generic service catalogue** linked to external tariff catalogues:

- **Standard catalogues imported:** TARMED, TARDOC (on go-live), CHOP, ICD-10-GM-CH, LEP Nursing (version current), ICF, dietetics-specific codes (IDNT), DRG grouper tables.
- **Institution-specific catalogues:** Local service codes, procedure bundles, and specialty-specific items are maintained in the catalogue administration module.
- **Catalogue synchronisation:** Updates to official tariff catalogues (annual TARMED release, DRG catalogue update) are imported via the master data interface from SAP IS-H or directly from the official sources. Version management tracks which catalogue version applies to each historical encounter.

---

### 20.3 Automated Charge Trigger

Clinical documentation actions trigger charge capture automatically:

| Clinical action | Charge generated |
|---|---|
| Procedure note signed (CHOP code assigned) | Surgical / procedural fee |
| Anaesthesia times recorded | Time-based anaesthesia fee |
| Laboratory order released as result | Lab service fee |
| Imaging study completed (DICOM series linked to order) | Radiology fee (including teleradiology, second opinion) |
| Therapy session completed (attendance confirmed) | Therapy service fee + LEP time |
| Material items consumed (from packs, individual scan) | Material charges |
| Medication administered (MAR confirmed) | Drug charge |
| Telemedicine consultation completed | Telemedicine tariff code |
| Biopsy specimen dispatched to pathology | Pathology order fee |

For charges that cannot be fully automated (e.g. complex surgical services with intraoperative variation), the system generates a **charge suggestion** pre-populated from the procedure note; the responsible clinician or coder reviews and confirms before transmission to SAP.

---

### 20.4 Notification of Uncaptured Charges

The system continuously monitors for services that have been documented clinically but not yet captured for billing:

- A **missing charge alert** is surfaced on the clinician's or coder's task list for each unconfirmed charge suggestion.
- A **case completeness indicator** on the patient summary shows the billing status (complete / charges pending / missing documentation).
- Before case closure (discharge), the system runs a final completeness check and lists all open charge items; the responsible physician or coder must resolve or explicitly waive each item before the case is closed.

---

### 20.5 Therapy Charge Capture

Therapy services carry specific charge capture requirements:

- **Session time:** Start and end time of each therapy session are recorded (automatically from scheduling confirmation; manually correctable). Duration in minutes is calculated and applied to the relevant TARMED or LEP time code.
- **Nutrition Risk Score (NRS):** The NRS-2002 score (a mandatory prerequisite for dietetics billing in several tariff contexts) is automatically extracted from the structured assessment record; the charge capture module confirms it is present before releasing the dietetics fee.
- **Pre-discharge completeness check:** Before discharge, the system identifies therapy disciplines where the planned number of sessions was not reached. It surfaces these as a list to the responsible clinician with remaining session capacity in the therapy calendar; the clinician can schedule additional sessions or document a clinical reason for early cessation.
- **Controlling analysis:** The billing controller can run a session-level reconciliation: planned sessions vs. delivered sessions vs. billed sessions, with variance flags.

---

### 20.6 Service Bundles (Leistungsblöcke)

Individual services are grouped into **service bundles** (Leistungsblöcke) for efficiency:

- **Bundle definition:** A bundle groups a set of TARMED or generic service codes that are routinely billed together for a given procedure or encounter type. Example: an outpatient knee arthroscopy bundle includes surgeon fee, assistant fee, anaesthesia base, instrument tray, and standard disposables.
- **Configuration:** Bundles are configured by the billing team or a clinician with the appropriate authority role. Bundle definition is version-controlled.
- **Contextual presentation:** When a clinician opens a procedure note or completes a consultation, the system suggests the applicable bundle(s) based on the documented procedure code or appointment type. The clinician selects the bundle with one click; individual items within the bundle are pre-confirmed and can be adjusted if the actual service differed from the standard (e.g. a component was not used).
- **Automated selection:** For high-volume standard procedures, bundle application can be fully automated (no user interaction required); the resulting charge line is shown as "auto-applied" and is reviewable by the coder.

---

### 20.7 Billing Rules and Optimisation

A configurable **billing rules engine** applies TARMED/TARDOC combination and exclusion rules automatically:

- Identifies services that cannot be billed simultaneously per tariff rules and proposes the compliant combination.
- Detects under-billing: where documented services qualify for a higher-value tariff position that was not captured, the engine flags the opportunity (subject to clinical documentation supporting it).
- Validates time-based codes against documented times (e.g. anaesthesia minutes match the recorded OR time).
- Generates a compliance report per case showing: auto-applied rules, manual overrides, and flagged inconsistencies.

---

### 20.8 Coding

#### 20.8.1 Concurrent Encounter Coding

Diagnoses (ICD-10-CH) and procedures (CHOP) are coded continuously throughout the encounter — not only at discharge:

- The treating physician assigns working diagnoses at each encounter event; these are used as candidate codes for the final coding.
- AI-assisted coding (§36.9.1) proposes ICD-10 and CHOP codes from the free-text documentation and order history; the coder reviews and confirms.
- A **working DRG** is computed in real time from the current coded diagnoses and procedures, displayed on the patient summary. This gives the clinical and financial team an ongoing estimate of the case complexity and expected reimbursement.

#### 20.8.2 Coding Integration with SAP

The coded diagnoses and procedures are transmitted to SAP IS-H for DRG grouping via a certified interface:
- Transmission is triggered at configurable milestones (e.g. daily, or on physician sign-off of the discharge summary).
- The DRG grouper runs in SAP; the resulting DRG and case weight are returned to the EHR and displayed on the case record.
- Coding amendments after DRG assignment are tracked with the reason for change; re-grouping is triggered automatically.

#### 20.8.3 Coding Optimisation Hints

The system identifies cases where additional documentation could improve the DRG assignment (optimisation without upcoding):

- Missing secondary diagnoses that are clinically documented but not yet coded (e.g. complication documented in the progress note but not added to the problem list).
- Procedures documented in free text but not coded (identified by NLP scan of notes).
- Cases with a complexity level score (CCL) near the next DRG tier — highlighting that a documented complication, if coded, would move the case into a higher-weight DRG.

All hints are advisory; the coder decides whether to act based on clinical documentation.

---

### 20.9 Complex-Fee Packages (Komplexpauschalen)

Certain SwissDRG cases qualify for complexity supplements when defined treatment criteria are met (e.g. minimum physiotherapy minutes, specific assessment completion):

- **Current status display:** The patient's current Komplexpauschale level and progress toward the next tier are shown on the case summary — visible to all treating team members.
- **Achievement tracking:** Required treatment components (therapy minutes, assessments, consultant reviews) are tracked against the package criteria. A completion bar shows percentage achieved.
- **Early-warning alert:** If the required components will not be achievable before the projected discharge date, an alert is sent to the responsible physician and therapy coordinator. The system calculates what additional treatments would be required and identifies available capacity in the therapy calendar.
- **Research function:** Billing controllers can search across cases for patients "near a tier boundary" — patients where one additional qualifying session or assessment would move them to a higher reimbursement level. This is used for retrospective case review and prospective planning.

---

### 20.10 Prior Authorisation (Kostengutsprache)

#### 20.10.1 Activation

Prior authorisation (KG) requests are triggered by:
- **Automatic rule engine:** Procedure codes, DRG groups, or care pathway events that always require KG (e.g. organ transplant, experimental therapy) automatically generate a KG request.
- **Care pathway trigger:** Specific milestones in a clinical pathway (e.g. decision to proceed to elective surgery) include a KG task.
- **Manual activation:** Any team member can initiate a KG request; a supervisor role is required for requests outside the automatic rule set.

#### 20.10.2 Status Visibility

The KG status is prominently displayed on the patient's financial summary and on the ward dashboard:
- **Colour-coded badge:** Green (approved) / Amber (pending) / Red (expired, rejected, or missing).
- **Expiry alert:** An alert is generated 7 days (configurable) before a KG expires and again on expiry; the financial team receives the alert and can request renewal.

#### 20.10.3 Rejection and Reconsideration

When a KG request is rejected by the insurer:
- The system presents a structured reconsideration workflow: reasons for rejection are documented, supporting clinical evidence is attached, and the reconsideration letter is drafted with AI assistance (pre-populated from the clinical record).
- The status of the reconsideration is tracked until final decision.

#### 20.10.4 Automated Data Population

The KG request form is pre-populated automatically from the patient record:
- Diagnoses and procedure codes from the current coding
- Relevant lab results, imaging findings, and clinical scores
- Treating physician and institution details
- Expected treatment duration and cost estimate (from DRG calculator)

The responsible physician reviews and signs; the completed form is transmitted electronically to the insurer (via portal, HL7, or structured email depending on insurer capabilities).

---


---

# Part IV — Specialty Departments

---

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


## 23. Perioperative Quality Management

The perioperative domain — anaesthesia, operating theatre, and PACU — requires structured safety checklists, implant documentation, and quality management reporting integrated into the clinical workflow.

### 23.1 Safe Surgery Checklist (WHO SSC)

The WHO Safe Surgery Checklist is embedded as a three-phase workflow. Completion is mandatory; the procedure cannot be documented as started until Sign-In and Time-Out are complete.

| Phase | Timing | Location | Key items |
|---|---|---|---|
| **Sign-In** | Before anaesthesia induction | Anaesthesia workstation | Patient identity, site marked, consent signed, allergy check, anaesthesia machine check, anaesthetic plan |
| **Time-Out** | Before first incision | OR — all team members | Team introductions, patient/procedure/site, critical steps (surgeon), airway concerns (anaesthetist), sterility confirmed, antibiotic given |
| **Sign-Out** | Before patient leaves OR | OR | Procedure name confirmed, instrument/swab count complete, specimen labelled, equipment issues noted, recovery plan communicated |

Items requiring multi-role confirmation cannot be completed by a single user. Emergency override by attending surgeon or anaesthetist requires a mandatory reason code and generates a quality management notification.

**SSC reporting:** Completion rate by OR / team / period; items most frequently skipped or overridden; Time-Out-to-incision interval; emergency override rate.

### 23.2 Anaesthesia Pre-Induction Checklist

Triggered automatically when the patient enters anaesthesia preparation — anaesthesia-internal, separate from the SSC:

- Anaesthesia machine check completed (machine serial number logged)
- Drugs prepared, labelled, high-alert drugs double-checked
- Emergency drugs available (adrenaline, atropine, suxamethonium)
- Difficult airway equipment present and checked
- IV access confirmed and patent
- Patient identity and consent re-confirmed
- Allergy status confirmed against allergy record
- Fasting status documented
- Pre-medication confirmed as given

All items are timestamped and attributed to the confirming anaesthetist.

### 23.3 Medical Device and Implant Documentation

Every implant placed during a procedure is recorded in a structured implant record linked to the procedure note.

| Field | Description |
|---|---|
| `device_type` | Joint prosthesis, cardiac pacemaker, ICD, LVAD, vascular graft, mesh, cochlear implant, … |
| `manufacturer` / `model` / `catalogue_number` | |
| `lot_number` / `serial_number` | |
| `implant_date` | From procedure timestamp |
| `anatomical_site` | Structured (left hip, right coronary artery, …) |
| `implanting_surgeon` | Linked to user record |

**Patient implant certificate:** A PDF implant card is generated automatically at procedure closure and added to the patient's document library.

**Recall management:** When a device lot or serial range is subject to a safety recall (FSCA), the system identifies all patients with the affected device and creates a recall notification task for each responsible clinical team.

### 23.4 Perioperative Quality Reporting

**Pressure injury reporting:** Perioperative pressure injuries are documented as structured clinical incidents (body-map annotation, EPUAP grade, acquisition context) with automatic notification to the ward nurse, quality manager, and the OR/anaesthesia team lead.

**Perioperative performance metrics:**
- First incision on time % (actual vs. scheduled)
- OR turnover time between cases
- Case duration vs. predicted (scheduling accuracy)
- Antibiotic prophylaxis compliance (drug, timing relative to incision)
- DVT prophylaxis compliance (documented pre-op)
- Re-operation within 30 days
- SSI rate (linked to post-op wound assessments and microbiology)
- Unplanned ICU admission within 24 h of surgery

All metrics are filterable by time period, OR room, surgical specialty, and procedure code (CHOP).

---


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


## 25. Neonatology

Neonatology is a specialised clinical domain requiring capabilities that extend beyond the standard inpatient model: a record that begins before birth, continuous monitoring from the first minute of life, paediatric-specific medication rules, growth tracking against gestational reference curves, and dynamic visualisations of time-critical values such as bilirubin.

### 25.1 Prenatal Documentation — Before the First Breath

The neonatal patient record is created as a **pre-patient** before birth, linked to the mother's inpatient episode via `parent_episode_id`. Clinical activity begins — and is properly attributed — before the neonate has a legal identity.

**Prenatal emergency orders:** The neonatology team places orders on the pre-patient before delivery, anticipating clinical needs based on the obstetric diagnosis (extreme prematurity, suspected cardiac defect, known IUGR). These orders activate at birth and are visible in the delivery room resuscitation workflow.

**Continuous monitoring from minute 1:** A neonatal resuscitation unit in the delivery room records:
- Heart rate (ECG or pulse oximetry)
- SpO₂ (pre-ductal and post-ductal)
- Respiratory rate and effort
- Temperature
- APGAR score at 1, 5, and 10 minutes (manual entry, prompted by system timer)

Data is captured offline if the delivery room is network-isolated and backfilled into the NICU episode on admission (§24.13).

**Service and procedure capture from birth:** Every resuscitation intervention (intubation, surfactant, chest compression, umbilical catheter insertion) is documented with timestamp and operator, attributed to the neonatal pre-patient record.

### 25.2 External Postnatal Care — Collaboration Hospitals

The neonatology team provides services at collaboration hospitals in two modes.

**Physical presence:** The team carries offline-capable tablet devices with the full neonatal documentation workflow. On return to the NICU (or via VPN sync), the record is merged into the patient's episode with original timestamps. Patient identity is established at birth using the mother's existing record.

**Telemedicine consult:** A NICU physician participates via a structured telemedicine session:
- Video link with the on-site team
- Remote viewing of the neonate's vital signs (if the collaboration site has compatible monitoring)
- Structured consult documentation: assessment, recommendations, remote orders
- Remote orders transmitted electronically to the collaboration hospital and simultaneously recorded in the EHR

The telemedicine consult is a first-class clinical record with the same legal standing as an in-person consultation.

### 25.3 Paediatric and Neonatal Medication

**Neonatal drug formulary:** Separate from adult and paediatric formularies, covering:
- Doses in mg/kg or µg/kg based on current body weight (updated daily)
- Maximum dose limits per kg AND per dose, adjusted for gestational age
- Dilution protocols for neonatal infusion volumes
- Compatibility matrix for co-administration via shared IV lines

**Weight-based dose calculation:** Every neonatal medication order requires current weight confirmation. The system calculates dose, infusion rate, and volume in ml/h, presenting the calculation for verification before signing.

**Gestational-age-adjusted alerts:** Drug alerts are adjusted for gestational age — a drug safe at term may be contraindicated at 26 weeks. The alert engine reads the neonate's gestational age at birth and postnatal age to select the appropriate threshold.

### 25.4 Growth and Gestational Development Tracking

**Key measurements:**

| Measurement | Frequency | Display |
|---|---|---|
| Birth weight | Once | Reference for all weight-based calculations |
| Current weight | Daily in NICU | Trend; % change from birth weight; weight-for-age z-score |
| Length / head circumference | Weekly | Percentile chart |
| Gestational age (GA) at birth | From LMP or USS | Fixed reference |
| Corrected age (CA) | Continuously: GA + postnatal age | Shown alongside chronological age in all views |

**Percentile and growth curves:** Growth parameters are plotted on WHO and Fenton (preterm) reference charts:
- Weight-for-gestational-age, length-for-corrected-age, head circumference-for-corrected-age
- Z-scores computed at each data point
- Interactive curve: hover to see raw value, date, gestational/corrected age, z-score
- PDF export for paper-based patient summaries

### 25.5 Dynamic Clinical Curves — Bilirubin and Phototherapy Management

Total serum bilirubin (TSB) values are plotted on a risk-zone nomogram (Bhutani-style):
- X-axis: postnatal age in hours
- Y-axis: TSB in µmol/L
- Risk zones: low / low-intermediate / high-intermediate / high
- Phototherapy and exchange transfusion thresholds plotted as separate lines, adjusted for gestational age and haemolytic disease status

Each new TSB result is plotted automatically. A rising curve approaching a threshold generates a proactive alert before the threshold is crossed. Phototherapy periods are shown as shaded bands; TSB response is visible as slope change. Rebound checks are scheduled automatically (12–24 h after phototherapy cessation) as nursing tasks.

**Additional neonatal dynamic curves:**
- Blood gas trend (pH, pCO₂, pO₂, HCO₃, BE) with gestational-age-specific normal ranges
- Oxygen requirement trend (FiO₂ / flow rate) — weaning progress

---


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


## 27. Prevention and Population Health

Prevention and population health is a distinct module with its own data model, workflow engine, and patient-facing interface. It is not a sub-feature of the clinical record module.

### 27.1 Preventive Care in the Clinical Context

When a relevant patient is opened, the clinical workspace surfaces outstanding prevention and screening recommendations:
- Overdue or upcoming screening is displayed as a contextual alert (not a blocking interruption)
- A preventive care plan can be added to the patient record and tracked alongside clinical pathways
- Completed screening is linked to the clinical composition that satisfied it

### 27.2 Prevention Standards Registry

Screening and prevention standards are maintained as configurable rule sets — not hardcoded:

```
Rule: Colorectal cancer screening
  Eligible population: age 50–74, both sexes
  Interval: every 2 years (FOBT) or 10 years (colonoscopy)
  Trigger: no qualifying composition in the eligible interval
  Action: add to recall list; notify via patient app
```

Rules specify:
- Eligible population (age, sex, diagnosis, risk factors)
- Screening interval and test type
- Action to trigger (recall letter, patient app notification, booking invitation)

Rules are updated centrally; updates propagate immediately to all clinical contexts without code deployment. Sources: BAG guidelines, EKIF vaccination schedule, SSPH / Swiss Cancer Screening Programme.

### 27.3 Population Identification and Recall

Authorised staff generate recall lists from population queries:

```
Example: "All patients over 50 with Type 2 diabetes and no HbA1c
          recorded in the last 6 months"
```

The query runs against the projection store — not raw compositions. Results are available within seconds for practice-scale populations.

Outreach actions per patient on the recall list:
- Automated letter (postal or digital)
- Patient app push notification with direct booking link
- Direct booking invitation (slot reserved for recall patients)

All recall actions are logged in the patient record with timestamp and source rule.

### 27.4 Prevention Workflows

Prevention programmes are modelled as clinical pathways (§13):
- A vaccination campaign pathway, a colorectal screening recall pathway, a cardiovascular risk assessment programme
- Pathways can include automated patient communication steps
- Step completion is triggered by the relevant composition being recorded (the same event-driven pathway advance described in §13)
- Completion rates and drop-out rates are reportable for quality management and programme evaluation

### 27.5 Patient App — Prevention for Non-Registered Individuals

Prevention features in the patient app are accessible without being an existing patient of the institution:
- **Symptom screening tools** — routing and triage guidance only; not clinical diagnosis
- **Vaccination reminders** — based on age and self-reported vaccination history
- **Screening appointment booking** — as a new patient; registration is created on first booking
- **Health literacy content** — aligned with BAG prevention campaigns, available in German, French, and Italian

Non-registered users are identified by a lightweight account (email + phone). Their prevention record is merged with the full patient record on their first clinical registration.

---


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


## 29. Logistics

### 29.1 Patient and Material Transport

- Transport orders generated automatically from appointment and procedure scheduling: patient transport triggered N minutes before appointment start; material transport triggered by order confirmation
- Manual transport requests also supported from any clinical workstation or bedside terminal
- Transport optimisation: open requests grouped by origin/destination and urgency; routing algorithm minimises total transport time; displayed as an optimised run list to transport staff
- Real-time status of each transport order: requested / accepted / en route / delivered / cancelled — visible on the ward dashboard and on the requesting clinician's task view
- Bidirectional status updates: transport staff update status from mobile device; changes propagate immediately to the requesting ward
- Appointment rescheduling propagates to linked transport orders: if an appointment moves, the transport order is automatically adjusted or flagged for re-planning
- Integration with external transport services (e.g. Logbuch transport system): bidirectional interface showing bed status, material status, and medication-in-transit; the EHR transport module can replace or supplement the existing Logbuch system depending on configuration

### 29.2 Inventory, Materials, and Medications

- Digital ordering process for non-catalogue items with required approval workflow
- Real-time material availability: current stock levels and projected stock (based on scheduled procedures and consumption rate) visible per ward and per central store
- Automated inventory management: stock alerts when items fall below reorder point; automatic reorder triggered via SAP integration (GLN/SSCC standard item codes)
- Material status in EHR synchronised with SAP material master data (material master matching)
- Cross-ward stock locator: any user can query which store or ward holds a specific item
- Cross-ward requisition: order materials from another ward's stock with approval workflow
- Consignment stock management: consignment agreements with suppliers maintained; consumption automatically triggers billing event to supplier and replenishment order
- External system integration: SAP via GLN (Global Location Number) and SSCC (Serial Shipping Container Code)
- Regulatory traceability: batch and serial number tracking from receipt to patient use; automated recall identification (which patients received a recalled lot) — see also implant recall §23.3
- Scan-based consumption capture: barcode or RFID scan at point of care captures item, lot number, and patient; charge is generated automatically (Scan & Go)
- Image recognition for automated stock counting: camera-based shelf scanning generates reorder suggestions
- OR case cart management: dynamic procedure-linked picklist generated from OR schedule; cart contents adjusted as procedure changes propagate; picklist includes standard packs (§22.4.2) and ad-hoc additions

### 29.3 Cleaning

- Cleaning orders triggered automatically: on patient admission (room preparation), on patient discharge (terminal clean), on OR sign-out (OR room clean), and on isolation order activation (enhanced clean protocol)
- Manual cleaning requests from any workstation or bedside terminal
- Cleaning order scheduling: urgency and estimated duration considered; orders dispatched to available cleaning staff via the transport/task routing module
- Bed-level status: each bed and each bed position within a shared room has an independent cleaning status (clean / pending clean / cleaning in progress / ready for patient)
- Cleaning status visible on the bed management board and in the ward overview
- Materials and supply orders for cleaning tasks: linked to the inventory module; supply request status shown
- Prospective planning: cleaning schedule feeds the bed pre-planning (§28.15) — a bed flagged for terminal clean is excluded from pre-allocation until clean status is confirmed
- Post-OR clean trigger: generated automatically at OR sign-out with infection control metadata (isolation type, causative organisms) to determine cleaning protocol level

### 29.4 Sterile Goods (CSSD / AEMP)

- Sterile goods tracked throughout the production lifecycle: soiled return → decontamination → inspection → packaging → sterilisation → release → storage → dispatch → use → documentation on patient
- CSSD/AEMP status visible in the EHR: current production step of each set shown (e.g. "tray 4712-A: in autoclave, cycle 00441, ETA 14:30")
- Bidirectional data flow between EHR and CSSD system: EHR sends request for specific tray; CSSD sends back status updates and confirmation of dispatch
- RFID integration: trays tracked via RFID tags through each production step; RFID reader events trigger status updates automatically
- Instrument set documented on patient: when a sterile set is used in a procedure, the set ID, sterilisation lot number, and expiry date are recorded in the procedure record (§22.5.8)
- Utilisation analysis: configurable report showing for each instrument set: use frequency, current location/status, ordered-but-not-yet-available count, min/max stock in circulation

### 29.5 Hotel Services

- Meal ordering for staff (configurable staff meal categories separate from patient meal system)
- Additional patient services ordering and billing: TV, phone, newspaper, private nursing, premium amenities — ordered via patient app or bedside terminal; charges applied to billing record by insurance class entitlement
- Patient service entitlement overview: what services the patient is entitled to under their insurance class is shown to ward staff and in the patient app; out-of-scope services are flagged with self-pay cost before ordering

### 29.6 Patient Belongings and Valuables

- Belongings inventory on admission: items recorded (description, quantity); image capture (tablet camera) with confirmation/signature by patient or representative
- Valuables stored in ward safe: item tracked with safe identifier and handover chain
- Automatic transport request for return of belongings at discharge
- Alert/reminder to ward staff at discharge: checklist item confirms all recorded belongings have been returned and acknowledged by patient

### 29.7 Blood Products and Patient Blood Management

- Blood sample collection triggers transport order to blood bank automatically; urgency level maps to transport priority
- Urgent blood orders flagged on transport screen; blood bank notified simultaneously
- Patient Blood Management (PBM) protocol integrated: haemoglobin thresholds (per evidence-based PBM guidelines) trigger CDS prompts before transfusion order is accepted (e.g. "Hb 9.2 g/dL — PBM guideline recommends optimisation before transfusion; proceed?")
- Transfusion order requires documented indication; post-transfusion Hb check reminder generated automatically
- Blood product administration documented in MAR with product identifiers (donation number, blood group, expiry) scanned at bedside; mismatch blocked

---


## 30. Research and Teaching

### 30.1 Study and Study-Participant Management

- **Study register/portfolio:** All studies (interventional, observational, cohorts, registries, biobanks) entered with: BASEC number, SNCTP number, ClinicalTrials.gov NCT number, IEC/IRB approval reference, sponsor, phase, indication, inclusion/exclusion criteria
- **External registry interface:** Import/export with SNCTP (Swiss National Clinical Trials Portal) and ClinicalTrials.gov via structured XML/JSON
- **Feasibility queries:** Anonymised query against the clinical data warehouse using inclusion/exclusion criteria (diagnosis codes, lab value ranges, demographics, consent status) returns estimated eligible patient count without exposing identities
- **Recruitment alerts:** When a patient meeting a study's criteria is admitted or registers in the system, a push notification is sent to the study coordinator (pull and push modes configurable). The alert respects consent status: only patients who have given the applicable consent (or General Consent) are surfaced
- **Healthy volunteer/comparator cohorts:** Non-patient volunteers or healthy comparators can be registered and tracked separately from clinical patients, with their own consent and data visibility rules
- **Teaching case labelling:** Any case can be flagged as a teaching case or exemplary case report by an authorised user; flagged cases are available in the simulation environment (§30.9) under de-identified form
- **Recruitment statistics:** Dashboard showing enrolled patients by study, by diagnosis, by period — exportable as KPIs for clinic certifications
- **SAE alerts:** When a study participant is admitted as emergency or inpatient, the study team is automatically notified; a structured SAE documentation form is pre-populated

### 30.2 Consent Management

- Study-specific consent forms stored and managed per study; versioned with effective date
- Re-consent triggered automatically when consent version changes or consent expires
- Policy automation: study-related orders (lab, medication, procedures) are only permitted for patients with active, valid study-specific consent; General Consent enables read access for researchers
- Consent by proxy (legal guardian, authorised representative) supported; relationship documented
- Emergency study consent: regulatory confirmation by independent physician documented; surrogate consent with Ethics Committee approval tracked
- Patient Public Involvement (PPI) willingness flag: patient can indicate willingness to contribute to research design, separate from study enrolment consent
- All consent records versionable, printable as PDF, and accessible to patient in patient app

### 30.3 Study Participant Pathway

- **General Consent management:** Digital capture, storage, and patient-facing review of the institution's General Consent; patient can withdraw at any time from patient app
- **Study visit plan:** Study protocol visits are modelled as a structured pathway; each visit has an order set (labs, procedures, questionnaires, medications); data points to be collected per visit are defined with validation rules
- **Data tagging:** All study-collected data is tagged as study data with study identifier and marked as "non-clinical-grade/experimental" where appropriate; visibility configurable per role and consent status
- **External access for monitors/auditors:** Study monitors and auditors can be granted read-only access scoped to enrolled patients and study-relevant data; data presented in de-identified form for roles below source-data verification level; query function available (monitor raises a query; assigned study physician is notified and responds within the system)
- **Study SOPs and working instructions:** Available within the EHR at the point of care via DMS link; access scoped to users with the appropriate study role

### 30.4 Research Data Management

- **Data point definition:** Study-specific data collection schemas defined by the study team; validation rules (range checks, required fields, conditional logic) configurable
- **Source data designation:** Fields can be designated as source data / single point of truth; links to raw data stored externally (genomics, imaging, device telemetry) are maintained as references
- **Plausibility checks:** Automated checks on data entry (out-of-range flags, inconsistency detection across related fields); deviations documented with reason
- **Research health record:** Unidirectional data pull from the clinical record into a research-specific view; the research team can configure which clinical data elements are copied; a data governance approval process governs each new data access request
- **External experimental data:** Data generated externally (e.g. university genomics lab) can be imported into the research record with configurable visibility rules
- **Structured data entry with AI assistance:** Voice input and LLM-assisted structuring of free-text research observations into defined data fields
- **Adverse event reporting:** Structured AE/SAE forms with direct generation of CIOMS I forms for submission to sponsor and regulatory authorities
- **Terminology service:** Standard terminologies (SNOMED CT, MedDRA, CTCAE, NCI thesaurus) maintained and updated by the vendor; custom study-specific terminologies can be imported
- **Relational modules:** FHIR R4 compatible data model; OMOP CDM export for observational research; mCODE (Minimal Common Oncology Data Elements) support

### 30.5 Study Medication Management

- Study drugs added to a study-specific catalogue; non-approved drugs can be configured within a reasonable timeframe
- Dispensing policy-automated: consent active + patient enrolled + prescriber on delegation log → order permitted
- Inpatient dispensing and outpatient visit dispensing (take-home supply) both supported; return of unused/partially used supply documented via scan; waste recorded
- Accountability ledger maintained automatically from dispense and return records; no separate manual drug accountability spreadsheet needed
- Investigator's Brochure linked to drug record (role-restricted access)
- Interaction data for study drugs: manually entered pending database inclusion; flagged as "study drug — limited interaction data available"
- Rescue medications (approved drugs used as per-protocol rescue) separately tracked with cost assigned to study budget
- Full logistics chain for study drug orders: linked to pharmacy, cold-chain transport, storage conditions monitoring, and study participant visit schedule

### 30.6 Data Export

- Export formats: FHIR R4 (Bundles), OMOP CDM, CSV, JSON, PDF, REDCap-compatible XML
- Standard conformance: openEHR archetype export, HL7 FHIR R4, CDISC ODM/SDTM for regulatory submissions
- De-identification: configurable de-identification profiles (Safe Harbour, Expert Determination); date-shifting, pseudonymisation, geographic generalisation; de-identification applied automatically before any export to external parties
- Transfer to third parties (sponsors, biobank platforms, universities): SFTP, FHIR API endpoint, or secure file transfer; transfer events logged (recipient, data category, volume, de-identification applied, date)
- Export configuration managed by data stewardship team; role-restricted

### 30.7 Clinical Trial Management System Integration

- **DMS for QM documents:** SOPs, working instructions, training certificates, and delegation logs stored and managed within the EHR's document management module or via interface to a dedicated QMS
- **eTMF:** Electronic Trial Master File functionality either native or via certified interface to an eTMF system (e.g. Veeva Vault, Florence eBinders)
- **Source Data Verification (SDV):** Monitor-role access (read-only, scoped to enrolled patients and study visits) enables remote SDV; query raised by monitor creates a task for the responsible investigator; query/response chain documented
- **Clinical supply management:** Study medication ordering, logistics, and accountability integrated (§30.5)
- **Link to contract management:** Study activation linked to signed contract and budget in the financial module

### 30.8 Research Orders and Results Visibility Control

- Laboratory and procedure orders can be assigned to a specific study; billing is routed to the study cost centre rather than the patient's insurance
- Results flagged as study results are tagged "non-clinical-grade" and excluded from the patient's routine clinical result view (configurable)
- Visibility rules: study results are visible only to users with the appropriate study role and valid consent on file; patients do not see study-specific results unless explicitly enabled per consent and study protocol
- Results needed for safety monitoring (AE/SAE surveillance) are always visible to the responsible study physician regardless of general visibility rules

### 30.9 Sample Management

- **Full lifecycle tracking:** From consent → order → collection → transport → processing → fixation → interim storage → archiving; metadata per SPREC 3.0 standard at each step
- **Policy automation:** Sample collection orders permitted only when consent is active and patient is enrolled; plausibility checks from visit plan
- **Scan-and-timestamp workflow:** Each lifecycle milestone (collection, handoff to courier, receipt at lab, processing start, freezing) captured by barcode/QR scan with automatic timestamp; one-click confirmation for routine steps
- **Transport alert:** If sample does not arrive at the laboratory within the expected transit window, an alert is sent to the ordering investigator
- **Processing protocols:** Study-specific sample processing SOPs available at the laboratory workstation; deviation documentation with governance workflow (discard justification, protocol deviation reporting)
- **LIMS/BIMS integration:** Bidirectional interface with the laboratory information management system; sample availability status visible on the patient's research record within the EHR

### 30.10 Simulations, Training, and Digital Twins

- **Parallel training environment:** A sandboxed instance with configurable data visibility; trainers can define which anonymised or synthetic patient datasets are available
- **Role-specific training scenarios:** Configurable for physicians, nurses, pharmacists, administrative staff; guided walkthroughs and free-practice modes
- **Case assembly tool:** Trainers compose teaching cases by selecting anonymised real cases or building synthetic cases from templates; cases annotated with learning objectives
- **Digital twins:** Synthetic patient models generated from statistical distributions of real patient populations; used for simulation of clinical decisions (e.g. prescribing, order entry, triage) without real patient risk; vital-sign and lab-value time series generated dynamically in response to simulated interventions

### 30.11 eSRA (Investigator Site eSource Readiness Assessment)

The system is assessed against the eSRA Version 2024 questionnaire (as per appendix B07). Key compliance areas:

| eSRA Domain | System capability |
|---|---|
| Electronic source data capture | Structured data entry for all study data points; timestamp and user attribution at point of entry |
| Audit trail | Immutable, 21 CFR Part 11-compliant audit trail for all study-related records |
| System validation | IQ/OQ/PQ documentation maintained; change control process documented |
| Access control | Role-based access per study; user identity verified; session logs maintained |
| Data integrity | Checksums on exported data; no silent edits — all changes versioned |
| Remote SDV support | Monitor read-access with query functionality (§30.7) |
| Regulatory compliance | GDPR / nFADP compliant; data residency configurable |

A formal eSRA self-assessment report can be generated from the system's audit and validation documentation for submission to sponsors on request.

## 31. Radiology and Imaging (RIS/PACS)

*This chapter is planned but not yet written.*

---

## 32. Laboratory Information System (LIS)

*This chapter is planned but not yet written.*

---

## 33. Pathology

*This chapter is planned but not yet written.*

---

## 34. Endoscopy

*This chapter is planned but not yet written.*

---

## 35. Infection Control and Antimicrobial Stewardship

*This chapter is planned but not yet written.*

---

---

# Part V — Digital Platform

---

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


## 37. External Portals and Referrer Integration

Three external-facing portals serve distinct user populations with distinct authorization scopes. All three share the same scheduling, clinical record, and notification backend; they differ in what data is visible, what actions are permitted, and what identity mechanism is required.

| Portal | Primary users | Core capability |
|---|---|---|
| **Referrer Portal** | GPs, specialists, outpatient clinics | Appointment booking, referral submission, report access |
| **Orders Portal** | External labs, pathology requestors, imaging requestors | Order submission, result retrieval, billing |
| **Direct Contact / CRM** | Hospital booking coordinators (internal) | Telephony-assisted intake, referrer master data, manual referral processing |

The patient portal is covered in §51.6.

---

### 37.1 Referrer Portal

#### Structure and Navigation

The portal is organised by clinical intent, not by internal department structure. A referring physician navigating to "book an appointment for a patient with chest pain" should reach the correct cardiology booking flow in three interactions or fewer — without knowing how the hospital organises its departments.

Navigation paths:
- Book an appointment → specialty selector → appointment type → availability → confirm
- Check a referred patient's status → patient search (own referred patients only) → timeline view
- Retrieve a report → patient search → document list → download or view
- Submit a referral → referral form (pre-populated from PIS where integrated)

#### Accessible Resources

| Resource | Access | Release mechanism |
|---|---|---|
| Appointment availability | Always available to authenticated referrers | Slots released by booking coordinators (see §51.6) |
| Referred patient data | Scoped to own referred patients only | Active referral relationship required |
| Clinical reports and letters | Per-patient, per-document | Explicit release by responsible clinician |
| Imaging reports | Per-patient | Clinician release; images require additional authorisation |
| Referral status | Always — own referrals only | Real-time |

#### Portal Configuration

Configurable by clinical and administrative staff without developer involvement:
- Clinic-specific landing pages and content
- Which appointment types are bookable externally and at what trust level
- Which document types are auto-released vs require manual release
- Referrer group definitions and their access scope

#### Data Visibility Control

Visibility is governed by three independent rules evaluated in order:
1. **Patient consent** — patient may restrict access to specific data categories
2. **Referral relationship** — referrer can only see data for patients they have actively referred
3. **Institution release policy** — per data type (auto-release, manual release, restricted)

All three rules must permit access; any restriction in any rule blocks access. The rules are configurable without code changes.

#### Booking Access and Trust Levels

```
Unverified referrer        → Request only; institution confirms every booking
HIN-authenticated referrer → Direct booking within designated external slots
Trusted partner            → Direct booking across broader slot pool
Emergency (EMS / Rega)     → Immediate booking; pre-arrival protocol triggered
```

Trust level is assigned per referring physician or per organisation. Changes take effect immediately. All booking actions are logged with the referrer's identity and trust level at time of booking.

#### Referrer–Patient Interaction

The referrer portal and patient app share a common backbone for appointments and secure messaging:
- A referring physician can initiate an appointment request that the patient confirms in the patient app
- Secure messaging between referrer and patient is mediated by the institution — direct unmediated contact is not provided
- A patient may share selected data from the patient app with their referring physician, subject to consent settings

#### Authentication — HIN and Identity Providers

| Method | Use case |
|---|---|
| **HIN identity** | Primary Swiss referrer authentication; automatic trust-level elevation |
| **Swiss eID** | Alternative for referring physicians without HIN |
| **SMART on FHIR / OIDC** | PIS-integrated access (system-to-system or delegated) |
| **SAML 2.0** | Institutional federation (hospital networks, cantonal health authorities) |

HIN-authenticated referrers receive a verified trust level automatically. The system supports HIN's EPD-IDP authentication profile for EPD-connected workflows. HIN Connect is used for encrypted document exchange where required.

#### Barriers to Adoption

| Barrier | Countermeasure |
|---|---|
| Additional login on top of PIS | SSO via HIN; PIS deep integration eliminates separate login |
| Portal is slower than calling | Core booking flow ≤ 3 interactions; faster for common tasks by design |
| Uncertain which data USZ can see | Explicit display of data visible to the institution |
| No feedback after referral | Real-time push: referral received → appointment confirmed → report available |
| Low IT literacy in small practices | Mobile-first design; no training required for core workflows |

---

### 37.2 Orders Portal (Pathology, Radiology, Laboratory)

External organisations submit diagnostic orders and retrieve results through the orders portal. The portal is functionally distinct from the referrer portal: it serves organisations (not individual physicians as primary users) and handles order workflows, not care coordination.

#### Order Submission

Orders are submitted digitally via the portal or via PIS integration (see §36). Physical post is supported as a documented fallback with a manual intake workflow. Each submitted order includes:
- Patient demographics and insurance information
- Clinical indication and relevant history
- Order type and any special instructions
- Accompanying samples, documents, or prior imaging

On submission, the system:
- Matches the patient against the MPI (AHV-Nummer / NAVS13 as primary identifier)
- Routes the order to the correct internal department (LIS, RIS, or pathology) via KIS
- Returns an order confirmation number to the submitter

#### Automatic Patient Data Import

On patient match, clinical data relevant to the order type is surfaced to the reporting clinician without re-entry. Follow-up orders (additional staining, confirmatory assay) can be triggered directly from the result screen and are automatically linked to the originating order.

#### Guidance for Requestors

At order submission, the portal provides:
- Sample collection instructions specific to the ordered test
- Checklist of required accompanying documentation
- Warnings if the patient's accessible clinical data indicates a contraindication or special handling requirement

#### Second Opinion Support

For patients referred for a second opinion:
- Prior imaging, pathology slides, and reports are uploaded at referral time
- The reporting clinician sees prior findings alongside the new assessment in a structured comparison view
- The new report can annotate and reference the prior findings

#### Cumulative Findings

Cumulative findings reports aggregate results from multiple sources — internal historical results (LIS, RIS), results transmitted by the referring organisation, and results from previous episodes. These are available as structured views and as exportable documents.

#### KIS — LIS — RIS — Billing Integration

Orders flow without manual re-entry:

```
Portal / PIS (order entry)
  → KIS (clinical context and order management)
  → LIS (laboratory) or RIS/PACS (radiology) or Pathology system
  → Result returned to KIS → updates order status
  → Billing event triggered in SAP
```

No field is entered twice. Each system is authoritative for its own domain; integration is event-driven.

#### Billing for External Orders

| Order type | Billing target |
|---|---|
| Patient-linked order, insured patient | Patient's insurer (standard TARMED/SwissDRG flow) |
| Patient-linked order, self-paying | Patient invoice |
| Order without patient reference (research, environmental) | Direct invoice to the submitting organisation |

Billing rules per order type are configurable without code changes.

---

### 37.3 Direct Contact — Referrer CRM and Telephony Integration

Despite digital channels, direct telephone contact from referring physicians remains common. Staff handling these calls are supported by the system so that every incoming referral is captured correctly with minimum manual effort.

#### Referrer Master Data (CRM)

A referrer register is maintained as a first-class domain within the system:
- Individual physicians and their practice affiliations
- Specialty, language preference, and preferred communication channel
- Trust level and booking permissions (shared with the referrer portal)
- Active referrals and patients currently in the institution linked to this referrer
- Full contact log: calls, portal activity, messages — chronological and searchable

The register is the single source of truth for all referrer interactions. It is updated from portal activity, PIS integrations, and manual entries.

#### Telephony Integration (CTI)

```
Incoming call
  → Number matched against referrer register
  → On match: referrer context opens automatically
      — referrer profile
      — their active referrals
      — their patients currently in the institution
  → On no match: new referrer entry pre-populated from number lookup
                 staff completes and confirms
  → Call logged in referrer's contact history (timestamp, staff member)
```

The telephony integration is a CTI (Computer Telephony Integration) connection to the hospital PBX. It does not require staff to search manually — the correct context is open before they speak.

#### Scheduling During Direct Contact

From the open referrer context, the booking coordinator can:
- Access appointment availability without navigating away
- Create a referral record and book the appointment in a single workflow
- Send the confirmation to the referrer by their preferred channel (portal notification, HIN mail, SMS) without leaving the current screen

#### Manual Referral — Document Intake and Structured Import

Referrals arriving by fax, post, or email:
1. Document scanned or uploaded and attached to the referral record
2. AI extraction (see §27) pre-populates structured fields from the document
3. Staff reviews and confirms extracted data — no re-keying
4. Confirmed data immediately available in the patient record

High-confidence extractions can be confirmed by administrative staff. Low-confidence or clinically complex extractions are routed to a designated clinical reviewer.

---



Practice Information Systems (PIS) used by referring physicians can integrate directly with the hospital system. The goal is that the referring physician never needs to leave their familiar PIS environment for common tasks.

### 37.4 Standard Interface

The integration is based on **HL7 FHIR R4** as the canonical interface standard. The hospital exposes a FHIR endpoint; the PIS connects to it. Where a PIS does not support FHIR natively, an adapter translates to/from common Swiss PIS formats.

### 37.5 Bidirectional Data Exchange

| Exchange | Direction | FHIR resource |
|---|---|---|
| Appointment request / booking | PIS → hospital | `Appointment`, `Schedule`, `Slot` |
| Appointment confirmation / cancellation | Hospital → PIS | `Appointment` status update |
| Patient demographics | Bidirectional | `Patient`; AHV-Nummer as primary identifier |
| Referral (clinical indication, diagnoses) | PIS → hospital | `ServiceRequest`, `Condition` |
| Documents and images | PIS → hospital | `DocumentReference`, DICOM via IHE MHD |
| Reports and letters | Hospital → PIS | `DocumentReference`, `DiagnosticReport` |
| Lab and radiology results | Hospital → PIS | `DiagnosticReport`, `Observation` |
| Order status updates | Hospital → PIS | `ServiceRequest` status |

All exchanges are event-driven: the hospital system pushes status changes to the PIS via FHIR subscriptions (R4 topic-based subscription or webhook).

### 37.6 Swiss PIS Integrations

Documented integrations (Switzerland only) — to be completed by implementation team. Integration candidates include systems conformant with the Swiss EPD FHIR profiles and HIN Connect transport.

### 37.7 Authentication

| Mechanism | Use |
|---|---|
| **HIN Connect / HIN API** | Organisation-level trust anchor; practice as a trusted entity |
| **OAuth 2.0 client credentials** | System-to-system (non-interactive) flows |
| **HIN EPD-IDP** | EPD-connected document exchange requiring EPD authentication |

A PIS authenticating via HIN automatically inherits the trust level of the practice, which maps to the referrer portal trust model (§37.1). No separate credential management is required.

---


## 38. Swiss EPD Integration

The Swiss EPD layer is a **façade** — it does not pollute the internal data model.

```
Internal clinical store
  → Composition stored
  → FHIR resource generated on demand (or on trigger)
  → Submitted to EPD community XDS.b repository
  → IHE ATNA audit record written

Patient identity
  → Internal patient_id
  → EPD MPI lookup via PIX query → EPD patient identity
  → AHV-Nummer / NAVS13 as national root identifier

Document sharing
  → XDS.b metadata: class code, type code, confidentiality, language
  → Swiss CH EPD FHIR profile compliance
  → MHD for mobile access
```

The FHIR conversion is a mapping layer — internal compositions are projected to FHIR resources using registered archetype → FHIR mappings. The internal model is not constrained to FHIR's resource granularity.

---


## 39. Privacy, Data Protection, and Security

*This chapter is planned but not yet written.*

---

## 40. System Administration and Audit

*This chapter is planned but not yet written.*

---

## 41. Disaster Recovery and Business Continuity

*This chapter is planned but not yet written.*

---

## 42. Interoperability Architecture

*This chapter is planned but not yet written.*

---

---

# Part VI — Technical Architecture

---

## 43. Data Architecture Philosophy

### 43.1 Data Model First

The system's defining architectural principle: **the data model is the source of truth for structure and meaning**. UI forms, reports, and API responses are derived from the data model. No bespoke form code exists that is not grounded in a formal data definition.

This eliminates a class of common EHR failure: forms that diverge from the underlying model, or data that cannot be queried because it was captured in an ad-hoc string field.

### 43.2 Two-Level Modelling (openEHR Influence)

Clinical knowledge is separated into two levels:

| Level | What it defines | Who controls it | Stability |
|---|---|---|---|
| **Reference Model (RM)** | Generic structures — Composition, Observation, Element, data types | International standard | Stable for years |
| **Archetypes / Schemas** | Clinical knowledge — what data a blood pressure observation must contain | Clinical informaticians | Evolves with practice |

Software only needs to understand the Reference Model. New clinical concepts add archetypes; no software change is required.

### 43.3 Hierarchical Nature of Clinical Data

Clinical data is inherently hierarchical:

```
Patient
  └── Episodes (admission, outpatient, etc.)
        └── Encounters / Compositions
              ├── Observations (vitals, test results)
              ├── Instructions (orders, prescriptions)
              ├── Actions (administered medications, procedures)
              └── Evaluations (diagnoses, care plans)
```

This shape maps poorly to flat relational tables. Forcing it into rows and columns requires many joins to reconstruct a single encounter and introduces impedance mismatch between the clinical model and the storage model.

### 43.4 Data Integration and Continuity

Data integration and continuity across all sources and all contexts is a first-class architectural principle, not an integration afterthought.

**Single entry, universal availability.** Data entered once is available across all clinical contexts immediately — inpatient, outpatient, mobile, and external portals. Demographic data entered at registration is never re-collected. Anamnesis recorded at a first visit is accessible in all subsequent encounters; it is not re-collected unless clinically indicated and the new collection is explicitly linked to the prior record.

**Structured intake of external data.** Referral data and prior investigation results from external sources are stored in structured form. Documents (PDF, DICOM) are stored with rich metadata and indexed for retrieval by type, date, source, and clinical category. OCR and AI extraction produce a structured shadow record alongside every received document (see §27). Unstructured content is never the only representation of clinical data.

**Unified timeline.** Every clinical record — internal and external, structured and document — appears on a single chronological patient timeline. A clinician opens one view and sees the complete history without navigating between separate archives or systems.

**Full data transparency and access control.** Role-based access is enforced at the data layer, not the UI layer. Every access to a patient record is logged with user identity, timestamp, and data accessed. Patients can inspect their own access log. Emergency override (break-the-glass) is possible for any authorised clinician, requires an explicit justification, generates a permanent audit entry, and optionally notifies the patient.

**Data continuity across episode boundaries.** Long-term conditions, medications, allergies, and advance directives are patient-scoped (not episode-scoped) and are always current and accessible regardless of which episode is active. Episode-scoped data is always traceable back to the episode that produced it (see §53).

---


## 44. Data Model

### 44.1 Bounded Contexts

Each domain is a bounded context: it owns its schema, its service layer, its projections. Domains communicate through events and shared identifiers — never through cross-domain table joins.

```
┌─────────────────────────────────────────────────────┐
│                   Shared Kernel                     │
│   patient_id · episode_id · user_id · event_log     │
└─────────────────────────────────────────────────────┘
        │              │              │
┌───────────┐  ┌───────────────┐  ┌──────────────┐
│ Clinical  │  │  Scheduling   │  │   Billing    │
│ Records   │  │  & Resources  │  │   & Cost     │
└───────────┘  └───────────────┘  └──────────────┘
        │              │              │
┌───────────┐  ┌───────────────┐  ┌──────────────┐
│  Patient  │  │   Rostering   │  │  Insurance   │
│  Admin    │  │   & Shifts    │  │  & Claims    │
└───────────┘  └───────────────┘  └──────────────┘
```

### 44.2 Clinical Record Store

```sql
-- Append-only composition store — document model
-- One row per clinical record unit (vital signs, medication order, etc.)
CREATE TABLE compositions (
  id             UUID PRIMARY KEY,
  ehr_id         UUID NOT NULL,
  episode_id     UUID NOT NULL,
  archetype_id   TEXT NOT NULL,       -- e.g. 'vital_signs.v3'
  recorded_at    TIMESTAMPTZ NOT NULL,
  recorded_by    UUID NOT NULL,
  content        JSONB NOT NULL       -- full composition, hierarchical, sparse
);

-- B-tree indexes only — no GIN on content (see §44.7)
CREATE INDEX ON compositions (episode_id);
CREATE INDEX ON compositions (ehr_id, recorded_at DESC);
CREATE INDEX ON compositions (archetype_id, recorded_at DESC);

-- Projection: latest values per patient — always current, never computed on read
CREATE TABLE latest_vitals (
  ehr_id      UUID PRIMARY KEY,
  heart_rate  INT,
  bp_systolic INT,
  bp_diastolic INT,
  temperature NUMERIC,
  spo2        INT,
  updated_at  TIMESTAMPTZ
);
```

Compositions are **immutable and append-only** — corrections create new compositions with a reference to the superseded one. This gives audit for free and makes undo trivial.

Projections are updated asynchronously via the event stream. Operational reads always hit projections, never raw compositions. This is the MUMPS access pattern translated to PostgreSQL.

### 44.3 Resource Domain

```sql
CREATE TABLE resources (
  id            UUID PRIMARY KEY,
  resource_type TEXT NOT NULL,   -- 'person','team','location','device','consumable'
  display_name  TEXT NOT NULL,
  active        BOOLEAN DEFAULT true,
  attributes    JSONB            -- stable, rarely-written extension metadata only
                                 -- never store high-churn fields here (see §44.7)
);

-- Typed subtables per resource kind
CREATE TABLE resource_persons (
  resource_id    UUID PRIMARY KEY REFERENCES resources,
  staff_role     TEXT,
  qualifications TEXT[],
  fte            NUMERIC
);

CREATE TABLE resource_locations (
  resource_id   UUID PRIMARY KEY REFERENCES resources,
  parent_id     UUID REFERENCES resource_locations,  -- tree: site→ward→room→bed
  location_type TEXT,
  capacity      INT
);

CREATE TABLE resource_devices (
  resource_id      UUID PRIMARY KEY REFERENCES resources,
  device_type      TEXT,
  serial_number    TEXT,
  capabilities     TEXT[],
  next_maintenance TIMESTAMPTZ
);

-- Extensibility: namespaced per-resource extension fields
CREATE TABLE resource_extensions (
  resource_id UUID NOT NULL REFERENCES resources,
  namespace   TEXT NOT NULL,   -- e.g. 'ch.spital-bern.wound-care'
  key         TEXT NOT NULL,
  value       JSONB NOT NULL,
  PRIMARY KEY (resource_id, namespace, key)
);
```

### 44.4 Scheduling Domain

```sql
CREATE TABLE slots (
  id            UUID PRIMARY KEY,
  resource_id   UUID NOT NULL REFERENCES resources,
  start_time    TIMESTAMPTZ NOT NULL,
  end_time      TIMESTAMPTZ NOT NULL,
  slot_type     TEXT NOT NULL,   -- 'appointment','block','maintenance','on_call'
  episode_id    UUID,            -- nullable: link to clinical domain
  booked_by     UUID,
  status        TEXT NOT NULL,   -- 'available','booked','blocked','completed'
  -- Database-enforced no double-booking:
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  )
);

CREATE TABLE rosters (
  id          UUID PRIMARY KEY,
  staff_id    UUID NOT NULL REFERENCES resources,
  team_id     UUID REFERENCES resources,
  shift_start TIMESTAMPTZ NOT NULL,
  shift_end   TIMESTAMPTZ NOT NULL,
  role        TEXT
);
```

The `EXCLUDE USING gist` constraint enforces no double-booking at the database level — this invariant cannot be violated regardless of application logic.

### 44.5 Billing & Cost Domain

```sql
CREATE TABLE tariff_codes (
  id          UUID PRIMARY KEY,
  system      TEXT NOT NULL,   -- 'TARMED','SwissDRG','TARDOC'
  code        TEXT NOT NULL,
  description TEXT,
  valid_from  DATE,
  valid_to    DATE
);

CREATE TABLE cost_centers (
  id        UUID PRIMARY KEY,
  name      TEXT NOT NULL,
  parent_id UUID REFERENCES cost_centers   -- tree
);

CREATE TABLE invoices (
  id         UUID PRIMARY KEY,
  patient_id UUID NOT NULL,
  episode_id UUID NOT NULL,
  issued_at  TIMESTAMPTZ,
  status     TEXT,            -- 'draft','submitted','paid','rejected'
  insurer_id UUID
);

CREATE TABLE invoice_items (
  id             UUID PRIMARY KEY,
  invoice_id     UUID NOT NULL REFERENCES invoices,
  tariff_code_id UUID REFERENCES tariff_codes,
  quantity       NUMERIC,
  unit_price     NUMERIC,
  cost_center_id UUID REFERENCES cost_centers,
  source_type    TEXT,    -- 'composition','slot','device_use' — polymorphic ref
  source_id      UUID
);
```

`source_type` / `source_id` traces every charge back to the clinical or resource event that generated it. Billing derives from clinical and resource data without importing their schemas.

### 44.6 PostgreSQL Schema Layout

```
One PostgreSQL cluster, multiple schemas:

  shared.*        patient_id master, user_id master, event_log
  clinical.*      compositions, projections, archetype registry
  scheduling.*    slots, rosters
  resources.*     resource registry, subtables, extensions
  billing.*       invoices, tariff codes, cost centres
  patient_admin.* demographics, episodes, insurance
  audit.*         append-only, partitioned by month
```

One schema per bounded context. Cross-domain foreign keys only via `shared.*` identifiers.

### 44.7 PostgreSQL JSONB — Limitations and Mitigations

PostgreSQL JSONB is a deliberate choice for clinical content storage, but it carries three specific failure modes that must be designed against explicitly.

#### A. High-churn fields inside JSONB blobs

Every UPDATE to a row rewrites the entire JSONB value (PostgreSQL MVCC). A status transition, a counter increment, or a flag change inside a JSONB blob costs a full blob rewrite and leaves a dead row until VACUUM runs. On high-volume tables this creates write amplification and bloat.

**Mitigation — the append-only contract.**

Clinical compositions are never updated after insertion. A correction is a new composition that references the superseded one. There are no UPDATE statements on the `compositions` table outside of administrative correction workflows. JSONB rewrite cost on `compositions` is therefore zero in normal operation.

For all other tables (`resources`, `episodes`, `slots`, `tasks`, `pathway_step_instances`): **high-churn fields — status, counters, timestamps of state transitions — are typed columns, never inside JSONB.** The `attributes JSONB` column on `resources` holds stable, rarely-written extension metadata. If a field is written more than a few times per day per row, it must be a typed column on a normalised row.

#### B. TOAST and large out-of-line blobs

PostgreSQL moves column values out-of-line once a row exceeds approximately 8 KB (TOAST threshold). Out-of-line values require a separate heap fetch on read and a chunk rewrite on update. For append-only data this is a read overhead; for mutable JSONB it is a write cliff.

**Mitigation — archetype discipline and projection typing.**

Well-designed archetypes model one focused clinical concept. A vital signs composition should contain only vital signs; an anaesthetics induction record only its fields. In practice a disciplined composition remains well under the TOAST threshold. A composition that approaches or exceeds it is a symptom of an archetype that is doing too much.

Projection tables are typed-column tables — never JSONB summaries. A "current medications" projection is not a JSONB array growing with each new medication order; it is a set of rows with typed columns indexed independently. Projections carry no TOAST risk.

If a specific archetype is known to produce large compositions (e.g., a full ICU daily round), the storage strategy for that table can be adjusted:

```sql
ALTER TABLE compositions ALTER COLUMN content SET STORAGE EXTERNAL;
-- EXTERNAL: stored out-of-line uncompressed.
-- Avoids compression round-trip on the occasional large read.
-- Acceptable for append-only data where update cost is irrelevant.
```

#### C. GIN index write cost

A GIN index on a JSONB column inverts every key-value pair in every document. An INSERT to a composition with 40 fields generates 40+ GIN index entries. Under sustained ward load this adds measurable per-write overhead, creates index bloat, and makes VACUUM work harder.

**Mitigation — no GIN on the composition content column.**

```sql
-- Correct: B-tree indexes on structured columns only
CREATE INDEX ON compositions (episode_id);
CREATE INDEX ON compositions (ehr_id, recorded_at DESC);
CREATE INDEX ON compositions (archetype_id, recorded_at DESC);

-- Never:
-- CREATE INDEX ON compositions USING GIN (content);
```

Queries against clinical content go through typed-column projection tables, not through GIN scans of the composition store. The composition table is write-optimised; the projection tables are read-optimised. These are different tables with different index strategies.

GIN indexes may be justified on `resource_extensions` (key lookup by namespace + key) or on specific small lookup tables where containment queries are genuinely needed — but only when a specific query requirement has been identified, never pre-emptively.

#### Summary

| Concern | Root cause | Mitigation |
|---|---|---|
| JSONB rewrite on churn | MVCC rewrites full blob on UPDATE | Compositions are append-only; status fields are typed columns |
| TOAST on large blobs | Out-of-line storage triggers on large rows | Archetype discipline keeps compositions small; projections use typed columns |
| GIN write cost | GIN indexes every key on every INSERT | No GIN on composition content; queries routed through projection tables |

The append-only property of clinical compositions is architecturally load-bearing. It is what makes PostgreSQL JSONB viable for the clinical record under sustained write load.

---


## 45. Archetype System

### 45.1 What an Archetype Is

An archetype is a formal, versioned definition of a clinical concept — what data a "blood pressure observation" must contain, what data types are used, what units are valid, what terminology codes apply.

Archetypes are stored as JSON Schema (derived from the international openEHR Archetype Definition Language / ADL format):

```json
{
  "archetype_id": "openEHR-EHR-OBSERVATION.blood_pressure.v2",
  "description": "Blood pressure measurement",
  "items": {
    "/data/events/data/items[at0004]/value": {
      "rm_type": "DV_QUANTITY",
      "units": ["mmHg"],
      "range": { "min": 0, "max": 300 }
    },
    "/data/events/data/items[at0005]/value": {
      "rm_type": "DV_QUANTITY",
      "units": ["mmHg"],
      "range": { "min": 0, "max": 200 }
    }
  }
}
```

### 45.2 Archetype Registry

Archetypes are loaded and cached at application startup. No archetype is parsed per request.

```python
class ArchetypeRegistry:
    _cache: dict[str, ArchetypeSchema] = {}

    @classmethod
    def load(cls, path: Path) -> None:
        for f in path.glob("*.json"):
            schema = ArchetypeSchema.model_validate_json(f.read_text())
            cls._cache[schema.archetype_id] = schema

    @classmethod
    def validate(cls, archetype_id: str, content: dict) -> None:
        schema = cls._cache.get(archetype_id)
        if not schema:
            raise UnknownArchetypeError(archetype_id)
        schema.validate(content)   # raises ValidationError if invalid
```

### 45.3 Form Generation

Forms are derived from archetypes via FHIR Questionnaire descriptors — one per archetype. The frontend form engine takes a Questionnaire JSON and renders the form without any form-specific code.

```typescript
// Any clinical form, no bespoke component:
function ClinicalForm({ archetypeId }: { archetypeId: string }) {
  const { data: questionnaire } = useQuery(
    ["questionnaire", archetypeId],
    () => fetchQuestionnaire(archetypeId)
  );
  if (!questionnaire) return <Spinner />;
  return <FormEngine items={questionnaire.item} />;
}
```

Adding a new clinical concept: add an archetype JSON + a Questionnaire JSON. No code change.

---


## 46. Multi-Granularity and Multi-Perspective Clinical Data

### 46.1 The Problem

Archetypes define structure and enforce validity, but they do not by themselves solve a deeper problem: the same clinical concept must be captured at different levels of detail in different contexts, and different specialties interpret the same data differently.

**The smoking example** illustrates all three layers of this problem:

| Context | What is needed |
|---|---|
| ED triage | Smoker: yes / no / ex |
| GP chronic disease review | Current status + pack-years |
| Anaesthetics pre-assessment | Pack-years + how long smoke-free |
| Oncology intake | Full lifetime history: types, amounts, quit dates, cessation attempts |

The data captured in one context must be usable in all others — but the system cannot demand oncology-level detail from a triage nurse.

### 46.2 Archetype Specialisation

openEHR's formal answer is **archetype specialisation**: a specialised archetype is a valid instance of its parent. Software that understands the parent can read any specialisation of it.

```
tobacco_use.v1  (base)
  ├── status: current | ex | never
  └── [optional slot]
        └── tobacco_smoking_summary.v1  (specialised)
              ├── pack_years: DV_QUANTITY
              ├── episodes[]
              │     ├── start_date
              │     ├── end_date
              │     ├── tobacco_type: cigarette | pipe | cigar | vaping
              │     └── daily_amount: DV_QUANTITY
              └── cessation_attempts[]
```

**Templates compose archetypes per clinical context.** The triage template includes the base archetype only. The oncology template includes the full specialisation. Same underlying concept; different templates determine what is asked and what is stored.

### 46.3 Derivability Asymmetry

Specialisation handles structure. A further problem is that derivability is asymmetric:

- Full smoking history → current status: **always derivable** ✓
- "Smoker: yes" → pack-years: **not derivable** ✗

The system must know this asymmetry and communicate it to consumers. A **semantic mapping registry** records which fields can be derived from which archetypes and how:

```python
class ArchetypeSemanticMap:
    # Subsumption: which archetypes are specialisations of which
    subsumes = {
        "tobacco_smoking_summary.v1": ["tobacco_use.v1"],
    }

    # Derivation rules: how to derive a simpler field from a richer archetype
    derivations = {
        ("tobacco_use.v1", "status"): [
            DerivationRule(
                source_archetype="tobacco_smoking_summary.v1",
                source_path="/episodes[-1]/end_date",
                logic="if end_date is not null → 'ex', else 'current'"
            )
        ]
    }
```

When a consumer queries for `tobacco_use.v1/status` and only a `tobacco_smoking_summary.v1` composition exists, the query engine derives the answer automatically. When the reverse is requested and only simple data exists, the engine returns the data with a `completeness: false` flag — not a wrong answer, but an honest one.

### 46.4 Projections With Completeness Flags

Projection tables materialise multiple granularities from the same composition store, with explicit provenance:

```sql
CREATE TABLE smoking_summary (
  patient_id       UUID PRIMARY KEY,
  current_status   TEXT,          -- 'current','ex','never' — always available if any record exists
  pack_years       NUMERIC,       -- NULL if only simple capture available
  last_quit_date   DATE,          -- NULL if not recorded
  detail_available BOOLEAN,       -- false if only tobacco_use.v1 base captured
  last_updated     TIMESTAMPTZ,
  source_comp_id   UUID           -- which composition this was derived from
);
```

Consumers know whether the answer is fully grounded or partially derived and can act accordingly — flag "incomplete history" in an oncology workflow, accept it as sufficient for a GP summary.

### 46.5 Named Views Per Clinical Context

Different specialties need different projections of the same data. These are defined as **named view definitions** — data, not code. A new specialty view is a new JSON file, not a new component or query function.

```json
{
  "view_id": "anaesthetics.smoking_cessation",
  "label": "Smoking cessation status",
  "archetype_path": "tobacco_smoking_summary.v1/episodes",
  "derived_field": "most_recent_quit_date",
  "fallback": "tobacco_use.v1/status == 'ex'",
  "completeness_required": false
}
```

```json
{
  "view_id": "oncology.cumulative_tobacco_exposure",
  "label": "Cumulative tobacco exposure",
  "archetype_path": "tobacco_smoking_summary.v1/pack_years",
  "fallback": null,
  "completeness_required": true
}
```

The query engine selects the named view for the consumer's context, resolves derivations and subsumption, and returns a completeness flag alongside the data.

### 46.6 SNOMED CT Subsumption

When smoking status is coded — as it must be for interoperability — a further correctness problem appears. SNOMED CT encodes tobacco use as a hierarchy:

```
77176002  | Smoker |
  ├── 230059006  | Cigarette smoker |
  │     └── 56294008  | Heavy cigarette smoker |
  ├── 228501002  | Pipe smoker |
  └── 722496004  | Cigar smoker |
```

A query for "smoker" using flat code equality silently misses "heavy cigarette smoker." The query engine must resolve codes against a loaded SNOMED CT subsumption table before executing any coded-value query. This is not optional for clinical correctness.

```sql
-- Pre-computed subsumption closure (loaded from SNOMED CT release)
CREATE TABLE snomed_subsumption (
  ancestor_code TEXT NOT NULL,
  descendant_code TEXT NOT NULL,
  PRIMARY KEY (ancestor_code, descendant_code)
);

-- Query for all smokers — catches all subtypes
SELECT DISTINCT c.ehr_id
FROM compositions c
JOIN snomed_subsumption s
  ON s.ancestor_code = '77176002'
 AND c.content @> jsonb_build_object('status_code', s.descendant_code)
WHERE c.archetype_id IN ('tobacco_use.v1', 'tobacco_smoking_summary.v1');
```

### 46.7 Summary: What Archetypes Do and Do Not Solve

| Problem | Solution |
|---|---|
| Structure and validation of clinical data | Archetype definition + validator |
| Same concept at different granularities | Archetype specialisation + templates per context |
| Deriving simple answers from detailed data | Semantic mapping registry with derivation rules |
| Different perspectives on the same data | Named view definitions (data, not code) |
| Communicating incomplete data honestly | Completeness flags on projections |
| Coded value queries matching subtypes | SNOMED CT subsumption table in query engine |

---


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


## 49. Technology Stack

### 49.1 Backend — Python

```
FastAPI (async)
  ├── Granian (ASGI server — higher throughput than Uvicorn for sustained load)
  ├── asyncpg (direct PostgreSQL driver — bypasses ORM for hot paths)
  ├── Pydantic v2 (Rust-core validation — fast enough for request-path use)
  ├── Redis (caching, pub/sub, session state)
  └── ARQ / Celery (background tasks — report generation, notifications, projections)
```

### 49.2 Frontend — TypeScript / React

```
React 19
  ├── TanStack Query (server state, cache, background refetch)
  ├── TanStack Router (type-safe, code-split routing)
  ├── TanStack Virtual (virtualised lists — large ward/result grids)
  ├── Zustand (local UI state — lightweight)
  └── Vite (build, code splitting by domain)
```

### 49.3 Database

```
PostgreSQL (primary)
  ├── Clinical compositions    — JSONB document store
  ├── Projection tables        — materialised, typed, fast reads
  ├── Resource / scheduling    — relational with gist exclusion constraints
  ├── Billing                  — relational
  └── Audit log                — append-only, partitioned by month

ClickHouse or DuckDB (analytical)
  — Fed by event stream from PostgreSQL
  — Population health, reporting, billing analytics
  — Never queried by operational code paths

Redis
  — Session state
  — Hot projections (latest vitals per patient)
  — Pub/sub for real-time ward updates
```

### 49.4 Performance-Critical Decisions

- **asyncpg directly** for high-frequency reads — SQLAlchemy ORM adds measurable overhead at scale
- **Archetype schemas cached in memory** at startup — never re-parsed per request
- **Projection tables always current** — updated by PostgreSQL `LISTEN/NOTIFY` event stream asynchronously; operational reads never hit raw compositions
- **Code splitting by domain** — a ward nurse never loads the pharmacy or billing bundle
- **WASM for client-side computation** — drug interaction checking, early warning scores, scheduling conflict detection run in-browser (Rust → WASM), reducing server round-trips and enabling offline use
- **Optimistic UI** for high-frequency actions — observations, medication administration records update immediately; reconciled in background
- **Offline-first for ward devices** — Service Worker + IndexedDB; sync on reconnect

---


## 50. The MUMPS Lesson — Epic Systems

### 50.1 What Epic Uses

Epic Systems — the dominant EHR in the US — is built on **MUMPS** (Massachusetts General Hospital Utility Multi-Programming System, 1966), implemented via InterSystems Caché / IRIS. This is a persistent, sparse, multidimensional hierarchical key-value store with a built-in programming language.

Data is stored in "globals":

```
^PATIENT(12345, "NAME")              = "Müller, Hans"
^PATIENT(12345, "DOB")               = "19650315"
^PATIENT(12345, "ENC", 1, "DATE")    = "20240115"
^PATIENT(12345, "ENC", 1, "DX", 1)  = "J18.9"
^PATIENT(12345, "ENC", 1, "DX", 2)  = "I10"
^PATIENT(12345, "ENC", 1, "MED", 1) = "Metformin 500mg"
^PATIENT(12345, "ENC", 2, "DATE")    = "20240220"
```

Access is by direct key traversal — no query planner, no JOIN, no ORM.

### 50.2 Why It Works

**Clinical data is naturally hierarchical.** MUMPS maps patient → episode → encounter → data directly. A relational schema requires 6+ joins to reconstruct an encounter; MUMPS traverses a known path in one operation.

**No schema migrations.** New fields are added by simply storing them. Sparse storage means old records without the new field incur no overhead. Epic has added fields for 45 years without ALTER TABLE.

**Predictable performance.** No query planner means no bad plan surprises. Access patterns are explicit in code; latency is consistent.

**Sparse data is free.** A psychiatric record and an oncology record look nothing alike. MUMPS stores exactly what exists — no NULLs, no polymorphic complexity.

### 50.3 The Costs

**Reporting requires a separate system.** Epic's **Clarity** (SQL Server / Oracle relational) is a full ETL copy used for all reporting and analytics. MUMPS cannot support ad-hoc queries efficiently. Two databases, an ETL pipeline, and lagged analytical data are the operational price.

**Proprietary and expensive.** InterSystems IRIS licensing is significant. The developer ecosystem is small.

**Interoperability is a façade.** Epic's FHIR API translates MUMPS globals into FHIR resources on demand — it is not natively FHIR.

### 50.4 Lessons for Greenfield Design

| MUMPS insight | How to apply |
|---|---|
| Hierarchical storage fits clinical data | Document/JSONB storage for compositions |
| Schema flexibility is operationally critical | JSONB + JSON Schema validation, not rigid columns |
| Explicit access paths outperform query planner | Explicit indexes per query path, not generic SQL |
| OLTP and OLAP must be separated | Operational store + analytical projections from day one |

---


## 51. Mobile Applications

### 51.1 Three Distinct Apps, One Backend

Mobile access is not a single application. Three distinct user populations have fundamentally different needs, different authorization scopes, and different security models:

| App | Users | Authorization | Primary data flow |
|---|---|---|---|
| **Clinician — Physician** | Attending physicians, consultants, on-call | Staff SMART on FHIR scopes | Read-heavy: results, trends, patient lists |
| **Clinician — Nurse** | Ward nurses, ICU nurses | Staff SMART on FHIR scopes | Write-heavy: observations, MAR, assessments |
| **Patient** | Patients, proxy carers | Patient SMART on FHIR scopes | Read: own record; Write: PROs, home monitoring |

All three connect to the same backend through the **FHIR façade** (§13), using SMART on FHIR for authentication and authorization. The FHIR layer acts as the mobile API — purpose-built for exactly this use case. Clinical staff apps may additionally call internal FastAPI endpoints for features not expressible in FHIR (scheduling, resource management).

### 51.2 Technology: React Native

React Native is the right choice for a team already working in React and TypeScript:

- Shared type definitions and FHIR client code between web and mobile
- Single codebase for iOS and Android
- Access to native device capabilities: camera, barcode scanner, biometrics, push notifications, background sync
- React Native's new architecture (JSI / Hermes) is fast enough for the display requirements of all three apps

The PDMS real-time strip chart (§24.9) is the only rendering component that requires a native module — React Native's `Canvas` via `@shopify/react-native-skia` is sufficient for that use case.

### 51.3 Shared Mobile Architecture

All three apps share the same foundation:

```
Authentication
  SMART on FHIR (OAuth 2.0 + OpenID Connect)
  Biometric unlock (Face ID / Touch ID) for session resume
  Certificate pinning for all API connections

Offline-first store
  WatermelonDB (SQLite-backed, React Native optimised)
  Read-heavy data pre-fetched and cached on login/patient selection
  Writes queued locally when offline; synced on reconnect
  Append-only clinical writes (observations, MAR) have no merge conflicts

Push notifications
  APNs (iOS) / FCM (Android) via backend notification service
  Critical alerts use iOS Critical Alert entitlement (bypasses silent mode)
  Notification payload contains patient_id and action type only — no clinical data in push payload (privacy)

Audit
  Every patient record access from mobile logged identically to web access
  Device identifier included in audit log entry
```

**Conflict resolution for offline writes** is straightforward because clinical records are append-only events. A nurse who recorded a medication administration offline and then syncs does not conflict with any other write — the administration is stamped with the time it occurred, not the time it synced. The only case requiring attention is duplicate detection: if a write is re-submitted after an uncertain network failure, idempotency keys prevent double-recording.

---

### 51.4 Physician App

The physician's primary need is fast access to information during ward rounds, on-call response, and consultant review. Data entry is secondary; most physicians prefer to dictate notes rather than type on a phone.

**Core screens:**

```
Patient list
  ├── My patients (primary team)
  ├── On-call list (all ward patients)
  └── Search by name / MRN / room

Patient overview
  ├── Header: name, age, admission date, primary diagnosis
  ├── Active alerts: critical values, NEWS2 deterioration, unacknowledged alarms
  ├── Recent vitals (sparklines — last 24 h per parameter)
  ├── Active medications (simplified — full list on demand)
  ├── Recent lab results (flagged abnormals highlighted)
  └── Active problem list

Results viewer
  ├── Lab trends (time series chart — touch to zoom, pinch)
  ├── Radiology reports
  └── Microbiology (sensitivities, pending cultures)

Notes
  ├── Dictation → server-side transcription → structured note
  ├── Review and sign transcribed note
  └── Read previous notes

Alerts inbox
  ├── Critical lab values (requires acknowledgement)
  ├── Clinical deterioration alerts (NEWS2 threshold breach)
  └── Escalations from nursing staff
```

**Dictation pipeline**: audio recorded on device → uploaded to transcription service (on-premise or cloud, depending on data residency requirements) → returned as draft note text → physician reviews and signs. The transcription is linked to the composition; the original audio is retained for medicolegal purposes.

**On-call specifics**: the on-call physician's app view shows all ward patients grouped by acuity, with the most deteriorating patients surfaced at the top. Alerts arrive as push notifications; tapping opens the patient directly to the relevant result or trend.

---

### 51.5 Nurse App

The nurse app is write-heavy and workflow-driven. Nurses work under time pressure with multiple simultaneous patients; every interaction must be minimal in steps.

**Core screens:**

```
Ward board
  ├── All assigned patients in one view
  ├── NEWS2 score per patient (colour-coded: green/amber/red)
  ├── Pending tasks highlighted (observations overdue, medications due)
  └── Alarm indicators

Medication administration (MAR)
  ├── Due medications listed with time window
  ├── Scan patient wristband barcode → confirms patient identity
  ├── Scan medication barcode → confirms drug, dose, route
  ├── Five-rights check: patient / drug / dose / route / time
  ├── Record administration (one tap after successful scan)
  └── Record omission with reason (refused, unavailable, etc.)

Observations entry
  ├── Vital signs: HR, BP, SpO2, temperature, RR, GCS
  ├── Fluid balance: intake and output entries
  ├── NEWS2 auto-calculated from entered values
  └── Escalation prompt if NEWS2 exceeds threshold

Patient handover
  ├── Structured handover using SBAR format (Situation, Background, Assessment, Recommendation)
  ├── Outstanding tasks for receiving nurse
  └── Pending results

Tasks
  ├── All outstanding nursing assessments for assigned patients
  ├── Sorted by due time
  └── Mark complete in place
```

**Barcode scanning for medication safety** is the most critical feature. The five-rights check (right patient, right drug, right dose, right route, right time) prevents administration errors. The scan confirms each right independently before recording — the system does not allow recording without a successful patient wristband scan and medication barcode scan. Overrides are possible (damaged barcode) but require an explicit reason, are logged, and are flagged for review.

**NEWS2 and escalation**: when a nurse enters observations that trigger a NEWS2 threshold, the app presents an escalation prompt immediately — not after the observation is saved, but as part of the entry flow. The escalation can be sent directly to the on-call physician from within the prompt, generating an alert in the physician app and logging the escalation event.

**Offline-first is non-negotiable** for the nurse app. Ward Wi-Fi in older hospital buildings is unreliable. Observations entered offline are stored locally and sync transparently. The nurse sees no difference in workflow — offline state is indicated by a status indicator only.

---

### 51.6 Patient App

The patient app is architecturally distinct from the clinical apps in three ways: it presents data for health literacy rather than clinical use; patients control their own data sharing (Swiss EPD consent management); and patients can contribute data into the record (home monitoring, symptom reporting).

**Core screens:**

```
Health summary
  ├── Active conditions (plain language descriptions)
  ├── Current medications (name, purpose, dose, when to take)
  ├── Allergies and adverse reactions
  └── Immunisation history

Appointments
  ├── Upcoming appointments (date, location, clinician)
  ├── Request new appointment
  ├── Reschedule or cancel
  └── Pre-appointment questionnaire (sent by clinic, completed here)

Results
  ├── Recent lab results
  │     — value + reference range shown graphically
  │     — plain language: "Your haemoglobin is slightly below normal"
  │     — not shown until clinician has reviewed and released (configurable)
  ├── Reports available (discharge summary, letters — PDF)
  └── Trend view (Hb over last 12 months)

Medications
  ├── Current medication list with instructions
  ├── Discharge medications with reconciliation notes
  └── Medication reminders (optional, local notifications)

Messages
  ├── Secure messaging with care team
  ├── Read receipts
  └── Attachment support (patient can send photos of wounds, rashes, etc.)

My data (patient-generated)
  ├── Blood pressure (manual entry or connected device)
  ├── Blood glucose (manual or CGM integration)
  ├── Weight
  ├── Symptom diary / PRO questionnaires
  └── All entries flow into the clinical record as patient-reported compositions

Documents
  ├── Discharge summaries
  ├── Referral letters
  ├── Imaging reports
  └── Download / share with another provider

EPD consent (Switzerland)
  ├── View which providers have accessed the EPD
  ├── Grant / revoke access per provider
  ├── Set access level (normal / restricted / emergency-only)
  └── Access log (who viewed what, when)
```

**Plain language presentation** is not cosmetic — it is a patient safety requirement. A raw lab value without context causes anxiety or false reassurance. Every result shown in the patient app includes: the value, the reference range for that patient's demographics, a colour indicator, and one sentence of plain-language context. The plain-language text is authored by clinicians per archetype/series type and stored in the series type registry alongside the clinical definition.

**Result release gating**: lab results are not shown in the patient app until a clinician has reviewed and released them. The release is a deliberate act, not an automatic delay. This is configurable per organisation and per result type — some organisations release routine results immediately; others require clinician review for all results.

**Patient-generated data** enters the clinical record as compositions with `recorder_type: patient`. They are stored in the same composition store with a distinct provenance marker. Clinicians see patient-reported data in the timeline alongside clinically recorded data, clearly distinguished. PRO (Patient Reported Outcome) questionnaires are modelled as FHIR Questionnaire / QuestionnaireResponse — the same form engine used for clinical forms.

**Proxy access**: a parent accessing a child's record, or an adult carer accessing an elderly patient's record, requires explicit consent from the patient (where capacity permits) or from a legal guardian. Proxy access is scoped — a carer may be granted access to appointments and medications but not to mental health or reproductive health records. This is enforced at the FHIR authorization layer, not in the app.

**Swiss EPD integration**: the patient app is the primary interface through which Swiss patients exercise their EPD rights — granting and revoking provider access, viewing the access log, and downloading their EPD documents. This requires the app to integrate with the EPD community's patient portal APIs (IHE MHD for document access, PPQM for consent management).

#### Appointment Booking in the Patient App and Web Portal

Appointment booking is available in both the mobile app and the web portal; both connect to the same scheduling backend.

**Booking modes**

Two modes coexist for different appointment types:

| Mode | When used | Patient experience |
|---|---|---|
| **Direct booking** | Follow-up visits, screening, vaccination, explicitly released slot types | Patient selects time, confirms immediately — no staff involvement |
| **Request mode** | Complex first appointments, referral-required specialties | Patient submits request with clinical indication; booking coordinator confirms and allocates |

**Slot release control**

Slots are closed to patient booking by default. The institution releases slots by:
- Appointment type (follow-up, annual check, procedure)
- Department or clinic
- Patient group (patients of a specific physician, patients on a named pathway)
- Insurance class — general, semi-private, private pools are managed independently

Slot release is a configuration action by booking coordinators, not a developer task.

**Post-booking process**

1. Immediate confirmation by push notification, in-app, and optionally email
2. Pre-appointment questionnaire delivered at a configurable interval before the visit (e.g., 7 days)
3. Reminders at 48 hours and 2 hours before
4. Patient may reschedule or cancel up to a configurable cut-off; cancellation returns the slot to the pool or waitlist immediately

**Waitlist**

Patients may join a waitlist for a specific appointment type or clinician. On cancellation:
- Waitlisted patients are notified by push notification in priority order (clinical urgency, then chronological)
- First confirmation takes the slot; others remain on the waitlist
- Patients can leave the waitlist at any time

**Pre-booking interaction**

Before booking, patients can:
- Navigate to the correct appointment type via a guided symptom-to-specialty question flow
- Use an AI assistant for booking guidance — routing and preparation only, not clinical advice
- Send a pre-booking message to the clinic's booking coordinator
- View preparation instructions for the appointment type

**Insurance class reservation**

Slot pools are partitioned by insurance class where required. A patient cannot inadvertently book a slot designated for a different insurance class. Partition ratios are configurable per clinic and per time period.

---

### 51.7 Notification Architecture

Push notifications cross all three apps but with different urgency tiers:

| Tier | Example | Delivery | Clinical app | Patient app |
|---|---|---|---|---|
| **Critical** | Critical lab value, cardiac arrest call | Immediate, bypasses silent mode | Physician + nurse | — |
| **Urgent** | NEWS2 deterioration, medication overdue | Immediate, normal priority | Physician + nurse | — |
| **Standard** | New result available, task assigned | Normal push | All clinical | Result released, message received |
| **Informational** | Appointment reminder, discharge summary available | Scheduled / batched | — | Patient |

**No clinical data in push payloads.** The notification payload contains only patient_id, notification type, and a reference ID. The app fetches the actual data after authentication. This prevents clinical information appearing on lock screens and in notification centres.

**Critical alert implementation (iOS)**: iOS Critical Alerts bypass the device's mute switch and Do Not Disturb settings. This requires an Apple entitlement that must be applied for and justified. It is appropriate for cardiac arrest calls and critical lab values directed at on-call physicians; it is not appropriate for standard clinical notifications.

---

### 51.8 Screen Layouts

The following layouts use a shared design language derived from the My-Ambili project:

| Token | Value |
|---|---|
| Page background | `#f2f7fd` (light blue-grey) |
| Card background | `#ffffff`, border `#d7e3f4`, radius `12px`, shadow `0 4px 14px rgba(12,42,90,0.08)` |
| Header / hero | gradient `#005ca9 → #0a79d1`, white text |
| Primary action | `#005ca9`, white text, radius `8px`, padding `0.55rem 0.85rem` |
| Alert red | text `#8b162f`, bg `#ffe8ed`, border `#ffc0cb` |
| Warning amber | `#d79a1c` / `#b36a08` |
| Success green | bg `#eaf9f0`, border `#93cfac` |
| Inactive / muted | `#9db9d8` |
| Typography | `"Segoe UI", system-ui, -apple-system`, labels 0.85rem uppercase, body 0.92rem |

---

#### 51.8.1 Nurse — Ward Overview (Primary Screen)

The ward overview is the nurse's home screen — the digital equivalent of the bedside whiteboard. It is always the entry point. Patient detail opens from it; the nurse returns to it after each interaction.

**Layout: two-panel (task queue left, ward board right)**

```
╔══════════════════════════════════════════════════════════════════════╗
║  gradient #005ca9→#0a79d1 (12px radius, white text)                 ║
║  Ward 3B  ·  Tagschicht  ·  08:42         [⚠ 2 Alerts]  K. Müller  ║
╠══════════════════╦═══════════════════════════════════════════════════╣
║                  ║                                                   ║
║  AUFGABEN        ║  BETTENBELEGUNG                                   ║
║  ─────────────   ║  ─────────────────────────────────────────────   ║
║  ÜBERFÄLLIG      ║                                                   ║
║  ■ 08:00  B3     ║  ┌──────────────────────────────────────────┐    ║
║    Vitalzeichen  ║  │ B1  Meier, A.  67J  ●NEWS2 1             │    ║
║    [Erfassen ▶]  ║  │     Meds 09:00                           │    ║
║                  ║  ├──────────────────────────────────────────┤    ║
║  ■ 08:30  B7     ║  │ B2  Huber, B.  54J  ●NEWS2 0             │    ║
║    Bilanz        ║  ├──────────────────────────────────────────┤    ║
║    [Erfassen ▶]  ║  │ B3  Keller, C. 68J  ●NEWS2 6  ⚠⚠        │    ║
║                  ║  │     Vital ÜBERFÄLLIG · Eskalation prüfen │    ║
║  NÄCHSTE STD     ║  ├──────────────────────────────────────────┤    ║
║  □ 09:00  B1     ║  │ B4  ─ leer ─                             │    ║
║    Metformin     ║  ├──────────────────────────────────────────┤    ║
║  □ 09:00  B5     ║  │ B5  Schmid, D. 71J  ●NEWS2 2             │    ║
║    Ramipril      ║  │     Meds 09:00                           │    ║
║  □ 09:30  B2     ║  ├──────────────────────────────────────────┤    ║
║    Wundpflege    ║  │ B6  Fischer, E. 82J ●NEWS2 3  ⚠          │    ║
║                  ║  │     SpO2 91% — prüfen                    │    ║
║  SPÄTER          ║  ├──────────────────────────────────────────┤    ║
║  □ 10:00  B6     ║  │ B7  Weber, F.  59J  ●NEWS2 2             │    ║
║    Bilanz        ║  │     Bilanz ÜBERFÄLLIG                    │    ║
║                  ║  └──────────────────────────────────────────┘    ║
║  [+ Aufgabe]     ║                                                   ║
╚══════════════════╩═══════════════════════════════════════════════════╝
```

**Design notes:**
- NEWS2 badge colour: `#eaf9f0` / `#93cfac` border for 0–2; `#d79a1c` for 3–4; `#8b162f` / `#ffe8ed` for 5+
- Overdue tasks in the left panel use `#ffe8ed` row background with `#8b162f` label
- Each bed row is a card (`#ffffff`, `#d7e3f4` border, `12px` radius); tapping opens patient detail
- The right panel is scrollable; left task queue is fixed
- On a phone (single-column): task queue collapses to a badge count in the header; ward board occupies full width

---

#### 51.8.2 Nurse — Patient Detail

Opened by tapping a bed row. The back arrow always returns to the ward overview — the nurse is never "lost" inside a patient record.

```
╔══════════════════════════════════════════════════════════════════════╗
║  ← Ward 3B   Keller, Christian  68J  ·  Bett 3  ·  Fall 2026-001234║
║  [⚠⚠ NEWS2 6 — Eskalation empfohlen]                                ║
╠═══════════════════╦══════════════════════════════════════════════════╣
║  VITALZEICHEN     ║  AUFGABEN                                        ║
║  ──────────────   ║  ─────────────────────────────────────────────   ║
║  HF      98 /min  ║  ■ ÜBERFÄLLIG                                   ║
║  BD   148/92 mmHg ║    08:00  Vitalzeichen      [Jetzt erfassen ▶]  ║
║  Temp   37.8 °C   ║                                                  ║
║  SpO2    96 %     ║  □ 09:00  Metformin 500mg   [Bestätigen ▶]      ║
║  AF      20 /min  ║  □ 09:00  Ramipril 5mg      [Bestätigen ▶]      ║
║                   ║  □ 10:00  Wundverbandwechsel [Erfassen ▶]       ║
║  NEWS2   6  ⚠⚠   ║                                                  ║
║                   ║  BILANZ                                          ║
║  [Vital erfassen] ║  ─────────────────────────────────────────────   ║
║                   ║  Einfuhr  350 ml  ·  Ausfuhr  200 ml            ║
║  WARNUNGEN        ║  Bilanz   +150 ml                                ║
║  ────────────     ║  [+ Eintrag]                                     ║
║  ⚠ NEWS2 ↑        ║                                                  ║
║  ⚠ Meds überfäll. ║  NOTIZEN                                         ║
║                   ║  ─────────────────────────────────────────────   ║
║  [Eskalieren ▶]   ║  08:30  Patient unruhig, Schmerz 6/10.          ║
║                   ║         Dr. Kessler informiert 07:30.            ║
║                   ║  [+ Notiz]                                       ║
╚═══════════════════╩══════════════════════════════════════════════════╝
```

**Design notes:**
- Alert banner below header: `#ffe8ed` background, `#8b162f` text, full-width
- Vital values in the left panel: large `1.2rem` bold numerals, unit in `0.82rem #44678f`
- [Eskalieren] primary button: `#005ca9`, escalation creates an alert in the physician app and logs the event
- Overdue task row: `#ffe8ed` background, solid `#8b162f` left border `4px`

---

#### 51.8.3 Physician — Desktop Layout (Primary)

The physician's desktop view is the richest layout in the system. Three panels are always visible simultaneously. The center panel is tabbed; switching tabs does not lose context in the left or right panels.

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║  gradient #005ca9→#0a79d1                                                            ║
║  Keller, Christian · 68J · Bett 3, Ward 3B · Fall 2026-001234                       ║
║  Hüftersatz rechts · Tag 2 postop · ⚠ NEWS2 6 · Dr. A. Meier (verantw.)             ║
╠════════════════════╦═════════════════════════════════════╦═════════════════════════╣
║  KONTEXT           ║  [Befunde] [Notizen] [Aufträge]      ║  TRENDS  letzte 24h     ║
║  ─────────────     ║             [Pathway] [Medikation]   ║  ─────────────────────  ║
║                    ║  ──────────────────────────────────  ║                         ║
║  Probleme          ║  AKTUELLE BEFUNDE          08:15     ║  HF  ▁▂▄▆▇█▇▆  98       ║
║  ─────────────     ║  CRP       142  ↑↑  ⚠               ║  BD  ────────── 148/92   ║
║  Hüftersatz        ║  Leukozyten 11.2  (norm)             ║  T°  ────────── 37.8°    ║
║  Diabetes T2       ║  Hb         9.8  ↓  ⚠               ║  SpO2 ───────── 96%      ║
║  Hypertonie        ║  Kreatinin  88   (norm)              ║                         ║
║  [+]               ║                          [Alle ▶]    ║  VERLAUF                ║
║                    ║                                      ║  ─────────────────────  ║
║  Pathway           ║  NOTIZEN                             ║  08:30 Visite Dr.Meier  ║
║  ─────────────     ║  ─────────────────────────────────── ║  08:15 Blut resultiert  ║
║  ✓ Tag 1 Visite    ║  08:30  Dr. A. Meier                 ║  07:00 Vitalzeichen     ║
║  ● Tag 2 Visite    ║  Patient febril, CRP erhöht.         ║  06:00 Vitalzeichen     ║
║  □ Physio          ║  Wundinspektion: leichte Rötung.     ║  Gestern                ║
║  □ Entlassplanung  ║  Analgesie gesteigert.               ║  20:00 Pflegenotiz      ║
║  [Pathway ▶]       ║  Blutkulturen bestellt.              ║  18:00 Meds verabreicht ║
║                    ║  [+ Notiz]  [Diktieren 🎤]           ║  16:30 Physio           ║
║  Medikamente       ║                                      ║  [Vollständig ▶]        ║
║  ─────────────     ║  AKTIVE AUFTRÄGE                     ║                         ║
║  Metformin 500mg   ║  ─────────────────────────────────── ║                         ║
║  Ramipril 5mg      ║  Paracetamol 1g IV  q6h   [Aktiv]   ║                         ║
║  Enoxaparin 40mg   ║  Blutkulturen x2        [Ausstehend] ║                         ║
║  [Alle / + Auftrag]║  [+ Neuer Auftrag]                   ║                         ║
╚════════════════════╩═════════════════════════════════════╩═════════════════════════╝
```

**Design notes:**
- Left sidebar: `#f2f7fd` background, `0.85rem` uppercase section labels in `#44678f`
- Center panel: white card, tab strip using segment-button style (`#edf5ff` bg, `#0d3c79` text, `#bdd4ec` border)
- Active tab: `#005ca9` underline `3px`, bold text
- Right panel: `#f2f7fd` background; sparkline bars use gradient `#2b87d8 → #0d5cad`, inactive bars `#9db9d8`
- Abnormal lab values: `#8b162f` text, `↑↑` or `↓` suffix; background row `#ffe8ed`
- Pathway steps: `✓` in `#93cfac`, `●` (active) in `#005ca9`, `□` in `#9db9d8`
- [Diktieren] launches the voice-to-note pipeline from §51.4

---

#### 51.8.4 Physician — Mobile / Ward Round (Compact)

On a phone during ward rounds, the three-panel layout collapses to a single-column priority view. The goal is: essential information in under three seconds; action in under five taps.

```
╔══════════════════════════════════════╗
║  gradient #005ca9→#0a79d1           ║
║  Keller, C.  68J  Bett 3            ║
║  Fall 2026-001234  Tag 2 postop      ║
╠══════════════════════════════════════╣
║  ⚠⚠ NEWS2 6 · Eskalation prüfen    ║
║  (#ffe8ed banner, #8b162f)           ║
╠══════════════════════════════════════╣
║  VITALZEICHEN          07:00         ║
║  HF 98  BD 148/92  SpO2 96%         ║
║  T° 37.8°  AF 20                    ║
╠══════════════════════════════════════╣
║  BEFUNDE               08:15         ║
║  CRP 142 ↑↑⚠  Hb 9.8 ↓⚠            ║
║  Leukozyten 11.2 (norm)              ║
║  [Alle Befunde ▶]                    ║
╠══════════════════════════════════════╣
║  LETZTE NOTIZ          08:30         ║
║  Dr. Meier: Febril, CRP erhöht.     ║
║  Wundinspektion: leichte Rötung...   ║
║  [Vollständig ▶]                     ║
╠══════════════════════════════════════╣
║  AKTIVE AUFTRÄGE                     ║
║  Paracetamol 1g IV q6h  [Aktiv]     ║
║  Blutkulturen x2  [Ausstehend]       ║
╠══════════════════════════════════════╣
║  ┌────────┐ ┌────────┐ ┌──────────┐ ║
║  │Diktier.│ │Auftrag │ │Pathway   │ ║
║  │  🎤   │ │  + Rx  │ │  →       │ ║
║  └────────┘ └────────┘ └──────────┘ ║
╚══════════════════════════════════════╝
```

**Design notes:**
- Three bottom action buttons: primary blue (`#005ca9`), equal width, `12px` radius
- Each section is a card (`#ffffff`, `#d7e3f4` border) with `0.85rem` uppercase section label
- Alert banner is always pinned directly below the patient header — never scrolls away
- All data shown is from projection tables — no composition fetches on the hot ward-round path; sub-100ms load target

---

#### 51.8.5 Design Principles Across All Layouts

| Principle | Application |
|---|---|
| Episode context always visible | Fallnummer and episode type in every header |
| Alert banner never scrolls away | Pinned below patient header; `#ffe8ed` / `#8b162f` |
| NEWS2 colour-coded consistently | Green 0–2 · Amber 3–4 · Red 5+ across all surfaces |
| One primary action per screen | The most likely next action is always a prominent `#005ca9` button |
| Role separation | Nurse layout is task/action-first; physician layout is information/context-first |
| Data shown from projections only | No raw composition queries on any hot UI path |

---


## 52. Configuration vs Code

### 52.1 The Traditional Argument for Configuration

The standard case for defining clinical logic as configuration (JSON pathway definitions, score formulas, SOP checklists, form templates) has been:

- **Non-developer maintenance**: clinical informaticians can update a pathway definition without involving a software engineer
- **Runtime modifiability**: a JSON definition can be loaded into a running production system without a deployment cycle
- **Auditability**: a JSON file can be diff'd, reviewed, and approved by clinical governance without reading code
- **Regulatory traceability**: in IEC 62304 (medical device software lifecycle), configuration is both the specification and the implementation — one artefact satisfies both

### 52.2 The AI-Coding Challenge to This Argument

With AI-assisted coding, a developer — or increasingly a clinical informatician with AI assistance — can generate and iterate a React form component, a score formula, or a pathway step handler in seconds. The productivity argument for avoiding code weakens substantially.

If generating code is as fast as filling in a form builder, and the result is more flexible (code can express anything; a config DSL can only express what its designers anticipated), why maintain a configuration layer at all?

### 52.3 Where Configuration Remains Superior

Despite AI-coding, three arguments for configuration remain strong:

**Runtime modifiability in regulated systems.** A code change in a regulated medical device triggers a software change process: impact assessment, re-testing of affected paths, possibly a new software version with updated documentation. A configuration change to a pathway definition or score formula can be governed by a lighter clinical governance process — a clinician signs off the JSON diff; no re-deployment, no software version bump. This is a significant operational advantage in a clinical environment where pathways are updated every few months.

**Clinician reviewability.** The entity who approves a NEWS2 threshold definition is a consultant physician, not a software engineer. A structured JSON definition with named fields is reviewable by that physician. Python code with a lookup table is not. The configuration layer is the interface between clinical governance and software. AI-coding does not eliminate this interface — it only changes who can write on the software side of it.

**Separation of concerns at organisational scale.** A hospital deploying this system will want to customise pathways for their patient population, local drug formulary, and departmental workflows without touching the software codebase. Configuration enables this: each institution maintains its own pathway and score definitions; the engine is shared software. Coding requires either forking the codebase or writing extension points — both are architecturally expensive.

### 52.4 Where Code Wins

**Forms.** The original argument for FHIR Questionnaire as the form definition format was partly developer convenience. With AI-coding, generating a type-safe React form component from a natural language description is fast and produces better results (type checking, IDE support, test coverage) than a runtime-interpreted Questionnaire renderer. For forms that are unlikely to change at governance cadence (standard intake forms, demographic capture), generated code is a reasonable alternative.

**Integrations and edge cases.** Non-standard device protocols, complex billing rules with unusual tariff logic, specialty-specific workflow variations — these are better expressed as code than as strained configuration. A configuration DSL that tries to cover every case becomes an unmaintainable ad-hoc programming language.

### 52.5 The Rule

> **Configure what changes at governance cadence. Code the engines that execute it.**

| Artefact | Approach | Rationale |
|---|---|---|
| Pathway definitions | Configuration (JSON) | Updated by clinical governance; runtime-modifiable; clinician-reviewable |
| Score formulas | Configuration (JSON) | Same; must be approvable by clinical experts without reading code |
| SOP checklists | Configuration (JSON) | Govenance-controlled; linked to regulatory obligations |
| Condition expression evaluator | Code | The engine; changes rarely; requires testing |
| Score computation engine | Code | The engine; not the definitions |
| Standard clinical forms | Configuration (FHIR Questionnaire) | Runtime-modifiable; governance-controlled |
| Bespoke complex forms | Generated code (AI-assisted) | Better type safety; appropriate when form is stable and complex |
| Device integration adapters | Code | Vendor-specific; cannot be genericised |

---


## 53. Episode Assignment — Every Action Traced to a Fall

### 53.1 The Core Principle

Every clinical action in the system carries an explicit `episode_id` at the moment of creation. It is a required field — non-nullable in the schema, mandatory in the API contract, enforced by the UI. It is never inferred, never defaulted, never assigned retroactively.

This is the mechanism that makes billing, audit, and EPD document attribution reliable in the Swiss context.

### 53.2 The Swiss "Fall"

A *Fall* (episode / case) is the administrative and billing unit:

| Domain | Use of the Fall |
|---|---|
| **SwissDRG** | One DRG grouping per inpatient Fall — Hauptdiagnose + procedures |
| **TARMED / TARDOC** | Consultations billed per ambulatory Fall |
| **EPD** | XDS.b document metadata references the episode; service start/stop times |
| **Insurer communication** | The Fallnummer appears on every claim and correspondence |
| **Audit** | Every action attributable to a specific episode for insurer and cantonal review |

Episode types: inpatient admission, outpatient consultation series, day case, emergency, rehabilitation, psychiatric stay. A patient may have multiple episodes active simultaneously — an inpatient hip replacement admission running in parallel with an ongoing outpatient oncology episode.

### 53.3 Data Model

```sql
CREATE TABLE episodes (
  id                        UUID PRIMARY KEY,
  patient_id                UUID NOT NULL,
  episode_type              TEXT NOT NULL,   -- 'inpatient','outpatient','day_case',
                                             --   'emergency','rehab','psychiatric'
  episode_number            TEXT NOT NULL,   -- Fallnummer — unique, on all billing/EPD
  status                    TEXT NOT NULL,   -- see lifecycle below
  opened_at                 TIMESTAMPTZ NOT NULL,
  closed_at                 TIMESTAMPTZ,
  department_id             UUID,
  responsible_physician_id  UUID,
  cost_center_id            UUID REFERENCES cost_centers,
  referred_from_episode_id  UUID REFERENCES episodes   -- cross-episode link (nullable)
);
```

Every action table has:

```sql
episode_id  UUID NOT NULL REFERENCES episodes
```

This applies to: `compositions`, `orders`, `slots`, `tasks`, `invoice_items`, `sop_executions`, `pathway_instances`, `roster` entries where patient-linked. The foreign key is non-nullable. The schema physically cannot store an action without an episode.

### 53.4 Patient-Scoped vs Episode-Scoped

Not all records belong to an episode. The distinction is structural and enforced by which table the record lives in:

| Scope | Examples | Table |
|---|---|---|
| **Patient** | Allergy, blood group, advance directive, long-term problem list | `patient_records` — no `episode_id` |
| **Episode** | Compositions, orders, vitals, procedures, billing items, pathway instances | Domain tables — `episode_id NOT NULL` |

There is no ambiguity at query time. The schema makes scope unambiguous.

### 53.5 Episode Lifecycle

The episode follows an explicit state machine. State transitions are events on the event bus. Downstream domains react to transitions — billing listens for `episode.coded`; the EPD adapter listens for `episode.discharged`.

```
planned
  → admitted        (patient physically present)
  → active          (care underway)
  → discharge_pending
  → discharged      (patient left; EPD document generation triggered)
  → coded           (ICD-10 / CHOP coded by clinical coder)
  → billed          (SwissDRG / TARMED claim submitted)
  → closed
```

**Clinical actions cannot be added to an episode in `billed` or `closed` status.** This is enforced at the service layer — not just the UI. A composition write attempt against a closed episode returns a 409 Conflict with the episode status in the error body.

**Billing can only be submitted from `coded` status.** The billing domain's `submit_claim` function checks this precondition. It cannot be bypassed.

### 53.6 UI Enforcement — Episode Context

The UI makes it impossible to act without an explicit episode context.

**Single active episode**: the workspace opens directly into it. The Fallnummer is shown persistently in the header.

**Multiple active episodes**: an episode picker is mandatory before the clinical workspace opens. The system never guesses.

```
Patient: Müller, Hans   DOB: 1965-03-15

Active episodes:
  ● 2026-001234   Inpatient — Hüftersatz rechts          opened 2026-03-15
  ● 2025-001189   Ambulant  — Onkologie Nachsorge         opened 2025-11-02

Welche Episode bearbeiten Sie? →
```

The selected episode is held in application state for the duration of the session. Switching episode is an explicit act — a button in the header, always visible — and is logged in the audit trail with the user, timestamp, and both episode identifiers.

### 53.7 Cross-Episode Links

Some actions span episodes. These are explicit foreign key references, never automatic:

| Situation | Mechanism |
|---|---|
| Outpatient referral leading to an inpatient admission | `episodes.referred_from_episode_id` |
| Medication started inpatient, continued outpatient | Composition carries originating `episode_id`; continuation composition references it via `continuation_of_id` |
| Follow-up appointment booked at discharge | Slot carries `originating_episode_id` (the admission) and `target_episode_id` (the future outpatient episode, created on presentation) |
| Pathway spanning multiple episodes (e.g., surgical + rehab) | `pathway_instances.episode_id` is the current active episode; pathway definition may specify episode-type transitions |

Cross-episode links are navigable in the UI — a reference badge opens the linked episode in a read-only side panel without changing the active context.

### 53.8 Audit Capability

Because every action carries `episode_id`, the audit trail answers any question an insurer or cantonal authority may ask:

| Question | Query |
|---|---|
| What happened during Fall 2026-001234? | All compositions, orders, tasks, slots filtered by `episode_id` |
| What was billed for this episode? | `invoice_items` where `source_id` traces to this `episode_id` |
| Who acted on this episode and when? | `audit_log` filtered by `episode_id` |
| Which episodes used OR 3 on this date? | `slots` by resource + date joined to `episodes` |
| Which episodes are uncoded more than 3 days post-discharge? | `episodes` where `status = 'discharged'` and `discharged_at < now() - interval '3 days'` |

### 53.9 The Rule

> **The episode is the root context. The UI enforces it. The schema enforces it. Billing derives from it. Audit traces through it.**

---


## 54. Inter-Domain Communication

Domains never query each other's schemas. They communicate through events.

```python
# Clinical domain: composition stored → publish event
async def store_composition(episode_id: UUID, data: CompositionInput) -> UUID:
    archetype_registry.validate(data.archetype_id, data.content)
    comp_id = await db.insert_composition(episode_id, data)
    await event_bus.publish("composition.created", {
        "composition_id": str(comp_id),
        "archetype_id": data.archetype_id,
        "episode_id": str(episode_id),
        "patient_id": str(data.patient_id),
        "recorded_at": utcnow().isoformat()
    })
    return comp_id

# Billing domain: listen and derive charges
@on_event("composition.created")
async def handle_composition_for_billing(event: dict) -> None:
    if is_billable(event["archetype_id"]):
        await create_invoice_item(
            episode_id=event["episode_id"],
            source_type="composition",
            source_id=event["composition_id"]
        )

# Projection updater: maintain latest_vitals
@on_event("composition.created")
async def update_vitals_projection(event: dict) -> None:
    if event["archetype_id"] == "vital_signs.v3":
        await refresh_latest_vitals(event["patient_id"])
```

**Transport**: PostgreSQL `LISTEN/NOTIFY` for single-node deployments. NATS or RabbitMQ when scaling horizontally.

---


## 55. Modularity Structure

Code and deployment are organised as vertical domain slices, not horizontal layers:

```
/domains
  /patient_admin       Demographics, ADT, MPI, insurance registration
  /scheduling          Slots, resource planning, conflict detection, calendars
  /clinical_docs       Compositions, archetype engine, form generation
  /orders              CPOE, lab orders, radiology orders, referrals
  /medications         Prescribing, dispensing, MAR, interaction checking
  /results             Lab, radiology, document inbox, trending
  /resources           Resource registry, device management, rostering
  /billing             SwissDRG, TARMED/TARDOC, invoicing, claims
  /decision_support    Alerts, pathways, early warning scores
  /pdms                Device gateway, realtime hub, ICU charting, alarms, scores
  /mobile_physician    Patient list, results viewer, dictation, alert inbox
  /mobile_nurse        Ward board, MAR + barcode, observations, handover
  /mobile_patient      Health summary, appointments, results, PROs, EPD consent
  /interop             FHIR façade, IHE adapters, Swiss EPD federation
  /audit               Append-only audit log, break-glass, ATNA
```

Each domain owns:
- Its FastAPI router
- Its service layer
- Its PostgreSQL schema
- Its projection tables
- Its frontend bundle (lazy-loaded)

Domains import only from `shared/` for cross-cutting identifiers and the event bus.

---


## 56. Architecture and Development Considerations

This chapter addresses how the system enforces its own quality standards over time — through rule-sets, architecture verification, module templates, developer feedback loops, and a live user-guiding layer. These are not afterthoughts; they are first-class infrastructure built in from day one.

---

### 56.1 Rule-Sets

Rule-sets are the mechanism by which clinical knowledge, validation logic, access control, billing rules, and alert conditions are expressed in data rather than in code. Changing a rule never requires a deployment.

#### What a Rule-Set Is

A rule-set is a named, versioned collection of conditions and actions stored in the rule registry:

```json
{
  "rule_id": "prevention.hba1c_recall.v2",
  "name": "HbA1c recall — Type 2 diabetes",
  "version": 2,
  "active": true,
  "conditions": {
    "type": "and",
    "conditions": [
      { "type": "diagnosis", "code": "E11", "system": "ICD-10", "operator": "subsumes" },
      { "type": "composition_absent", "archetype": "hba1c.v1",
        "within_days": 180 }
    ]
  },
  "action": { "type": "recall", "priority": "routine",
               "notification": "patient_app" }
}
```

Rules are authored in structured JSON by clinical informaticians (§3.4) through the authoring interface — not by writing code. The rule engine evaluates conditions against the projection store; all evaluation runs against typed projection columns, not raw JSONB.

#### Where Rule-Sets Are Used

| Domain | Example rule-set |
|---|---|
| Clinical decision support | Drug-drug interaction alerts; dosing range warnings |
| Pathway transitions | Condition expressions on pathway branches (§13) |
| Prevention and recall | Population eligibility for screening (§27) |
| Access control | Dynamic RBAC conditions ("nurse can escalate on her own ward only") |
| Billing validation | "TARMED position X requires position Y to be present in the same episode" |
| Checklist auto-population | "Set isolation flag if any MRSA composition in last 12 months" |
| SOP trigger | "Trigger SOP acknowledgement when composition of type X is created" |

#### Rule Governance

Rules are versioned. A new version of a rule goes through:
1. Draft (authored, not active)
2. Review (clinical informatician + clinical lead sign-off)
3. Active (replaces previous version; prior version archived, not deleted)
4. Retired (explicitly deactivated with reason)

**Rule testing**: every rule can be evaluated against a synthetic patient record in a sandboxed environment before activation. The authoring interface includes a test harness — the author defines test cases (patient data → expected action) and verifies them before submitting for review.

**Rule conflicts**: the rule engine detects conflicting rules (two rules that produce contradictory actions for the same patient state) at activation time, not at runtime.

---

### 56.2 Architecture Principles and Verification

Architecture quality degrades when violations accumulate unnoticed. The system maintains a formal principles register and verifies compliance continuously.

#### Principles Register

A principles register documents every architectural rule:

| ID | Principle | Severity | Verification | Status |
|---|---|---|---|---|
| P01 | Pure-logic modules do not import React, DOM, or Tauri | Critical | Automated (import scan) | ✓ |
| P02 | No cross-domain table joins | Critical | Automated (query analysis) | ✓ |
| P03 | episode_id NOT NULL on all action tables | Critical | Automated (schema check) | ✓ |
| P04 | Every patient record access is audit-logged | Critical | Integration test | ✓ |
| P05 | Compositions are append-only (no UPDATE on compositions) | Critical | Automated (SQL scan) | ✓ |
| P06 | No GIN index on composition content | High | Automated (schema check) | ✓ |
| P07 | Projection tables use typed columns only — no JSONB | High | Automated (schema check) | ✓ |
| P08 | Break-the-glass access generates audit entry and notification | Critical | Integration test | ✓ |
| P09 | AI-generated output is never auto-promoted to clinical record | Critical | Code review + integration test | ✓ |
| P10 | Rule changes do not require code deployment | High | Manual (authoring UI review) | ✓ |
| P11 | FHIR façade is read-only projection — not the primary store | High | Automated (write-path analysis) | ✓ |
| P12 | No clinical data in push notification payloads | Critical | Automated (notification schema check) | ✓ |
| P13 | Template module standards compliance (see §56.3) | High | Automated (linting) | ✓ |

Each principle states: what is required, why it exists, how it is verified, and current status. The register is a living document — new principles are added when new architectural risks are identified; existing principles are updated when the system evolves.

#### Automated Verification

The CI pipeline runs an architecture check script on every pull request:

```bash
#!/usr/bin/env bash
# arch-check.sh — automated subset of principles register

# P01: No React/DOM imports in pure-logic modules
grep -r "from 'react'" src/model src/resources src/runtime \
  && fail "P01: React import in pure-logic module"

# P03: episode_id NOT NULL in all migration files
grep -r "episode_id" migrations/ | grep -v "NOT NULL" | grep -v "REFERENCES" \
  && fail "P03: episode_id without NOT NULL constraint"

# P05: No UPDATE on compositions table
grep -r "UPDATE compositions" src/ \
  && fail "P05: compositions table is append-only"

# P06: No GIN index on composition content column
grep -r "GIN.*content\|content.*GIN" migrations/ \
  && fail "P06: GIN index on composition content is prohibited"

# P12: No clinical fields in notification payload schemas
python3 scripts/check_notification_schemas.py \
  || fail "P12: Clinical data found in notification payload schema"
```

**Scope of automated checks**: import boundaries, schema constraints, SQL patterns, notification payload shape. These cover principles where violations are detectable as text patterns.

**Integration test coverage**: principles that require runtime verification (audit log completeness, break-the-glass notification, AI output gating) are enforced by integration tests that run against a real database with real application code.

#### Manual Review Cadence

Automated checks catch mechanical violations. Architectural drift — the gradual weakening of design intent through individually reasonable-seeming decisions — requires human review.

- **Monthly full scan**: all 13+ principles reviewed by the lead architect against the current codebase
- **Post-milestone review**: after every major feature delivery, a health log entry is written and appended
- **Health log**: a dated, rolling log of findings, deviations accepted with justification, and resolutions — not a dashboard, a narrative record

---

### 56.3 Template Module

Every new domain module starts from a canonical template that enforces compliance with all architecture principles from line one. A developer creating a new module copies the template; the scaffolded code already satisfies the principles register. There is no "I'll add the audit logging later."

#### Backend Template (Python / FastAPI)

```
/domains/new_module/
  ├── router.py          # FastAPI router — standard error handling, auth dependency
  ├── service.py         # Business logic — no DB session here, injected
  ├── repository.py      # DB queries only — asyncpg or SQLAlchemy async
  ├── schema.py          # Pydantic request/response models
  ├── model.py           # SQLAlchemy model — episode_id NOT NULL enforced by template
  ├── events.py          # Event emitters — standard event bus integration
  ├── audit.py           # Audit decorators — applied to every read and write
  └── tests/
      ├── test_service.py    # Unit tests against real DB (no mocks)
      └── test_router.py     # Integration tests via TestClient
```

**Built-in to the template — non-negotiable:**

```python
# router.py template — audit logging is mandatory, not optional
@router.get("/{id}")
async def get_record(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    audit: AuditLogger = Depends(get_audit_logger),   # ← injected, not optional
):
    record = await service.get(db, id)
    await audit.log_read(                              # ← every read is logged
        user=current_user,
        resource_type="new_module",
        resource_id=id,
    )
    return record

# model.py template — episode_id constraint enforced
class NewModuleRecord(Base):
    __tablename__ = "new_module_records"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    episode_id: Mapped[UUID] = mapped_column(
        ForeignKey("episodes.id"), nullable=False   # ← NOT NULL, no exceptions
    )
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    created_by: Mapped[UUID] = mapped_column(nullable=False)
    # Domain fields below — template provides no domain fields
```

**Standard error response shape** — all routers return errors in the same envelope:

```json
{ "error": "RESOURCE_NOT_FOUND", "detail": "Record 123 not found",
  "request_id": "a1b2c3d4", "timestamp": "2026-03-27T08:42:00Z" }
```

#### Frontend Template (React / TypeScript)

```
/features/new_module/
  ├── NewModuleRoot.tsx        # Route entry point — suspense boundary, error boundary
  ├── NewModuleRoot.css        # Module-scoped styles — design tokens only
  ├── components/
  │   └── NewModuleCard.tsx    # Feature components
  ├── hooks/
  │   └── useNewModule.ts      # TanStack Query hooks — data fetching
  ├── api/
  │   └── newModuleApi.ts      # API client — typed, no raw fetch in components
  ├── types.ts                 # Shared TypeScript types
  └── tests/
      └── NewModuleCard.test.tsx
```

**Built-in to the template:**

```tsx
// NewModuleRoot.tsx — error boundary + suspense are not optional
export function NewModuleRoot() {
  const { episodeId } = useEpisodeContext();  // ← episode context always required

  return (
    <ErrorBoundary fallback={<ModuleError />}>    {/* ← always present */}
      <Suspense fallback={<ModuleSkeleton />}>    {/* ← always present */}
        <NewModuleContent episodeId={episodeId} />
      </Suspense>
    </ErrorBoundary>
  );
}

// hooks/useNewModule.ts — TanStack Query, no raw fetch
export function useNewModuleRecord(id: string) {
  return useQuery({
    queryKey: ["new_module", id],
    queryFn: () => newModuleApi.getRecord(id),
    staleTime: 30_000,
  });
}
```

**Design token enforcement**: the CSS template imports only from the design token file. Hardcoded colour values, font sizes, or spacing values in module CSS files are a linting violation:

```css
/* Correct — token reference */
.new-module-card { background: var(--color-card-bg); border: 1px solid var(--color-border); }

/* Violation — caught by stylelint rule */
.new-module-card { background: #ffffff; }  /* ERROR: hardcoded colour */
```

#### Compliance Linting

The template installs linting rules that verify compliance at development time, not at review time:

| Tool | Rule | Principle |
|---|---|---|
| ESLint | No direct `fetch()` in components — use API client | Architecture boundary |
| ESLint | `useEpisodeContext()` required in all route roots | §53 episode assignment |
| Stylelint | No hardcoded colour/spacing values | Design token compliance |
| Pylint / Ruff | `AuditLogger` dependency required in every router function | §53 audit requirement |
| SQLFluff | No `UPDATE` on `compositions` table | P05 append-only |
| Custom | `episode_id` NOT NULL in all new model classes | P03 |

Linting runs on file save in the IDE and as a pre-commit hook. Violations block commit; they cannot be silenced without an explicit override comment that flags the exception for review.

---

#### 56.3.2 UI Component Template Library

The template module contains a living library of canonical examples for every artifact type that recurs across the application. Any new screen, dialog, or widget begins by copying the relevant template — never from a blank file. This enforces visual consistency, accessibility compliance, and design token usage across the entire product.

All templates use the shared design token set:

```css
/* tokens.css — single source of truth for all visual values */
--color-bg-page:      #f2f7fd;   /* page background */
--color-bg-card:      #ffffff;
--color-border:       #d7e3f4;
--color-primary:      #005ca9;   /* primary action, active states */
--color-primary-dark: #0d3c79;   /* headings, emphasis */
--color-accent:       #0a79d1;   /* links, waveforms */
--color-alert-bg:     #ffe8ed;   /* alert/error background */
--color-alert-text:   #8b162f;   /* alert/error text */
--color-alert-border: #ffc0cb;
--color-warning:      #d79a1c;   /* amber — overdue, NEWS2 medium */
--color-success-bg:   #eaf9f0;   /* success/ready background */
--color-success-border: #93cfac;
--color-muted:        #9db9d8;   /* disabled, inactive, placeholder */
--color-meta:         #44678f;   /* metadata labels, section headers */
--radius-card:        12px;
--radius-button:      8px;
--shadow-card:        0 4px 14px rgba(12, 42, 90, 0.08);
--font-body:          "Segoe UI", system-ui, -apple-system, sans-serif;
--font-size-label:    0.85rem;   /* uppercase section labels */
--font-size-body:     0.92rem;
--font-size-small:    0.82rem;
```

---

##### T1 — Episode Context Bar

The persistent header shown at the top of every patient-facing screen. Always visible; never scrolls away.

```tsx
// EpisodeContextBar.tsx
type Props = { patient: PatientSummary; episode: EpisodeSummary };

export function EpisodeContextBar({ patient, episode }: Props) {
  return (
    <header className="episode-bar" data-guide-id="episode.context_header">
      <span className="episode-bar-name">{patient.displayName}</span>
      <span className="episode-bar-meta">{patient.dobFormatted} · {episode.locationLabel}</span>
      <span className="episode-bar-fall">Fall {episode.episodeNumber}</span>
      {episode.alerts.length > 0 && (
        <AlertBadge count={episode.alerts.length} />
      )}
    </header>
  );
}
```

```css
.episode-bar {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: #fff;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-radius: 0 0 var(--radius-card) var(--radius-card);
}
.episode-bar-name   { font-weight: 700; font-size: 1rem; }
.episode-bar-meta   { font-size: var(--font-size-body); opacity: 0.9; }
.episode-bar-fall   { margin-left: auto; font-size: var(--font-size-small);
                      opacity: 0.85; }
```

**Variants**: compact (mobile — name + Fall only), expanded (desktop — full details).
**Accessibility**: `role="banner"`, patient name in `aria-label`.

---

##### T2 — Clinical Data Table

Used for results, order lists, medication lists, and work queues. Supports column sorting, row-level status flags, and an expandable detail row.

```tsx
// ClinicalTable.tsx
type Column<T> = {
  key: keyof T; label: string; width?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
};
type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
};

export function ClinicalTable<T extends { id: string; flagLevel?: 'normal'|'warning'|'critical' }>(
  { columns, rows, onRowClick, emptyMessage, loading }: Props<T>
) {
  if (loading) return <TableSkeleton columns={columns.length} />;
  if (!rows.length) return <EmptyState message={emptyMessage ?? "No records"} />;

  return (
    <div className="clinical-table-wrap" role="region">
      <table className="clinical-table" aria-live="polite">
        <thead>
          <tr>{columns.map(c => <th key={String(c.key)}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              className={`clinical-table-row flag-${row.flagLevel ?? 'normal'}`}
              onClick={() => onRowClick?.(row)}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map(c => (
                <td key={String(c.key)}>
                  {c.render ? c.render(row[c.key], row) : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```css
.clinical-table-wrap { overflow-x: auto; border-radius: var(--radius-card);
                        box-shadow: var(--shadow-card); }
.clinical-table      { width: 100%; border-collapse: collapse;
                        background: var(--color-bg-card); }
.clinical-table th   { padding: 0.6rem 0.85rem; font-size: var(--font-size-label);
                        text-transform: uppercase; letter-spacing: 0.04em;
                        color: var(--color-meta); border-bottom: 1px solid var(--color-border); }
.clinical-table td   { padding: 0.55rem 0.85rem; font-size: var(--font-size-body);
                        border-bottom: 1px solid var(--color-border); }
.clinical-table-row.flag-warning  { background: #fffbea; }
.clinical-table-row.flag-critical { background: var(--color-alert-bg);
                                     color: var(--color-alert-text); }
.clinical-table-row[tabindex]:hover { background: #edf5ff; cursor: pointer; }
```

**Variants**: compact (dense row padding), expandable (row click opens detail panel below), selectable (checkbox column).

---

##### T3 — Clinical Entry Dialog

Used for any action that captures a composition: vital signs, medication administration confirmation, wound assessment. Modal, keyboard-accessible, never auto-closes on successful save.

```tsx
// ClinicalEntryDialog.tsx
type Props = {
  title: string;
  archetypeId: string;           // drives form generation
  episodeId: string;             // mandatory
  onSave: (data: unknown) => Promise<void>;
  onClose: () => void;
  guideId?: string;
};

export function ClinicalEntryDialog({ title, archetypeId, episodeId, onSave, onClose, guideId }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSave(data: unknown) {
    setSaving(true);
    try   { await onSave(data); onClose(); }
    catch  { setError("Save failed — please try again"); }
    finally { setSaving(false); }
  }

  return (
    <dialog className="clinical-dialog" aria-modal="true"
            aria-labelledby="dialog-title" data-guide-id={guideId}>
      <header className="clinical-dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
      </header>

      {error && <AlertBanner message={error} />}

      <div className="clinical-dialog-body">
        <ArchetypeForm archetypeId={archetypeId} episodeId={episodeId}
                       onSubmit={handleSave} />
      </div>

      <footer className="clinical-dialog-footer">
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" form="archetype-form" type="submit"
                disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </footer>
    </dialog>
  );
}
```

```css
.clinical-dialog         { border: none; border-radius: var(--radius-card);
                            box-shadow: 0 8px 32px rgba(12,42,90,0.18);
                            padding: 0; min-width: 480px; max-width: 720px;
                            width: 90vw; max-height: 90vh; display: flex;
                            flex-direction: column; }
.clinical-dialog-header  { background: linear-gradient(135deg,var(--color-primary),var(--color-accent));
                            color: #fff; padding: 1rem 1.25rem; border-radius: var(--radius-card)
                            var(--radius-card) 0 0; display: flex;
                            justify-content: space-between; align-items: center; }
.clinical-dialog-body    { flex: 1; overflow-y: auto; padding: 1rem 1.25rem; }
.clinical-dialog-footer  { padding: 0.75rem 1.25rem; border-top: 1px solid var(--color-border);
                            display: flex; justify-content: flex-end; gap: 0.6rem; }
```

**Variants**: full-screen dialog (complex forms — anaesthetics assessment, discharge summary), read-only dialog (view-only composition, no footer actions), confirmation dialog (see T4).

---

##### T4 — Confirmation Dialog

For irreversible or high-consequence actions: discharge a patient, cancel an order, override a drug alert. Two-step: intent + explicit confirmation text.

```tsx
// ConfirmationDialog.tsx
type Props = {
  title: string;
  body: string;
  consequence: string;          // one sentence stating what will happen
  confirmLabel: string;         // e.g. "Cancel order" — action-specific, not "OK"
  variant?: 'warning' | 'critical';
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

export function ConfirmationDialog({ title, body, consequence, confirmLabel,
                                     variant = 'warning', onConfirm, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <dialog className={`confirm-dialog confirm-dialog--${variant}`} aria-modal="true">
      <h2>{title}</h2>
      <p className="confirm-body">{body}</p>
      <p className="confirm-consequence">{consequence}</p>
      <footer>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className={`btn-${variant}`} onClick={async () => {
          setConfirming(true); await onConfirm(); setConfirming(false);
        }} disabled={confirming}>
          {confirming ? "Working…" : confirmLabel}
        </button>
      </footer>
    </dialog>
  );
}
```

```css
.confirm-dialog             { border-radius: var(--radius-card); padding: 1.25rem;
                               max-width: 420px; border: none;
                               box-shadow: 0 8px 32px rgba(12,42,90,0.18); }
.confirm-dialog--warning h2 { color: var(--color-warning); }
.confirm-dialog--critical h2{ color: var(--color-alert-text); }
.confirm-consequence        { font-weight: 600; font-size: var(--font-size-body);
                               margin-top: 0.5rem; }
.btn-warning  { background: var(--color-warning); color: #fff;
                border-radius: var(--radius-button); padding: 0.55rem 0.85rem; }
.btn-critical { background: var(--color-alert-text); color: #fff;
                border-radius: var(--radius-button); padding: 0.55rem 0.85rem; }
```

**Rule**: the confirm button label always states the action ("Cancel order"), never a generic "OK" or "Yes". This is a linting rule applied to all `ConfirmationDialog` usages.

---

##### T5 — Alert Banner

Displayed inline at the top of a patient view whenever a critical alert is active. Pinned — never scrolls away. Stacks if multiple alerts are present.

```tsx
// AlertBanner.tsx
type Severity = 'info' | 'warning' | 'critical';
type Props = { message: string; severity?: Severity; action?: { label: string; onClick: () => void }; };

export function AlertBanner({ message, severity = 'warning', action }: Props) {
  return (
    <div className={`alert-banner alert-banner--${severity}`} role="alert"
         aria-live={severity === 'critical' ? 'assertive' : 'polite'}>
      <span className="alert-banner-icon">{severity === 'critical' ? '⚠⚠' : '⚠'}</span>
      <span className="alert-banner-text">{message}</span>
      {action && (
        <button className="alert-banner-action" onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  );
}
```

```css
.alert-banner             { display: flex; align-items: center; gap: 0.65rem;
                             padding: 0.55rem 1rem; font-size: var(--font-size-body); }
.alert-banner--info       { background: #eaf4ff; border-left: 4px solid var(--color-primary); }
.alert-banner--warning    { background: #fffbea; border-left: 4px solid var(--color-warning);
                             color: var(--color-warning); }
.alert-banner--critical   { background: var(--color-alert-bg);
                             border-left: 4px solid var(--color-alert-text);
                             color: var(--color-alert-text); font-weight: 600; }
.alert-banner-action      { margin-left: auto; background: transparent;
                             border: 1px solid currentColor; border-radius: var(--radius-button);
                             padding: 0.3rem 0.65rem; cursor: pointer; font-size: var(--font-size-small); }
```

---

##### T6 — Checklist Component

Configurable blocking/advisory items per visit or pathway step.

```tsx
// Checklist.tsx
type ChecklistItem = {
  id: string; label: string; blocking: boolean;
  status: 'pending' | 'done' | 'waived';
  waivedReason?: string;
};
type Props = { items: ChecklistItem[]; onToggle: (id: string, waive?: string) => void; };

export function Checklist({ items, onToggle }: Props) {
  const blocking = items.filter(i => i.blocking && i.status === 'pending');

  return (
    <div className="checklist" data-guide-id="checklist.root">
      {blocking.length > 0 && (
        <AlertBanner severity="critical"
          message={`${blocking.length} required item${blocking.length > 1 ? 's' : ''} incomplete`} />
      )}
      <ul className="checklist-items">
        {items.map(item => (
          <li key={item.id} className={`checklist-item checklist-item--${item.status}
              ${item.blocking ? 'checklist-item--blocking' : ''}`}>
            <button className="checklist-toggle" onClick={() => onToggle(item.id)}
                    aria-pressed={item.status === 'done'}>
              {item.status === 'done' ? '✓' : '○'}
            </button>
            <span className="checklist-label">{item.label}</span>
            {item.blocking && item.status === 'pending' && (
              <span className="checklist-required">Required</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```css
.checklist-items            { list-style: none; padding: 0; margin: 0; }
.checklist-item             { display: flex; align-items: center; gap: 0.6rem;
                               padding: 0.45rem 0.75rem; border-radius: 6px; }
.checklist-item--pending.checklist-item--blocking
                            { background: var(--color-alert-bg); }
.checklist-item--done       { opacity: 0.6; }
.checklist-required         { margin-left: auto; font-size: var(--font-size-small);
                               color: var(--color-alert-text); font-weight: 600; }
```

---

##### T7 — Status Badge

Compact colour-coded label for NEWS2 scores, order status, episode status, and pathway step status.

```tsx
// StatusBadge.tsx
type Variant = 'green' | 'amber' | 'red' | 'blue' | 'grey';
type Props = { label: string; variant: Variant; };

export function StatusBadge({ label, variant }: Props) {
  return <span className={`status-badge status-badge--${variant}`}>{label}</span>;
}

// Convenience: NEWS2 auto-selects variant
export function News2Badge({ score }: { score: number }) {
  const variant = score <= 2 ? 'green' : score <= 4 ? 'amber' : 'red';
  return <StatusBadge label={`NEWS2 ${score}`} variant={variant} />;
}
```

```css
.status-badge        { display: inline-flex; align-items: center; padding: 0.2rem 0.55rem;
                        border-radius: 999px; font-size: var(--font-size-small);
                        font-weight: 600; letter-spacing: 0.02em; }
.status-badge--green { background: var(--color-success-bg); color: #1a6640;
                        border: 1px solid var(--color-success-border); }
.status-badge--amber { background: #fffbea; color: var(--color-warning);
                        border: 1px solid #f0d080; }
.status-badge--red   { background: var(--color-alert-bg); color: var(--color-alert-text);
                        border: 1px solid var(--color-alert-border); }
.status-badge--blue  { background: #edf5ff; color: var(--color-primary-dark);
                        border: 1px solid #bdd4ec; }
.status-badge--grey  { background: #f0f4f8; color: var(--color-meta);
                        border: 1px solid var(--color-border); }
```

---

##### T8 — Timeline View

The patient record timeline: chronological list of compositions, events, and documents, filterable by type and date range.

```tsx
// TimelineView.tsx
type TimelineEntry = {
  id: string; timestamp: string; type: string;
  title: string; summary: string; source: 'internal' | 'external';
  archetypeId?: string;
};
type Props = { entries: TimelineEntry[]; loading?: boolean; };

export function TimelineView({ entries, loading }: Props) {
  if (loading) return <TimelineSkeleton />;

  return (
    <ol className="timeline" aria-label="Patient timeline" data-guide-id="timeline.root">
      {entries.map(entry => (
        <li key={entry.id} className={`timeline-entry timeline-entry--${entry.source}`}>
          <div className="timeline-dot" />
          <time className="timeline-time">{formatDateTime(entry.timestamp)}</time>
          <div className="timeline-card">
            <span className="timeline-type">{entry.type}</span>
            <span className="timeline-title">{entry.title}</span>
            <p className="timeline-summary">{entry.summary}</p>
            {entry.source === 'external' && (
              <span className="timeline-external-badge">External</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
```

```css
.timeline             { list-style: none; padding: 0; margin: 0;
                         border-left: 2px solid var(--color-border);
                         padding-left: 1.25rem; }
.timeline-entry       { position: relative; margin-bottom: 1rem; }
.timeline-dot         { position: absolute; left: -1.45rem; top: 0.3rem;
                         width: 0.7rem; height: 0.7rem; border-radius: 50%;
                         background: var(--color-primary); border: 2px solid #fff;
                         box-shadow: 0 0 0 2px var(--color-primary); }
.timeline-entry--external .timeline-dot { background: var(--color-muted); }
.timeline-time        { font-size: var(--font-size-small); color: var(--color-meta);
                         display: block; margin-bottom: 0.25rem; }
.timeline-card        { background: var(--color-bg-card); border: 1px solid var(--color-border);
                         border-radius: var(--radius-card); padding: 0.65rem 0.85rem;
                         box-shadow: var(--shadow-card); }
.timeline-type        { font-size: var(--font-size-label); text-transform: uppercase;
                         letter-spacing: 0.04em; color: var(--color-meta); display: block; }
.timeline-external-badge { font-size: var(--font-size-small); background: #f0f4f8;
                            color: var(--color-meta); padding: 0.15rem 0.45rem;
                            border-radius: 4px; margin-top: 0.35rem; display: inline-block; }
```

---

##### T9 — Work Queue View

Departmental task list for nurses, BMAs, MTRAs, and booking coordinators. Overdue rows are visually prominent; clicking a row opens the relevant action.

```tsx
// WorkQueueView.tsx
type QueueItem = {
  id: string; dueAt: string; overdue: boolean; urgency: 'routine'|'urgent'|'stat';
  patientName: string; taskLabel: string; assignedTo?: string;
};
type Props = { items: QueueItem[]; onItemClick: (item: QueueItem) => void; };

export function WorkQueueView({ items, onItemClick }: Props) {
  return (
    <div className="work-queue" data-guide-id="work_queue.root">
      <header className="work-queue-header">
        <span>Task</span><span>Patient</span><span>Due</span><span>Urgency</span>
      </header>
      {items.map(item => (
        <button key={item.id} className={`work-queue-row
            ${item.overdue ? 'work-queue-row--overdue' : ''}
            urgency-${item.urgency}`}
            onClick={() => onItemClick(item)}>
          <span>{item.taskLabel}</span>
          <span>{item.patientName}</span>
          <span>{item.overdue ? `⚠ ${item.dueAt}` : item.dueAt}</span>
          <StatusBadge label={item.urgency.toUpperCase()}
            variant={item.urgency === 'stat' ? 'red' : item.urgency === 'urgent' ? 'amber' : 'grey'} />
        </button>
      ))}
    </div>
  );
}
```

```css
.work-queue           { background: var(--color-bg-card); border-radius: var(--radius-card);
                         box-shadow: var(--shadow-card); overflow: hidden; }
.work-queue-header    { display: grid; grid-template-columns: 2fr 1.5fr 1fr 0.75fr;
                         padding: 0.55rem 0.85rem; font-size: var(--font-size-label);
                         text-transform: uppercase; letter-spacing: 0.04em;
                         color: var(--color-meta); border-bottom: 1px solid var(--color-border); }
.work-queue-row       { display: grid; grid-template-columns: 2fr 1.5fr 1fr 0.75fr;
                         padding: 0.55rem 0.85rem; font-size: var(--font-size-body);
                         border-bottom: 1px solid var(--color-border); text-align: left;
                         background: transparent; border-left: none; border-right: none;
                         cursor: pointer; width: 100%; }
.work-queue-row:hover { background: #edf5ff; }
.work-queue-row--overdue { background: var(--color-alert-bg);
                            border-left: 3px solid var(--color-alert-text); }
```

---

##### T10 — Loading Skeleton and Empty State

Standard placeholder shapes shown while data loads, and a consistent empty state when a query returns no results.

```tsx
// Skeleton.tsx — matches card and table shapes
export function CardSkeleton() {
  return (
    <div className="skeleton-card" aria-busy="true" aria-label="Loading">
      <div className="skeleton-line w-60" /><div className="skeleton-line w-40" />
      <div className="skeleton-line w-80" /><div className="skeleton-line w-50" />
    </div>
  );
}

export function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="skeleton-table" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton-row">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );
}

// EmptyState.tsx
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon">○</span>
      <p className="empty-state-message">{message}</p>
      {action}
    </div>
  );
}
```

```css
.skeleton-line   { height: 0.85rem; border-radius: 4px; background: linear-gradient(
                    90deg, var(--color-border) 25%, #e8f0f8 50%, var(--color-border) 75%);
                    background-size: 200% 100%; animation: shimmer 1.4s infinite; }
.w-40  { width: 40%; } .w-50 { width: 50%; }
.w-60  { width: 60%; } .w-80 { width: 80%; }
@keyframes shimmer { 0% { background-position: 200% 0; }
                      100% { background-position: -200% 0; } }
.empty-state         { padding: 2rem; text-align: center; color: var(--color-meta); }
.empty-state-icon    { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
.empty-state-message { font-size: var(--font-size-body); }
```

---

##### T11 — Toast Notification

Non-blocking feedback after an action completes. Auto-dismisses after 4 seconds; critical toasts persist until dismissed.

```tsx
// Toast.tsx — consumed via useToast() hook
type Toast = { id: string; message: string; severity: 'success'|'warning'|'error'; persistent?: boolean; };

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.severity}`} role="status">
          <span>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
```

```css
.toast-container { position: fixed; bottom: 1.25rem; right: 1.25rem;
                    display: flex; flex-direction: column; gap: 0.5rem; z-index: 1000; }
.toast           { display: flex; align-items: center; gap: 0.65rem; padding: 0.65rem 0.85rem;
                    border-radius: var(--radius-button); box-shadow: var(--shadow-card);
                    font-size: var(--font-size-body); min-width: 260px; max-width: 400px;
                    animation: slide-in 0.2s ease; }
.toast--success  { background: var(--color-success-bg); border: 1px solid var(--color-success-border); }
.toast--warning  { background: #fffbea; border: 1px solid #f0d080; }
.toast--error    { background: var(--color-alert-bg); border: 1px solid var(--color-alert-border);
                    color: var(--color-alert-text); }
@keyframes slide-in { from { transform: translateX(100%); opacity: 0; }
                       to   { transform: translateX(0);    opacity: 1; } }
```

---

##### Template Library Summary

| Template | ID | Used for |
|---|---|---|
| Episode Context Bar | T1 | All patient-facing screens |
| Clinical Data Table | T2 | Results, orders, medications, audit log |
| Clinical Entry Dialog | T3 | Any composition capture |
| Confirmation Dialog | T4 | Irreversible / high-consequence actions |
| Alert Banner | T5 | Critical alerts, validation errors |
| Checklist Component | T6 | Visit checklists, pathway step checks |
| Status Badge | T7 | NEWS2, order status, episode status |
| Timeline View | T8 | Patient history, episode timeline |
| Work Queue View | T9 | Task lists for nurses, BMAs, MTRAs |
| Loading Skeleton + Empty State | T10 | All async data loads |
| Toast Notification | T11 | Post-action feedback |

New components that replicate functionality covered by an existing template are a code review violation. The template library grows when a genuinely new artifact pattern is identified; it does not grow because a developer prefers a slightly different style.

---

### 56.4 Feedback-Loop Integration (Dev Forum)

The system embeds an in-app feedback loop directly accessible to all users during normal operation. This is the **Dev Forum** — a lightweight, context-capturing ticket system that connects clinical users to the development team without breaking the clinical workflow.

The design is based on the AppSpec DevForum implementation (AppSpace/AppSpec), adapted for the EHR clinical context.

#### The Problem It Solves

Clinical users identify usability issues and missing functionality during real work — not in training or testing sessions. Capturing that context precisely is difficult:
- A nurse notices a missing checklist item while standing at the bedside
- A physician wants to flag that a result view is missing a critical trend
- An MPA notices the appointment flow requires an unnecessary extra step

Without a built-in mechanism, feedback is lost, arrives without context, or is communicated through slow channels (email, helpdesk ticket). The Dev Forum captures the request with full context at the moment of insight.

#### Architecture

```
User triggers Dev Forum (keyboard shortcut or persistent floating button)
  → Current context captured automatically:
      — Current URL and route
      — Current patient_id, episode_id (from app state)
      — Current module / screen
      — Current user role
      — Selected UI component (optional — user picks a specific element)
  → User writes request in rich text editor
  → Request stored as DevRequest with captured context JSON

Developer receives request (Dev tab, DEV role):
  → Sees full context: patient/episode/screen at time of submission
  → Can copy structured AI prompt (MODE: IMPLEMENT TICKET ONLY) to clipboard
  → Claims, implements, responds

User receives developer response (Review tab):
  → Accepts (closes) or rejects with feedback
  → Rejection creates a child DevRequest — full lineage preserved
```

**Privacy safeguard**: the context capture records identifiers (patient_id, episode_id, screen name) but never captures clinical values. A developer seeing "patient_id: abc123, screen: vitals_entry" knows where the user was — they do not see any clinical data from that patient's record.

#### EHR-Specific Context Capture

The standard AppSpec context capture is extended for the EHR:

```typescript
interface EhrCaptureContext {
  url: string;
  module: string;             // 'vitals_entry' | 'order_entry' | 'pathway_view' | ...
  patient_id: string | null;  // present when in patient context
  episode_id: string | null;  // present when in episode context
  episode_type: string | null; // 'inpatient' | 'outpatient' | ...
  user_role: string;          // from authenticated session
  selected_component: DomDescriptor | null; // if user picked an element
  captured_at: string;        // ISO timestamp
}
```

The `data-guide-id` attributes (see §56.5) double as context anchors for Dev Forum — the element the user picks is identified by its guide ID, which maps to a human-readable description of what the component is.

#### Request Lifecycle

```
PENDING
  → IN_DEVELOPMENT (developer claims)
  → IMPLEMENTED_REVIEW or REJECTED_REVIEW (developer decides)
  → CLOSED_ACCEPTED (user accepts)
     or
  → CLOSED_REOPENED (user rejects — new child DevRequest created)
       → PENDING (cycle repeats; lineage preserved)
```

Full lineage is viewable by all participants at any point — the complete iteration history of a request is one click away. Every request in the chain is read-only after it is closed; history is immutable.

#### AI Integration

The Dev Forum structures each ticket as an AI-ready prompt for direct use with Claude Code or Cursor:

```
MODE: IMPLEMENT TICKET ONLY — do not refactor surrounding code

TICKET #47
SCOPE: Vitals entry form — ECG button is missing from the quick-action bar
DONE WHEN: ECG order can be placed from the vitals entry screen in ≤ 2 taps
CONTEXT: module=vitals_entry, episode_type=inpatient, user_role=nurse
REQUIREMENT: [user's request text, HTML → Markdown converted]
```

The developer copies this to the clipboard and pastes it directly into the AI coding assistant. The structured format prevents scope creep (MODE: IMPLEMENT TICKET ONLY) and provides all necessary context.

---

### 56.5 User-Guiding Framework

The User-Guiding Framework is a transparent explanatory layer that can be activated on demand, overlaying the running application. When active, every UI component is annotated with a contextual explanation. Users can also ask questions in natural language; the framework answers in the context of the current screen.

This is not a help documentation system — it is a live, context-aware companion layer built into the application shell.

#### Activation

The guide layer is activated and deactivated by a persistent, accessible control:
- Keyboard shortcut: `Shift + ?`
- A small floating "?" button always visible in the application chrome
- In the guide layer, a second activation mode enables "question mode" (see below)

Activation never interrupts a clinical workflow. The layer is additive — it overlays the running UI; it does not navigate away or interrupt any form in progress.

#### How It Works — Guide Definitions

Every meaningful UI component is annotated with a `data-guide-id` attribute:

```tsx
<NewsScoreDisplay score={news2} data-guide-id="vitals.news2_score" />
<OrderSetButton data-guide-id="orders.order_set_picker" />
<EpisodeHeader data-guide-id="episode.context_header" />
```

Guide definitions are stored in the guide registry — a content store managed by clinical informaticians and UX authors, not developers:

```json
{
  "guide_id": "vitals.news2_score",
  "label": "NEWS2 Score",
  "short": "A score measuring how unwell the patient is. Higher is more urgent.",
  "detail": "The National Early Warning Score 2 (NEWS2) is calculated from six physiological parameters. A score of 5 or above should trigger immediate clinical review. Scores are colour-coded: green (0–4), amber (5–6), red (7+).",
  "actions": [
    { "label": "How is this calculated?", "links_to": "guide://vitals.news2_calculation" },
    { "label": "What should I do if it is red?", "links_to": "guide://escalation.news2_red" }
  ]
}
```

Guide content is authored in the same multilingual framework as the rest of the application — German, French, and Italian for Switzerland.

#### Semantic Identity — Surviving Component Reorganisation

The most important architectural constraint is that UI components move over time.  A button migrates from one toolbar to another.  A panel is split in two.  A feature is reorganised into a different dialog.  A help system coupled to component identity (React component names, file paths, DOM position) breaks silently every time this happens.

The solution is to decouple help content from component identity.  Guide IDs identify **semantic concepts** — things the user cares about — not the components that happen to render them today:

```
  Semantic concept
  ("Activate the NEWS2 score input")
         │
         │  data-guide-id="vitals.news2_score"
         ▼
  Whatever DOM element currently renders that concept
```

If a component moves from one area of the screen to another, the developer carries the `data-guide-id` attribute with it.  The guide system finds the concept wherever it lives because it queries the live DOM **spatially** (where is the cursor right now?) — not historically (where was the component before?).

This also means multiple elements can share the same guide ID legitimately — a concept present in both a desktop toolbar and a mobile action sheet is the same concept and should show the same help.

#### Typed ID Registry — Compile-Time Drift Prevention

The worst silent failure: a developer moves a component and forgets to carry the `data-guide-id`.  Coverage drops with no visible error.

The defence is a **typed constant registry**:

```typescript
// guide_ids.ts — authoritative list of every guide concept
export const GUIDE_IDS = {
  VITALS_NEWS2:       "vitals.news2_score",
  ORDERS_ORDER_SET:   "orders.order_set_picker",
  EPISODE_HEADER:     "episode.context_header",
  // …
} as const;

export type GuideId = typeof GUIDE_IDS[keyof typeof GUIDE_IDS];
```

Every `data-guide-id` usage in component code imports from this registry — raw strings are disallowed by convention and flagged in code review:

```tsx
import { GUIDE_IDS } from "../guide/guide_ids";
<NewsScoreDisplay score={news2} data-guide-id={GUIDE_IDS.VITALS_NEWS2} />
```

If a concept is removed from `guide_ids.ts`, TypeScript immediately flags every component that referenced it.  Drift becomes a **compile-time error**, not a silent coverage gap.

The CI pipeline cross-checks the typed registry against the guide content store: unknown IDs (in code but not in the content store) are build errors; orphaned IDs (in the content store but absent from all compiled output) are warnings surfaced in the pull request review.

#### Visual Behaviour When Active

When the guide layer is active:
- A subtle highlight ring (`2px solid #005ca9, opacity 0.6`) appears on every component that has a `data-guide-id`
- Hovering over a component shows its short description in a tooltip
- Clicking a component shows a side panel with the full description and linked actions
- Components without a `data-guide-id` are visually dimmed — signalling to the guide authors that coverage is incomplete

The application remains fully functional while the guide layer is active. A clinician can use the guide to understand a score and then immediately act on it — they do not need to deactivate the guide to continue working.

#### Guide Dialog Placement

The detail panel is anchored to the **target element**, not to the cursor.  When the user clicks a component, the panel's position is computed from the component's bounding rectangle:

1. **Right** — preferred: if `targetRect.right + panelWidth ≤ viewportWidth`
2. **Left** — if `targetRect.left − panelWidth ≥ 0`
3. **Below** — if `targetRect.bottom + panelHeight ≤ viewportHeight`
4. **Above** — fallback

The panel is clamped to viewport edges in all cases.  It positions once at open time; it does not reposition on scroll.  The highlight ring remains visible while the panel is open so the user always knows which component they are reading about.  This placement logic is particularly important for components at the edges of the screen (e.g. a right-side panel or a bottom toolbar).

#### Two Access Paths

Users reach help through two complementary paths:

| Path | How |
|---|---|
| **Spatial** | Point at something visible — the guide system resolves the concept from the DOM |
| **Conceptual** | Type what you are looking for — the system searches all guide entries by keyword |

Both paths lead to the same guide entries and the same detail panel.  A user who cannot find what they are looking for by pointing can always switch to typing, and vice versa.  Before the AI companion is available, the conceptual path is served by a **narrowing full-text search** over the guide registry:

- Query is tokenised into lowercase words
- Each entry is scored by how many query tokens appear in (label ∪ short ∪ detail ∪ keywords)
- Results are sorted by score and displayed as a narrowing list
- Clicking a result navigates to that entry — the same view as if the user had pointed at the component

This client-side scan over ~100–300 entries is instantaneous and requires no backend.

#### Question Mode

Question mode adds a floating chat panel to the guide layer. The user types a question in natural language; the AI answers in the context of the current screen.

```
User: "What does it mean that the NEWS2 is 6?"
AI: "A NEWS2 score of 6 indicates medium-high risk of clinical deterioration.
     For this patient, the score is driven by the respiratory rate of 22 and
     SpO2 of 95%. According to your institution's escalation policy, a score
     of 5 or above should trigger a clinical review by a senior nurse or physician
     within 30 minutes. You can escalate directly from the patient screen —
     use the [Escalate] button in the left panel."
```

The AI's answer is grounded in:
- The guide definition for the current context (`data-guide-id`)
- The institution's configured escalation rules (from the rule registry, §56.1)
- The current patient's data (non-identifying summary only — the AI sees values, not names)

**Governance**: the AI is permitted to explain and contextualise; it is not permitted to recommend a specific clinical action or diagnose. Every AI response in question mode ends with: *"This is contextual guidance — clinical decisions remain with the responsible clinician."*

#### Guide Coverage Enforcement

Guide coverage is tracked as a quality metric:
- The CI pipeline reports the percentage of rendered components that have a `data-guide-id`
- A coverage target (e.g., 90% of named components) is set per module
- Falling below the target is a build warning; new components without a `data-guide-id` are flagged in the pull request review

This ensures that as the application grows, the guide layer stays complete.

#### Conditional Components

Some components are only present in the DOM in certain contexts — a panel that appears only when an episode is open, a score display only visible in a specific workflow step.  When the user points at a region with no `data-guide-id` ancestor, no highlight ring appears and no panel opens.  This is intentional: guide-unannotated regions signal a coverage gap to guide authors.

For guide entries whose component is currently absent, the **conceptual (search) path** still works.  A result clicked from search shows the entry content with a note describing when and how to reach the feature.  This prevents the guide from misleading users into looking for something that is not on screen.

#### Open Questions

- **Keyboard-only targeting**: should `Tab` focus traversal highlight `data-guide-id` elements while guide mode is active so that keyboard users can navigate the guide without a pointer device?
- **Touch / mobile**: the hover-then-confirm model does not map directly to touch; a first tap could substitute for hover, a second tap for Enter, keeping the gesture count the same.
- **Dynamic content rows**: tables and list rows (e.g. individual orders, results) need a template-style guide ID (e.g. `"orders.row"`) rather than per-row IDs; the guide entry should describe the row type, not an individual row.
- **Deeply nested or occluded elements**: if a large component covers a smaller one, the user cannot hover the inner element.  A right-click or long-press context menu as an alternative entry point would resolve this without a blocking overlay.

#### Guide Authoring Interface

Guide definitions are authored in a dedicated interface accessible to clinical informaticians and UX leads:
- Browse all `data-guide-id` values registered in the application
- See which have definitions, which are missing (coverage report)
- Edit definitions with a rich text editor
- Preview how the definition will appear in the overlay
- Publish a new definition without a code deployment

Guide content is stored in the same database as other configuration content and is served at runtime — not compiled into the application bundle.

### 56.6 Guideline Adherence — Operational and Analytical Modes

Clinical guidelines (Patient Blood Management, sepsis bundles, thromboprophylaxis, ventilator weaning criteria) are represented as versioned rule-sets (§56.1) operating in two modes.

**Operational mode — bedside alert:** When a patient's data meets a guideline trigger condition, a soft alert appears in the patient banner and notification feed, including:
- The guideline name and version
- The triggering value (e.g., "Hb 6.8 g/dL — PBM trigger threshold 7.0 g/dL")
- The recommended action
- A link to the full SOP

The clinician either acts (order placed) or documents a rationale for deviation. Both outcomes are recorded against the alert record.

**Analytical mode — adherence reporting:** The module queries historical alert records to identify cases where a trigger fired but no conforming action was taken within the defined time window:

```sql
-- PBM adherence: triggered but no transfusion order within 4 h
SELECT episode_id, triggered_at, hb_value, action_taken, deviation_reason
FROM   guideline_adherence_log
WHERE  guideline_id = 'PBM-01'
  AND  action_taken IS NULL
  AND  triggered_at < NOW() - INTERVAL '4 hours';
```

Quality managers access a dashboard showing: adherence rate per guideline, deviation breakdown (documented rationale vs. no response), adherence by ward and by attending, trend over time.

**Guideline versioning:** When a guideline is updated, the new version is authored in the rule-set editor, reviewed, approved, and activated with a go-live date. Historical adherence data retains the version active at the time, enabling transition-period analysis.

---


## 57. Implementation Priorities

Given the "data model first" principle, the critical path is:

1. **Shared kernel** — patient_id master, episode_id master, user_id, event bus, audit log; episode lifecycle state machine; episode_id is a required field from day one — retrofitting it later is expensive
2. **Archetype registry + validator** — everything depends on this
3. **Archetype specialisation hierarchy + semantic mapping registry** — required before any multi-context queries are meaningful
4. **SNOMED CT subsumption table** — load from SNOMED release; required for correct coded-value queries
5. **Composition store + projection framework** — the clinical record core; projections carry completeness flags from the start
6. **Named view definition registry** — enables context-specific data views without code changes
7. **Resource registry + slot model** — visible early win; scheduling is universally needed
8. **TimescaleDB time series infrastructure + series type registry** — required before PDMS and lab trending
9. **Lab ingest adapter** — HL7 v2 ORU + LOINC mapping; critical path for clinical usability
10. **Form engine** — once archetypes and templates exist, forms become free
11. **PDMS device gateway + realtime hub** — high complexity; start early alongside core clinical store
12. **Nurse mobile app** — offline-first MAR and observations; barcode scanning; highest daily usage volume
13. **Physician mobile app** — results viewer, alert inbox, dictation pipeline
14. **Pathway definition schema + execution engine** — once archetypes and order sets exist, pathways wire them together; order set firing drives clinical workflow
15. **SOP registry + structured SOP authoring tool** — begin with linked-document SOPs for existing procedures; migrate to structured incrementally
16. **Score engine + score definition registry** — depends on composition store and projection infrastructure; NEWS2 and SOFA unlock pathway branching and deterioration alerting
17. **Anatomical body view assets + region mapping** — SVG assets and SNOMED mappings; generic component is low effort once the query infrastructure exists
18. **Swiss EPD IHE adapter** — regulatory requirement; long lead time; start early
17. **Patient mobile app** — depends on FHIR façade and EPD integration being stable
18. **Billing domain** — derives from clinical + resource events; can follow once events flow

---


## 58. Summary of Key Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Clinical record storage | JSONB document per composition | Hierarchical data fits document model; schema-free evolution; MUMPS lesson |
| Clinical data structure | openEHR-influenced archetypes | Data model first; international clinical knowledge; extensibility |
| Multi-granularity concepts | Archetype specialisation + templates per context | Same concept captured at different detail levels; simple always derivable from detailed |
| Cross-context data perspectives | Named view definitions (JSON, not code) | Different specialties get different projections; no bespoke query code per context |
| Coded value queries | SNOMED CT subsumption table | Flat equality misses subtypes; subsumption is required for clinical correctness |
| Incomplete data communication | Completeness flags on projections | Consumers know whether answer is fully grounded or partially derived |
| Form generation | FHIR Questionnaire → generic engine | No bespoke form code; new forms are JSON files |
| Non-clinical domains | Relational per domain | Resources, scheduling, billing are structured and relational by nature |
| Cross-domain integration | Event bus (PostgreSQL NOTIFY / NATS) | No cross-schema joins; loose coupling; audit trail of state changes |
| Analytical queries | Separate projection / materialised views | Never compete with operational write path; Clarity lesson from Epic |
| Double-booking prevention | PostgreSQL gist exclusion constraint | Database-enforced invariant; cannot be bypassed by application logic |
| Swiss EPD compliance | FHIR façade over internal model | Internal model not constrained by interop format; EPD is an output, not a core |
| Extensibility | Namespaced extension tables + JSONB attributes | No schema migration for new fields; governed by namespace |
| Time series storage | TimescaleDB hypertable + continuous aggregates | Handles sub-second ICU data to monthly lab trends; compression reduces cold storage cost; stays within PostgreSQL |
| Time series extensibility | Series type registry (JSON) | New series = new registry entry; no code change |
| Curve rendering | Server-side LTTB down-sampling + pre-computed aggregates | Client receives display-ready point count; raw data never sent for long ranges |
| Lab ingestion | HL7 v2 / FHIR adapter → LOINC normalisation → composition + time series | Single ingest pipeline; labs trend identically to vitals |
| Lab reference ranges | Patient-context-matched at ingest | Ranges vary by sex, age, pregnancy; stored with result, not re-evaluated on read |
| PDMS integration | Integrated domain sharing patient/episode model and time series infrastructure | Avoids silo; device data feeds clinical record, scoring, and billing directly |
| PDMS ingestion | Batched INSERT / COPY from device gateway | Sustained 50–250 rows/sec; row-by-row INSERT generates unacceptable WAL overhead |
| PDMS real-time display | Redis ring buffer + WebSocket; no DB reads on hot path | Sub-second latency; DB unavailability does not affect bedside display |
| PDMS timeline zones | Three zones: Redis (0–30 min), TimescaleDB raw (30 min–7 days), aggregates (7 days+) | Access patterns differ too sharply for a single retrieval strategy |
| PDMS strip chart rendering | Canvas circular buffer; only new right-edge segment drawn per update | SVG cannot sustain the update rate; full re-render on every point is unnecessary |
| PDMS data retention | Tiered by age; alarm windows flagged for full-resolution permanent retention | Medicolegal and incident investigation requirements preserved; storage cost controlled |
| Mobile framework | React Native (shared TypeScript/FHIR client with web) | Single codebase iOS + Android; native capabilities; shared type definitions |
| Mobile offline | WatermelonDB + idempotency keys | Clinical writes are append-only events; no merge conflicts; duplicate prevention on sync |
| Mobile API | FHIR façade + SMART on FHIR | Standard healthcare mobile auth; patient and clinician scopes separated |
| Nurse medication safety | Barcode scan (patient wristband + drug) before MAR record | Five-rights check enforced in hardware scan; cannot be bypassed without explicit reason |
| Patient result gating | Clinician review and release before patient-visible | Prevents raw results causing harm without clinical context |
| Patient-generated data | Stored as compositions with recorder_type: patient | Flows into clinical record; provenance clearly marked; same query infrastructure |
| Push notification privacy | No clinical data in payload; app fetches after auth | Prevents PHI on lock screen; required by nDSG / GDPR |
| Clinical pathways | Event-driven execution engine; steps reference archetypes, not bespoke UI | Pathways are sequences of archetype references + timing rules; no per-pathway form code |
| Pathway variance | Coded reason picker (≤2 taps) + optional free text | Friction-free documentation is the only documentation that happens |
| Pathway versioning | Instances pin to definition version at enrolment | Patients mid-pathway are not affected by definition updates |
| SOP architecture | Structured steps + linked archetypes; PDF fallback for legacy | SOPs as data enables checklist documentation, version tracking, and compliance reporting |
| SOP execution record | Execution references SOP id + version; checklist entries time-stamped | Complete medicolegal record: standard, version, operator, deviations |
| Episode assignment | episode_id NOT NULL on every action table; UI always operates in explicit episode context | Billing, audit, and EPD attribution require unambiguous episode traceability |
| Episode lifecycle | Explicit state machine; billing blocked until coded; actions blocked on closed episodes | Prevents billing of uncoded episodes and post-billing clinical data corruption |
| Patient vs episode scope | Structural distinction in schema — separate tables | Allergy is patient-scoped; wound assessment is episode-scoped; no ambiguity at query time |
| Multiple concurrent episodes | Mandatory episode picker in UI; no automatic selection | Patient may have inpatient + outpatient episodes simultaneously; wrong attribution is a billing and safety risk |
| Cross-episode links | Explicit foreign keys; navigable in read-only side panel | Referral chains and medication continuations are traceable without merging episode contexts |
| SOP notification on update | In-app acknowledgement required | Compliance requirement; acknowledgement is logged |
| Pathway branching | Directed graph: decision / parallel / merge / loop step types | Linear list cannot model clinical reality; BPMN-derived model covers all clinical pathway shapes |
| Branch conditions | Structured JSON expressions (no code) | Clinician-reviewable; runtime-modifiable; governance-controlled |
| Decision pending | Pauses pathway; surfaces manual selection task | Conditions may not be evaluable; always need human override path |
| Pathway visual — full graph | React Flow + Dagre auto-layout | Node/edge graph with custom step-type nodes; authoring and clinical overview |
| Pathway visual — progress strip | Patient-specific linear view following taken branches only | Bedside and mobile; overdue steps highlighted; timeline axis for time-critical pathways |
| Clinical scores | JSON-defined; computed by event-driven engine; stored as compositions | Configuration separates clinical knowledge from code; scores available as pathway condition inputs |
| Score visualisation | Time series chart alongside source observations | Relationship between raw data and computed score immediately visible |
| Anatomical body views | Generic SVG component + SNOMED region mapping JSON | No per-view code; SNOMED subsumption query on region click; new views are SVG + mapping file |
| Configuration vs code | Configure at governance cadence; code the engines | Runtime-modifiability and clinician-reviewability justify configuration; AI-coding does not eliminate these needs |
| Backend server | Granian + FastAPI async | Higher throughput than Uvicorn; async throughout; direct asyncpg for hot paths |
| Client-side computation | Rust → WASM | Drug interactions, early warning scores, conflict detection offline-capable |

---

