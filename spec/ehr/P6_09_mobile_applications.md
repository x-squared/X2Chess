## 51. Mobile Applications

### 51.1 Three Distinct Apps, One Backend

Mobile access is not a single application. Three distinct user populations have fundamentally different needs, different authorization scopes, and different security models:

| App | Users | Authorization | Primary data flow |
|---|---|---|---|
| **Clinician — Physician** | Attending physicians, consultants, on-call | Staff SMART on FHIR scopes | Read-heavy: results, trends, patient lists |
| **Clinician — Nurse** | Ward nurses, ICU nurses | Staff SMART on FHIR scopes | Write-heavy: observations, MAR, assessments |
| **Patient** | Patients, proxy carers | Patient SMART on FHIR scopes | Read: own record; Write: PROs, home monitoring |

All three connect to the same backend through the **FHIR façade** (§13), using SMART on FHIR for authentication and authorization. The FHIR layer acts as the mobile API — purpose-built for exactly this use case. Clinical staff apps may additionally call internal FastAPI endpoints for features not expressible in FHIR (scheduling, resource management).

### 51.2 Technology: React Native

React Native is the right choice for a team already working in React and TypeScript:

- Shared type definitions and FHIR client code between web and mobile
- Single codebase for iOS and Android
- Access to native device capabilities: camera, barcode scanner, biometrics, push notifications, background sync
- React Native's new architecture (JSI / Hermes) is fast enough for the display requirements of all three apps

The PDMS real-time strip chart (§24.9) is the only rendering component that requires a native module — React Native's `Canvas` via `@shopify/react-native-skia` is sufficient for that use case.

### 51.3 Shared Mobile Architecture

All three apps share the same foundation:

```
Authentication
  SMART on FHIR (OAuth 2.0 + OpenID Connect)
  Biometric unlock (Face ID / Touch ID) for session resume
  Certificate pinning for all API connections

Offline-first store
  WatermelonDB (SQLite-backed, React Native optimised)
  Read-heavy data pre-fetched and cached on login/patient selection
  Writes queued locally when offline; synced on reconnect
  Append-only clinical writes (observations, MAR) have no merge conflicts

Push notifications
  APNs (iOS) / FCM (Android) via backend notification service
  Critical alerts use iOS Critical Alert entitlement (bypasses silent mode)
  Notification payload contains patient_id and action type only — no clinical data in push payload (privacy)

Audit
  Every patient record access from mobile logged identically to web access
  Device identifier included in audit log entry
```

**Conflict resolution for offline writes** is straightforward because clinical records are append-only events. A nurse who recorded a medication administration offline and then syncs does not conflict with any other write — the administration is stamped with the time it occurred, not the time it synced. The only case requiring attention is duplicate detection: if a write is re-submitted after an uncertain network failure, idempotency keys prevent double-recording.

---

### 51.4 Physician App

The physician's primary need is fast access to information during ward rounds, on-call response, and consultant review. Data entry is secondary; most physicians prefer to dictate notes rather than type on a phone.

**Core screens:**

```
Patient list
  ├── My patients (primary team)
  ├── On-call list (all ward patients)
  └── Search by name / MRN / room

Patient overview
  ├── Header: name, age, admission date, primary diagnosis
  ├── Active alerts: critical values, NEWS2 deterioration, unacknowledged alarms
  ├── Recent vitals (sparklines — last 24 h per parameter)
  ├── Active medications (simplified — full list on demand)
  ├── Recent lab results (flagged abnormals highlighted)
  └── Active problem list

Results viewer
  ├── Lab trends (time series chart — touch to zoom, pinch)
  ├── Radiology reports
  └── Microbiology (sensitivities, pending cultures)

Notes
  ├── Dictation → server-side transcription → structured note
  ├── Review and sign transcribed note
  └── Read previous notes

Alerts inbox
  ├── Critical lab values (requires acknowledgement)
  ├── Clinical deterioration alerts (NEWS2 threshold breach)
  └── Escalations from nursing staff
```

**Dictation pipeline**: audio recorded on device → uploaded to transcription service (on-premise or cloud, depending on data residency requirements) → returned as draft note text → physician reviews and signs. The transcription is linked to the composition; the original audio is retained for medicolegal purposes.

**On-call specifics**: the on-call physician's app view shows all ward patients grouped by acuity, with the most deteriorating patients surfaced at the top. Alerts arrive as push notifications; tapping opens the patient directly to the relevant result or trend.

---

