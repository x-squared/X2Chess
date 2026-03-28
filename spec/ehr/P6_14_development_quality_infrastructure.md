## 56. Development Quality Infrastructure

This chapter addresses how the system enforces its own quality standards over time — through rule-sets, architecture verification, module templates, and guideline adherence monitoring. Developer feedback tooling is documented in [P6_18](P6_18_dev_forum_feedback_loop.md); the user-guiding layer in [P6_19](P6_19_user_guiding_framework.md).

---

### 56.1 Rule-Sets

Rule-sets are the mechanism by which clinical knowledge, validation logic, access control, billing rules, and alert conditions are expressed in data rather than in code. Changing a rule never requires a deployment.

#### What a Rule-Set Is

A rule-set is a named, versioned collection of conditions and actions stored in the rule registry:

```json
{
  "rule_id": "prevention.hba1c_recall.v2",
  "name": "HbA1c recall — Type 2 diabetes",
  "version": 2,
  "active": true,
  "conditions": {
    "type": "and",
    "conditions": [
      { "type": "diagnosis", "code": "E11", "system": "ICD-10", "operator": "subsumes" },
      { "type": "composition_absent", "archetype": "hba1c.v1",
        "within_days": 180 }
    ]
  },
  "action": { "type": "recall", "priority": "routine",
               "notification": "patient_app" }
}
```

Rules are authored in structured JSON by clinical informaticians (§3.4) through the authoring interface — not by writing code. The rule engine evaluates conditions against the projection store; all evaluation runs against typed projection columns, not raw JSONB.

#### Where Rule-Sets Are Used

| Domain | Example rule-set |
|---|---|
| Clinical decision support | Drug-drug interaction alerts; dosing range warnings |
| Pathway transitions | Condition expressions on pathway branches (§13) |
| Prevention and recall | Population eligibility for screening (§27) |
| Access control | Dynamic RBAC conditions ("nurse can escalate on her own ward only") |
| Billing validation | "TARMED position X requires position Y to be present in the same episode" |
| Checklist auto-population | "Set isolation flag if any MRSA composition in last 12 months" |
| SOP trigger | "Trigger SOP acknowledgement when composition of type X is created" |

#### Rule Governance

Rules are versioned. A new version of a rule goes through:
1. Draft (authored, not active)
2. Review (clinical informatician + clinical lead sign-off)
3. Active (replaces previous version; prior version archived, not deleted)
4. Retired (explicitly deactivated with reason)

**Rule testing**: every rule can be evaluated against a synthetic patient record in a sandboxed environment before activation. The authoring interface includes a test harness — the author defines test cases (patient data → expected action) and verifies them before submitting for review.

**Rule conflicts**: the rule engine detects conflicting rules (two rules that produce contradictory actions for the same patient state) at activation time, not at runtime.

---

### 56.2 Architecture Principles and Verification

Architecture quality degrades when violations accumulate unnoticed. The system maintains a formal principles register and verifies compliance continuously.

#### Principles Register

A principles register documents every architectural rule:

| ID | Principle | Severity | Verification | Status |
|---|---|---|---|---|
| P01 | Pure-logic modules do not import React, DOM, or Tauri | Critical | Automated (import scan) | ✓ |
| P02 | No cross-domain table joins | Critical | Automated (query analysis) | ✓ |
| P03 | episode_id NOT NULL on all action tables | Critical | Automated (schema check) | ✓ |
| P04 | Every patient record access is audit-logged | Critical | Integration test | ✓ |
| P05 | Compositions are append-only (no UPDATE on compositions) | Critical | Automated (SQL scan) | ✓ |
| P06 | No GIN index on composition content | High | Automated (schema check) | ✓ |
| P07 | Projection tables use typed columns only — no JSONB | High | Automated (schema check) | ✓ |
| P08 | Break-the-glass access generates audit entry and notification | Critical | Integration test | ✓ |
| P09 | AI-generated output is never auto-promoted to clinical record | Critical | Code review + integration test | ✓ |
| P10 | Rule changes do not require code deployment | High | Manual (authoring UI review) | ✓ |
| P11 | FHIR façade is read-only projection — not the primary store | High | Automated (write-path analysis) | ✓ |
| P12 | No clinical data in push notification payloads | Critical | Automated (notification schema check) | ✓ |
| P13 | Template module standards compliance (see §56.3) | High | Automated (linting) | ✓ |

Each principle states: what is required, why it exists, how it is verified, and current status. The register is a living document — new principles are added when new architectural risks are identified; existing principles are updated when the system evolves.

