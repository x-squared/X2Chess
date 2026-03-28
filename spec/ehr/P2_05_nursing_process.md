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