### 51.5 Nurse App

The nurse app is write-heavy and workflow-driven. Nurses work under time pressure with multiple simultaneous patients; every interaction must be minimal in steps.

**Core screens:**

```
Ward board
  ├── All assigned patients in one view
  ├── NEWS2 score per patient (colour-coded: green/amber/red)
  ├── Pending tasks highlighted (observations overdue, medications due)
  └── Alarm indicators

Medication administration (MAR)
  ├── Due medications listed with time window
  ├── Scan patient wristband barcode → confirms patient identity
  ├── Scan medication barcode → confirms drug, dose, route
  ├── Five-rights check: patient / drug / dose / route / time
  ├── Record administration (one tap after successful scan)
  └── Record omission with reason (refused, unavailable, etc.)

Observations entry
  ├── Vital signs: HR, BP, SpO2, temperature, RR, GCS
  ├── Fluid balance: intake and output entries
  ├── NEWS2 auto-calculated from entered values
  └── Escalation prompt if NEWS2 exceeds threshold

Patient handover
  ├── Structured handover using SBAR format (Situation, Background, Assessment, Recommendation)
  ├── Outstanding tasks for receiving nurse
  └── Pending results

Tasks
  ├── All outstanding nursing assessments for assigned patients
  ├── Sorted by due time
  └── Mark complete in place
```

**Barcode scanning for medication safety** is the most critical feature. The five-rights check (right patient, right drug, right dose, right route, right time) prevents administration errors. The scan confirms each right independently before recording — the system does not allow recording without a successful patient wristband scan and medication barcode scan. Overrides are possible (damaged barcode) but require an explicit reason, are logged, and are flagged for review.

**NEWS2 and escalation**: when a nurse enters observations that trigger a NEWS2 threshold, the app presents an escalation prompt immediately — not after the observation is saved, but as part of the entry flow. The escalation can be sent directly to the on-call physician from within the prompt, generating an alert in the physician app and logging the escalation event.

**Offline-first is non-negotiable** for the nurse app. Ward Wi-Fi in older hospital buildings is unreliable. Observations entered offline are stored locally and sync transparently. The nurse sees no difference in workflow — offline state is indicated by a status indicator only.

---

### 51.6 Patient App

The patient app is architecturally distinct from the clinical apps in three ways: it presents data for health literacy rather than clinical use; patients control their own data sharing (Swiss EPD consent management); and patients can contribute data into the record (home monitoring, symptom reporting).

**Core screens:**

```
Health summary
  ├── Active conditions (plain language descriptions)
  ├── Current medications (name, purpose, dose, when to take)
  ├── Allergies and adverse reactions
  └── Immunisation history

Appointments
  ├── Upcoming appointments (date, location, clinician)
  ├── Request new appointment
  ├── Reschedule or cancel
  └── Pre-appointment questionnaire (sent by clinic, completed here)

Results
  ├── Recent lab results
  │     — value + reference range shown graphically
  │     — plain language: "Your haemoglobin is slightly below normal"
  │     — not shown until clinician has reviewed and released (configurable)
  ├── Reports available (discharge summary, letters — PDF)
  └── Trend view (Hb over last 12 months)

Medications
  ├── Current medication list with instructions
  ├── Discharge medications with reconciliation notes
  └── Medication reminders (optional, local notifications)

Messages
  ├── Secure messaging with care team
  ├── Read receipts
  └── Attachment support (patient can send photos of wounds, rashes, etc.)

My data (patient-generated)
  ├── Blood pressure (manual entry or connected device)
  ├── Blood glucose (manual or CGM integration)
  ├── Weight
  ├── Symptom diary / PRO questionnaires
  └── All entries flow into the clinical record as patient-reported compositions

Documents
  ├── Discharge summaries
  ├── Referral letters
  ├── Imaging reports
  └── Download / share with another provider

EPD consent (Switzerland)
  ├── View which providers have accessed the EPD
  ├── Grant / revoke access per provider
  ├── Set access level (normal / restricted / emergency-only)
  └── Access log (who viewed what, when)
```

**Plain language presentation** is not cosmetic — it is a patient safety requirement. A raw lab value without context causes anxiety or false reassurance. Every result shown in the patient app includes: the value, the reference range for that patient's demographics, a colour indicator, and one sentence of plain-language context. The plain-language text is authored by clinicians per archetype/series type and stored in the series type registry alongside the clinical definition.

