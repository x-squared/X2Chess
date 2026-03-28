## 57. Implementation Priorities

Given the "data model first" principle, the critical path is:

1. **Shared kernel** — patient_id master, episode_id master, user_id, event bus, audit log; episode lifecycle state machine; episode_id is a required field from day one — retrofitting it later is expensive
2. **Archetype registry + validator** — everything depends on this
3. **Archetype specialisation hierarchy + semantic mapping registry** — required before any multi-context queries are meaningful
4. **SNOMED CT subsumption table** — load from SNOMED release; required for correct coded-value queries
5. **Composition store + projection framework** — the clinical record core; projections carry completeness flags from the start
6. **Named view definition registry** — enables context-specific data views without code changes
7. **Resource registry + slot model** — visible early win; scheduling is universally needed
8. **TimescaleDB time series infrastructure + series type registry** — required before PDMS and lab trending
9. **Lab ingest adapter** — HL7 v2 ORU + LOINC mapping; critical path for clinical usability
10. **Form engine** — once archetypes and templates exist, forms become free
11. **PDMS device gateway + realtime hub** — high complexity; start early alongside core clinical store
12. **Nurse mobile app** — offline-first MAR and observations; barcode scanning; highest daily usage volume
13. **Physician mobile app** — results viewer, alert inbox, dictation pipeline
14. **Pathway definition schema + execution engine** — once archetypes and order sets exist, pathways wire them together; order set firing drives clinical workflow
15. **SOP registry + structured SOP authoring tool** — begin with linked-document SOPs for existing procedures; migrate to structured incrementally
16. **Score engine + score definition registry** — depends on composition store and projection infrastructure; NEWS2 and SOFA unlock pathway branching and deterioration alerting
17. **Anatomical body view assets + region mapping** — SVG assets and SNOMED mappings; generic component is low effort once the query infrastructure exists
18. **Swiss EPD IHE adapter** — regulatory requirement; long lead time; start early
17. **Patient mobile app** — depends on FHIR façade and EPD integration being stable
18. **Billing domain** — derives from clinical + resource events; can follow once events flow

---

