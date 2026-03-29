---
section: IMPORT
area: Format importers (EPD, ChessBase CBH/CBV)
---

## Key source files
- `dev/plans/format_importers_a2b3c4d5.plan.md` — EPD importer, CBH/CBV Tauri command design

## Checklist

- [ ] **IMPORT-1** — Importing an `.epd` file produces one PGN game per non-blank line; each game has `[SetUp "1"]` and a valid 6-field `[FEN]` header.
- [ ] **IMPORT-2** — An EPD `id` opcode sets the `[Event]` header of the resulting PGN game.
- [ ] **IMPORT-3** — An EPD `bm` opcode sets the `[Annotator]` header (e.g. `bm: Nf6`).
- [ ] **IMPORT-4** — EPD `c0`–`c9` comments and `ce` evaluations appear as a comment block in the PGN body.
- [ ] **IMPORT-5** — Blank lines and `#`-prefixed comment lines in an `.epd` file are silently skipped.
- [ ] **IMPORT-6** — A `.cbh` or `.cbv` file triggers the `import_chessbase_file` Tauri command; on success games are imported into the active `.x2chess` database. (Requires Rust backend implementation — stub only until then.)
