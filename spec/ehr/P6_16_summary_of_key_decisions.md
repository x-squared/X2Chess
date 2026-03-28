## 58. Summary of Key Decisions

| Concern | Decision | Rationale |
|---|---|---|
| Clinical record storage | JSONB document per composition | Hierarchical data fits document model; schema-free evolution; MUMPS lesson |
| Clinical data structure | openEHR-influenced archetypes | Data model first; international clinical knowledge; extensibility |
| Multi-granularity concepts | Archetype specialisation + templates per context | Same concept captured at different detail levels; simple always derivable from detailed |
| Cross-context data perspectives | Named view definitions (JSON, not code) | Different specialties get different projections; no bespoke query code per context |
| Coded value queries | SNOMED CT subsumption table | Flat equality misses subtypes; subsumption is required for clinical correctness |
| Incomplete data communication | Completeness flags on projections | Consumers know whether answer is fully grounded or partially derived |
| Form generation | FHIR Questionnaire → generic engine | No bespoke form code; new forms are JSON files |
| Non-clinical domains | Relational per domain | Resources, scheduling, billing are structured and relational by nature |
| Cross-domain integration | Event bus (PostgreSQL NOTIFY / NATS) | No cross-schema joins; loose coupling; audit trail of state changes |
| Analytical queries | Separate projection / materialised views | Never compete with operational write path; Clarity lesson from Epic |
| Double-booking prevention | PostgreSQL gist exclusion constraint | Database-enforced invariant; cannot be bypassed by application logic |
| Swiss EPD compliance | FHIR façade over internal model | Internal model not constrained by interop format; EPD is an output, not a core |
| Extensibility | Namespaced extension tables + JSONB attributes | No schema migration for new fields; governed by namespace |
| Time series storage | TimescaleDB hypertable + continuous aggregates | Handles sub-second ICU data to monthly lab trends; compression reduces cold storage cost; stays within PostgreSQL |
| Time series extensibility | Series type registry (JSON) | New series = new registry entry; no code change |
| Curve rendering | Server-side LTTB down-sampling + pre-computed aggregates | Client receives display-ready point count; raw data never sent for long ranges |
| Lab ingestion | HL7 v2 / FHIR adapter → LOINC normalisation → composition + time series | Single ingest pipeline; labs trend identically to vitals |
| Lab reference ranges | Patient-context-matched at ingest | Ranges vary by sex, age, pregnancy; stored with result, not re-evaluated on read |
| PDMS integration | Integrated domain sharing patient/episode model and time series infrastructure | Avoids silo; device data feeds clinical record, scoring, and billing directly |
| PDMS ingestion | Batched INSERT / COPY from device gateway | Sustained 50–250 rows/sec; row-by-row INSERT generates unacceptable WAL overhead |
| PDMS real-time display | Redis ring buffer + WebSocket; no DB reads on hot path | Sub-second latency; DB unavailability does not affect bedside display |
| PDMS timeline zones | Three zones: Redis (0–30 min), TimescaleDB raw (30 min–7 days), aggregates (7 days+) | Access patterns differ too sharply for a single retrieval strategy |
| PDMS strip chart rendering | Canvas circular buffer; only new right-edge segment drawn per update | SVG cannot sustain the update rate; full re-render on every point is unnecessary |
| PDMS data retention | Tiered by age; alarm windows flagged for full-resolution permanent retention | Medicolegal and incident investigation requirements preserved; storage cost controlled |
| Mobile framework | React Native (shared TypeScript/FHIR client with web) | Single codebase iOS + Android; native capabilities; shared type definitions |
| Mobile offline | WatermelonDB + idempotency keys | Clinical writes are append-only events; no merge conflicts; duplicate prevention on sync |
| Mobile API | FHIR façade + SMART on FHIR | Standard healthcare mobile auth; patient and clinician scopes separated |
| Nurse medication safety | Barcode scan (patient wristband + drug) before MAR record | Five-rights check enforced in hardware scan; cannot be bypassed without explicit reason |
| Patient result gating | Clinician review and release before patient-visible | Prevents raw results causing harm without clinical context |
| Patient-generated data | Stored as compositions with recorder_type: patient | Flows into clinical record; provenance clearly marked; same query infrastructure |
| Push notification privacy | No clinical data in payload; app fetches after auth | Prevents PHI on lock screen; required by nDSG / GDPR |
| Clinical pathways | Event-driven execution engine; steps reference archetypes, not bespoke UI | Pathways are sequences of archetype references + timing rules; no per-pathway form code |
| Pathway variance | Coded reason picker (≤2 taps) + optional free text | Friction-free documentation is the only documentation that happens |
| Pathway versioning | Instances pin to definition version at enrolment | Patients mid-pathway are not affected by definition updates |
| SOP architecture | Structured steps + linked archetypes; PDF fallback for legacy | SOPs as data enables checklist documentation, version tracking, and compliance reporting |
| SOP execution record | Execution references SOP id + version; checklist entries time-stamped | Complete medicolegal record: standard, version, operator, deviations |
| Episode assignment | episode_id NOT NULL on every action table; UI always operates in explicit episode context | Billing, audit, and EPD attribution require unambiguous episode traceability |
| Episode lifecycle | Explicit state machine; billing blocked until coded; actions blocked on closed episodes | Prevents billing of uncoded episodes and post-billing clinical data corruption |
| Patient vs episode scope | Structural distinction in schema — separate tables | Allergy is patient-scoped; wound assessment is episode-scoped; no ambiguity at query time |
| Multiple concurrent episodes | Mandatory episode picker in UI; no automatic selection | Patient may have inpatient + outpatient episodes simultaneously; wrong attribution is a billing and safety risk |
| Cross-episode links | Explicit foreign keys; navigable in read-only side panel | Referral chains and medication continuations are traceable without merging episode contexts |
| SOP notification on update | In-app acknowledgement required | Compliance requirement; acknowledgement is logged |
| Pathway branching | Directed graph: decision / parallel / merge / loop step types | Linear list cannot model clinical reality; BPMN-derived model covers all clinical pathway shapes |
| Branch conditions | Structured JSON expressions (no code) | Clinician-reviewable; runtime-modifiable; governance-controlled |
| Decision pending | Pauses pathway; surfaces manual selection task | Conditions may not be evaluable; always need human override path |
| Pathway visual — full graph | React Flow + Dagre auto-layout | Node/edge graph with custom step-type nodes; authoring and clinical overview |
| Pathway visual — progress strip | Patient-specific linear view following taken branches only | Bedside and mobile; overdue steps highlighted; timeline axis for time-critical pathways |
| Clinical scores | JSON-defined; computed by event-driven engine; stored as compositions | Configuration separates clinical knowledge from code; scores available as pathway condition inputs |
| Score visualisation | Time series chart alongside source observations | Relationship between raw data and computed score immediately visible |
| Anatomical body views | Generic SVG component + SNOMED region mapping JSON | No per-view code; SNOMED subsumption query on region click; new views are SVG + mapping file |
| Configuration vs code | Configure at governance cadence; code the engines | Runtime-modifiability and clinician-reviewability justify configuration; AI-coding does not eliminate these needs |
| Backend server | Granian + FastAPI async | Higher throughput than Uvicorn; async throughout; direct asyncpg for hot paths |
| Client-side computation | Rust → WASM | Drug interactions, early warning scores, conflict detection offline-capable |

---

