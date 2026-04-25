# Metadata Definition System Plan

**File:** `metadata_definition_system_d1e2f3a4.plan.md`
**Status:** Draft — awaiting design review.

---

## Goal

Provide a user-facing system for defining structured metadata schemas —
independent of any specific resource. Users define field names, data types,
and ordering once, then apply those definitions to any resource. Definitions
are exportable and importable, so they can be shared between users or
across installations.

---

## Motivation

PGN headers are free-form. The current resource viewer treats all metadata
keys as plain text columns. A definition system allows:
- Typed input (date picker, dropdown, free text) instead of raw strings.
- Standard ordering of columns across resources.
- Validation (date format, selection from a finite list).
- Shared vocabularies (tournament categories, player ratings systems, etc.).

---

## Data types

| Type | Storage | Input control | Display |
|---|---|---|---|
| `text` | String | Single-line text input | As-is |
| `date` | String (dd.mm.yyyy) | Three optional number fields + separator | Formatted; partial dates allowed (e.g. `2024`, `03.2024`) |
| `select` | String | Dropdown (from defined value list) | Value label |
| `number` | String | Numeric input | Right-aligned |
| `flag` | String ("true"/"false") | Checkbox | ✓ / – |
| `reference` | String (target `recordId`) | Game picker (search by White/Black/Event within the same resource) | Link chip that navigates to the referenced game |

`date` partial format rules:
- Full: `dd.mm.yyyy` (e.g. `14.03.2024`)
- Month + year: `mm.yyyy` (e.g. `03.2024`)
- Year only: `yyyy` (e.g. `2024`)
- Unknown day/month may use `??` (PGN convention) but input renders as blank fields.

---

## MetadataDefinition type

```typescript
type MetadataFieldType = "text" | "date" | "select" | "number" | "flag" | "reference";

type MetadataFieldDefinition = {
  key: string;               // PGN header key (e.g. "Event", "WhiteElo", "Category")
  label: string;             // Display name (e.g. "Event", "White Elo", "Category")
  type: MetadataFieldType;
  required: boolean;
  orderIndex: number;        // controls column order; gaps are allowed; ties sort by key
  selectValues?: string[];   // only for type = "select"; ordered list of allowed values
  description?: string;      // tooltip / help text shown in the definition editor
  referenceable?: true;      // non-reference fields: value is available as fallback for referencing games
};

type MetadataSchema = {
  id: string;                // stable UUID
  name: string;              // e.g. "OTB Tournament", "Study Collection"
  version: number;           // monotonically increasing; incremented on each save
  fields: MetadataFieldDefinition[];
};
```

---

## Standard (built-in) field definitions

The app ships with a default set of definitions matching PGN Seven Tag Roster
and common extensions. These are read-only (cannot be deleted, but can be
reordered or overridden by a user schema):

| Key | Label | Type |
|---|---|---|
| `Event` | Event | text |
| `Site` | Site | text |
| `Date` | Date | date |
| `Round` | Round | text |
| `White` | White | text |
| `Black` | Black | text |
| `Result` | Result | select: `1-0`, `0-1`, `1/2-1/2`, `*` |
| `WhiteElo` | White Elo | number |
| `BlackElo` | Black Elo | number |
| `ECO` | ECO | text |
| `Opening` | Opening | text |
| `TimeControl` | Time Control | text |
| `Annotator` | Annotator | text |

User-defined fields are additive — they appear after the built-in fields
unless the user explicitly reorders them.

---

## Schema storage

Schemas are stored in `config/metadata-schemas.json` in the app data
directory (alongside `config/engines.json`). Format:

```json
{
  "schemas": [
    {
      "id": "f3a2c1b0-...",
      "name": "OTB Tournament",
      "version": 3,
      "fields": [ ... ]
    }
  ]
}
```

### Association with a resource

A resource (`.x2chess` DB or directory) can reference a preferred schema by
`id`. The association is stored:
- For `.x2chess` DB: a `resource_meta` table (key/value, schema version 2):
  `schema_id` key.
- For directory: in `.x2chess-meta.json` under `schemaId`.
- For single-file PGN: no persistent association (schema is chosen at
  import time and not stored alongside the file).

If no schema is associated, the resource viewer uses the built-in field set.
Multiple resources can share the same schema.

---

## MetadataSchema definition dialog

A modal dialog (`MetadataSchemaEditor`) allows defining and editing schemas.

### Layout

```
┌─ Metadata Schema Editor ────────────────────────────────────────────┐
│ Schema name:  [OTB Tournament              ]                         │
│                                                                       │
│ Fields:                                                               │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │ ≡  Event        text      required  ✎  ×  ↑↓                   │ │
│ │ ≡  Site         text              ✎  ×  ↑↓                   │ │
│ │ ≡  Date         date      required  ✎  ×  ↑↓                   │ │
│ │ ≡  Round        text              ✎  ×  ↑↓                   │ │
│ │ ≡  White        text      required  ✎  ×  ↑↓                   │ │
│ │ ≡  Black        text      required  ✎  ×  ↑↓                   │ │
│ │ ≡  Result       select    required  ✎  ×  ↑↓                   │ │
│ │ ≡  Category     select             ✎  ×  ↑↓                   │ │
│ │      Values: Open, U2200, U2000, U1800, U1600                   │ │
│ │ ≡  WhiteElo     number             ✎  ×  ↑↓                   │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                          [ + Add Field ]              │
│                                                                       │
│ [ Export… ]  [ Import… ]          [ Cancel ]  [ Save ]               │
└──────────────────────────────────────────────────────────────────────┘
```

### Add / edit field inline

Clicking `+Add Field` or the ✎ edit icon expands an inline form below the
field row:

