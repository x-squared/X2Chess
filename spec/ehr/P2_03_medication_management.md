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