#### Automated Verification

The CI pipeline runs an architecture check script on every pull request:

```bash
#!/usr/bin/env bash
# arch-check.sh — automated subset of principles register

# P01: No React/DOM imports in pure-logic modules
grep -r "from 'react'" src/model src/resources src/runtime \
  && fail "P01: React import in pure-logic module"

# P03: episode_id NOT NULL in all migration files
grep -r "episode_id" migrations/ | grep -v "NOT NULL" | grep -v "REFERENCES" \
  && fail "P03: episode_id without NOT NULL constraint"

# P05: No UPDATE on compositions table
grep -r "UPDATE compositions" src/ \
  && fail "P05: compositions table is append-only"

# P06: No GIN index on composition content column
grep -r "GIN.*content\|content.*GIN" migrations/ \
  && fail "P06: GIN index on composition content is prohibited"

# P12: No clinical fields in notification payload schemas
python3 scripts/check_notification_schemas.py \
  || fail "P12: Clinical data found in notification payload schema"
```

**Scope of automated checks**: import boundaries, schema constraints, SQL patterns, notification payload shape. These cover principles where violations are detectable as text patterns.

**Integration test coverage**: principles that require runtime verification (audit log completeness, break-the-glass notification, AI output gating) are enforced by integration tests that run against a real database with real application code.

#### Manual Review Cadence

Automated checks catch mechanical violations. Architectural drift — the gradual weakening of design intent through individually reasonable-seeming decisions — requires human review.

- **Monthly full scan**: all 13+ principles reviewed by the lead architect against the current codebase
- **Post-milestone review**: after every major feature delivery, a health log entry is written and appended
- **Health log**: a dated, rolling log of findings, deviations accepted with justification, and resolutions — not a dashboard, a narrative record

---

### 56.3 Template Module

Every new domain module starts from a canonical template that enforces compliance with all architecture principles from line one. A developer creating a new module copies the template; the scaffolded code already satisfies the principles register. There is no "I'll add the audit logging later."

#### Backend Template (Python / FastAPI)

```
/domains/new_module/
  ├── router.py          # FastAPI router — standard error handling, auth dependency
  ├── service.py         # Business logic — no DB session here, injected
  ├── repository.py      # DB queries only — asyncpg or SQLAlchemy async
  ├── schema.py          # Pydantic request/response models
  ├── model.py           # SQLAlchemy model — episode_id NOT NULL enforced by template
  ├── events.py          # Event emitters — standard event bus integration
  ├── audit.py           # Audit decorators — applied to every read and write
  └── tests/
      ├── test_service.py    # Unit tests against real DB (no mocks)
      └── test_router.py     # Integration tests via TestClient
```

**Built-in to the template — non-negotiable:**

```python
# router.py template — audit logging is mandatory, not optional
@router.get("/{id}")
async def get_record(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    audit: AuditLogger = Depends(get_audit_logger),   # ← injected, not optional
):
    record = await service.get(db, id)
    await audit.log_read(                              # ← every read is logged
        user=current_user,
        resource_type="new_module",
        resource_id=id,
    )
    return record

# model.py template — episode_id constraint enforced
class NewModuleRecord(Base):
    __tablename__ = "new_module_records"
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    episode_id: Mapped[UUID] = mapped_column(
        ForeignKey("episodes.id"), nullable=False   # ← NOT NULL, no exceptions
    )
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    created_by: Mapped[UUID] = mapped_column(nullable=False)
    # Domain fields below — template provides no domain fields
```

**Standard error response shape** — all routers return errors in the same envelope:

```json
{ "error": "RESOURCE_NOT_FOUND", "detail": "Record 123 not found",
  "request_id": "a1b2c3d4", "timestamp": "2026-03-27T08:42:00Z" }
```

#### Frontend Template (React / TypeScript)

```
/features/new_module/
  ├── NewModuleRoot.tsx        # Route entry point — suspense boundary, error boundary
  ├── NewModuleRoot.css        # Module-scoped styles — design tokens only
  ├── components/
  │   └── NewModuleCard.tsx    # Feature components
  ├── hooks/
  │   └── useNewModule.ts      # TanStack Query hooks — data fetching
  ├── api/
  │   └── newModuleApi.ts      # API client — typed, no raw fetch in components
  ├── types.ts                 # Shared TypeScript types
  └── tests/
      └── NewModuleCard.test.tsx
```

**Built-in to the template:**

