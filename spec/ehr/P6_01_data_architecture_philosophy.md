## 43. Data Architecture Philosophy

### 43.1 Data Model First

The system's defining architectural principle: **the data model is the source of truth for structure and meaning**. UI forms, reports, and API responses are derived from the data model. No bespoke form code exists that is not grounded in a formal data definition.

This eliminates a class of common EHR failure: forms that diverge from the underlying model, or data that cannot be queried because it was captured in an ad-hoc string field.

### 43.2 Two-Level Modelling (openEHR Influence)

Clinical knowledge is separated into two levels:

| Level | What it defines | Who controls it | Stability |
|---|---|---|---|
| **Reference Model (RM)** | Generic structures — Composition, Observation, Element, data types | International standard | Stable for years |
| **Archetypes / Schemas** | Clinical knowledge — what data a blood pressure observation must contain | Clinical informaticians | Evolves with practice |

Software only needs to understand the Reference Model. New clinical concepts add archetypes; no software change is required.

### 43.3 Hierarchical Nature of Clinical Data

Clinical data is inherently hierarchical:

```
Patient
  └── Episodes (admission, outpatient, etc.)
        └── Encounters / Compositions
              ├── Observations (vitals, test results)
              ├── Instructions (orders, prescriptions)
              ├── Actions (administered medications, procedures)
              └── Evaluations (diagnoses, care plans)
```

This shape maps poorly to flat relational tables. Forcing it into rows and columns requires many joins to reconstruct a single encounter and introduces impedance mismatch between the clinical model and the storage model.

### 43.4 Data Integration and Continuity

Data integration and continuity across all sources and all contexts is a first-class architectural principle, not an integration afterthought.

**Single entry, universal availability.** Data entered once is available across all clinical contexts immediately — inpatient, outpatient, mobile, and external portals. Demographic data entered at registration is never re-collected. Anamnesis recorded at a first visit is accessible in all subsequent encounters; it is not re-collected unless clinically indicated and the new collection is explicitly linked to the prior record.

**Structured intake of external data.** Referral data and prior investigation results from external sources are stored in structured form. Documents (PDF, DICOM) are stored with rich metadata and indexed for retrieval by type, date, source, and clinical category. OCR and AI extraction produce a structured shadow record alongside every received document (see §27). Unstructured content is never the only representation of clinical data.

**Unified timeline.** Every clinical record — internal and external, structured and document — appears on a single chronological patient timeline. A clinician opens one view and sees the complete history without navigating between separate archives or systems.

**Full data transparency and access control.** Role-based access is enforced at the data layer, not the UI layer. Every access to a patient record is logged with user identity, timestamp, and data accessed. Patients can inspect their own access log. Emergency override (break-the-glass) is possible for any authorised clinician, requires an explicit justification, generates a permanent audit entry, and optionally notifies the patient.

**Data continuity across episode boundaries.** Long-term conditions, medications, allergies, and advance directives are patient-scoped (not episode-scoped) and are always current and accessible regardless of which episode is active. Episode-scoped data is always traceable back to the episode that produced it (see §53).

---

