# P1_00 Introduction

## Patient-Anchored. Clinician-Shaped. Institution-Accountable.

This is the architectural slogan of the system. It is not a marketing phrase. It is a statement of priority and a source of decision-making discipline — a way of answering the question "whose interest wins?" when the interests of different stakeholders pull in different directions, which in healthcare they always do.

---

## The Patient is the Anchor

Every record in the system traces back to a patient. This is not a platitude — it is a structural constraint. A composition without a patient is not valid data. An episode without an owner is an orphan. A lab result, a medication administration, an order, a nursing note: all are meaningless without the patient they describe, and all carry the patient's identity as a non-nullable fact at the database level (P6_11).

"Anchor" is the right word because an anchor is not the destination — it is the fixed point from which everything else is measured. The patient does not drive the system's design decisions in a UX sense. The patient is not the user. But the patient is the reason any given record exists, and the reason any given workflow runs. When a design decision is contested, "does this serve the patient's care, or does it serve something else?" is always a legitimate question — and the answer must always be acknowledged honestly, even when the answer is "something else."

Anchoring the data model in the patient also has concrete consequences:

- **Data sovereignty**: the patient has a claim on their own data. The Swiss EPD framework (P1_04) makes this a legal reality. The system's architecture must make it technically easy to extract, present, and transfer everything belonging to a patient, because that is not a corner case — it is an obligation.
- **Longitudinal continuity**: a patient's record spans years, institutions, and care teams. The data model is designed for longitudinal queries, not just transactional ones. A single episode is a chapter; the patient record is the book.
- **Privacy by construction**: sensitivity flags, access controls, and audit trails all exist at the patient-record level (P5_08). Restricting access to a patient's record is a first-class operation, not an afterthought.

The patient anchor does not mean the patient is always right, always safe, or always the beneficiary of every decision the system makes. It means the patient's identity is the thread on which all clinical data is strung, and that thread must never be cut.

---

## The Clinician is the Compass

The people who use this system moment to moment — at the bedside, in the consulting room, in the pharmacy, in the operating theatre — are clinicians. They are the ones who look at a screen under cognitive load, at shift change, when a patient is deteriorating, when a medication error is possible. The system's design must be shaped by them.

"Compass" means direction. A clinician using this system is not an administrator managing records — they are navigating a clinical situation, and the system either helps them navigate or it creates friction at the worst possible moment. Every design decision about information density, workflow sequence, alert thresholds, and default views should be evaluated against the question: *does this help a competent clinician do the right thing faster?*

This has several concrete implications:

- **Workflow primacy**: the system must support real clinical workflows, not idealised ones. Admission in the emergency department happens under time pressure. Medication rounds happen with partial information. Discharge happens when the patient is ready, not when the paperwork is finished. The system must be capable of operating at the speed of clinical reality.
- **Cognitive load awareness**: healthcare generates enormous amounts of data. Most of it, most of the time, is not immediately relevant. The system must filter, prioritise, and surface the right information at the right moment — not everything all the time. Alert fatigue is a patient safety risk, not just a usability complaint.
- **The clinician is not infallible**: clinical decision support exists because clinicians make errors under load, like all humans. Decision support must be helpful without being obstructive. The system supports the clinician's judgement; it does not substitute for it. When the system disagrees with a clinician's action, it can flag and document — it cannot refuse, except in a small number of hard safety cases where the clinical evidence for refusal is unambiguous.
- **The clinician is accountable**: the compass metaphor also carries responsibility. The clinician who uses this system is the person ultimately accountable for the care decisions it supports. Documentation is not bureaucracy — it is the record of a professional's judgement, which can be reviewed, defended, and learned from. The system must make accurate documentation fast and natural, because documentation that is slow or painful gets deferred, abbreviated, or avoided.

---

## The Institution is Accountable

The third dimension is the one that the clinical ideal would prefer to ignore, but cannot. A hospital is not a collection of individual clinician–patient relationships. It is an institution: legally constituted, publicly regulated, financially constrained, and responsible for outcomes that no individual clinician can control alone.

"Institution-accountable" acknowledges that this system must serve institutional functions that are not directly reducible to any individual patient's care:

- **Regulatory compliance**: Swiss healthcare regulation (EPDG, KVG, IVG, and cantonal requirements) imposes obligations on the institution as a whole. The system must make compliance tractable — not by adding bureaucratic overhead, but by capturing the data that demonstrates compliance as a by-product of normal clinical operation.
- **Billing and reimbursement**: the institution is paid through DRG and TARMED coding. Correct coding requires accurate clinical documentation. The system must support coding workflows (P3_06) without allowing billing pressure to distort clinical documentation — the record is what happened, not what was billed.
- **Quality and safety management**: institutions are responsible for outcomes across populations of patients. Clinical pathway adherence, infection rates, readmission rates, complication rates — these are institutional metrics that require data aggregated across many episodes and many clinicians. The system must support this analytical layer without compromising the individual care layer (P6_14 §56.4).
- **Workforce and resource management**: beds, theatres, staff, equipment — the institution must plan and allocate these. Multi-resource planning (P4_08), scheduling, and logistics modules serve the institution as an operational entity, not any individual patient directly.
- **Auditability**: the institution is accountable to patients, regulators, and insurers. The system must produce a trustworthy, tamper-evident record of what happened, when, and who did it. This is not optional and it is not negotiable. Every write operation is attributed; every read of sensitive data is logged (P5_05).

Institutional accountability also means that the system must survive the people who currently use it. Clinicians leave. Workflows change. Regulations are updated. The system must be configurable without redeployment (P6_10), evolvable without breaking existing records, and designed so that the institution's knowledge is in its data and configuration — not locked inside the heads of the team that built it.

---

## When the Three Dimensions Conflict

The value of a three-part slogan is not that it eliminates conflict — it is that it names the parties clearly enough that conflicts can be reasoned about honestly.

Some examples of tensions this system must navigate:

| Tension | Resolution principle |
|---|---|
| A billing optimisation would require documenting a diagnosis the clinician considers secondary | The clinical record reflects clinical reality. Billing codes are derived from the record; they do not drive it. |
| An alert fires constantly and clinicians dismiss it without reading it | A frequently dismissed alert is not a safety net — it is noise. Threshold calibration is a clinical governance responsibility, not a system failure. |
| A patient requests full access to their record, but it contains sensitive third-party information (e.g., a family history note) | Patient data sovereignty is real and legally enforceable; it has defined limits. The system provides the access mechanism; the institution governs the policy. |
| A quality manager wants access to all episode data across the institution | Legitimate institutional need. Granted via RBAC (P5_08) with full audit logging and time-limited scope where appropriate. |
| A clinician wants to bypass a mandatory checklist item in an urgent situation | The system must allow it — clinical judgement overrides protocol in emergencies — but must document the bypass and reason. The record is complete; the deviation is visible. |

The slogan is not a decision procedure. It is a reminder of what this system is for, who it serves, and what it owes. Design decisions that cannot be justified in terms of any of the three — patient anchoring, clinical usefulness, or institutional accountability — should be questioned.
