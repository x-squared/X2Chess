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

## Bundled Stockfish

For app distribution, bundle Stockfish as a Tauri sidecar:
- `src-tauri/binaries/stockfish-aarch64-apple-darwin` (macOS ARM)
- `src-tauri/binaries/stockfish-x86_64-unknown-linux-gnu` (Linux)
- `src-tauri/binaries/stockfish-x86_64-pc-windows-msvc.exe` (Windows)

In `tauri.conf.json`:
```json
{ "bundle": { "externalBin": ["binaries/stockfish"] } }
```

For the browser/web build: Stockfish-WASM (`stockfish.js` npm package) as
a Web Worker fallback, automatically selected when not in Tauri runtime.

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

---

## Open questions

1. **Engine bundling size**: Stockfish 16 binary is ~80MB. Is this acceptable
   in the Tauri app bundle, or should we prompt users to install it separately?
2. **Multiple simultaneous engines**: should analysis and play-vs share the
   same engine process, or run separate instances?
3. **Pondering**: should the engine ponder (think on opponent's time) in
   play-vs mode? Configurable option.
4. **NNUE weights**: Stockfish uses NNUE evaluation by default. The bundled
   binary includes weights; no extra download needed. For Leela Zero, the
   weights file must be downloaded separately.
5. **Web fallback**: Stockfish-WASM runs in a Web Worker and has API parity
   with UCI. However, it is significantly slower than the native binary.
   Should we warn users when running in degraded WASM mode?

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
| G8 | Play vs engine: session mode + engine response loop | G5 |
| G9 | Game annotation batch analysis | G5 |
| G10 | Stockfish WASM adapter (web fallback) | G2 |
| G11 | Bundled Stockfish sidecar in Tauri app | G4 |
