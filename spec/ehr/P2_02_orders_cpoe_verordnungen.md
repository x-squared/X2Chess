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

