# Chess Engine Integration Plan

**File:** `engines_integration_e5f6a7b8.plan.md`
**Status:** Draft — awaiting design review.

---

## Goal

Integrate chess engines into X2Chess as a configurable, multi-engine capability
layer. Engines are used for: real-time position analysis, best-move hints,
game annotation, and playing against the computer. The architecture is
protocol-agnostic (UCI is the primary target; XBoard/WinBoard deferred) and
supports both locally installed engines and a bundled fallback.

---

## Engine availability

Stockfish is **not currently installed** on this machine. Install options:
- `brew install stockfish` — for development
- Bundle the binary in the Tauri app for distribution (recommended: use
  Stockfish WASM as a web fallback; native binary for Tauri desktop)

Stockfish 16+ is the recommended reference implementation. All design
decisions below are validated against Stockfish's UCI output.

---

## Module layout

```
engines/
├── domain/
│   ├── engine_config.ts     # EngineConfig, user registry
│   ├── uci_types.ts         # Raw UCI message types (input/output)
│   └── analysis_types.ts    # EngineVariation, AnalysisSnapshot, MoveScore
├── uci/
│   ├── uci_parser.ts        # Parse UCI output lines into typed events
│   ├── uci_writer.ts        # Format UCI commands for stdin
│   └── uci_session.ts       # UCI state machine (idle/thinking/pondering)
├── adapters/
│   ├── tauri_engine.ts      # Spawn + pipe native engine via Tauri commands
│   └── stockfish_wasm.ts    # Stockfish-WASM adapter (browser fallback)
├── client/
│   └── engine_manager.ts    # Lifecycle: start/stop/restart; multi-engine registry
└── index.ts
```

The `engines/` module lives at the repository root (peer of `resource/`),
following the same pure-logic convention. It has no React or Tauri imports.
Tauri I/O is injected via an `EngineProcess` interface.

---

## UCI protocol abstraction

### EngineProcess interface (I/O injection point)

```typescript
interface EngineProcess {
  send(line: string): Promise<void>;
  // Emits one line at a time from engine stdout.
  onOutput(handler: (line: string) => void): () => void;  // returns unsubscribe
  kill(): Promise<void>;
}
```

The Tauri adapter implements this by spawning a child process with
`tauri-plugin-shell` (or a custom Rust command) and bridging its stdio.

### UciEngine (high-level interface used by the rest of the app)

```typescript
interface UciEngine {
  readonly id: string;
  readonly name: string;        // from "id name ..." UCI response
  readonly author: string;      // from "id author ..."
  readonly options: Map<string, UciOption>;

  // Lifecycle
  initialize(): Promise<void>;  // sends "uci", awaits "uciok"
  isReady(): Promise<void>;     // sends "isready", awaits "readyok"
  quit(): void;

  // Analysis
  startAnalysis(position: EnginePosition, options: AnalysisOptions): void;
  stopAnalysis(): void;
  onVariation(handler: (v: EngineVariation) => void): () => void;

  // Best-move search (single result)
  findBestMove(position: EnginePosition, options: MoveSearchOptions): Promise<EngineBestMove>;

  // Options
  setOption(name: string, value: string): void;
  setPosition(moves: string[]): void;  // from startpos
}

type EnginePosition = {
  fen: string;                  // starting FEN ("startpos" maps to initial)
  moves: string[];              // UCI moves played from that FEN
};

type AnalysisOptions = {
  depth?: number;
  movetime?: number;            // ms
  multiPv?: number;             // default 1
  searchMoves?: string[];       // restrict search to these UCI moves
  infinite?: boolean;           // run until stopAnalysis() called
};

type MoveSearchOptions = {
  movetime?: number;
  depth?: number;
  wtime?: number; btime?: number;  // for time management
  winc?: number; binc?: number;
};

type EngineVariation = {
  multipvIndex: number;         // 1-based
  depth: number;
  selDepth?: number;
  score: EngineScore;
  pv: string[];                 // UCI move list
  pvSan?: string[];             // SAN (computed externally from position)
  nodes?: number;
  nps?: number;
  hashFull?: number;            // hash table usage ‰
  tbHits?: number;
};

type EngineScore =
  | { type: "cp"; value: number }      // centipawns (positive = good for side to move)
  | { type: "mate"; value: number };   // moves to mate (negative = being mated)

type EngineBestMove = {
  uci: string;
  san?: string;
  ponder?: string;              // engine's expected reply
};
```

### UciOption types

```typescript
type UciOption =
  | { type: "check"; default: boolean; value: boolean }
  | { type: "spin"; default: number; min: number; max: number; value: number }
  | { type: "combo"; default: string; vars: string[]; value: string }
  | { type: "button" }
  | { type: "string"; default: string; value: string };
```

---

## Tauri integration

