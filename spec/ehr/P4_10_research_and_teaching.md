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

