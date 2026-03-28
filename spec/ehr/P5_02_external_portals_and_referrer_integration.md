## 37. External Portals and Referrer Integration

Three external-facing portals serve distinct user populations with distinct authorization scopes. All three share the same scheduling, clinical record, and notification backend; they differ in what data is visible, what actions are permitted, and what identity mechanism is required.

| Portal | Primary users | Core capability |
|---|---|---|
| **Referrer Portal** | GPs, specialists, outpatient clinics | Appointment booking, referral submission, report access |
| **Orders Portal** | External labs, pathology requestors, imaging requestors | Order submission, result retrieval, billing |
| **Direct Contact / CRM** | Hospital booking coordinators (internal) | Telephony-assisted intake, referrer master data, manual referral processing |

The patient portal is covered in §51.6.

---

### 37.1 Referrer Portal

#### Structure and Navigation

The portal is organised by clinical intent, not by internal department structure. A referring physician navigating to "book an appointment for a patient with chest pain" should reach the correct cardiology booking flow in three interactions or fewer — without knowing how the hospital organises its departments.

Navigation paths:
- Book an appointment → specialty selector → appointment type → availability → confirm
- Check a referred patient's status → patient search (own referred patients only) → timeline view
- Retrieve a report → patient search → document list → download or view
- Submit a referral → referral form (pre-populated from PIS where integrated)

#### Accessible Resources

| Resource | Access | Release mechanism |
|---|---|---|
| Appointment availability | Always available to authenticated referrers | Slots released by booking coordinators (see §51.6) |
| Referred patient data | Scoped to own referred patients only | Active referral relationship required |
| Clinical reports and letters | Per-patient, per-document | Explicit release by responsible clinician |
| Imaging reports | Per-patient | Clinician release; images require additional authorisation |
| Referral status | Always — own referrals only | Real-time |

#### Portal Configuration

Configurable by clinical and administrative staff without developer involvement:
- Clinic-specific landing pages and content
- Which appointment types are bookable externally and at what trust level
- Which document types are auto-released vs require manual release
- Referrer group definitions and their access scope

#### Data Visibility Control

Visibility is governed by three independent rules evaluated in order:
1. **Patient consent** — patient may restrict access to specific data categories
2. **Referral relationship** — referrer can only see data for patients they have actively referred
3. **Institution release policy** — per data type (auto-release, manual release, restricted)

All three rules must permit access; any restriction in any rule blocks access. The rules are configurable without code changes.

#### Booking Access and Trust Levels

```
Unverified referrer        → Request only; institution confirms every booking
HIN-authenticated referrer → Direct booking within designated external slots
Trusted partner            → Direct booking across broader slot pool
Emergency (EMS / Rega)     → Immediate booking; pre-arrival protocol triggered
```

Trust level is assigned per referring physician or per organisation. Changes take effect immediately. All booking actions are logged with the referrer's identity and trust level at time of booking.

#### Referrer–Patient Interaction

The referrer portal and patient app share a common backbone for appointments and secure messaging:
- A referring physician can initiate an appointment request that the patient confirms in the patient app
- Secure messaging between referrer and patient is mediated by the institution — direct unmediated contact is not provided
- A patient may share selected data from the patient app with their referring physician, subject to consent settings

#### Authentication — HIN and Identity Providers

| Method | Use case |
|---|---|
| **HIN identity** | Primary Swiss referrer authentication; automatic trust-level elevation |
| **Swiss eID** | Alternative for referring physicians without HIN |
| **SMART on FHIR / OIDC** | PIS-integrated access (system-to-system or delegated) |
| **SAML 2.0** | Institutional federation (hospital networks, cantonal health authorities) |

HIN-authenticated referrers receive a verified trust level automatically. The system supports HIN's EPD-IDP authentication profile for EPD-connected workflows. HIN Connect is used for encrypted document exchange where required.

#### Barriers to Adoption

| Barrier | Countermeasure |
|---|---|
| Additional login on top of PIS | SSO via HIN; PIS deep integration eliminates separate login |
| Portal is slower than calling | Core booking flow ≤ 3 interactions; faster for common tasks by design |
| Uncertain which data USZ can see | Explicit display of data visible to the institution |
| No feedback after referral | Real-time push: referral received → appointment confirmed → report available |
| Low IT literacy in small practices | Mobile-first design; no training required for core workflows |

---

### 37.2 Orders Portal (Pathology, Radiology, Laboratory)

External organisations submit diagnostic orders and retrieve results through the orders portal. The portal is functionally distinct from the referrer portal: it serves organisations (not individual physicians as primary users) and handles order workflows, not care coordination.

#### Order Submission

Orders are submitted digitally via the portal or via PIS integration (see §36). Physical post is supported as a documented fallback with a manual intake workflow. Each submitted order includes:
- Patient demographics and insurance information
- Clinical indication and relevant history
- Order type and any special instructions
- Accompanying samples, documents, or prior imaging

On submission, the system:
- Matches the patient against the MPI (AHV-Nummer / NAVS13 as primary identifier)
- Routes the order to the correct internal department (LIS, RIS, or pathology) via KIS
- Returns an order confirmation number to the submitter

#### Automatic Patient Data Import

On patient match, clinical data relevant to the order type is surfaced to the reporting clinician without re-entry. Follow-up orders (additional staining, confirmatory assay) can be triggered directly from the result screen and are automatically linked to the originating order.

#### Guidance for Requestors