### Rust side: engine process management

A `EngineState` (Tauri managed state) holds a map of running engine processes,
each identified by an engine ID string.

Commands:
```rust
spawn_engine(id: String, path: String) -> Result<(), String>
send_to_engine(id: String, line: String) -> Result<(), String>
kill_engine(id: String) -> Result<(), String>
```

Engine stdout is streamed back to the frontend via Tauri events:
```rust
app.emit("engine-output", EngineOutputPayload { id, line })
```

This avoids polling and gives sub-millisecond latency for analysis updates.

### Frontend adapter

`tauri_engine.ts` wraps the Tauri commands into the `EngineProcess` interface.
The `onOutput` handler subscribes to `engine-output` Tauri events filtered by
engine ID.

---

## Engine configuration

Users configure engines in `config/engines.json` (inside the game root):

```json
{
  "engines": [
    {
      "id": "stockfish",
      "label": "Stockfish 16",
      "path": "/opt/homebrew/bin/stockfish",
      "options": {
        "Threads": 4,
        "Hash": 256,
        "MultiPV": 3
      }
    },
    {
      "id": "lc0",
      "label": "Leela Zero",
      "path": "/usr/local/bin/lc0",
      "options": {
        "WeightsFile": "/path/to/weights.pb.gz"
      }
    }
  ],
  "defaultEngineId": "stockfish"
}
```

The `engine_manager.ts` reads this at startup and lazily initializes engines
(only `spawn_engine` when first needed).

---

## Use cases — detailed design

### A. Real-time position analysis

**Trigger:** User navigates to a ply and the analysis panel is open.

**Flow:**
1. `startAnalysis(position, { infinite: true, multiPv: 3 })` called.
2. Engine streams `info depth ... score cp ... pv ...` lines.
3. Each line is parsed into `EngineVariation` and pushed to the UI.
4. When the user navigates away, `stopAnalysis()` is called; engine replies
   with `bestmove ...`.
5. The UI shows arrows on the board for the top variation's first move, colored
   by evaluation (green = advantage, red = disadvantage, yellow = equal).

**UI component:** `AnalysisPanel` — shows top N lines with depth, score, PV.
PV moves are clickable (navigates to that variation in preview mode).

### B. Best-move hint

