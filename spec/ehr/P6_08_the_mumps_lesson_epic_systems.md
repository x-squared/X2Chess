## 50. The MUMPS Lesson — Epic Systems

### 50.1 What Epic Uses

Epic Systems — the dominant EHR in the US — is built on **MUMPS** (Massachusetts General Hospital Utility Multi-Programming System, 1966), implemented via InterSystems Caché / IRIS. This is a persistent, sparse, multidimensional hierarchical key-value store with a built-in programming language.

Data is stored in "globals":

```
^PATIENT(12345, "NAME")              = "Müller, Hans"
^PATIENT(12345, "DOB")               = "19650315"
^PATIENT(12345, "ENC", 1, "DATE")    = "20240115"
^PATIENT(12345, "ENC", 1, "DX", 1)  = "J18.9"
^PATIENT(12345, "ENC", 1, "DX", 2)  = "I10"
^PATIENT(12345, "ENC", 1, "MED", 1) = "Metformin 500mg"
^PATIENT(12345, "ENC", 2, "DATE")    = "20240220"
```

Access is by direct key traversal — no query planner, no JOIN, no ORM.

### 50.2 Why It Works

**Clinical data is naturally hierarchical.** MUMPS maps patient → episode → encounter → data directly. A relational schema requires 6+ joins to reconstruct an encounter; MUMPS traverses a known path in one operation.

**No schema migrations.** New fields are added by simply storing them. Sparse storage means old records without the new field incur no overhead. Epic has added fields for 45 years without ALTER TABLE.

**Predictable performance.** No query planner means no bad plan surprises. Access patterns are explicit in code; latency is consistent.

**Sparse data is free.** A psychiatric record and an oncology record look nothing alike. MUMPS stores exactly what exists — no NULLs, no polymorphic complexity.

### 50.3 The Costs

**Reporting requires a separate system.** Epic's **Clarity** (SQL Server / Oracle relational) is a full ETL copy used for all reporting and analytics. MUMPS cannot support ad-hoc queries efficiently. Two databases, an ETL pipeline, and lagged analytical data are the operational price.

**Proprietary and expensive.** InterSystems IRIS licensing is significant. The developer ecosystem is small.

**Interoperability is a façade.** Epic's FHIR API translates MUMPS globals into FHIR resources on demand — it is not natively FHIR.

### 50.4 Lessons for Greenfield Design

| MUMPS insight | How to apply |
|---|---|
| Hierarchical storage fits clinical data | Document/JSONB storage for compositions |
| Schema flexibility is operationally critical | JSONB + JSON Schema validation, not rigid columns |
| Explicit access paths outperform query planner | Explicit indexes per query path, not generic SQL |
| OLTP and OLAP must be separated | Operational store + analytical projections from day one |

---