**Result release gating**: lab results are not shown in the patient app until a clinician has reviewed and released them. The release is a deliberate act, not an automatic delay. This is configurable per organisation and per result type — some organisations release routine results immediately; others require clinician review for all results.

**Patient-generated data** enters the clinical record as compositions with `recorder_type: patient`. They are stored in the same composition store with a distinct provenance marker. Clinicians see patient-reported data in the timeline alongside clinically recorded data, clearly distinguished. PRO (Patient Reported Outcome) questionnaires are modelled as FHIR Questionnaire / QuestionnaireResponse — the same form engine used for clinical forms.

**Proxy access**: a parent accessing a child's record, or an adult carer accessing an elderly patient's record, requires explicit consent from the patient (where capacity permits) or from a legal guardian. Proxy access is scoped — a carer may be granted access to appointments and medications but not to mental health or reproductive health records. This is enforced at the FHIR authorization layer, not in the app.

**Swiss EPD integration**: the patient app is the primary interface through which Swiss patients exercise their EPD rights — granting and revoking provider access, viewing the access log, and downloading their EPD documents. This requires the app to integrate with the EPD community's patient portal APIs (IHE MHD for document access, PPQM for consent management).

#### Appointment Booking in the Patient App and Web Portal

Appointment booking is available in both the mobile app and the web portal; both connect to the same scheduling backend.

**Booking modes**

Two modes coexist for different appointment types:

| Mode | When used | Patient experience |
|---|---|---|
| **Direct booking** | Follow-up visits, screening, vaccination, explicitly released slot types | Patient selects time, confirms immediately — no staff involvement |
| **Request mode** | Complex first appointments, referral-required specialties | Patient submits request with clinical indication; booking coordinator confirms and allocates |

**Slot release control**

Slots are closed to patient booking by default. The institution releases slots by:
- Appointment type (follow-up, annual check, procedure)
- Department or clinic
- Patient group (patients of a specific physician, patients on a named pathway)
- Insurance class — general, semi-private, private pools are managed independently

Slot release is a configuration action by booking coordinators, not a developer task.

**Post-booking process**

1. Immediate confirmation by push notification, in-app, and optionally email
2. Pre-appointment questionnaire delivered at a configurable interval before the visit (e.g., 7 days)
3. Reminders at 48 hours and 2 hours before
4. Patient may reschedule or cancel up to a configurable cut-off; cancellation returns the slot to the pool or waitlist immediately

**Waitlist**

Patients may join a waitlist for a specific appointment type or clinician. On cancellation:
- Waitlisted patients are notified by push notification in priority order (clinical urgency, then chronological)
- First confirmation takes the slot; others remain on the waitlist
- Patients can leave the waitlist at any time

**Pre-booking interaction**

Before booking, patients can:
- Navigate to the correct appointment type via a guided symptom-to-specialty question flow
- Use an AI assistant for booking guidance — routing and preparation only, not clinical advice
- Send a pre-booking message to the clinic's booking coordinator
- View preparation instructions for the appointment type

**Insurance class reservation**

Slot pools are partitioned by insurance class where required. A patient cannot inadvertently book a slot designated for a different insurance class. Partition ratios are configurable per clinic and per time period.

---

### 51.7 Notification Architecture

Push notifications cross all three apps but with different urgency tiers:

| Tier | Example | Delivery | Clinical app | Patient app |
|---|---|---|---|---|
| **Critical** | Critical lab value, cardiac arrest call | Immediate, bypasses silent mode | Physician + nurse | — |
| **Urgent** | NEWS2 deterioration, medication overdue | Immediate, normal priority | Physician + nurse | — |
| **Standard** | New result available, task assigned | Normal push | All clinical | Result released, message received |
| **Informational** | Appointment reminder, discharge summary available | Scheduled / batched | — | Patient |

**No clinical data in push payloads.** The notification payload contains only patient_id, notification type, and a reference ID. The app fetches the actual data after authentication. This prevents clinical information appearing on lock screens and in notification centres.

**Critical alert implementation (iOS)**: iOS Critical Alerts bypass the device's mute switch and Do Not Disturb settings. This requires an Apple entitlement that must be applied for and justified. It is appropriate for cardiac arrest calls and critical lab values directed at on-call physicians; it is not appropriate for standard clinical notifications.

---

### 51.8 Screen Layouts

The following layouts use a shared design language derived from the My-Ambili project:

| Token | Value |
|---|---|
| Page background | `#f2f7fd` (light blue-grey) |
| Card background | `#ffffff`, border `#d7e3f4`, radius `12px`, shadow `0 4px 14px rgba(12,42,90,0.08)` |
| Header / hero | gradient `#005ca9 → #0a79d1`, white text |
| Primary action | `#005ca9`, white text, radius `8px`, padding `0.55rem 0.85rem` |
| Alert red | text `#8b162f`, bg `#ffe8ed`, border `#ffc0cb` |
| Warning amber | `#d79a1c` / `#b36a08` |
| Success green | bg `#eaf9f0`, border `#93cfac` |
| Inactive / muted | `#9db9d8` |
| Typography | `"Segoe UI", system-ui, -apple-system`, labels 0.85rem uppercase, body 0.92rem |

---

#### 51.8.1 Nurse — Ward Overview (Primary Screen)

The ward overview is the nurse's home screen — the digital equivalent of the bedside whiteboard. It is always the entry point. Patient detail opens from it; the nurse returns to it after each interaction.

**Layout: two-panel (task queue left, ward board right)**

```
╔══════════════════════════════════════════════════════════════════════╗
║  gradient #005ca9→#0a79d1 (12px radius, white text)                 ║
║  Ward 3B  ·  Tagschicht  ·  08:42         [⚠ 2 Alerts]  K. Müller  ║
╠══════════════════╦═══════════════════════════════════════════════════╣
║                  ║                                                   ║
║  AUFGABEN        ║  BETTENBELEGUNG                                   ║
║  ─────────────   ║  ─────────────────────────────────────────────   ║
║  ÜBERFÄLLIG      ║                                                   ║
║  ■ 08:00  B3     ║  ┌──────────────────────────────────────────┐    ║
║    Vitalzeichen  ║  │ B1  Meier, A.  67J  ●NEWS2 1             │    ║
║    [Erfassen ▶]  ║  │     Meds 09:00                           │    ║
║                  ║  ├──────────────────────────────────────────┤    ║
║  ■ 08:30  B7     ║  │ B2  Huber, B.  54J  ●NEWS2 0             │    ║
║    Bilanz        ║  ├──────────────────────────────────────────┤    ║
║    [Erfassen ▶]  ║  │ B3  Keller, C. 68J  ●NEWS2 6  ⚠⚠        │    ║
║                  ║  │     Vital ÜBERFÄLLIG · Eskalation prüfen │    ║
║  NÄCHSTE STD     ║  ├──────────────────────────────────────────┤    ║
║  □ 09:00  B1     ║  │ B4  ─ leer ─                             │    ║
║    Metformin     ║  ├──────────────────────────────────────────┤    ║
║  □ 09:00  B5     ║  │ B5  Schmid, D. 71J  ●NEWS2 2             │    ║
║    Ramipril      ║  │     Meds 09:00                           │    ║
║  □ 09:30  B2     ║  ├──────────────────────────────────────────┤    ║
║    Wundpflege    ║  │ B6  Fischer, E. 82J ●NEWS2 3  ⚠          │    ║
║                  ║  │     SpO2 91% — prüfen                    │    ║
║  SPÄTER          ║  ├──────────────────────────────────────────┤    ║
║  □ 10:00  B6     ║  │ B7  Weber, F.  59J  ●NEWS2 2             │    ║
║    Bilanz        ║  │     Bilanz ÜBERFÄLLIG                    │    ║
║                  ║  └──────────────────────────────────────────┘    ║
║  [+ Aufgabe]     ║                                                   ║
╚══════════════════╩═══════════════════════════════════════════════════╝
```

**Design notes:**
- NEWS2 badge colour: `#eaf9f0` / `#93cfac` border for 0–2; `#d79a1c` for 3–4; `#8b162f` / `#ffe8ed` for 5+
- Overdue tasks in the left panel use `#ffe8ed` row background with `#8b162f` label
- Each bed row is a card (`#ffffff`, `#d7e3f4` border, `12px` radius); tapping opens patient detail
- The right panel is scrollable; left task queue is fixed
- On a phone (single-column): task queue collapses to a badge count in the header; ward board occupies full width

---

#### 51.8.2 Nurse — Patient Detail

Opened by tapping a bed row. The back arrow always returns to the ward overview — the nurse is never "lost" inside a patient record.