```tsx
// NewModuleRoot.tsx — error boundary + suspense are not optional
export function NewModuleRoot() {
  const { episodeId } = useEpisodeContext();  // ← episode context always required

  return (
    <ErrorBoundary fallback={<ModuleError />}>    {/* ← always present */}
      <Suspense fallback={<ModuleSkeleton />}>    {/* ← always present */}
        <NewModuleContent episodeId={episodeId} />
      </Suspense>
    </ErrorBoundary>
  );
}

// hooks/useNewModule.ts — TanStack Query, no raw fetch
export function useNewModuleRecord(id: string) {
  return useQuery({
    queryKey: ["new_module", id],
    queryFn: () => newModuleApi.getRecord(id),
    staleTime: 30_000,
  });
}
```

**Design token enforcement**: the CSS template imports only from the design token file. Hardcoded colour values, font sizes, or spacing values in module CSS files are a linting violation:

```css
/* Correct — token reference */
.new-module-card { background: var(--color-card-bg); border: 1px solid var(--color-border); }

/* Violation — caught by stylelint rule */
.new-module-card { background: #ffffff; }  /* ERROR: hardcoded colour */
```

#### Compliance Linting

The template installs linting rules that verify compliance at development time, not at review time:

| Tool | Rule | Principle |
|---|---|---|
| ESLint | No direct `fetch()` in components — use API client | Architecture boundary |
| ESLint | `useEpisodeContext()` required in all route roots | §53 episode assignment |
| Stylelint | No hardcoded colour/spacing values | Design token compliance |
| Pylint / Ruff | `AuditLogger` dependency required in every router function | §53 audit requirement |
| SQLFluff | No `UPDATE` on `compositions` table | P05 append-only |
| Custom | `episode_id` NOT NULL in all new model classes | P03 |

Linting runs on file save in the IDE and as a pre-commit hook. Violations block commit; they cannot be silenced without an explicit override comment that flags the exception for review.

---

#### 56.3.2 UI Component Template Library

The template module contains a living library of canonical examples for every artifact type that recurs across the application. Any new screen, dialog, or widget begins by copying the relevant template — never from a blank file. This enforces visual consistency, accessibility compliance, and design token usage across the entire product.

All templates use the shared design token set:

```css
/* tokens.css — single source of truth for all visual values */
--color-bg-page:      #f2f7fd;   /* page background */
--color-bg-card:      #ffffff;
--color-border:       #d7e3f4;
--color-primary:      #005ca9;   /* primary action, active states */
--color-primary-dark: #0d3c79;   /* headings, emphasis */
--color-accent:       #0a79d1;   /* links, waveforms */
--color-alert-bg:     #ffe8ed;   /* alert/error background */
--color-alert-text:   #8b162f;   /* alert/error text */
--color-alert-border: #ffc0cb;
--color-warning:      #d79a1c;   /* amber — overdue, NEWS2 medium */
--color-success-bg:   #eaf9f0;   /* success/ready background */
--color-success-border: #93cfac;
--color-muted:        #9db9d8;   /* disabled, inactive, placeholder */
--color-meta:         #44678f;   /* metadata labels, section headers */
--radius-card:        12px;
--radius-button:      8px;
--shadow-card:        0 4px 14px rgba(12, 42, 90, 0.08);
--font-body:          "Segoe UI", system-ui, -apple-system, sans-serif;
--font-size-label:    0.85rem;   /* uppercase section labels */
--font-size-body:     0.92rem;
--font-size-small:    0.82rem;
```

---

##### T1 — Episode Context Bar

The persistent header shown at the top of every patient-facing screen. Always visible; never scrolls away.

```tsx
// EpisodeContextBar.tsx
type Props = { patient: PatientSummary; episode: EpisodeSummary };

export function EpisodeContextBar({ patient, episode }: Props) {
  return (
    <header className="episode-bar" data-element-id="episode.widget.context_header">
      <span className="episode-bar-name">{patient.displayName}</span>
      <span className="episode-bar-meta">{patient.dobFormatted} · {episode.locationLabel}</span>
      <span className="episode-bar-fall">Fall {episode.episodeNumber}</span>
      {episode.alerts.length > 0 && (
        <AlertBadge count={episode.alerts.length} />
      )}
    </header>
  );
}
```

```css
.episode-bar {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  color: #fff;
  padding: 0.75rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border-radius: 0 0 var(--radius-card) var(--radius-card);
}
.episode-bar-name   { font-weight: 700; font-size: 1rem; }
.episode-bar-meta   { font-size: var(--font-size-body); opacity: 0.9; }
.episode-bar-fall   { margin-left: auto; font-size: var(--font-size-small);
                      opacity: 0.85; }
```

