## 55. Modularity Structure

Code and deployment are organised as vertical domain slices, not horizontal layers:

```
/domains
  /patient_admin       Demographics, ADT, MPI, insurance registration
  /scheduling          Slots, resource planning, conflict detection, calendars
  /clinical_docs       Compositions, archetype engine, form generation
  /orders              CPOE, lab orders, radiology orders, referrals
  /medications         Prescribing, dispensing, MAR, interaction checking
  /results             Lab, radiology, document inbox, trending
  /resources           Resource registry, device management, rostering
  /billing             SwissDRG, TARMED/TARDOC, invoicing, claims
  /decision_support    Alerts, pathways, early warning scores
  /pdms                Device gateway, realtime hub, ICU charting, alarms, scores
  /mobile_physician    Patient list, results viewer, dictation, alert inbox
  /mobile_nurse        Ward board, MAR + barcode, observations, handover
  /mobile_patient      Health summary, appointments, results, PROs, EPD consent
  /interop             FHIR façade, IHE adapters, Swiss EPD federation
  /audit               Append-only audit log, break-glass, ATNA
```

Each domain owns:
- Its FastAPI router
- Its service layer
- Its PostgreSQL schema
- Its projection tables
- Its frontend bundle (lazy-loaded)

Domains import only from `shared/` for cross-cutting identifiers and the event bus.

---

