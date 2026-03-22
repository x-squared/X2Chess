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

`date` partial format rules:
- Full: `dd.mm.yyyy` (e.g. `14.03.2024`)
- Month + year: `mm.yyyy` (e.g. `03.2024`)
- Year only: `yyyy` (e.g. `2024`)
- Unknown day/month may use `??` (PGN convention) but input renders as blank fields.

---

## MetadataDefinition type

```typescript
type MetadataFieldType = "text" | "date" | "select" | "number" | "flag";

type MetadataFieldDefinition = {
  key: string;               // PGN header key (e.g. "Event", "WhiteElo", "Category")
  label: string;             // Display name (e.g. "Event", "White Elo", "Category")
  type: MetadataFieldType;
  required: boolean;
  orderIndex: number;        // controls column order; gaps are allowed; ties sort by key
  selectValues?: string[];   // only for type = "select"; ordered list of allowed values
  description?: string;      // tooltip / help text shown in the definition editor
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

Required fields are marked with an asterisk (*). Saving with an empty
required field shows an inline validation error (no modal interruption).

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