At order submission, the portal provides:
- Sample collection instructions specific to the ordered test
- Checklist of required accompanying documentation
- Warnings if the patient's accessible clinical data indicates a contraindication or special handling requirement

#### Second Opinion Support

For patients referred for a second opinion:
- Prior imaging, pathology slides, and reports are uploaded at referral time
- The reporting clinician sees prior findings alongside the new assessment in a structured comparison view
- The new report can annotate and reference the prior findings

#### Cumulative Findings

Cumulative findings reports aggregate results from multiple sources — internal historical results (LIS, RIS), results transmitted by the referring organisation, and results from previous episodes. These are available as structured views and as exportable documents.

#### KIS — LIS — RIS — Billing Integration

Orders flow without manual re-entry:

```
Portal / PIS (order entry)
  → KIS (clinical context and order management)
  → LIS (laboratory) or RIS/PACS (radiology) or Pathology system
  → Result returned to KIS → updates order status
  → Billing event triggered in SAP
```

No field is entered twice. Each system is authoritative for its own domain; integration is event-driven.

#### Billing for External Orders

| Order type | Billing target |
|---|---|
| Patient-linked order, insured patient | Patient's insurer (standard TARMED/SwissDRG flow) |
| Patient-linked order, self-paying | Patient invoice |
| Order without patient reference (research, environmental) | Direct invoice to the submitting organisation |

Billing rules per order type are configurable without code changes.

---

### 37.3 Direct Contact — Referrer CRM and Telephony Integration

Despite digital channels, direct telephone contact from referring physicians remains common. Staff handling these calls are supported by the system so that every incoming referral is captured correctly with minimum manual effort.

#### Referrer Master Data (CRM)

A referrer register is maintained as a first-class domain within the system:
- Individual physicians and their practice affiliations
- Specialty, language preference, and preferred communication channel
- Trust level and booking permissions (shared with the referrer portal)
- Active referrals and patients currently in the institution linked to this referrer
- Full contact log: calls, portal activity, messages — chronological and searchable

The register is the single source of truth for all referrer interactions. It is updated from portal activity, PIS integrations, and manual entries.

#### Telephony Integration (CTI)

```
Incoming call
  → Number matched against referrer register
  → On match: referrer context opens automatically
      — referrer profile
      — their active referrals
      — their patients currently in the institution
  → On no match: new referrer entry pre-populated from number lookup
                 staff completes and confirms
  → Call logged in referrer's contact history (timestamp, staff member)
```

The telephony integration is a CTI (Computer Telephony Integration) connection to the hospital PBX. It does not require staff to search manually — the correct context is open before they speak.

#### Scheduling During Direct Contact

From the open referrer context, the booking coordinator can:
- Access appointment availability without navigating away
- Create a referral record and book the appointment in a single workflow
- Send the confirmation to the referrer by their preferred channel (portal notification, HIN mail, SMS) without leaving the current screen

#### Manual Referral — Document Intake and Structured Import

Referrals arriving by fax, post, or email:
1. Document scanned or uploaded and attached to the referral record
2. AI extraction (see §27) pre-populates structured fields from the document
3. Staff reviews and confirms extracted data — no re-keying
4. Confirmed data immediately available in the patient record

High-confidence extractions can be confirmed by administrative staff. Low-confidence or clinically complex extractions are routed to a designated clinical reviewer.

---



Practice Information Systems (PIS) used by referring physicians can integrate directly with the hospital system. The goal is that the referring physician never needs to leave their familiar PIS environment for common tasks.

### 37.4 Standard Interface

The integration is based on **HL7 FHIR R4** as the canonical interface standard. The hospital exposes a FHIR endpoint; the PIS connects to it. Where a PIS does not support FHIR natively, an adapter translates to/from common Swiss PIS formats.

### 37.5 Bidirectional Data Exchange

| Exchange | Direction | FHIR resource |
|---|---|---|
| Appointment request / booking | PIS → hospital | `Appointment`, `Schedule`, `Slot` |
| Appointment confirmation / cancellation | Hospital → PIS | `Appointment` status update |
| Patient demographics | Bidirectional | `Patient`; AHV-Nummer as primary identifier |
| Referral (clinical indication, diagnoses) | PIS → hospital | `ServiceRequest`, `Condition` |
| Documents and images | PIS → hospital | `DocumentReference`, DICOM via IHE MHD |
| Reports and letters | Hospital → PIS | `DocumentReference`, `DiagnosticReport` |
| Lab and radiology results | Hospital → PIS | `DiagnosticReport`, `Observation` |
| Order status updates | Hospital → PIS | `ServiceRequest` status |

All exchanges are event-driven: the hospital system pushes status changes to the PIS via FHIR subscriptions (R4 topic-based subscription or webhook).

### 37.6 Swiss PIS Integrations

Documented integrations (Switzerland only) — to be completed by implementation team. Integration candidates include systems conformant with the Swiss EPD FHIR profiles and HIN Connect transport.

### 37.7 Authentication

| Mechanism | Use |
|---|---|
| **HIN Connect / HIN API** | Organisation-level trust anchor; practice as a trusted entity |
| **OAuth 2.0 client credentials** | System-to-system (non-interactive) flows |
| **HIN EPD-IDP** | EPD-connected document exchange requiring EPD authentication |

A PIS authenticating via HIN automatically inherits the trust level of the practice, which maps to the referrer portal trust model (§37.1). No separate credential management is required.

---

