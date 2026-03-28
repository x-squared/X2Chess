# Format Importers Plan

**ID:** format_importers_a2b3c4d5
**Status:** Phase F1 implemented; F2 stubbed (requires Rust); F3–F4 deferred.

---

## Goal

Accept chess database files in formats other than PGN as **import-only sources**.
Each importer reads a source file (text or binary), converts its contents to a
stream of PGN-compatible game records, and hands them off to the canonical
resource system for storage in a local `.x2chess` database. No special runtime
adapter is needed after import — the canonical resource viewer handles everything
from that point.

---

## Scope

| Format | Origin | Mechanism | Phase |
|---|---|---|---|
| EPD | Standard text format | TypeScript parser | F1 ✅ |
| CBH + siblings | ChessBase native | Tauri command (Rust) | F2 (stub only) |
| CBV | ChessBase compressed | Tauri command (Rust) | F2 (stub only) |
| VBZ | Various German-market tools | Deferred | F3 |
| HCE | Hiarcs Chess Explorer | Deferred | F4 |

---

## Architecture

### Import-only model

Importers are **not** `PgnResourceAdapter` implementations. They are one-shot
converters: given a file path, return an array of PGN strings. The calling code
then passes those PGN strings to `ResourceClient.importGames(...)`.

```
User picks file (.epd / .cbv / …)
       ↓
formatImporterFor(extension)        ← dispatcher in index.ts
       ↓
importer.importFile(path, gateway)  ← FormatImporter contract
       ↓
FormatImportResult { games: ImportedGame[] }
       ↓
ResourceClient.importGames(...)     ← canonical resource write
       ↓
.x2chess SQLite DB
```

### Module layout

```
resource/adapters/import/
  format_import_types.ts        # shared types (FormatImporter, ImportedGame, …)
  epd_importer.ts               # EPD → PGN (TypeScript, no native deps)
  chessbase_import_gateway.ts   # CBH/CBV → PGN via Tauri command (Rust backend)
  index.ts                      # dispatcher: formatImporterFor(extension)
```

### `FormatImporter` contract

```typescript
export interface FormatImporter {
  readonly supportedExtensions: readonly string[];
  importFile(path: string, gateway: FormatImportGateway): Promise<FormatImportResult>;
}
```

`FormatImportGateway` abstracts I/O so the importer is testable without Tauri:

```typescript
export type FormatImportGateway = {
  /** Read a file as UTF-8 text (for EPD and other text formats). */
  readTextFile: (path: string) => Promise<string>;
  /** Invoke a Tauri command that returns structured data (for binary formats). */
  invokeTauriCommand: <T>(cmd: string, args: Record<string, unknown>) => Promise<T>;
};
```

---

## Phase F1 — EPD importer (implemented)

EPD (Extended Position Description) is a one-line-per-position text format.

Each line: `<FEN-4-fields> [opcode operand;]...`

The 4-field FEN (position, side, castling, en-passant) is padded with `0 1`
to produce a valid 6-field FEN for the PGN `[FEN]` header.

### Recognized opcodes

| Opcode | Used as |
|---|---|
| `id` | `[Event]` PGN header |
| `bm` | `[Annotator]` (best move hint) |
| `c0`–`c9` | PGN comment after the position |
| `ce` | Centipawn evaluation appended to comment |
| All others | Ignored (not serialized) |

### Output

One PGN game per EPD record:

```pgn
[Event "id value or EPD position N"]
[SetUp "1"]
[FEN "expanded 6-field FEN"]
[Annotator "bm: Nf6"]

{ c0 comment text }
*
```

---

## Phase F2 — ChessBase importer (Tauri stub)

CBH and CBV are proprietary binary formats. All parsing is delegated to a Rust
Tauri command `import_chessbase_file` that returns an array of PGN strings.

The TypeScript layer:
1. Calls `gateway.invokeTauriCommand<ChessbaseImportResponse>("import_chessbase_file", { filePath })`.
2. Validates the response shape.
3. Returns `FormatImportResult`.

The Rust implementation is **out of scope** for this plan. The TypeScript stub
is wired so the command interface is stable; the Rust side can be implemented
independently and will work without any further frontend changes.

### Tauri command contract

```rust
// Expected Rust command signature (for the backend implementor):
// #[tauri::command]
// fn import_chessbase_file(file_path: String) -> Result<ChessbaseImportResponse, String>

// ChessbaseImportResponse = { games: Vec<String>, errors: Vec<ImportError> }
// ImportError = { index: u32, message: String }
```

---

## Phase F3 — VBZ (deferred)

No stable open-source parser available. Revisit when community tooling matures
or a user with this format requests support.

---

## Phase F4 — HCE (deferred)

Hiarcs Chess Explorer format. Proprietary, small user base. Deferred indefinitely.

---

## UI integration (future)

The import entry point lives in the Resource Viewer toolbar: "Import file…"
button → OS file picker filtered to `.pgn`, `.epd`, `.cbv`, `.cbh` → importer
dispatch → progress toast → confirmation with game count.

This UI is out of scope for the current phases; the importer modules are
library code ready to be wired up when the UI is built.

---

## Implementation phases

| Phase | Deliverable | Status |
|---|---|---|
| F1 | EPD importer (`epd_importer.ts`) + shared types | ✅ Done |
| F2 | ChessBase gateway stub + Tauri command contract | ✅ Stubbed |
| F3 | VBZ importer | Deferred |
| F4 | HCE importer | Deferred |
| F5 | UI: "Import file…" button in Resource Viewer toolbar | Pending |