**Trigger:** User presses "Hint" button in editor toolbar (only available when
an engine is configured and it is the user's turn in a game).

**Flow:**
1. `findBestMove(position, { movetime: 2000 })`.
2. Show a translucent arrow on the board for 3 seconds.
3. Optionally annotate the position with `[%cal ...]` / `[%csl ...]` markup.

**Gating:** Disabled during training sessions (would defeat the purpose).

### C. Game annotation (batch analysis)

**Trigger:** "Annotate game" action in game menu.

**Flow:**
1. Dialog: choose engine, depth/movetime per move, annotation level
   (blunder threshold, inaccuracy threshold, add variations for missed best moves).
2. Background task iterates over all plies:
   - For each ply: `findBestMove(position, { depth: D })`.
   - Compares to game move. If |eval delta| > threshold, classify:
     - > 300cp: blunder `??`
     - 100–300cp: mistake `?`
     - 50–100cp: inaccuracy `?!`
   - Writes `{eval=+0.52}` and `{BAD MOVE: Nf6 was better}` annotations.
3. Progress bar in UI; cancellable.
4. On completion: opens a review dialog showing blunder summary; offers to
   apply annotations to the game.

**Storage:** Annotation batch results use the `TrainingTranscript`-like
separate-diff approach (see training plan) to avoid mutating source games.

### D. Play vs engine

**Trigger:** "New game vs engine" action.

**Flow:**
1. Dialog: choose engine, side, time control, optional Elo cap (UCI
   `UCI_LimitStrength` + `UCI_Elo` options).
2. Opens a new session in "vs engine" mode; sets `session.vsEngine = { engineId, playerSide }`.
3. After each user move: `findBestMove` with time management parameters
   derived from the session clock (future: real clock; initial: fixed movetime).
4. Engine move played automatically with a configurable delay (feels more natural).
5. Game ends when checkmate/draw detected by chess.js. Score displayed; PGN
   exported with `[White "Stockfish 16"]` / `[Black "Player"]` headers.

**Clock:** Simple countdown per side; not a full-featured clock in phase 1.
Full clock (increment, delay) in a later phase.

### E. Engine vs engine (deferred)

Out of scope for Phase 1. Useful for testing evaluation or opening preparation.
Add as a background task with no board rendering requirement.

---

## Supported engines

The architecture is engine-agnostic (UCI protocol). Any UCI-compatible engine
works. The table below lists engines of particular interest.

| Engine | License | Elo (approx) | Notes |
|---|---|---|---|
| **Stockfish** | GPL-3.0 | 3600+ | Reference engine; strongest; NNUE evaluation; bundling deferred — to be discussed at app delivery time |
| **Maia Chess / Maia-2** | GPL-3.0 | Configurable 1100–1900 | Trained on human games; plays human-like mistakes at the selected level; single `maia2` model covers all Elo ranges; **primary engine for training mode** |
| **Leela Chess Zero (Lc0)** | GPL-3.0 | 3600+ | Neural network MCTS; GPU-optimized; different evaluation style from alpha-beta engines; large weights download |
| **Ethereal** | GPL-3.0 | 3450+ | C, NNUE; high code quality; good educational reference |
| **Fairy-Stockfish** | GPL-3.0 | — | Stockfish variant with support for Xiangqi, Shogi, Crazyhouse, Antichess, etc. Useful if variant support is added |
| **Arasan** | **MIT** | ~2800–3000 | C++; cross-platform; **most permissive license** for bundling (no source-distribution requirement) |
| **Reckless / Rustic** | Open source | ~2000–2600 | Rust-native engines; architecturally interesting given Tauri's Rust foundation |

### Licensing note

All GPL-3.0 engines can be bundled in the app for commercial distribution, but
require distributing the engine source code and GPL-3.0 license text alongside.
A 2022 legal case (Stockfish vs ChessBase) confirmed enforcement. Arasan (MIT)
has no such requirement.

Add the licenses in a suitable distribution location. Add this either to a creat-distribution workflow, or do it right now.

### Priority for X2Chess use cases

| Use case | Recommended engine |
|---|---|
| Play vs computer at human-like level | **Maia-2** (human-like mistakes at configured Elo) |
| Real-time position analysis | Stockfish (user-installed) or Lc0 |
| Game annotation | Stockfish (user-installed) |
| Best-move hints | Any engine; Stockfish preferred |
| Variants (Crazyhouse, etc.) | Fairy-Stockfish |
| Bundled fallback (permissive license) | Arasan |

### Stockfish bundling

Deferred — not included in initial Tauri app bundle. To be discussed at
delivery time. Users install Stockfish independently (`brew install stockfish`
on macOS; package managers on Linux; manual on Windows) and configure the path
in `config/engines.json`.

---

## Evaluation display conventions

| Score range | Color | Label |
|---|---|---|
| ≥ +3.0 | Dark green | Winning |
| +1.0 to +3.0 | Green | Advantage |
| +0.3 to +1.0 | Light green | Slight advantage |
| −0.3 to +0.3 | Gray | Equal |
| −1.0 to −0.3 | Light red | Slight disadvantage |
| −3.0 to −1.0 | Red | Disadvantage |
| ≤ −3.0 | Dark red | Losing |
| Mate in N | Purple | Forced mate |

Scores displayed from White's perspective in the UI (normalized from
side-to-move perspective in UCI output).

This is to be configurable.

---

## Open questions

1. **Multiple simultaneous engines**: should analysis and play-vs share the
   same engine process, or run separate instances? -> a choice to be made when engines are started.
2. **Pondering**: should the engine ponder (think on opponent's time) in
   play-vs mode? Configurable option. -> let the user choose (setting, but overridable when using engine in play)
3. **Lc0 weights**: Leela Zero requires a separate weights file download
   (~100MB+). Should the app guide users through this, or treat Lc0 as
   entirely self-managed? -> make a note, discuss later.
4. **Maia-2 distribution**: the `maia2` single model covers all Elo levels.
   Weights are ~200MB. Could be bundled as the training-mode companion engine
   — discuss at delivery time alongside Stockfish bundling decision. -> defer
5. **Web fallback**: if a WASM engine is needed (browser build), Stockfish-WASM
   is the most mature option. Should we warn users when running in degraded
   WASM mode? -> yes, but that should not be necessary, I hope, as we do no browser setup.

---

## Implementation phases

| Phase | Deliverable | Dependencies |
|---|---|---|
| G1 | `uci_parser.ts` + `uci_writer.ts` (pure logic, fully testable) | None |
| G2 | `uci_session.ts` state machine | G1 |
| G3 | Tauri Rust commands: `spawn_engine`, `send_to_engine`, `kill_engine`, event streaming | None |
| G4 | `tauri_engine.ts` adapter + `UciEngine` implementation | G2, G3 |
| G5 | `engine_manager.ts` + config loading | G4 |
| G6 | Analysis panel UI (`AnalysisPanel.tsx`) + real-time board arrows | G5 |
| G7 | Best-move hint button in editor toolbar | G5 |
| G8 | Play vs engine (Maia-2 for human-like play; any configured engine) | G5 |
| G9 | Game annotation batch analysis | G5 |
| G10 | Stockfish WASM adapter (web fallback, deferred) | G2 |