```
│   Key:    [Category         ]  Label: [Category ]  ☑ Required          │
│   Type:   [select      ▾]                                               │
│   Values: [Open] [U2200] [U2000] [U1800] [U1600] [+]  (drag to reorder)│
│   Desc:   [Used to categorize tournaments by strength rating]           │
│                                    [ Cancel ]  [ Save field ]           │
```

Key rules:
- The `key` field maps directly to the PGN header key (case-preserved).
  Standard keys (Seven Tag Roster) cannot be deleted but can be hidden.
- `selectValues` are shown as editable pills; drag to reorder.
- New fields get a generated `orderIndex = max + 10` (leaves gaps for
  later insertion).

### Drag-and-drop reordering

The `≡` handle on each row enables drag-to-reorder within the dialog.
This sets `orderIndex` values (renumbered 10, 20, 30, … on save to maintain
gaps).

---

## Export / import

### Export

Clicking `Export…` downloads a JSON file:

```json
{
  "x2chess-schema": "1",
  "schema": {
    "id": "f3a2c1b0-...",
    "name": "OTB Tournament",
    "version": 3,
    "fields": [ ... ]
  }
}
```

The exported file can be shared and imported by other users.

### Import

Clicking `Import…` opens a file picker filtered to `.json`. The imported
schema:
1. Is validated against the schema type.
2. If a schema with the same `id` already exists, the user is asked:
   "Replace existing schema, or import as a copy?"
3. A copy gets a new `id` and appends " (imported)" to the name.

---

## Schema chooser in resource viewer

The resource viewer header bar gains a `Schema:` selector (dropdown):

```
[ Schema: OTB Tournament ▾ ]  [ Manage schemas… ]
```

Changing the schema updates the column set and type validation for that
resource tab immediately. The association is saved on the next explicit save
of the resource's sidecar/meta.

---

## Metadata entry in game edit dialog

When the user edits a game's metadata (existing "Edit game" dialog or the
new import dialog), fields are rendered using their type-appropriate controls:

| Type | Control |
|---|---|
| `text` | Single-line `<input>` |
| `date` | Three number inputs: `dd  .  mm  .  yyyy` (each optional) |
| `select` | `<select>` dropdown with defined values + empty option |
| `number` | Numeric `<input type="number">` |
| `flag` | `<input type="checkbox">` |
| `reference` | Game picker — text search within the same resource; stores selected `recordId` |

Required fields are marked with an asterisk (*). Saving with an empty
required field shows an inline validation error (no modal interruption).

---

## Metadata inheritance

### Design

Two schema declarations drive inheritance:

- **`referenceable?: true`** on any non-`reference` field — marks the field as
  available for fallback. "If a game referencing me has no local value for this
  field, use mine."
- **`type: "reference"`** — a field that holds a `recordId`. When set on a game,
  it activates fallback resolution for every `referenceable` field in the schema.

No per-field wiring: the rule is uniform across all `referenceable` fields once
a `reference` attribute is set.

Example — opening database schema:

```typescript
{ key: "ECO",      type: "text",      referenceable: true, ... }
{ key: "Opening",  type: "text",      referenceable: true, ... }
{ key: "ModelFor", type: "reference", label: "Model for opening", ... }
```

A model game with `ModelFor` pointing to opening game A will show A's `ECO` and
`Opening` values unless the model game has its own values set.

### Resolution rules

- Resolved at read time; no values are copied into the game record.
- A locally set value always wins over an inherited one.
- Resolution follows the reference chain: if the referenced game itself has a
  `reference` attribute set and a field is still unresolved, the chain continues.
- **Loop detection**: a visited set of `recordId` values stops the traversal if
  a cycle is detected.
- **Max depth**: chain traversal is capped at 3 hops (sufficient for typical
  opening-database hierarchies; deeper chains are silently truncated).
- If a referenced game cannot be resolved (broken link, resource not open),
  remaining fields stay blank — no error is surfaced.

### Performance

**Viewer (batch reads):** When the viewer loads a page of N games, it collects
all `reference` field values, fetches the referenced games in a single batch
query, then resolves inherited values in memory. If the chain has depth > 1,
at most 3 batch queries are issued (one per hop level). No per-row round-trips.

**Single-game reads:** resolve the chain inline (max 3 hops × one DB lookup each).

**Write:** inherited values are never stored. This eliminates write-invalidation
complexity entirely; the bounded read-time traversal is the only overhead.

### Schema editor UI (MD3)

- A `referenceable` toggle is shown for each non-`reference` field (checkbox:
  "Available for inheritance").
- `reference` fields show a read-only note: "When set, activates inheritance
  for all referenceable fields."
- Viewer may display inherited values with a subtle indicator (e.g. italics or
  a small ↗ icon); local values display normally. Deferred to MD9.

---

## Implementation phases

| Phase | Deliverable |
|---|---|
| MD1 | `MetadataFieldDefinition` + `MetadataSchema` types in `resource/domain/metadata_schema.ts` |
| MD2 | `config/metadata-schemas.json` storage + read/write helpers |
| MD3 | `MetadataSchemaEditor` dialog component |
| MD4 | Schema chooser in resource viewer header |
| MD5 | Type-appropriate input controls in game edit dialog |
| MD6 | Export / import (JSON file) |
| MD7 | Schema association stored in `.x2chess` DB + `.x2chess-meta.json` |
| MD8 | Column ordering driven by `MetadataFieldDefinition.orderIndex` |
| MD9 | Inheritance resolution: batch-load referenced games, resolve `referenceable` fields via chain (max 3 hops, visited-set loop detection); UI indicator for inherited vs. local values |
