## 38. Swiss EPD Integration

The Swiss EPD layer is a **façade** — it does not pollute the internal data model.

```
Internal clinical store
  → Composition stored
  → FHIR resource generated on demand (or on trigger)
  → Submitted to EPD community XDS.b repository
  → IHE ATNA audit record written

Patient identity
  → Internal patient_id
  → EPD MPI lookup via PIX query → EPD patient identity
  → AHV-Nummer / NAVS13 as national root identifier

Document sharing
  → XDS.b metadata: class code, type code, confidentiality, language
  → Swiss CH EPD FHIR profile compliance
  → MHD for mobile access
```

The FHIR conversion is a mapping layer — internal compositions are projected to FHIR resources using registered archetype → FHIR mappings. The internal model is not constrained to FHIR's resource granularity.

---

