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

