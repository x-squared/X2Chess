# P5_08 Role-Based Access Control

This chapter is the authoritative specification for all access control in the system. Every question of "who may see or do what" is answered here. Other chapters that touch on access (P5_04 Privacy and Security, P6_17 Element Identity) defer to this chapter for the access model; they describe the mechanisms that implement it.

---

## Overview

The access control system has three layers that always work together:

| Layer | What it controls | Unit of permission |
|---|---|---|
| **GUI** | Which elements are visible or interactive | Element ID (`view`, `panel`, `widget`, `dialog`, `toolbar`) |
| **Service** | Which operations may be invoked | Element ID (`service.read`, `service.write`, `service.delete`) |
| **Data** | Which patient and episode records appear in results | Data scope predicate |

The resource vocabulary for the first two layers is the Element Registry (P6_17). The third layer uses the Organisation Model and Data Scope language defined in this chapter.

The three layers are always enforced together. A user who can call a read service but has no data scope sees an empty result — not an error. A user whose GUI profile shows a panel but whose service profile denies the backing read service sees the panel shell with an access-denied message. Consistency between layers is a configuration responsibility, not a runtime guarantee.

---

## Profiles

A **profile** is the central unit of access configuration. It is a named, versioned collection of rules across all three layers. Profiles are data, not code — they are authored in the administration UI and stored in the rule registry (P6_14 §56.1), not deployed as application changes.

### Structure

```
profile <name> [version] {

  gui {
    allow | deny  <element-id-pattern>
    …
  }

  services {
    allow | deny  <element-id-pattern>
    …
  }

  data {
    scope:            <data-scope>
    episode_types:    [<type>, …]
    temporal:         <temporal-scope>
    sensitivity:      [<flag>, …]
  }

}
```

### Element ID Patterns

Patterns follow the `domain.type.concept` naming (P6_17) with `*` as a wildcard at any segment:

```
vitals.*.*          — all elements in the vitals domain
*.service.read.*    — all read services across all domains
orders.widget.*     — all widgets in the orders domain
```

`deny` takes precedence over `allow` within the same profile. A more specific pattern does not override a less specific one — precedence is solely deny-over-allow.

### Profile Example

```
profile nursing_base {

  gui {
    allow  view.*
    allow  panel.vitals.*
    allow  panel.medication.*
    allow  panel.orders.*
    allow  panel.episode.*
    deny   panel.billing.*
    deny   panel.quality_management.*
    allow  widget.orders.order_set_picker
    deny   widget.orders.delete_draft
    allow  dialog.medication.*
    deny   dialog.discharge.*
  }

  services {
    allow  *.service.read.*
    allow  medication.service.write.administration
    allow  vitals.service.write.*
    allow  nursing.service.write.*
    deny   *.service.delete.*
    deny   orders.service.write.prescribe
  }

  data {
    scope:          ward
    episode_types:  [inpatient, day_clinic]
    temporal:       active_only
    sensitivity:    []
  }

}
```

```
profile physician_base {

  gui {
    allow  view.*
    allow  panel.*
    deny   panel.billing.*
    allow  dialog.*
  }

  services {
    allow  *.service.read.*
    allow  orders.service.write.*
    allow  medication.service.write.*
    allow  vitals.service.write.*
    deny   billing.service.write.*
  }

  data {
    scope:          department
    episode_types:  [inpatient, outpatient, day_clinic, emergency]
    temporal:       active_plus_90_days
    sensitivity:    []
  }

}
```

```
profile psychiatry_access {
  /* Additive profile — grants sensitivity access only */
  gui     {}
  services {}
  data {
    scope:       inherit        /* does not change scope, only adds sensitivity */
    sensitivity: [psychiatry]
  }
}
```

```
profile quality_manager {

  gui {
    allow  view.*
    allow  panel.*
    allow  panel.quality_management.*
    allow  panel.billing.*
  }

  services {
    allow  *.service.read.*
    deny   *.service.write.*
    deny   *.service.delete.*
  }

  data {
    scope:          institution
    episode_types:  [inpatient, outpatient, day_clinic, emergency]
    temporal:       all
    sensitivity:    []
  }

}
```

