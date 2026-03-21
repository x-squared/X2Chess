---
name: Resource Docs Cleanup
overview: "Documentation-only pass to bring public resource APIs and frontend resource boundary modules into compliance with the project documentation rule, in two phases: resource library first, frontend boundary second."
todos:
  - id: doc-resource-client-domain
    content: Document all public resource client/domain entrypoints with concrete Integration/Configuration/Communication and function contracts.
    status: completed
  - id: doc-resource-adapters
    content: Document file/directory adapters in detail and mark db adapter/database docs as deferred-only behavior.
    status: completed
  - id: doc-frontend-resources-boundary
    content: Document frontend resource gateway/facade and source adapters with explicit method-level contracts and side effects.
    status: completed
  - id: doc-resources-viewer-boundary
    content: Document resources viewer boundary modules and metadata preferences contracts.
    status: completed
  - id: doc-final-consistency-check
    content: Run a final documentation consistency sweep for canonical naming and rule compliance across all touched modules.
    status: completed
isProject: false
---

# Targeted Documentation-Only Pass

## Scope and constraints

- Documentation-only changes (no behavior/type logic changes).
- Apply project doc rule consistently: module-level intent + concrete Integration/Configuration/Communication APIs + public function/method docs with params/returns/side effects/error behavior.
- Execute in two ordered phases:
  1. `resource/*` public APIs.
  2. `frontend/src/resources/*` boundary modules.

## Phase 1: Public `resource/*` API docs (first)

- Add/standardize module headers and exported API docs in core public entrypoints:
  - [resource/index.ts](resource/index.ts)
  - [resource/client/api.ts](resource/client/api.ts)
  - [resource/client/capabilities.ts](resource/client/capabilities.ts)
  - [resource/client/default_client.ts](resource/client/default_client.ts)
  - [resource/client/compatibility.ts](resource/client/compatibility.ts)
- Document canonical contracts and domain surface:
  - [resource/domain/contracts.ts](resource/domain/contracts.ts)
  - [resource/domain/actions.ts](resource/domain/actions.ts)
  - [resource/domain/resource_ref.ts](resource/domain/resource_ref.ts)
  - [resource/domain/game_ref.ts](resource/domain/game_ref.ts)
  - [resource/domain/game_entry.ts](resource/domain/game_entry.ts)
  - [resource/domain/kinds.ts](resource/domain/kinds.ts)
  - [resource/domain/metadata.ts](resource/domain/metadata.ts)
- Document adapter-level API behavior for currently active kinds:
  - [resource/adapters/file/file_adapter.ts](resource/adapters/file/file_adapter.ts)
  - [resource/adapters/directory/directory_adapter.ts](resource/adapters/directory/directory_adapter.ts)
  - [resource/adapters/index.ts](resource/adapters/index.ts)
- Add explicit deferred-status documentation for DB-side files without implementing DB behavior:
  - [resource/adapters/db/db_adapter.ts](resource/adapters/db/db_adapter.ts)
  - [resource/database/migrations/runner.ts](resource/database/migrations/runner.ts)
  - [resource/database/schema/schema_manifest.ts](resource/database/schema/schema_manifest.ts)

## Phase 2: `frontend/src/resources/*` boundary docs (second)

- Strengthen boundary orchestration docs and public methods:
  - [frontend/src/resources/source_gateway.ts](frontend/src/resources/source_gateway.ts)
  - [frontend/src/resources/index.ts](frontend/src/resources/index.ts)
- Ensure source adapter boundary modules use canonical terminology and have concrete public docs:
  - [frontend/src/resources/sources/file_adapter.ts](frontend/src/resources/sources/file_adapter.ts)
  - [frontend/src/resources/sources/file_resource_adapter.ts](frontend/src/resources/sources/file_resource_adapter.ts)
  - [frontend/src/resources/sources/db_adapter.ts](frontend/src/resources/sources/db_adapter.ts)
  - [frontend/src/resources/sources/registry.ts](frontend/src/resources/sources/registry.ts)
  - [frontend/src/resources/sources/types.ts](frontend/src/resources/sources/types.ts)
  - [frontend/src/resources/sources/pgn_metadata.ts](frontend/src/resources/sources/pgn_metadata.ts)
- Cover resource viewer boundary contracts:
  - [frontend/src/resources_viewer/index.ts](frontend/src/resources_viewer/index.ts)
  - [frontend/src/resources_viewer/resource_metadata_prefs.ts](frontend/src/resources_viewer/resource_metadata_prefs.ts)

## Documentation acceptance checklist

- Each public module has a concrete top-level intent block (with real exports and side effects named).
- Every exported function/factory has `@param` and `@returns`; add error/side-effect notes where relevant.
- Returned capability objects/facades document each callable method contract clearly.
- DB/deferred modules explicitly state deferred behavior and current supported operations.
- Terminology aligned to canonical kinds (`file`, `directory`, `db`) in docs.

