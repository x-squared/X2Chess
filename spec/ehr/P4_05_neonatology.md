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

