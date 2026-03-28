## 27. Prevention and Population Health

Prevention and population health is a distinct module with its own data model, workflow engine, and patient-facing interface. It is not a sub-feature of the clinical record module.

### 27.1 Preventive Care in the Clinical Context

When a relevant patient is opened, the clinical workspace surfaces outstanding prevention and screening recommendations:
- Overdue or upcoming screening is displayed as a contextual alert (not a blocking interruption)
- A preventive care plan can be added to the patient record and tracked alongside clinical pathways
- Completed screening is linked to the clinical composition that satisfied it

### 27.2 Prevention Standards Registry

Screening and prevention standards are maintained as configurable rule sets — not hardcoded:

```
Rule: Colorectal cancer screening
  Eligible population: age 50–74, both sexes
  Interval: every 2 years (FOBT) or 10 years (colonoscopy)
  Trigger: no qualifying composition in the eligible interval
  Action: add to recall list; notify via patient app
```

Rules specify:
- Eligible population (age, sex, diagnosis, risk factors)
- Screening interval and test type
- Action to trigger (recall letter, patient app notification, booking invitation)

Rules are updated centrally; updates propagate immediately to all clinical contexts without code deployment. Sources: BAG guidelines, EKIF vaccination schedule, SSPH / Swiss Cancer Screening Programme.

### 27.3 Population Identification and Recall

Authorised staff generate recall lists from population queries:

```
Example: "All patients over 50 with Type 2 diabetes and no HbA1c
          recorded in the last 6 months"
```

The query runs against the projection store — not raw compositions. Results are available within seconds for practice-scale populations.

Outreach actions per patient on the recall list:
- Automated letter (postal or digital)
- Patient app push notification with direct booking link
- Direct booking invitation (slot reserved for recall patients)

All recall actions are logged in the patient record with timestamp and source rule.

### 27.4 Prevention Workflows

Prevention programmes are modelled as clinical pathways (§13):
- A vaccination campaign pathway, a colorectal screening recall pathway, a cardiovascular risk assessment programme
- Pathways can include automated patient communication steps
- Step completion is triggered by the relevant composition being recorded (the same event-driven pathway advance described in §13)
- Completion rates and drop-out rates are reportable for quality management and programme evaluation

### 27.5 Patient App — Prevention for Non-Registered Individuals

Prevention features in the patient app are accessible without being an existing patient of the institution:
- **Symptom screening tools** — routing and triage guidance only; not clinical diagnosis
- **Vaccination reminders** — based on age and self-reported vaccination history
- **Screening appointment booking** — as a new patient; registration is created on first booking
- **Health literacy content** — aligned with BAG prevention campaigns, available in German, French, and Italian

Non-registered users are identified by a lightweight account (email + phone). Their prevention record is merged with the full patient record on their first clinical registration.

---