**Variants**: compact (mobile — name + Fall only), expanded (desktop — full details).
**Accessibility**: `role="banner"`, patient name in `aria-label`.

---

##### T2 — Clinical Data Table

Used for results, order lists, medication lists, and work queues. Supports column sorting, row-level status flags, and an expandable detail row.

```tsx
// ClinicalTable.tsx
type Column<T> = {
  key: keyof T; label: string; width?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
};
type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
};

export function ClinicalTable<T extends { id: string; flagLevel?: 'normal'|'warning'|'critical' }>(
  { columns, rows, onRowClick, emptyMessage, loading }: Props<T>
) {
  if (loading) return <TableSkeleton columns={columns.length} />;
  if (!rows.length) return <EmptyState message={emptyMessage ?? "No records"} />;

  return (
    <div className="clinical-table-wrap" role="region">
      <table className="clinical-table" aria-live="polite">
        <thead>
          <tr>{columns.map(c => <th key={String(c.key)}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.id}
              className={`clinical-table-row flag-${row.flagLevel ?? 'normal'}`}
              onClick={() => onRowClick?.(row)}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map(c => (
                <td key={String(c.key)}>
                  {c.render ? c.render(row[c.key], row) : String(row[c.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```css
.clinical-table-wrap { overflow-x: auto; border-radius: var(--radius-card);
                        box-shadow: var(--shadow-card); }
.clinical-table      { width: 100%; border-collapse: collapse;
                        background: var(--color-bg-card); }
.clinical-table th   { padding: 0.6rem 0.85rem; font-size: var(--font-size-label);
                        text-transform: uppercase; letter-spacing: 0.04em;
                        color: var(--color-meta); border-bottom: 1px solid var(--color-border); }
.clinical-table td   { padding: 0.55rem 0.85rem; font-size: var(--font-size-body);
                        border-bottom: 1px solid var(--color-border); }
