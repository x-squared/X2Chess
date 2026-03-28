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

