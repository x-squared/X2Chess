## 14. Standard Operating Procedures (SOPs)

### 14.1 SOPs vs Clinical Pathways

| | Clinical Pathway | SOP |
|---|---|---|
| **Scope** | One patient, one care episode | Any staff member, any context |
| **Duration** | Days to weeks | Minutes to hours |
| **Patient-specific** | Yes — tracked per patient | No — defines the standard for a procedure |
| **Example** | Hip replacement care plan | How to insert a urinary catheter |

SOPs define *how* a procedure is performed. Pathways define *what* care a patient should receive and in what order. A pathway step may reference an SOP ("perform central line insertion per SOP-CV-001"), and the SOP drives what gets documented.

### 14.2 SOPs as Structured Data

The critical architectural decision is to treat SOPs as structured data, not documents.

Most organisations currently store SOPs as Word or PDF files in a document management system. This is architecturally weak for an EHR:
- A PDF cannot be linked to a specific EHR task or order
- A PDF checklist cannot generate timestamped EHR entries
- The version active at the time of a procedure cannot be automatically recorded

The system supports both: **native structured SOPs** and **linked document SOPs** (PDF/Word) as a migration path. Over time, procedures are migrated to structured format.

A structured SOP:

```sql
CREATE TABLE sops (
  id          UUID PRIMARY KEY,
  code        TEXT NOT NULL,        -- 'SOP-CV-001'
  title       TEXT NOT NULL,        -- 'Central Venous Catheter Insertion'
  version     INT NOT NULL,
  status      TEXT NOT NULL,        -- 'draft','active','retired'
  department  TEXT,
  review_date DATE,
  document_url TEXT                 -- legacy PDF link (nullable)
);

CREATE TABLE sop_steps (
  id              UUID PRIMARY KEY,
  sop_id          UUID NOT NULL REFERENCES sops,
  sequence        INT NOT NULL,
  instruction     TEXT NOT NULL,
  safety_note     TEXT,
  is_checklist    BOOLEAN DEFAULT false,  -- generates a documentable EHR entry
  archetype_ref   TEXT                    -- archetype to capture if is_checklist
);

CREATE TABLE sop_links (
  sop_id           UUID NOT NULL REFERENCES sops,
  linked_type      TEXT NOT NULL,  -- 'pathway_step','order','task_type'
  linked_id        UUID NOT NULL,
  PRIMARY KEY (sop_id, linked_type, linked_id)
);
```

### 14.3 SOP Execution and Documentation

When a clinician performs a procedure governed by a structured SOP:

1. The SOP is surfaced from within the task, order, or pathway step — not as a separate system to navigate to
2. Steps are presented sequentially; the clinician steps through or uses as reference
3. Checklist items generate timestamped compositions in the clinical record
4. The parent composition (e.g. `central_line_insertion.v2`) references the SOP id and version used
5. Departure from any checklist item is documented with a reason

The resulting audit trail answers: what was the standard, which version, who performed the procedure, which steps were completed, and what was documented. This is the complete medicolegal record.

### 14.4 SOP Execution Records

```sql
CREATE TABLE sop_executions (
  id              UUID PRIMARY KEY,
  sop_id          UUID NOT NULL REFERENCES sops,
  sop_version     INT NOT NULL,
  patient_id      UUID NOT NULL,
  episode_id      UUID,
  performed_by    UUID NOT NULL,
  performed_at    TIMESTAMPTZ NOT NULL,
  composition_id  UUID,             -- the composition this execution generated
  status          TEXT NOT NULL     -- 'completed','incomplete','abandoned'
);

CREATE TABLE sop_checklist_entries (
  id              UUID PRIMARY KEY,
  execution_id    UUID NOT NULL REFERENCES sop_executions,
  step_id         UUID NOT NULL REFERENCES sop_steps,
  completed       BOOLEAN NOT NULL,
  completed_at    TIMESTAMPTZ,
  deviation_reason TEXT
);
```

### 14.5 SOP Version Control and Notification

SOPs are versioned. When a new version is activated:
- Staff are notified in the app (standard notification tier)
- The new version becomes the default for new executions
- Existing in-progress executions continue on the version they started
- The previous version is retained and queryable (medicolegal requirement)

Notification of SOP changes is a compliance requirement in regulated clinical environments. The notification system (§51.7) handles this via the standard push infrastructure with an additional in-app acknowledgement requirement — staff must confirm they have read the updated SOP before it clears from their inbox.

### 14.6 SOP Quality and Compliance Reporting

Aggregate SOP execution data feeds the quality dashboard:
- Compliance rate per SOP (what percentage of executions completed all checklist items)
- Most frequent deviation reasons
- Executions per department and per operator
- SOP review dates approaching (governance alert)

This data is derived from `sop_executions` and `sop_checklist_entries` — no manual audit required.

### 14.7 Mapping SOPs to EHR Domains

SOPs are referenced from multiple EHR domains:

| Domain | How SOPs appear |
|---|---|
| **Clinical pathways** | Pathway step references the SOP governing that step's procedure |
| **Orders / CPOE** | Procedure order activates the relevant SOP in the task execution view |
| **Nursing tasks** | Task type links to SOP; nurse opens SOP from within the task |
| **Training / competency** | SOP is the reference standard for skills assessment |
| **Incident management** | Incident report links to the SOP that should have governed the action |
| **Audit** | Every execution references SOP id and version — reconstructible at any time |

The SOP is never a detached document. It is woven into the workflow at the point of action.

