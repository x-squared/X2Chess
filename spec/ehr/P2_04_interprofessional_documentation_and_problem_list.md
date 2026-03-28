## 9. Interprofessional Documentation and Problem List

### 9.1 Interprofessional Dossier

The inpatient dossier is a single shared document space — not separate physician notes, nursing notes, and therapy notes stored in disconnected silos. Every discipline writes into the same chronological stream, tagged by author role, discipline, and note type.

**Note types in the shared stream:**

| Note type | Description |
|---|---|
| Physician progress note | Daily attending note; structured: current state, plan, open issues |
| Consultant note | Specialist opinion; linked to the triggering consult order |
| Nursing narrative | Shift-level free-text observation; supplementary to structured nursing documentation |
| Therapy note | Physiotherapy, OT, speech therapy, social work — same structure |
| Handover note | System-generated Einlesebericht (§10) at shift change |
| Procedure note | Attached to the procedure order; covers consent, technique, complications |
| Discharge summary | Auto-populated draft from structured data (§18) |

All notes support structured headers (problem/goal/assessment/plan or SOAP), but free-text paragraphs are permitted where structure adds no value. Any note can be promoted to a clinical notice (§9.4) to give it persistent, header-level visibility.

### 9.2 Problem List

The problem list is a first-class entity — not a derived view. Every active clinical problem (diagnosis, symptom complex, procedure indication, chronic condition, functional limitation) is an explicit record with:

- ICD-10/SNOMED code (with free-text label for uncoded entries)
- Status: active / resolved / inactive / chronic
- Onset date and (if applicable) resolution date
- Responsible clinician
- Episode and encounter links
- Linked orders, notes, and results

Problems can be created from a diagnosis entry, promoted from a note, or imported from a referring document. The list is visible at all times in the patient header; it is the backbone of the discharge summary.

### 9.3 Nursing Documentation

Nursing documentation uses the **nursing process framework** (§10) as its structural scaffold. Within each shift, nursing staff document:

- Vital-sign entries (supplementary to automated PDMS feeds)
- Medication administration records (MAR) — each dose, route, time, nurse, any PRN rationale
- Wound and skin assessment updates (body-map annotations, §12 crossref)
- Activity and mobilisation log
- Patient/family education provided
- Fall, incident, or restraint documentation (structured, with mandatory fields)

MAR entries lock once documented; corrections require an amendment record with reason and approving witness.

### 9.4 Clinical Notices

A clinical notice is a short, free-text message that any clinician — regardless of discipline — can pin to a patient record when something important needs to be visible to everyone who opens that patient's chart. Unlike a note in the shared stream (§9.1), a notice does not scroll away; it remains pinned in the patient header until explicitly resolved.

**Relation to structured flags (§15.2):** Flags are typed, system-enforced, and carry defined clinical behaviour (alert triggers, handover inclusion, order blocks). Notices are free-text and author-initiated — they cover everything clinically significant that does not fit a predefined flag type: a family communication preference, a procedural consideration, an interpreter requirement, a patient-specific safety observation, or anything a professional judges too important to leave only in the note stream.

**Data model:**

| Field | Description |
|---|---|
| `notice_id` | Stable identifier |
| `patient_id` | Patient master reference |
| `episode_id` | Optional — notices may span or precede an episode |
| `author` | Authoring clinician |
| `author_role` | Discipline (physician, nurse, physiotherapist, social worker, pharmacist, …) |
| `authored_at` | Creation timestamp |
| `text` | Free text, ≤ 500 characters |
| `severity` | `info` / `warning` / `critical` — determines display colour and sort order |
| `expires_at` | Optional expiry; system prompts author to review on expiry rather than auto-deleting |
| `resolved_at` / `resolved_by` | Set when the author (or a supervisor) explicitly closes the notice |
| `source_note_id` | Optional back-link if the notice was promoted from a note in the stream |

**Promotion from the note stream:** Any note in the shared stream (§9.1) has a "Pin as notice" action. This copies the note's first paragraph (or a manual excerpt) into a new notice and stores `source_note_id` pointing back to the full note. The notice and the original note then coexist — the notice provides the persistent visibility; the full note provides the clinical context.

**Display:** Clinical notices appear as a pinned band immediately below the structured flags in the patient header, on every screen within the patient context. Multiple notices are shown stacked, sorted by severity (critical first) then by `authored_at` (newest first). Each notice shows the author name, role, discipline colour, and relative time. A collapsed summary ("3 notices") is used on space-constrained screens, expanding on tap/click.

**Acknowledgement vs resolution:**

- Any staff member can **acknowledge** a notice (logged: who, when). Acknowledgement signals "I have read this" but does not remove the notice.
- Only the author or a supervisor can **resolve** a notice. Resolved notices move to a history view accessible from the patient header; they are never deleted.
- The Einlesebericht (§10.2) includes all unresolved notices in its auto-populated content, ensuring handover continuity.

**Scope:** Clinical notices apply in both inpatient and ambulatory contexts. An ambulatory notice created during a consultation persists when the patient is subsequently admitted, and vice versa — notices follow the patient, not the episode, unless explicitly scoped to an episode by the author.

---

