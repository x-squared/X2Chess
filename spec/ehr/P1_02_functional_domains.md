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

