## 16. Admission Schemas, Order Sets, and Pathways

### 16.1 Admission Schema Bundle

Every planned admission is associated with an **admission schema** — a bundle of three artefacts activated simultaneously:

1. **Order set** — a pre-built set of admission orders (lab, imaging, medication, nursing, dietary) appropriate for the diagnosis or procedure. Individual orders within the set can be accepted, modified, or declined during countersignature. The order set is a versioned template; changes require a review/approval cycle before becoming the default.

2. **Structured admission interview** — a diagnosis-specific question set that guides the admitting physician and nurse through the anamnesis, ensuring no domain is omitted. Responses are stored as structured data (not free text) wherever possible, enabling later aggregation and quality measurement.

3. **Admission checklist** — a task list that must be completed before the patient is considered "fully admitted" (e.g., orientation provided, valuables documented, wristband printed, escape-risk assessment complete, family contact verified).

### 16.2 Countersignature Workflow

Order sets created by nursing or allied health staff require physician countersignature before execution. The countersignature UI presents each order with its default parameters, allows amendment, and records the approving physician, timestamp, and any changes. A single screen flow — not a separate module — handles the entire countersignature so that turnaround is measured in minutes, not hours.

### 16.3 AI-Assisted Early Warning

The admission data (vital signs, scores, lab results, medication reconciliation) feeds a continuous early-warning model:

- **NEWS2** score computed automatically from vital-sign entries; threshold alerts generated at ward and critical levels.
- **Sepsis screening** — SIRS / qSOFA computed from vital signs and lab values; alert if criteria met.
- **Deterioration risk** — institution-trained ML model (or configurable rule-set) scoring probability of ICU transfer or rapid-response activation within 24 h; displayed as a risk band in the patient header.
- **Re-admission risk** — relevant at discharge planning (§18).

All AI alerts are soft alerts by default — displayed in the patient banner and nursing board, requiring acknowledgement, not mandatory order entry. The escalation pathway (who to call, what to order) is linked as an SOP reference (§14).

### 16.4 Pathway Activation at Admission

When an admission schema includes a clinical pathway (§13), the pathway is activated as part of the admission workflow. Steps that are time-zero (e.g., post-op monitoring protocol, hip-fracture pathway) begin counting from admission timestamp. The admitting physician can select a different pathway or defer pathway assignment; the choice is logged. Pathways advance asynchronously (§13.3) — the patient does not need to be in a specific application view for pathway steps to advance.

### 16.5 Transfer Order Sets and PDMS Protocol Activation

At the point of ICU admission or transfer between care levels, a **transfer order set** is offered — a bundle of orders appropriate to the receiving environment. This is distinct from the admission schema (§16.1), which applies at hospital admission.

**Examples:**

| Transfer event | Transfer order set activates |
|---|---|
| Ward → ICU (respiratory failure) | Intubation preparation, monitoring parameters, hourly nursing, ICU medication conversion |
| ICU → ward (step-down) | Remove ICU monitoring, convert IV medications to oral, reduce nursing frequency, activate ward pathway |
| PACU → ward | Remove PACU monitoring, transition analgesia to PRN schedule, mobilisation order, diet resumption |
| OR → ICU (post-cardiac surgery) | Post-cardiac surgery PDMS order set (§24.15), chest drain management, anticoagulation start |

Transfer order sets require countersignature by the receiving team's attending physician before orders become active — this handover moment is the formal point at which clinical responsibility transfers.

---

