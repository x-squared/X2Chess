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