---

## Profile Composition

Profiles can be combined to build more specific profiles. The result is a new named profile with its own version history.

```
profile head_nurse =
    nursing_base
  + nursing_escalation_authority
  + staff_schedule_view
```

```
profile icu_physician =
    physician_base
  + icu_specialist_panels
  + ventilator_service_write
  + pdms_full_access
```

**Composition rules:**

1. GUI and service rules from all component profiles are merged. `deny` wins over `allow` across components — a `deny` in any component propagates to the composed profile.
2. Data scope takes the **broadest** scope among components (e.g., `department` + `ward` = `department`). Episode type and temporal scope are unioned. Sensitivity flags are unioned.
3. A composed profile may add explicit overrides after the composition to flip specific inherited denies:

```
profile senior_pharmacist =
    pharmacist_base
  + clinical_review_access
  override {
    gui { allow panel.prescribing.physician_intent }   /* re-allows one inherited deny */
  }
```

4. Circular composition is a validation error caught at authoring time.
5. Composition is shallow — the composed profile records which component profiles it is built from, but resolves into a flat rule set at runtime. There is no runtime profile stack.

---

## Roles

A **role** is a named function in the organisation (Nurse, Attending Physician, Clinical Informatician, Ward Clerk). A role is associated with one or more profiles and declares which qualification dimensions apply to it.

### Role Definition

```
role NURSE {
  profiles:      [nursing_base]
  qualified_by:  [ward]
  description:   "Registered nurse — access scoped to assigned ward"
}

role HEAD_NURSE {
  profiles:      [head_nurse]           /* composed profile */
  qualified_by:  [department]
  description:   "Head nurse — access scoped to assigned department"
}

role PHYSICIAN_ATTENDING {
  profiles:      [physician_base]
  qualified_by:  [department]
  description:   "Attending physician — access scoped to department"
}

role ICU_PHYSICIAN {
  profiles:      [icu_physician]        /* composed profile */
  qualified_by:  [ward]
  description:   "ICU physician — access scoped to ICU ward"
}

role CLINICAL_INFORMATICIAN {
  profiles:      [clinical_informatician_base]
  qualified_by:  [facility]
  description:   "Authors archetypes, rule-sets, and pathways"
}

role QUALITY_MANAGER {
  profiles:      [quality_manager]
  qualified_by:  [institution]
  description:   "Read-only access across the institution for quality analysis"
}

role SYSTEM_ADMIN {
  profiles:      [system_admin]
  qualified_by:  [institution]
  description:   "System configuration — no patient data access"
}
```

### Role Qualifications

A qualification constrains the **scope** at which a role applies. Without a qualification, a role's data scope would be unrestricted. The qualification shrinks the effective data scope to the user's position in the organisation.

| Qualification level | Effective data scope | Typical roles |
|---|---|---|
| `ward` | Only patients on the user's assigned ward(s) | NURSE, ICU_PHYSICIAN |
| `department` | All patients in the user's department | PHYSICIAN_ATTENDING, HEAD_NURSE |
| `facility` | All patients at the user's facility | Facility medical director |
| `institution` | All patients across the institution | QUALITY_MANAGER, SYSTEM_ADMIN |

A user may hold multiple roles simultaneously, each with its own qualification. The resolved effective profile is the union of all granted profiles with their respective qualifications applied. Data scope is the broadest scope across all active role assignments.

---

## Organisation Model

The organisation model maps the real structure of the healthcare institution. It provides the vocabulary for role qualifications and for data scope predicates in profiles.

### Hierarchy

```
Institution  (e.g., "Regionalspital Muster AG")
  └── Facility  (e.g., "Haupthaus", "Praxis Muri")
       └── Department  (e.g., "Innere Medizin", "Chirurgie", "ICU")
            └── Ward  (e.g., "Station 3A", "ICU-1", "Notaufnahme")
                 └── Team  (e.g., "Frühdienst Station 3A")  [optional leaf]
```

Each node carries:

