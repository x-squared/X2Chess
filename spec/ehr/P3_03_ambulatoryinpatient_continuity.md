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