```
╔══════════════════════════════════════════════════════════════════════╗
║  ← Ward 3B   Keller, Christian  68J  ·  Bett 3  ·  Fall 2026-001234║
║  [⚠⚠ NEWS2 6 — Eskalation empfohlen]                                ║
╠═══════════════════╦══════════════════════════════════════════════════╣
║  VITALZEICHEN     ║  AUFGABEN                                        ║
║  ──────────────   ║  ─────────────────────────────────────────────   ║
║  HF      98 /min  ║  ■ ÜBERFÄLLIG                                   ║
║  BD   148/92 mmHg ║    08:00  Vitalzeichen      [Jetzt erfassen ▶]  ║
║  Temp   37.8 °C   ║                                                  ║
║  SpO2    96 %     ║  □ 09:00  Metformin 500mg   [Bestätigen ▶]      ║
║  AF      20 /min  ║  □ 09:00  Ramipril 5mg      [Bestätigen ▶]      ║
║                   ║  □ 10:00  Wundverbandwechsel [Erfassen ▶]       ║
║  NEWS2   6  ⚠⚠   ║                                                  ║
║                   ║  BILANZ                                          ║
║  [Vital erfassen] ║  ─────────────────────────────────────────────   ║
║                   ║  Einfuhr  350 ml  ·  Ausfuhr  200 ml            ║
║  WARNUNGEN        ║  Bilanz   +150 ml                                ║
║  ────────────     ║  [+ Eintrag]                                     ║
║  ⚠ NEWS2 ↑        ║                                                  ║
║  ⚠ Meds überfäll. ║  NOTIZEN                                         ║
║                   ║  ─────────────────────────────────────────────   ║
║  [Eskalieren ▶]   ║  08:30  Patient unruhig, Schmerz 6/10.          ║
║                   ║         Dr. Kessler informiert 07:30.            ║
║                   ║  [+ Notiz]                                       ║
╚═══════════════════╩══════════════════════════════════════════════════╝
```

**Design notes:**
- Alert banner below header: `#ffe8ed` background, `#8b162f` text, full-width
- Vital values in the left panel: large `1.2rem` bold numerals, unit in `0.82rem #44678f`
- [Eskalieren] primary button: `#005ca9`, escalation creates an alert in the physician app and logs the event
- Overdue task row: `#ffe8ed` background, solid `#8b162f` left border `4px`

---

#### 51.8.3 Physician — Desktop Layout (Primary)

The physician's desktop view is the richest layout in the system. Three panels are always visible simultaneously. The center panel is tabbed; switching tabs does not lose context in the left or right panels.

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║  gradient #005ca9→#0a79d1                                                            ║
║  Keller, Christian · 68J · Bett 3, Ward 3B · Fall 2026-001234                       ║
║  Hüftersatz rechts · Tag 2 postop · ⚠ NEWS2 6 · Dr. A. Meier (verantw.)             ║
╠════════════════════╦═════════════════════════════════════╦═════════════════════════╣
║  KONTEXT           ║  [Befunde] [Notizen] [Aufträge]      ║  TRENDS  letzte 24h     ║
║  ─────────────     ║             [Pathway] [Medikation]   ║  ─────────────────────  ║
║                    ║  ──────────────────────────────────  ║                         ║
║  Probleme          ║  AKTUELLE BEFUNDE          08:15     ║  HF  ▁▂▄▆▇█▇▆  98       ║
║  ─────────────     ║  CRP       142  ↑↑  ⚠               ║  BD  ────────── 148/92   ║
║  Hüftersatz        ║  Leukozyten 11.2  (norm)             ║  T°  ────────── 37.8°    ║
║  Diabetes T2       ║  Hb         9.8  ↓  ⚠               ║  SpO2 ───────── 96%      ║
║  Hypertonie        ║  Kreatinin  88   (norm)              ║                         ║
║  [+]               ║                          [Alle ▶]    ║  VERLAUF                ║
║                    ║                                      ║  ─────────────────────  ║
║  Pathway           ║  NOTIZEN                             ║  08:30 Visite Dr.Meier  ║
║  ─────────────     ║  ─────────────────────────────────── ║  08:15 Blut resultiert  ║
║  ✓ Tag 1 Visite    ║  08:30  Dr. A. Meier                 ║  07:00 Vitalzeichen     ║
║  ● Tag 2 Visite    ║  Patient febril, CRP erhöht.         ║  06:00 Vitalzeichen     ║
║  □ Physio          ║  Wundinspektion: leichte Rötung.     ║  Gestern                ║
║  □ Entlassplanung  ║  Analgesie gesteigert.               ║  20:00 Pflegenotiz      ║
║  [Pathway ▶]       ║  Blutkulturen bestellt.              ║  18:00 Meds verabreicht ║
║                    ║  [+ Notiz]  [Diktieren 🎤]           ║  16:30 Physio           ║
║  Medikamente       ║                                      ║  [Vollständig ▶]        ║
║  ─────────────     ║  AKTIVE AUFTRÄGE                     ║                         ║
║  Metformin 500mg   ║  ─────────────────────────────────── ║                         ║
║  Ramipril 5mg      ║  Paracetamol 1g IV  q6h   [Aktiv]   ║                         ║
║  Enoxaparin 40mg   ║  Blutkulturen x2        [Ausstehend] ║                         ║
║  [Alle / + Auftrag]║  [+ Neuer Auftrag]                   ║                         ║
╚════════════════════╩═════════════════════════════════════╩═════════════════════════╝
```

**Design notes:**
- Left sidebar: `#f2f7fd` background, `0.85rem` uppercase section labels in `#44678f`
- Center panel: white card, tab strip using segment-button style (`#edf5ff` bg, `#0d3c79` text, `#bdd4ec` border)
- Active tab: `#005ca9` underline `3px`, bold text
- Right panel: `#f2f7fd` background; sparkline bars use gradient `#2b87d8 → #0d5cad`, inactive bars `#9db9d8`
- Abnormal lab values: `#8b162f` text, `↑↑` or `↓` suffix; background row `#ffe8ed`
- Pathway steps: `✓` in `#93cfac`, `●` (active) in `#005ca9`, `□` in `#9db9d8`
- [Diktieren] launches the voice-to-note pipeline from §51.4

