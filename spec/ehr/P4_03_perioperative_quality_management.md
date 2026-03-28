## 23. Perioperative Quality Management

The perioperative domain — anaesthesia, operating theatre, and PACU — requires structured safety checklists, implant documentation, and quality management reporting integrated into the clinical workflow.

### 23.1 Safe Surgery Checklist (WHO SSC)

The WHO Safe Surgery Checklist is embedded as a three-phase workflow. Completion is mandatory; the procedure cannot be documented as started until Sign-In and Time-Out are complete.

| Phase | Timing | Location | Key items |
|---|---|---|---|
| **Sign-In** | Before anaesthesia induction | Anaesthesia workstation | Patient identity, site marked, consent signed, allergy check, anaesthesia machine check, anaesthetic plan |
| **Time-Out** | Before first incision | OR — all team members | Team introductions, patient/procedure/site, critical steps (surgeon), airway concerns (anaesthetist), sterility confirmed, antibiotic given |
| **Sign-Out** | Before patient leaves OR | OR | Procedure name confirmed, instrument/swab count complete, specimen labelled, equipment issues noted, recovery plan communicated |

Items requiring multi-role confirmation cannot be completed by a single user. Emergency override by attending surgeon or anaesthetist requires a mandatory reason code and generates a quality management notification.

**SSC reporting:** Completion rate by OR / team / period; items most frequently skipped or overridden; Time-Out-to-incision interval; emergency override rate.

### 23.2 Anaesthesia Pre-Induction Checklist

Triggered automatically when the patient enters anaesthesia preparation — anaesthesia-internal, separate from the SSC:

- Anaesthesia machine check completed (machine serial number logged)
- Drugs prepared, labelled, high-alert drugs double-checked
- Emergency drugs available (adrenaline, atropine, suxamethonium)
- Difficult airway equipment present and checked
- IV access confirmed and patent
- Patient identity and consent re-confirmed
- Allergy status confirmed against allergy record
- Fasting status documented
- Pre-medication confirmed as given

All items are timestamped and attributed to the confirming anaesthetist.

### 23.3 Medical Device and Implant Documentation

Every implant placed during a procedure is recorded in a structured implant record linked to the procedure note.

| Field | Description |
|---|---|
| `device_type` | Joint prosthesis, cardiac pacemaker, ICD, LVAD, vascular graft, mesh, cochlear implant, … |
| `manufacturer` / `model` / `catalogue_number` | |
| `lot_number` / `serial_number` | |
| `implant_date` | From procedure timestamp |
| `anatomical_site` | Structured (left hip, right coronary artery, …) |
| `implanting_surgeon` | Linked to user record |

**Patient implant certificate:** A PDF implant card is generated automatically at procedure closure and added to the patient's document library.

**Recall management:** When a device lot or serial range is subject to a safety recall (FSCA), the system identifies all patients with the affected device and creates a recall notification task for each responsible clinical team.

### 23.4 Perioperative Quality Reporting

**Pressure injury reporting:** Perioperative pressure injuries are documented as structured clinical incidents (body-map annotation, EPUAP grade, acquisition context) with automatic notification to the ward nurse, quality manager, and the OR/anaesthesia team lead.

**Perioperative performance metrics:**
- First incision on time % (actual vs. scheduled)
- OR turnover time between cases
- Case duration vs. predicted (scheduling accuracy)
- Antibiotic prophylaxis compliance (drug, timing relative to incision)
- DVT prophylaxis compliance (documented pre-op)
- Re-operation within 30 days
- SSI rate (linked to post-op wound assessments and microbiology)
- Unplanned ICU admission within 24 h of surgery

All metrics are filterable by time period, OR room, surgical specialty, and procedure code (CHOP).

---

