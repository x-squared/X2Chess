# Architecture Principles Register

Source of truth for continuous architecture review. Each principle is a testable
assertion about the codebase's health state, derived from the ADRs in
`doc/architecture-adr-manual.qmd` and the rules in `dev/rules/`.

**How to use:**
- During periodic review: verify each principle using its listed method; record
  findings in `dev/architecture/health-log.md`.
- For automated principles: run `scripts/arch-check.sh` (enforces the grep-based
  subset; currently documents "clean" state — gate on each fix landing).
- On any new ADR or rule change: update this register accordingly.

---

## Quick Reference

| ID  | Principle                                    | Group            | Severity | Verification |
|-----|----------------------------------------------|------------------|----------|--------------|
| P01 | Pure-logic modules are framework-free        | Module Boundary  | Critical | Automated    |
| P02 | Tauri `invoke` only in frontend integration  | Module Boundary  | High     | Automated    |
| P03 | Single rendering owner per UI area           | Module Boundary  | High     | Manual       |
| P04 | `main.tsx` is a thin composition root        | Module Boundary  | Medium   | Manual       |
| P05 | UI state mutations only via `dispatch`       | State & Services | High     | Manual       |
| P06 | Service init in `useAppStartup`; via `ServiceContext` only | State & Services | High | Manual |
| P07 | Components read state via typed selectors    | State & Services | Medium   | Manual       |
| P08 | `resource/` has no imports from `frontend/` or `backend/` | Resource Library | Critical | Automated |
| P09 | DB schema/migrations owned in `resource/database/` only | Resource Library | High | Automated |
| P10 | Metadata schema constants not redefined in frontend | Resource Library | Medium | Manual |
| P11 | Kind names have a single authoritative registry | Resource Library | Medium | Manual |
| P12 | Browser fat-client builds clean              | Delivery         | Critical | Automated    |
| P13 | Tauri app profile dev path works             | Delivery         | High     | Manual/CI    |
| P14 | Profile feature differences are explicit     | Delivery         | Medium   | Manual       |
| P15 | No explicit `any` in production source       | TypeScript       | High     | Automated    |
| P16 | All exported functions have typed signatures | TypeScript       | High     | Semi-auto    |
| P17 | All user-facing strings use `t()`            | i18n             | Medium   | Manual       |
| P18 | Locale key sets aligned across all 5 locales | i18n             | Medium   | Automated    |
| P19 | All React components have a Component-Contract JSDoc | Component Contract | Medium | Manual |
| P20 | CSS uses theme variables; no scattered hard-coded values | CSS & Theming | Medium | Manual |
| P21 | Public exported functions and modules have intent docs | Documentation | Low | Manual |
| P22 | Bug fixes have regression tests              | Testing          | Medium   | Manual       |

---

## Group A — Module Boundaries

### P01 — Pure-logic modules are framework-free

**Assertion:** Modules under `src/model/`, `src/editor/`, `src/board/`,
`src/game_sessions/`, `src/resources/`, `src/resources_viewer/`, `src/runtime/`,
and all of `resource/` contain no React imports, no DOM APIs, and no Tauri globals.

**Source:** ADR-013; `dev/rules/coding-style.mdc` §5; `CLAUDE.md`

**Severity:** Critical — a violation decouples testability and breaks the dual-target
build model (browser + Tauri share the same pure-logic path).

**Verification (automated):**
```bash
grep -rl "document\.\|innerHTML\|addEventListener\|from 'react'\|from \"react\"" \
  frontend/src/model frontend/src/editor frontend/src/board \
  frontend/src/game_sessions frontend/src/resources \
  frontend/src/resources_viewer frontend/src/runtime resource/
```
Expected: no output.

---

### P02 — Tauri `invoke` only in the frontend integration point

**Assertion:** No call to `invoke(` appears anywhere inside `resource/`. All
Tauri I/O calls live in `frontend/src/resources/source_gateway.ts` and are
passed into adapters via injected `FsGateway` / `DbGateway` interfaces.