.clinical-table-row.flag-warning  { background: #fffbea; }
.clinical-table-row.flag-critical { background: var(--color-alert-bg);
                                     color: var(--color-alert-text); }
.clinical-table-row[tabindex]:hover { background: #edf5ff; cursor: pointer; }
```

**Variants**: compact (dense row padding), expandable (row click opens detail panel below), selectable (checkbox column).

---

##### T3 — Clinical Entry Dialog

Used for any action that captures a composition: vital signs, medication administration confirmation, wound assessment. Modal, keyboard-accessible, never auto-closes on successful save.

```tsx
// ClinicalEntryDialog.tsx
type Props = {
  title: string;
  archetypeId: string;           // drives form generation
  episodeId: string;             // mandatory
  onSave: (data: unknown) => Promise<void>;
  onClose: () => void;
  elementId?: string;
};

export function ClinicalEntryDialog({ title, archetypeId, episodeId, onSave, onClose, elementId }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSave(data: unknown) {
    setSaving(true);
    try   { await onSave(data); onClose(); }
    catch  { setError("Save failed — please try again"); }
    finally { setSaving(false); }
  }

  return (
    <dialog className="clinical-dialog" aria-modal="true"
            aria-labelledby="dialog-title" data-element-id={elementId}>
      <header className="clinical-dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button className="dialog-close" onClick={onClose} aria-label="Close">×</button>
      </header>

      {error && <AlertBanner message={error} />}

      <div className="clinical-dialog-body">
        <ArchetypeForm archetypeId={archetypeId} episodeId={episodeId}
                       onSubmit={handleSave} />
      </div>

      <footer className="clinical-dialog-footer">
        <button className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" form="archetype-form" type="submit"
                disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </footer>
    </dialog>
  );
}
```

```css
.clinical-dialog         { border: none; border-radius: var(--radius-card);
                            box-shadow: 0 8px 32px rgba(12,42,90,0.18);
                            padding: 0; min-width: 480px; max-width: 720px;
                            width: 90vw; max-height: 90vh; display: flex;
                            flex-direction: column; }
.clinical-dialog-header  { background: linear-gradient(135deg,var(--color-primary),var(--color-accent));
                            color: #fff; padding: 1rem 1.25rem; border-radius: var(--radius-card)
                            var(--radius-card) 0 0; display: flex;
                            justify-content: space-between; align-items: center; }
.clinical-dialog-body    { flex: 1; overflow-y: auto; padding: 1rem 1.25rem; }
.clinical-dialog-footer  { padding: 0.75rem 1.25rem; border-top: 1px solid var(--color-border);
                            display: flex; justify-content: flex-end; gap: 0.6rem; }
```

**Variants**: full-screen dialog (complex forms — anaesthetics assessment, discharge summary), read-only dialog (view-only composition, no footer actions), confirmation dialog (see T4).

---

##### T4 — Confirmation Dialog

For irreversible or high-consequence actions: discharge a patient, cancel an order, override a drug alert. Two-step: intent + explicit confirmation text.

```tsx
// ConfirmationDialog.tsx
type Props = {
  title: string;
  body: string;
  consequence: string;          // one sentence stating what will happen
  confirmLabel: string;         // e.g. "Cancel order" — action-specific, not "OK"
  variant?: 'warning' | 'critical';
  onConfirm: () => Promise<void>;
  onClose: () => void;
};

export function ConfirmationDialog({ title, body, consequence, confirmLabel,
                                     variant = 'warning', onConfirm, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);

  return (
    <dialog className={`confirm-dialog confirm-dialog--${variant}`} aria-modal="true">
      <h2>{title}</h2>
      <p className="confirm-body">{body}</p>
      <p className="confirm-consequence">{consequence}</p>
      <footer>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className={`btn-${variant}`} onClick={async () => {
          setConfirming(true); await onConfirm(); setConfirming(false);
        }} disabled={confirming}>
          {confirming ? "Working…" : confirmLabel}
        </button>
      </footer>
    </dialog>
  );
}
```

```css
.confirm-dialog             { border-radius: var(--radius-card); padding: 1.25rem;
                               max-width: 420px; border: none;
                               box-shadow: 0 8px 32px rgba(12,42,90,0.18); }
.confirm-dialog--warning h2 { color: var(--color-warning); }
.confirm-dialog--critical h2{ color: var(--color-alert-text); }
.confirm-consequence        { font-weight: 600; font-size: var(--font-size-body);
                               margin-top: 0.5rem; }
.btn-warning  { background: var(--color-warning); color: #fff;
                border-radius: var(--radius-button); padding: 0.55rem 0.85rem; }
.btn-critical { background: var(--color-alert-text); color: #fff;
                border-radius: var(--radius-button); padding: 0.55rem 0.85rem; }
```

**Rule**: the confirm button label always states the action ("Cancel order"), never a generic "OK" or "Yes". This is a linting rule applied to all `ConfirmationDialog` usages.

---

##### T5 — Alert Banner

Displayed inline at the top of a patient view whenever a critical alert is active. Pinned — never scrolls away. Stacks if multiple alerts are present.

```tsx
// AlertBanner.tsx
type Severity = 'info' | 'warning' | 'critical';
type Props = { message: string; severity?: Severity; action?: { label: string; onClick: () => void }; };

export function AlertBanner({ message, severity = 'warning', action }: Props) {
  return (
    <div className={`alert-banner alert-banner--${severity}`} role="alert"
         aria-live={severity === 'critical' ? 'assertive' : 'polite'}>
      <span className="alert-banner-icon">{severity === 'critical' ? '⚠⚠' : '⚠'}</span>
      <span className="alert-banner-text">{message}</span>
      {action && (
        <button className="alert-banner-action" onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  );
}
```

```css
.alert-banner             { display: flex; align-items: center; gap: 0.65rem;
                             padding: 0.55rem 1rem; font-size: var(--font-size-body); }
.alert-banner--info       { background: #eaf4ff; border-left: 4px solid var(--color-primary); }
.alert-banner--warning    { background: #fffbea; border-left: 4px solid var(--color-warning);
                             color: var(--color-warning); }
.alert-banner--critical   { background: var(--color-alert-bg);
                             border-left: 4px solid var(--color-alert-text);
                             color: var(--color-alert-text); font-weight: 600; }
.alert-banner-action      { margin-left: auto; background: transparent;
                             border: 1px solid currentColor; border-radius: var(--radius-button);
                             padding: 0.3rem 0.65rem; cursor: pointer; font-size: var(--font-size-small); }
```

---

##### T6 — Checklist Component

Configurable blocking/advisory items per visit or pathway step.

```tsx
// Checklist.tsx
type ChecklistItem = {
  id: string; label: string; blocking: boolean;
  status: 'pending' | 'done' | 'waived';
  waivedReason?: string;
};
type Props = { items: ChecklistItem[]; onToggle: (id: string, waive?: string) => void; };

export function Checklist({ items, onToggle }: Props) {
  const blocking = items.filter(i => i.blocking && i.status === 'pending');

  return (
    <div className="checklist" data-element-id="checklist.widget.root">
      {blocking.length > 0 && (
        <AlertBanner severity="critical"
          message={`${blocking.length} required item${blocking.length > 1 ? 's' : ''} incomplete`} />
      )}
      <ul className="checklist-items">
        {items.map(item => (
          <li key={item.id} className={`checklist-item checklist-item--${item.status}
              ${item.blocking ? 'checklist-item--blocking' : ''}`}>
            <button className="checklist-toggle" onClick={() => onToggle(item.id)}
                    aria-pressed={item.status === 'done'}>
              {item.status === 'done' ? '✓' : '○'}
            </button>
            <span className="checklist-label">{item.label}</span>
            {item.blocking && item.status === 'pending' && (
              <span className="checklist-required">Required</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

```css
.checklist-items            { list-style: none; padding: 0; margin: 0; }
.checklist-item             { display: flex; align-items: center; gap: 0.6rem;
                               padding: 0.45rem 0.75rem; border-radius: 6px; }
.checklist-item--pending.checklist-item--blocking
                            { background: var(--color-alert-bg); }
.checklist-item--done       { opacity: 0.6; }
.checklist-required         { margin-left: auto; font-size: var(--font-size-small);
                               color: var(--color-alert-text); font-weight: 600; }
```

---

##### T7 — Status Badge

Compact colour-coded label for NEWS2 scores, order status, episode status, and pathway step status.

```tsx
// StatusBadge.tsx
type Variant = 'green' | 'amber' | 'red' | 'blue' | 'grey';
type Props = { label: string; variant: Variant; };

export function StatusBadge({ label, variant }: Props) {
  return <span className={`status-badge status-badge--${variant}`}>{label}</span>;
}

// Convenience: NEWS2 auto-selects variant
export function News2Badge({ score }: { score: number }) {
  const variant = score <= 2 ? 'green' : score <= 4 ? 'amber' : 'red';
  return <StatusBadge label={`NEWS2 ${score}`} variant={variant} />;
}
```

```css
.status-badge        { display: inline-flex; align-items: center; padding: 0.2rem 0.55rem;
                        border-radius: 999px; font-size: var(--font-size-small);
                        font-weight: 600; letter-spacing: 0.02em; }
.status-badge--green { background: var(--color-success-bg); color: #1a6640;
                        border: 1px solid var(--color-success-border); }
.status-badge--amber { background: #fffbea; color: var(--color-warning);
                        border: 1px solid #f0d080; }
.status-badge--red   { background: var(--color-alert-bg); color: var(--color-alert-text);
                        border: 1px solid var(--color-alert-border); }
.status-badge--blue  { background: #edf5ff; color: var(--color-primary-dark);
                        border: 1px solid #bdd4ec; }
.status-badge--grey  { background: #f0f4f8; color: var(--color-meta);
                        border: 1px solid var(--color-border); }
```

---

##### T8 — Timeline View

The patient record timeline: chronological list of compositions, events, and documents, filterable by type and date range.

```tsx
// TimelineView.tsx
type TimelineEntry = {
  id: string; timestamp: string; type: string;
  title: string; summary: string; source: 'internal' | 'external';
  archetypeId?: string;
};
type Props = { entries: TimelineEntry[]; loading?: boolean; };

export function TimelineView({ entries, loading }: Props) {
  if (loading) return <TimelineSkeleton />;

  return (
    <ol className="timeline" aria-label="Patient timeline" data-element-id="episode.widget.timeline">
      {entries.map(entry => (
        <li key={entry.id} className={`timeline-entry timeline-entry--${entry.source}`}>
          <div className="timeline-dot" />
          <time className="timeline-time">{formatDateTime(entry.timestamp)}</time>
          <div className="timeline-card">
            <span className="timeline-type">{entry.type}</span>
            <span className="timeline-title">{entry.title}</span>
            <p className="timeline-summary">{entry.summary}</p>
            {entry.source === 'external' && (
              <span className="timeline-external-badge">External</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
```

```css
.timeline             { list-style: none; padding: 0; margin: 0;
                         border-left: 2px solid var(--color-border);
                         padding-left: 1.25rem; }
.timeline-entry       { position: relative; margin-bottom: 1rem; }
.timeline-dot         { position: absolute; left: -1.45rem; top: 0.3rem;
                         width: 0.7rem; height: 0.7rem; border-radius: 50%;
                         background: var(--color-primary); border: 2px solid #fff;
                         box-shadow: 0 0 0 2px var(--color-primary); }
.timeline-entry--external .timeline-dot { background: var(--color-muted); }
.timeline-time        { font-size: var(--font-size-small); color: var(--color-meta);
                         display: block; margin-bottom: 0.25rem; }
.timeline-card        { background: var(--color-bg-card); border: 1px solid var(--color-border);
                         border-radius: var(--radius-card); padding: 0.65rem 0.85rem;
                         box-shadow: var(--shadow-card); }
.timeline-type        { font-size: var(--font-size-label); text-transform: uppercase;
                         letter-spacing: 0.04em; color: var(--color-meta); display: block; }
.timeline-external-badge { font-size: var(--font-size-small); background: #f0f4f8;
                            color: var(--color-meta); padding: 0.15rem 0.45rem;
                            border-radius: 4px; margin-top: 0.35rem; display: inline-block; }
```

---

##### T9 — Work Queue View

Departmental task list for nurses, BMAs, MTRAs, and booking coordinators. Overdue rows are visually prominent; clicking a row opens the relevant action.

```tsx
// WorkQueueView.tsx
type QueueItem = {
  id: string; dueAt: string; overdue: boolean; urgency: 'routine'|'urgent'|'stat';
  patientName: string; taskLabel: string; assignedTo?: string;
};
type Props = { items: QueueItem[]; onItemClick: (item: QueueItem) => void; };

export function WorkQueueView({ items, onItemClick }: Props) {
  return (
    <div className="work-queue" data-element-id="work_queue.panel.root">
      <header className="work-queue-header">
        <span>Task</span><span>Patient</span><span>Due</span><span>Urgency</span>
      </header>
      {items.map(item => (
        <button key={item.id} className={`work-queue-row
            ${item.overdue ? 'work-queue-row--overdue' : ''}
            urgency-${item.urgency}`}
            onClick={() => onItemClick(item)}>
          <span>{item.taskLabel}</span>
          <span>{item.patientName}</span>
          <span>{item.overdue ? `⚠ ${item.dueAt}` : item.dueAt}</span>
          <StatusBadge label={item.urgency.toUpperCase()}
            variant={item.urgency === 'stat' ? 'red' : item.urgency === 'urgent' ? 'amber' : 'grey'} />
        </button>
      ))}
    </div>
  );
}
```

```css
.work-queue           { background: var(--color-bg-card); border-radius: var(--radius-card);
                         box-shadow: var(--shadow-card); overflow: hidden; }
.work-queue-header    { display: grid; grid-template-columns: 2fr 1.5fr 1fr 0.75fr;
                         padding: 0.55rem 0.85rem; font-size: var(--font-size-label);
                         text-transform: uppercase; letter-spacing: 0.04em;
                         color: var(--color-meta); border-bottom: 1px solid var(--color-border); }
.work-queue-row       { display: grid; grid-template-columns: 2fr 1.5fr 1fr 0.75fr;
                         padding: 0.55rem 0.85rem; font-size: var(--font-size-body);
                         border-bottom: 1px solid var(--color-border); text-align: left;
                         background: transparent; border-left: none; border-right: none;
                         cursor: pointer; width: 100%; }
.work-queue-row:hover { background: #edf5ff; }
.work-queue-row--overdue { background: var(--color-alert-bg);
                            border-left: 3px solid var(--color-alert-text); }
```

---

##### T10 — Loading Skeleton and Empty State

Standard placeholder shapes shown while data loads, and a consistent empty state when a query returns no results.

```tsx
// Skeleton.tsx — matches card and table shapes
export function CardSkeleton() {
  return (
    <div className="skeleton-card" aria-busy="true" aria-label="Loading">
      <div className="skeleton-line w-60" /><div className="skeleton-line w-40" />
      <div className="skeleton-line w-80" /><div className="skeleton-line w-50" />
    </div>
  );
}

export function TableSkeleton({ columns }: { columns: number }) {
  return (
    <div className="skeleton-table" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="skeleton-row">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="skeleton-cell" />
          ))}
        </div>
      ))}
    </div>
  );
}

// EmptyState.tsx
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon">○</span>
      <p className="empty-state-message">{message}</p>
      {action}
    </div>
  );
}
```

```css
.skeleton-line   { height: 0.85rem; border-radius: 4px; background: linear-gradient(
                    90deg, var(--color-border) 25%, #e8f0f8 50%, var(--color-border) 75%);
                    background-size: 200% 100%; animation: shimmer 1.4s infinite; }
.w-40  { width: 40%; } .w-50 { width: 50%; }
.w-60  { width: 60%; } .w-80 { width: 80%; }
@keyframes shimmer { 0% { background-position: 200% 0; }
                      100% { background-position: -200% 0; } }
.empty-state         { padding: 2rem; text-align: center; color: var(--color-meta); }
.empty-state-icon    { font-size: 2rem; display: block; margin-bottom: 0.5rem; }
.empty-state-message { font-size: var(--font-size-body); }
```

---

##### T11 — Toast Notification

Non-blocking feedback after an action completes. Auto-dismisses after 4 seconds; critical toasts persist until dismissed.

```tsx
// Toast.tsx — consumed via useToast() hook
type Toast = { id: string; message: string; severity: 'success'|'warning'|'error'; persistent?: boolean; };

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="false">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.severity}`} role="status">
          <span>{t.message}</span>
          <button onClick={() => onDismiss(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}
```

```css
.toast-container { position: fixed; bottom: 1.25rem; right: 1.25rem;
                    display: flex; flex-direction: column; gap: 0.5rem; z-index: 1000; }
.toast           { display: flex; align-items: center; gap: 0.65rem; padding: 0.65rem 0.85rem;
                    border-radius: var(--radius-button); box-shadow: var(--shadow-card);
                    font-size: var(--font-size-body); min-width: 260px; max-width: 400px;
                    animation: slide-in 0.2s ease; }
.toast--success  { background: var(--color-success-bg); border: 1px solid var(--color-success-border); }
.toast--warning  { background: #fffbea; border: 1px solid #f0d080; }
.toast--error    { background: var(--color-alert-bg); border: 1px solid var(--color-alert-border);
                    color: var(--color-alert-text); }
@keyframes slide-in { from { transform: translateX(100%); opacity: 0; }
                       to   { transform: translateX(0);    opacity: 1; } }
```

---

##### Template Library Summary

| Template | ID | Used for |
|---|---|---|
| Episode Context Bar | T1 | All patient-facing screens |
| Clinical Data Table | T2 | Results, orders, medications, audit log |
| Clinical Entry Dialog | T3 | Any composition capture |
| Confirmation Dialog | T4 | Irreversible / high-consequence actions |
| Alert Banner | T5 | Critical alerts, validation errors |
| Checklist Component | T6 | Visit checklists, pathway step checks |
| Status Badge | T7 | NEWS2, order status, episode status |
| Timeline View | T8 | Patient history, episode timeline |
| Work Queue View | T9 | Task lists for nurses, BMAs, MTRAs |
| Loading Skeleton + Empty State | T10 | All async data loads |
| Toast Notification | T11 | Post-action feedback |

New components that replicate functionality covered by an existing template are a code review violation. The template library grows when a genuinely new artifact pattern is identified; it does not grow because a developer prefers a slightly different style.

---

### 56.4 Guideline Adherence — Operational and Analytical Modes

Clinical guidelines (Patient Blood Management, sepsis bundles, thromboprophylaxis, ventilator weaning criteria) are represented as versioned rule-sets (§56.1) operating in two modes.

**Operational mode — bedside alert:** When a patient's data meets a guideline trigger condition, a soft alert appears in the patient banner and notification feed, including:
- The guideline name and version
- The triggering value (e.g., "Hb 6.8 g/dL — PBM trigger threshold 7.0 g/dL")
- The recommended action
- A link to the full SOP

The clinician either acts (order placed) or documents a rationale for deviation. Both outcomes are recorded against the alert record.

**Analytical mode — adherence reporting:** The module queries historical alert records to identify cases where a trigger fired but no conforming action was taken within the defined time window:

```sql
-- PBM adherence: triggered but no transfusion order within 4 h
SELECT episode_id, triggered_at, hb_value, action_taken, deviation_reason
FROM   guideline_adherence_log
WHERE  guideline_id = 'PBM-01'
  AND  action_taken IS NULL
  AND  triggered_at < NOW() - INTERVAL '4 hours';
```

Quality managers access a dashboard showing: adherence rate per guideline, deviation breakdown (documented rationale vs. no response), adherence by ward and by attending, trend over time.

**Guideline versioning:** When a guideline is updated, the new version is authored in the rule-set editor, reviewed, approved, and activated with a go-live date. Historical adherence data retains the version active at the time, enabling transition-period analysis.

---
