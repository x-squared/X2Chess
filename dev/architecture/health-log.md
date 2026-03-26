# Architecture Health Log

Rolling record of periodic architecture reviews, measured against
`dev/architecture/principles.md`.

**Entry format:**
- Date, reviewer, and scope.
- Per-principle finding: status (`Clean` / `Violation` / `Risk` / `Deferred` / `Unknown`),
  evidence, and a link to the tracking item (health plan or plan file) if applicable.
- Trend notes at the bottom of each entry.

---

## 2026-03-21 — Full codebase scan

**Reviewer:** Claude + Stephan
**Scope:** Full codebase; all principles reviewed for the first time.
**Reference:** `dev/plans/codebase_health_7f3a91bc.plan.md`

| Principle | Status    | Evidence / Notes                                                                 | Tracking |
|-----------|-----------|---------------------------------------------------------------------------------|----------|
| P01       | Violation | `resources_viewer/index.ts` contains `render()` calling `document.createElement`, `innerHTML`, `addEventListener` | health#remove-dom-from-resources-viewer |
| P02       | Violation | `resource/adapters/file/file_adapter.ts` calls `invoke('load_text_file', ...)` directly | health#inject-io-into-file-adapter |
| P03       | Violation | Tab/row state split between `resources_viewer/index.ts` internal mutable state and `ResourceViewer.tsx` `useState` | Consequence of P01; resolves with health#remove-dom-from-resources-viewer |
| P04       | Clean     | `main.tsx` is a thin composition root; no feature logic observed. | — |
| P05       | Clean     | No direct state mutation found outside reducer. | — |
| P06       | Clean     | Service construction confined to `useAppStartup.ts`. | — |
| P07       | Clean     | Selectors used consistently in components reviewed. | — |
| P08       | Clean     | No cross-boundary imports from `resource/` into `frontend/` found. | — |
| P09       | Clean     | No SQL schema found in `frontend/src/`. | — |
| P10       | Risk      | `resource_metadata_prefs.ts` and viewer column definitions hardcode metadata key name strings rather than referencing `METADATA_KEY.*` constants. | health#link-metadata-schema-to-viewer-columns |
| P11       | Violation | Kind literals `"file" \| "directory" \| "db"` defined independently in 4 files: `kinds.ts`, `isPgnResourceRef`, `compatibility.ts`, `source_types.ts`. | health#consolidate-kind-mappings |
| P12       | Clean     | Build passes (CI). | — |
| P13       | Clean     | Tauri dev path verified. | — |
| P14       | Clean     | No undocumented profile divergences found. | — |
| P15       | Unknown   | Not systematically scanned in this review. | — |
| P16       | Clean     | `tsc --noEmit` passes. | — |
| P17       | Unknown   | Not systematically scanned in this review. | — |
| P18       | Unknown   | Locale key alignment not checked in this review. | — |
| P19       | Unknown   | Component-contract compliance not systematically checked. | — |
| P20       | Unknown   | CSS token usage not checked in this review. | — |
| P21       | Unknown   | Documentation coverage not checked in this review. | — |
| P22       | Unknown   | Regression test coverage not checked in this review. | — |

**Trend notes (baseline):**
- 3 violations: P01, P02, P03 (P03 is a consequence of P01).
- 2 risks/unknowns in the resource layer: P10, P11.
- Groups E–J (P15–P22) not yet baselined; schedule a focused scan.

**Open work:**
All violations and the P10 risk are tracked in `dev/plans/codebase_health_7f3a91bc.plan.md`.

---

## 2026-03-26 — Violation resolution scan

**Reviewer:** Claude + Stephan
**Scope:** P01, P02, P11 violation resolution; full plan item verification.
**Reference:** `dev/plans/codebase_health_7f3a91bc.plan.md` (all items now done)

| Principle | Status    | Evidence / Notes                                                                 |
|-----------|-----------|---------------------------------------------------------------------------------|
| P01       | Clean     | Dead files deleted (`tabs_ui.ts`, `selection_runtime.ts`). `ingress_handlers.ts` purified: DOM event binding moved to `hooks/useGameIngress.ts`; pure factory `createIngressEventHandlers` keeps logic testable. |
| P02       | Clean     | Confirmed: no `invoke(` in `resource/`; `file_adapter.ts` uses injected `FsGateway`. |
| P03       | Clean     | Dual ownership resolved with P01 fix. `resources_viewer/index.ts` confirmed DOM-free. |
| P08       | Clean     | Confirmed: no cross-boundary imports from `resource/` into `frontend/`. |
| P09       | Clean     | Confirmed: no SQL schema in `frontend/src/`. |
| P11       | Clean     | `kind_router.ts` and `compatibility.ts` now use `PGN_RESOURCE_KINDS.includes()` guard. `isPgnResourceRef` and `source_types.ts` were already clean. Single authoritative registry. |
| P12       | Clean     | `npm run typecheck` + `npm test`: 0 errors, 450/450 pass. |

**Items from health plan all resolved:**
- Items 1–8: confirmed done (Items 1, 3, 4, 5, 6, 8 were already done; Items 2, 7 resolved in this session).
- Items 9–10: remain deferred per original plan.

**Trend notes:**
- All P01/P02/P03/P11 violations resolved. Codebase is now clean against all automated principles.
- Groups E–J (P15–P22) still not baselined; recommend a focused scan next review cycle.

---

<!-- Template for next entry:

## YYYY-MM-DD — [scope]

**Reviewer:** [name]
**Scope:** [full scan / focused scan on groups X–Y / post-feature review]
**Reference:** [plan file or commit range if applicable]

| Principle | Status | Evidence / Notes | Tracking |
|-----------|--------|-----------------|----------|
| P01       |        |                 |          |
| ...       |        |                 |          |

**Trend notes:**
- Violations resolved since last review: [list]
- New violations or risks: [list]
- Still open: [list]

-->
