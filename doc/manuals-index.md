# X2Chess Manuals Index

Last updated: 2026-04-28

## Manuals and owning rules

- `doc/architecture-manual.qmd`
  - Purpose: architecture boundaries, system view, delivery paths, and constraints.
  - Owning rule: `.cursor/rules/architecture-manual-maintenance.mdc`
- `doc/architecture-adr-manual.qmd`
  - Purpose: architecture decision records (ADRs) and decision history.
  - Owning rule: `.cursor/rules/architecture-adr-manual-maintenance.mdc`
- `doc/setup-manual.qmd`
  - Purpose: environment and toolchain setup instructions.
  - Owning rule: `.cursor/rules/setup-manual-maintenance.mdc`
- `doc/user-manual.qmd`
  - Purpose: end-user usage guide and workflows.
  - Owning rule: `.cursor/rules/user-manual-maintenance.mdc`

## Specification role

- Manuals in this index are the living specification for X2Chess.
- Developer-facing specification: architecture + architecture ADR + setup manuals.
- User-facing specification: user manual.

## Meta-governance

- Registry governance rule:
  - `.cursor/rules/manual-governance.mdc`
- Architecture direction rule:
  - `.cursor/rules/dual-target-architecture.mdc`
  - Focus: fat-client-first browser runtime + reduced app profile.
- Component contract rule:
  - `.cursor/rules/component-contract.mdc`
- UI style and theming rule:
  - `.cursor/rules/ui-style-and-theming.mdc`
- Manuals-as-specification rule:
  - `.cursor/rules/manuals-as-specification.mdc`
- Runtime dialog independence rule:
  - `dev/rules/runtime-dialog-independence.mdc`
  - Focus: avoid browser-native dialog globals for core workflows; use app-owned confirmation UI.
