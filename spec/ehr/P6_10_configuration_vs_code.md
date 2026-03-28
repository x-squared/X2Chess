## 52. Configuration vs Code

### 52.1 The Traditional Argument for Configuration

The standard case for defining clinical logic as configuration (JSON pathway definitions, score formulas, SOP checklists, form templates) has been:

- **Non-developer maintenance**: clinical informaticians can update a pathway definition without involving a software engineer
- **Runtime modifiability**: a JSON definition can be loaded into a running production system without a deployment cycle
- **Auditability**: a JSON file can be diff'd, reviewed, and approved by clinical governance without reading code
- **Regulatory traceability**: in IEC 62304 (medical device software lifecycle), configuration is both the specification and the implementation — one artefact satisfies both

### 52.2 The AI-Coding Challenge to This Argument

With AI-assisted coding, a developer — or increasingly a clinical informatician with AI assistance — can generate and iterate a React form component, a score formula, or a pathway step handler in seconds. The productivity argument for avoiding code weakens substantially.

If generating code is as fast as filling in a form builder, and the result is more flexible (code can express anything; a config DSL can only express what its designers anticipated), why maintain a configuration layer at all?

### 52.3 Where Configuration Remains Superior

Despite AI-coding, three arguments for configuration remain strong:

**Runtime modifiability in regulated systems.** A code change in a regulated medical device triggers a software change process: impact assessment, re-testing of affected paths, possibly a new software version with updated documentation. A configuration change to a pathway definition or score formula can be governed by a lighter clinical governance process — a clinician signs off the JSON diff; no re-deployment, no software version bump. This is a significant operational advantage in a clinical environment where pathways are updated every few months.

**Clinician reviewability.** The entity who approves a NEWS2 threshold definition is a consultant physician, not a software engineer. A structured JSON definition with named fields is reviewable by that physician. Python code with a lookup table is not. The configuration layer is the interface between clinical governance and software. AI-coding does not eliminate this interface — it only changes who can write on the software side of it.

**Separation of concerns at organisational scale.** A hospital deploying this system will want to customise pathways for their patient population, local drug formulary, and departmental workflows without touching the software codebase. Configuration enables this: each institution maintains its own pathway and score definitions; the engine is shared software. Coding requires either forking the codebase or writing extension points — both are architecturally expensive.

### 52.4 Where Code Wins

**Forms.** The original argument for FHIR Questionnaire as the form definition format was partly developer convenience. With AI-coding, generating a type-safe React form component from a natural language description is fast and produces better results (type checking, IDE support, test coverage) than a runtime-interpreted Questionnaire renderer. For forms that are unlikely to change at governance cadence (standard intake forms, demographic capture), generated code is a reasonable alternative.

**Integrations and edge cases.** Non-standard device protocols, complex billing rules with unusual tariff logic, specialty-specific workflow variations — these are better expressed as code than as strained configuration. A configuration DSL that tries to cover every case becomes an unmaintainable ad-hoc programming language.

### 52.5 The Rule

> **Configure what changes at governance cadence. Code the engines that execute it.**

| Artefact | Approach | Rationale |
|---|---|---|
| Pathway definitions | Configuration (JSON) | Updated by clinical governance; runtime-modifiable; clinician-reviewable |
| Score formulas | Configuration (JSON) | Same; must be approvable by clinical experts without reading code |
| SOP checklists | Configuration (JSON) | Govenance-controlled; linked to regulatory obligations |
| Condition expression evaluator | Code | The engine; changes rarely; requires testing |
| Score computation engine | Code | The engine; not the definitions |
| Standard clinical forms | Configuration (FHIR Questionnaire) | Runtime-modifiable; governance-controlled |
| Bespoke complex forms | Generated code (AI-assisted) | Better type safety; appropriate when form is stable and complex |
| Device integration adapters | Code | Vendor-specific; cannot be genericised |

---

