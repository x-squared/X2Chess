## 19. Insurance Authorization — Kostengutsprache

### 19.1 When Authorization Is Required

Swiss health insurers (Krankenkassen) require pre-authorization (Kostengutsprache, KGS) for a defined list of procedures, medications, implants, and certain hospital stays. If a KGS is required and not yet granted, the corresponding order is placed but flagged as **pending authorization** — it cannot be executed until either:

- The KGS is granted (confirmation received via insurer portal or manual entry), or
- The clinician documents a medical emergency override with a reason code

### 19.2 KGS Workflow

```
Order placed
  ↓
System checks KGS requirement (from insurer tariff rules, updated quarterly)
  ↓  [required?]
  ├─ No → order proceeds normally
  └─ Yes → order status = PENDING_KGS
           KGS request auto-generated (pre-filled from order + patient demographics + diagnosis)
             ↓
           Submitted to insurer via electronic channel (insurer-specific API or HL7 FHIR channel)
             ↓
           Insurer responds: GRANTED / PARTIAL / DENIED / INFORMATION_REQUESTED
             ↓
           ├─ GRANTED → order released; KGS reference number stored on order
           ├─ PARTIAL → cost-sharing terms documented; order released with caveat
           ├─ DENIED → order flagged; treating physician receives alert; alternative workflow offered
           └─ INFORMATION_REQUESTED → appeal task created; additional documents attached; resubmitted
```

### 19.3 Insurer Visibility Portal

Insurers are issued a **restricted portal view** (see §37 External Portals). Within their portal, insurer representatives can:

- View pending KGS requests for their insured patients
- Access only the clinical data explicitly submitted as part of the KGS request (not the full record)
- Submit responses (grant, deny, request information) electronically
- View the KGS history for their insured patients

The insurer portal is read-heavy with narrow write access (response submission only). All insurer access is logged with timestamp, user, patient, and data accessed — required for Swiss data protection compliance.

### 19.4 KGS Tracking and Reporting

Finance and case management have a KGS dashboard:

- All pending KGS requests, age-banded (< 24 h, 1–3 days, > 3 days)
- Response rate by insurer
- Denial rate by procedure/diagnosis
- Average approval turnaround time

Denied KGS cases are tracked through appeal. If a denial results in a procedure not being performed, the clinical team is notified and the order is cancelled with a "KGS denied" reason code, preserving the audit trail.

---