**Source:** ADR-013; `dev/rules/dual-target-architecture.mdc`; `CLAUDE.md`

**Severity:** High — baking Tauri calls into the resource library prevents
running the library in a plain browser context.

**Verification (automated):**
```bash
grep -rn "invoke(" resource/
```
Expected: no output.

---

### P03 — Single rendering owner per UI area

**Assertion:** For any given UI region, exactly one React component is
responsible for DOM output. No pure-logic module also writes to the same area
via direct DOM manipulation.

**Source:** ADR-013; `CLAUDE.md` ("Single rendering owner")

**Severity:** High — dual ownership produces overlapping state models and
makes React reconciliation unreliable.

**Verification (manual):** During review, check each file under
`src/resources_viewer/` and `src/app_shell/` for `document.createElement`,
`innerHTML`, or `render()` functions that produce DOM directly.

---

### P04 — `main.tsx` is a thin composition root

**Assertion:** `frontend/src/main.tsx` contains only wiring (provider wrapping,
root render call). No feature logic, parsing, event handling, or stateful helpers.

**Source:** `dev/rules/main-composition-boundary.mdc`

**Severity:** Medium

**Verification (manual):** Read `frontend/src/main.tsx`; confirm it is ≤ ~30
lines and contains only imports, provider composition, and `ReactDOM.createRoot`.

---

## Group B — State & Service Architecture

### P05 — All UI state mutations go through `dispatch`

**Assertion:** `AppStoreState` fields are never mutated directly. All state
changes are expressed as `dispatch(action)` calls routed through the
`useReducer` in `AppProvider`.

**Source:** ADR-013; `dev/rules/coding-style.mdc` §8

**Severity:** High — direct mutation bypasses React's reconciliation and makes
state history non-reproducible.

**Verification (manual):** Grep for direct assignment to state fields outside
reducer files; spot-check component files for patterns like `state.field =`.

---

### P06 — Service initialisation owned by `useAppStartup`; callbacks via `ServiceContext` only

**Assertion:** All service singletons are created inside `useAppStartup` (or
the `createAppServices` factory it calls). Components never construct services
directly. The only channel for components to trigger service logic is
`useServiceContext()` callbacks.

**Source:** ADR-013; `dev/rules/coding-style.mdc` §8

**Severity:** High — constructing services inside components causes
re-initialisation on re-render and bypasses the single initialisation guarantee.

**Verification (manual):** Grep for `new Service` or service factory calls
(e.g., `createSessionStore(`, `createSourceGateway(`) outside of
`useAppStartup.ts` and `createAppServices.ts`.

---

### P07 — Components read state via typed selectors only

**Assertion:** Inside React component bodies, state values are accessed using
typed selector functions from `src/state/selectors.ts`, not via direct field
access (`state.field`).

**Source:** `dev/rules/coding-style.mdc` §6

**Severity:** Medium — direct field access creates implicit coupling to state
shape and bypasses any selector-level memoisation.

**Verification (manual):** Scan component files for patterns like
`const x = state.` (direct field read in component body without selector).

---

## Group C — Resource Library

### P08 — `resource/` has no imports from `frontend/` or `backend/`

**Assertion:** No file inside `resource/` imports from `frontend/src/` or
`backend/` (directly or via relative path climbing out of `resource/`).

**Source:** ADR-012; `dev/rules/dual-target-architecture.mdc`

**Severity:** Critical — importing frontend code into the resource library would
create a circular dependency and break the library's independent deployability.

**Verification (automated):**
```bash
grep -rn "from.*frontend/" resource/
grep -rn "from.*\.\.\/\.\.\/frontend" resource/
```
Expected: no output.

---

### P09 — DB schema and migrations owned exclusively in `resource/database/`

**Assertion:** No `CREATE TABLE`, `ALTER TABLE`, or migration runner code
appears in `frontend/src/`. All SQL schema is in `resource/database/`.