```json
{
  "id":          "dept:MED",
  "code":        "MED",
  "name":        "Innere Medizin",
  "type":        "department",
  "parent":      "facility:HH",
  "facility":    "facility:HH",
  "institution": "inst:RSM",
  "active":      true
}
```

The full ancestry is always materialised on each node so that scope queries do not require tree traversal at runtime.

### User Org Assignment

Each user has one or more org assignments, each tied to a role:

```json
{
  "user_id": "u-4421",
  "assignments": [
    {
      "role":     "NURSE",
      "facility": "facility:HH",
      "department": "dept:MED",
      "ward":     "ward:3A"
    },
    {
      "role":     "NURSE",
      "facility": "facility:HH",
      "department": "dept:MED",
      "ward":     "ward:3B"          /* covers two wards */
    }
  ]
}
```

A user with two ward assignments under the same role has data access to both wards simultaneously — qualifications are additive.

### Organisation in Profile Rules

Profiles can also reference org nodes directly in their rules, which is useful for domain-specific access that is facility-specific by nature rather than user-position-specific:

```
profile radiology_worklist {
  /* Only applies when the user's assignment is within a radiology department */
  org_constraint: { department_type: "radiology" }
  services {
    allow  radiology.service.read.*
    allow  radiology.service.write.worklist_claim
  }
  data {
    scope:         facility
    episode_types: [inpatient, outpatient, emergency]
    temporal:      active_only
  }
}
```

---

## Data Scope Model

Data scope rules express which patient and episode records a user may retrieve. The model has four orthogonal dimensions.

### Dimension 1 — Patient Relationship Scope

Defines the set of patients the rule grants access to:

| Scope keyword | Meaning |
|---|---|
| `none` | No patient data |
| `own` | Episodes where the user is the responsible clinician (`responsible_clinician_id = user_id`) |
| `treating_team` | Episodes where the user appears in the treating team record |
| `ward` | All active episodes assigned to the user's qualified ward(s) |
| `department` | All episodes in the user's qualified department |
| `facility` | All episodes at the user's qualified facility |
| `institution` | All episodes in the institution |
| `referred` | Episodes referred to the user's department from another facility |
| `inherit` | Does not set scope — inherits from other profiles in the composition |

The effective scope when multiple role assignments are active is the **broadest** of the individual scopes.

### Dimension 2 — Episode Type Filter

```
episode_types: [inpatient, outpatient, day_clinic, emergency, pre_admission]
```

An empty list means no episode type restriction. A partial list restricts access to only those episode types. The effective filter when multiple roles are active is the **union** of all episode type lists.

### Dimension 3 — Temporal Scope

| Keyword | Meaning |
|---|---|
| `active_only` | Episodes with `status = open` |
| `active_plus_30_days` | Open episodes + those closed within the last 30 days |
| `active_plus_90_days` | Open + closed within 90 days (e.g., for follow-up) |
| `all` | All episodes regardless of status or closure date |

The effective temporal scope when multiple roles are active is the **broadest**.

### Dimension 4 — Sensitivity Flags

Certain records carry sensitivity flags set at admission or during the episode:

| Flag | Meaning |
|---|---|
| `psychiatry` | Psychiatric episode — restricted beyond normal clinical access |
| `hiv` | HIV/AIDS diagnosis present |
| `substance_abuse` | Substance dependency documentation |
| `vip` | VIP patient — access logged additionally |
| `self` | User is the patient — access requires explicit break-the-glass |

A sensitivity-flagged record is **invisible** to any user whose effective profile does not include that flag in its `sensitivity` list — even if the patient is on their ward. The record does not appear in lists, search, or timeline. This is enforced at the query layer, not in the UI.

Granting sensitivity access requires a separate profile explicitly listing the flags:

```
profile hiv_counsellor {
  data {
    scope:       treating_team
    sensitivity: [hiv, substance_abuse]
  }
}
```

---

## Effective Profile Resolution

When a user authenticates, the system resolves their **effective profile** — the single merged rule set that governs their entire session.

