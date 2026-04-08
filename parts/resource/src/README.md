# Resource Library

Independent PGN resource library.

This library owns:
- canonical PGN resource domain contracts
- adapters for `file`, `directory`, and `db` resource kinds
- SQL schema and migrations under `database/`

Frontend integrations should consume `client/` APIs and must not depend on adapter or schema internals.