**Source:** ADR-012; `dev/rules/coding-style.mdc` §8

**Severity:** High — schema drift between the resource library and frontend
modules causes silent data loss or runtime errors.

**Verification (automated):**
```bash
grep -rn "CREATE TABLE\|ALTER TABLE\|migration" frontend/src/
```
Expected: no output.

---

### P10 — Metadata schema constants are not redefined in frontend modules

**Assertion:** Metadata key names (Event, White, Black, ECO, X2Style, …) are
defined once in `resource/domain/metadata_schema.ts` and referenced by
`METADATA_KEY.X` in frontend viewer code. No file outside `resource/domain`
hardcodes these key strings as plain string literals.

**Source:** ADR-012; `codebase_health` item 8

**Severity:** Medium — a key rename in the schema will silently produce stale
column names in the viewer if the viewer hardcodes them.

**Verification (manual):** Search viewer and prefs files for string literals
matching known metadata key names (`"Event"`, `"White"`, `"Black"`, `"ECO"`).

---

### P11 — Kind names have a single authoritative registry

**Assertion:** The string literals `"file"`, `"directory"`, `"db"` are defined
as canonical constants in `resource/domain/kinds.ts` and imported everywhere
else. No other file independently re-declares the kind union.

**Source:** ADR-012; `codebase_health` item 7

**Severity:** Medium — four current sites; any new kind requires four edits and
a misspelling in one place is silent.

**Verification (manual):** Count sites that independently define or switch on
`"file" | "directory" | "db"` literals outside of `resource/domain/kinds.ts`.

---

## Group D — Delivery & Dual-Target

### P12 — Browser fat-client builds clean

**Assertion:** `npm run build` in `frontend/` passes with zero TypeScript errors
and zero Vite build errors.

**Source:** ADR-001; ADR-004; `dev/rules/dual-target-architecture.mdc`

**Severity:** Critical — this is the primary delivery path.

**Verification (automated):**
```bash
cd frontend && npm run build
```
Expected: exits 0.

---

### P13 — Tauri app profile dev path works

**Assertion:** `npm run desktop:dev` in `frontend/` starts without errors and
loads the full UI.

**Source:** ADR-004; `dev/rules/dual-target-architecture.mdc`

**Severity:** High

**Verification (manual/CI):** Boot the Tauri shell and confirm the UI loads and
basic navigation works.

---

### P14 — Profile feature differences between full and reduced client are explicit

**Assertion:** Any capability present in the browser fat-client but absent from
the Tauri reduced profile is documented in `doc/architecture-manual.qmd` §4 or
as a capability-matrix entry. There is no implicit divergence.

**Source:** ADR-004; `dev/rules/dual-target-architecture.mdc`

**Severity:** Medium

**Verification (manual):** During review, check for any feature code that
conditionally branches on `__X2CHESS_MODE__` or Tauri availability; confirm
the branch rationale is documented in the architecture manual.

---

## Group E — TypeScript Quality

### P15 — No explicit `any` in production source

**Assertion:** No production TypeScript file uses `: any` or `as any`. Use
`unknown` with narrowing instead. Test files may use broad types only with
inline documentation.

**Source:** `dev/rules/typescript-strict-types.mdc`; `dev/rules/coding-style.mdc` §2

**Severity:** High

**Verification (automated):**
```bash
grep -rn ": any\b\|as any\b" frontend/src/ resource/ --include="*.ts" --include="*.tsx"
```
Expected: no output (excluding test files if documented inline).

---

### P16 — All exported functions have typed parameters and return types

**Assertion:** Every `export function` / `export const` arrow function has
explicitly annotated parameter types and a return type. TypeScript `noImplicitAny`
is `true`.

**Source:** `dev/rules/typescript-strict-types.mdc`; `dev/rules/coding-style.mdc` §2

**Severity:** High