```
Input:  user's role assignments (from AD, see below)
Output: effective_profile {
  gui_rules:     [{ pattern, allow|deny }, …]   /* ordered, deny wins */
  service_rules: [{ pattern, allow|deny }, …]
  data_scope: {
    patient_scope:    <broadest across assignments>
    org_filter:       [<ward/dept/facility ids from assignments>]
    episode_types:    <union of all episode_types>
    temporal:         <broadest temporal scope>
    sensitivity:      <union of all sensitivity flags>
  }
}
```

Resolution steps:
1. Collect all role assignments for the user
2. For each assignment, resolve the role's profiles (including composed profiles flattened)
3. Merge GUI rules: concatenate all allow/deny rules; deny wins on conflict
4. Merge service rules: same algorithm
5. Merge data scope: broadest scope keyword, union episode types, broadest temporal, union sensitivity, collect org node ids for the org_filter
6. Cache the resolved effective profile in the session; invalidated on role change or org assignment change

---

## Active Directory Integration

Users are authenticated exclusively through the institution's Active Directory. The system does not maintain local user passwords.

### Authentication Flow

```
User opens application
  → OIDC/SAML redirect to AD FS (Active Directory Federation Services)
  → AD authenticates (Kerberos or password + MFA)
  → AD FS issues token with user identity + group memberships
  → Application receives token, extracts user_id and AD group list
  → Role assignment resolver maps AD groups → roles + org scope
  → Effective profile resolved and cached in session
```

### AD Group to Role Mapping

The mapping from AD groups to EHR roles is maintained in the RBAC administration UI — not hardcoded. The convention for group names is:

```
EHR_{ROLE}_{ORG_CODE}
```

Examples:

| AD Group | Role | Org Scope |
|---|---|---|
| `EHR_NURSE_3A` | NURSE | ward: 3A |
| `EHR_NURSE_3B` | NURSE | ward: 3B |
| `EHR_HEAD_NURSE_MED` | HEAD_NURSE | department: MED |
| `EHR_PHYSICIAN_MED` | PHYSICIAN_ATTENDING | department: MED |
| `EHR_ICU_PHYSICIAN_ICU1` | ICU_PHYSICIAN | ward: ICU-1 |
| `EHR_QUALITY_MANAGER` | QUALITY_MANAGER | institution |
| `EHR_SYSTEM_ADMIN` | SYSTEM_ADMIN | institution |

The mapping table in the administration UI translates each group name to a `{ role, org_node }` pair. A user in multiple groups receives multiple role assignments simultaneously.

### Org Scope from AD Attributes

As an alternative to encoding org scope in the group name, org scope can be read from an AD user attribute (e.g., `extensionAttribute1 = "HH/MED/3A"`). This is preferred in large institutions where group proliferation becomes unmanageable. The mapping table then specifies:

```json
{
  "ad_group":        "EHR_NURSE",
  "role":            "NURSE",
  "org_scope_from":  "ad_attribute:extensionAttribute1",
  "org_scope_level": "ward"
}
```

The org_scope_from value is resolved against the organisation model at login time.

### Sync and Provisioning

- Role assignments are resolved fresh on every login — not cached between sessions.
- A user removed from an AD group loses the corresponding role on their next login.
- AD group changes do not invalidate active sessions; sessions expire on their normal timeout (configurable per role, default 8 hours clinical / 30 minutes idle).
- HR system changes (ward transfer, contract end) propagate to AD groups through the existing HR→AD provisioning pipeline — the EHR is a consumer of that pipeline, not a parallel provisioning path.

---

## Runtime Enforcement

### GUI Layer

On session start, the resolved effective profile's GUI rules are evaluated against the full element registry to produce a **visibility map**: a lookup from element ID to `visible | hidden | read_only`. This map is sent to the client as part of the session initialisation payload.

The client applies the visibility map at render time:
- `hidden` elements are not rendered (not just CSS-hidden — they are absent from the DOM)
- `read_only` elements render without interactive controls
- `visible` is the default; no special handling needed

When a user's role changes mid-session (rare but possible — e.g., an on-call escalation), the session sends a visibility map refresh event; the client re-renders affected areas.

### Service Layer

Every service invocation passes through an authorisation middleware before the business logic runs:

