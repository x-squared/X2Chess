# `training/protocols`

Concrete training protocols.

Important files:

- `replay_protocol.ts`
- `opening_protocol.ts`

Use this package when changing how training sessions advance, score, or summarize a specific training mode.

Training protocol implementations.

Contains protocol-specific move evaluation and session progression logic such as replay or opening protocols. Keep these modules domain-oriented and UI-independent.