**Verification (semi-automated):** `npm run typecheck` (`tsc --noEmit`) is the
primary gate. Manual spot-check during review: grep for `export (function|const)`
and verify annotations in new/changed files.

---

## Group F — Internationalisation

### P17 — All user-facing strings use `t()`; no hardcoded English in components

**Assertion:** JSX text content, `aria-label`, `title`, and `placeholder` values
in component files are resolved through `useTranslator()` / `t(...)`. No raw
English string literals appear in these positions.

**Source:** `dev/rules/i18n-gui-alignment.mdc`; `dev/rules/coding-style.mdc` §7

**Severity:** Medium

**Verification (manual):** During review, scan recently changed component files
for JSX string children and ARIA attributes that are not wrapped in `t()`.

---

### P18 — Locale key sets are aligned across `en`, `de`, `fr`, `it`, `es`

**Assertion:** Every key present in `frontend/data/i18n/en.json` also appears
in the four other locale files, and vice versa. No locale has extra or missing keys.

**Source:** `dev/rules/i18n-gui-alignment.mdc`

**Severity:** Medium

**Verification (automated):**
```bash
# Compare key sets — all diffs should be empty
node -e "
  const fs = require('fs');
  const base = Object.keys(JSON.parse(fs.readFileSync('frontend/data/i18n/en.json','utf8')));
  for (const loc of ['de','fr','it','es']) {
    const other = Object.keys(JSON.parse(fs.readFileSync(\`frontend/data/i18n/\${loc}.json\`,'utf8')));
    const miss = base.filter(k => !other.includes(k));
    const extra = other.filter(k => !base.includes(k));
    if (miss.length || extra.length) console.log(\`\${loc}: missing=\${miss}, extra=\${extra}\`);
  }
  console.log('done');
"
```
Expected: only `done` printed.

---

## Group G — Component Contract

### P19 — All React components have a Component-Contract JSDoc block

**Assertion:** Every `.tsx` component file opens with a JSDoc block that
declares Integration API, Configuration API, and Communication API sections
with concrete, non-template content.

**Source:** ADR-007; `dev/rules/component-contract.mdc`; `dev/rules/coding-style.mdc` §3

**Severity:** Medium

**Verification (manual):** During review, scan component files for the
`Integration API:` marker. New or recently changed components receive priority.

---

## Group H — CSS & Theming

### P20 — CSS uses theme variables; no scattered hard-coded values

**Assertion:** Colors, spacing tokens, and typography sizes that appear in more
than one CSS rule are defined as CSS custom properties (`--token-name`) rather
than repeated hard-coded literals. New CSS does not introduce free-standing hex
color values or pixel sizes that duplicate an existing token.

**Source:** ADR-008; `dev/rules/ui-style-and-theming.mdc`

**Severity:** Medium

**Verification (manual):** During review, scan recently changed CSS files for
`#` hex values and hard-coded `px`/`rem` sizes that could be token references.

---

## Group I — Documentation

### P21 — Public exported functions and modules have intent docs

**Assertion:** Every file that exports public API has a top-level doc comment
stating its intent and responsibilities. Every exported function has a JSDoc
comment stating purpose, parameters, and return value.

**Source:** `dev/rules/public-code-documentation.mdc`

**Severity:** Low — violation degrades maintainability but does not break
runtime behaviour.

**Verification (manual):** Spot-check during review: newly added or recently
changed public API files in `resource/` and `frontend/src/`.

---

## Group J — Testing

### P22 — Bug fixes have regression tests

**Assertion:** Every commit that fixes a defect includes at least one test that
would fail before the fix and passes after it.

**Source:** `dev/rules/regression-tests.mdc`

**Severity:** Medium

**Verification (manual):** During review, scan recent bug-fix commits in
`git log` and confirm a corresponding test addition is present. If a useful
regression test was not feasible, this must be noted in the commit message.

---

## Changelog

| Date       | Change |
|------------|--------|
| 2026-03-26 | Initial register created from ADR-001–013 and all active rule files |