---

#### 51.8.4 Physician — Mobile / Ward Round (Compact)

On a phone during ward rounds, the three-panel layout collapses to a single-column priority view. The goal is: essential information in under three seconds; action in under five taps.

```
╔══════════════════════════════════════╗
║  gradient #005ca9→#0a79d1           ║
║  Keller, C.  68J  Bett 3            ║
║  Fall 2026-001234  Tag 2 postop      ║
╠══════════════════════════════════════╣
║  ⚠⚠ NEWS2 6 · Eskalation prüfen    ║
║  (#ffe8ed banner, #8b162f)           ║
╠══════════════════════════════════════╣
║  VITALZEICHEN          07:00         ║
║  HF 98  BD 148/92  SpO2 96%         ║
║  T° 37.8°  AF 20                    ║
╠══════════════════════════════════════╣
║  BEFUNDE               08:15         ║
║  CRP 142 ↑↑⚠  Hb 9.8 ↓⚠            ║
║  Leukozyten 11.2 (norm)              ║
║  [Alle Befunde ▶]                    ║
╠══════════════════════════════════════╣
║  LETZTE NOTIZ          08:30         ║
║  Dr. Meier: Febril, CRP erhöht.     ║
║  Wundinspektion: leichte Rötung...   ║
║  [Vollständig ▶]                     ║
╠══════════════════════════════════════╣
║  AKTIVE AUFTRÄGE                     ║
║  Paracetamol 1g IV q6h  [Aktiv]     ║
║  Blutkulturen x2  [Ausstehend]       ║
╠══════════════════════════════════════╣
║  ┌────────┐ ┌────────┐ ┌──────────┐ ║
║  │Diktier.│ │Auftrag │ │Pathway   │ ║
║  │  🎤   │ │  + Rx  │ │  →       │ ║
║  └────────┘ └────────┘ └──────────┘ ║
╚══════════════════════════════════════╝
```

**Design notes:**
- Three bottom action buttons: primary blue (`#005ca9`), equal width, `12px` radius
- Each section is a card (`#ffffff`, `#d7e3f4` border) with `0.85rem` uppercase section label
- Alert banner is always pinned directly below the patient header — never scrolls away
- All data shown is from projection tables — no composition fetches on the hot ward-round path; sub-100ms load target

---

#### 51.8.5 Design Principles Across All Layouts

| Principle | Application |
|---|---|
| Episode context always visible | Fallnummer and episode type in every header |
| Alert banner never scrolls away | Pinned below patient header; `#ffe8ed` / `#8b162f` |
| NEWS2 colour-coded consistently | Green 0–2 · Amber 3–4 · Red 5+ across all surfaces |
| One primary action per screen | The most likely next action is always a prominent `#005ca9` button |
| Role separation | Nurse layout is task/action-first; physician layout is information/context-first |
| Data shown from projections only | No raw composition queries on any hot UI path |

---

