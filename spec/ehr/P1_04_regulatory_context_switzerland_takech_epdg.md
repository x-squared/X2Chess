## 4. Regulatory Context — Switzerland (TakeCH / EPDG)

### 4.1 Key Legislation
- **EPDG** (Bundesgesetz über das elektronische Patientendossier) — federal law mandating EPD participation for hospitals; voluntary for patients
- **EPDV** — implementing ordinance

### 4.2 EPD Communities
Switzerland's EPD is federated through cantonal communities:
- CARA (Romandie)
- axsana (Zurich / Central Switzerland)
- eHealth Aargau
- Others per canton

The system must federate with whichever community serves its patients.

### 4.3 Mandated Standards
- **IHE profiles**: XDS.b (document sharing), PIX/PDQ (patient identity cross-referencing), ATNA (audit trail and node authentication), MHD (mobile health documents), XUA (cross-enterprise user authentication)
- **HL7 FHIR R4** — Swiss national profiles (CH Core, CH EPD)
- **eCH-0107** — Swiss patient identifier (AHV-Nummer / NAVS13 as root identity)
- **Swiss SNOMED CT** national extension
- **Trilingual terminology**: German, French, Italian minimum

### 4.4 Billing Standards
- SwissDRG for inpatient
- TARMED / TARDOC for ambulatory
- Swiss tariff point values per canton

### 4.5 Security & Compliance
- GDPR-compatible data protection (nDSG — revidiertes Datenschutzgesetz)
- Role-based access control to field level
- Full audit trail: every read, write, and delete logged with user identity and timestamp
- Break-glass access for emergencies with post-hoc audit
- Encryption at rest and in transit

---