```python
@require_permission(ELEMENT_IDS.ORDERS_WRITE_NEW)
async def create_order(request: OrderRequest, user: AuthenticatedUser):
    …
```

The `@require_permission` decorator checks the element ID against the user's resolved service rules. If denied: `HTTP 403` with a structured error body. The check is synchronous and fast — it reads from the cached effective profile.

The middleware also injects the resolved data scope into the request context, so that repository functions can apply it without knowing anything about the user's role:

```python
async def get_active_episodes(db, ctx: RequestContext):
    return await db.query(
        "SELECT * FROM episodes WHERE …",
        org_filter=ctx.data_scope.org_filter,          # injected automatically
        episode_types=ctx.data_scope.episode_types,
        temporal=ctx.data_scope.temporal,
        sensitivity_filter=ctx.data_scope.sensitivity,
    )
```

### Data Layer

Data scope is enforced at the repository layer as additional SQL predicates. The predicates are generated from the resolved data scope and applied to every query that touches patient or episode data.

```sql
-- Generated predicate for scope=ward, wards=[3A, 3B], temporal=active_only,
-- sensitivity=[] (no sensitivity access)
AND e.ward_code IN ('3A', '3B')
AND e.status = 'open'
AND NOT EXISTS (
  SELECT 1 FROM episode_sensitivity_flags esf
  WHERE esf.episode_id = e.id
)
```

This predicate is never written by hand in domain code. It is assembled by a `ScopePredicateBuilder` component that takes the data scope struct and returns a parameterised SQL fragment. Domain repository functions receive it as an opaque argument and append it to their WHERE clause.

Sensitivity-flagged records require the flag to appear in the user's `sensitivity` list to be included:

```sql
-- With sensitivity=[psychiatry] granted:
AND (
  NOT EXISTS (SELECT 1 FROM episode_sensitivity_flags esf WHERE esf.episode_id = e.id)
  OR EXISTS (
    SELECT 1 FROM episode_sensitivity_flags esf
    WHERE esf.episode_id = e.id AND esf.flag IN ('psychiatry')
  )
)
```

---

## Break-the-Glass

Break-the-glass allows a clinician to access a patient record that their current scope would normally deny — for example, an emergency physician accessing a patient outside their department.

### Activation

The user explicitly invokes break-the-glass on a specific patient or episode:
1. The system presents a mandatory reason selection (emergency clinical need, covering colleague, accidental access) and a free-text field
2. The user confirms — this is a deliberate action, not a bypass of a confusing error
3. An audit record is created immediately and flagged for review
4. A notification is sent to the patient's responsible clinician and to the data protection officer queue
5. The user receives temporary, time-limited (8 hours) access to that patient's record under their normal profile — the data scope is extended for that episode ID only

Break-the-glass does **not** grant access to sensitivity-flagged records. A separate, escalated break-the-glass with additional justification is required for those.

### Audit

Every access to a patient record is logged:
```
{ user_id, patient_id, episode_id, element_id, action, timestamp, scope_used, btg: bool }
```

Break-the-glass accesses are additionally:
- Flagged with `btg: true` in the audit log
- Queued for data protection officer review
- Visible to the patient on their data access log (EPD requirement)

---

## Administration

RBAC is configured exclusively through the RBAC administration module, accessible only to users with the `RBAC_ADMIN` role. There are no hardcoded access rules in application code.

| Operation | Who |
|---|---|
| Define / edit profiles | RBAC_ADMIN |
| Define / edit roles | RBAC_ADMIN |
| Map AD groups to roles | RBAC_ADMIN |
| View effective profile for a user | RBAC_ADMIN, SYSTEM_ADMIN |
| Add / remove sensitivity flags from episodes | DATA_PROTECTION_OFFICER |
| Approve break-the-glass review queue | DATA_PROTECTION_OFFICER |
| Edit organisation model | SYSTEM_ADMIN |

All changes to profiles, roles, and mappings are versioned. The prior version remains in effect until the new version is explicitly activated. Activation requires a second RBAC_ADMIN to approve (four-eyes principle). The change log is immutable.
