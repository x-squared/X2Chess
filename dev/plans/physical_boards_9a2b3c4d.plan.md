# Physical Chess Board Integration Plan

**File:** `physical_boards_9a2b3c4d.plan.md`
**Status:** Draft — awaiting design review.

---

## Goal

Integrate physical electronic chess boards into X2Chess as a configurable,
multi-board capability layer. The initial target hardware is the **Millennium
ChessLink** (USB + BLE). **DGT boards** (USB + BLE) are a secondary target.

Primary use cases:
1. **Move entry** — detecting and auto-advancing legal moves made on the
   physical board, keeping the digital and physical positions in sync.
2. **Computer move indication** — lighting LEDs on the physical board when the
   engine plays a move, so the user knows which piece to move.
3. **Position sync indication** — lighting LEDs to highlight squares that
   differ between the app's current game position and the physical board state
   (e.g. user navigates the game tree in the app, board drifts out of sync).
4. **Simulator** — a full in-process board simulator for development and
   testing without physical hardware.

---

## Module layout

```
boards/
├── domain/
│   ├── board_types.ts         # Core types: BoardState, PieceCode, SquareId,
│   │                          #   LedCommand, BoardEvent, BoardConnection
│   ├── board_gateway.ts       # BoardGateway interface (I/O injection point)
│   └── board_profile.ts       # BoardProfile type + built-in profile registry
├── protocol/
│   ├── millennium_protocol.ts # Millennium binary encode/decode (profile-driven, pure)
│   ├── dgt_protocol.ts        # DGT binary encode/decode (profile-driven, pure)
│   └── board_diff.ts          # Diff two BoardStates → MoveCandidate + sync LEDs
├── adapters/
│   ├── millennium_adapter.ts  # Millennium connection logic (via injected gateway)
│   ├── dgt_adapter.ts         # DGT connection logic (via injected gateway)
│   └── simulator_adapter.ts   # In-process simulator (implements BoardConnection)
└── index.ts                   # Re-exports public API
```

React integration lives in `frontend/src/`:

```
frontend/src/
├── resources/
│   ├── board_serial_gateway.ts   # Tauri invoke → tauri-plugin-serialport
│   └── board_ble_gateway.ts      # Tauri invoke → btleplug Rust plugin
├── hooks/
│   └── usePhysicalBoard.ts       # React hook: connect, events, LED dispatch
└── components/
    └── BoardConnectPanel.tsx      # Port/BLE scan, connect, status badge
```

Rust/Tauri side (new crates/plugins):

```
src-tauri/
└── (plugin dependencies added to Cargo.toml)
    tauri-plugin-serialport      # USB serial (existing community plugin)
    tauri-plugin-ble             # Custom thin wrapper around btleplug
```

---

## Core types

### `BoardState`
A 64-element array (a1=0 … h8=63) of `PieceCode`. Immutable snapshot.

```typescript
type PieceCode =
  | 0   // empty
  | 1   // white pawn   | 2  // white rook  | 3  // white knight
  | 4   // white bishop | 5  // white king  | 6  // white queen
  | 7   // black pawn   | 8  // black rook  | 9  // black knight
  | 10  // black bishop | 11 // black king  | 12 // black queen;

type SquareId = number; // 0–63, a1=0, h8=63 (matches DGT native ordering)

type BoardState = readonly PieceCode[];  // length 64
```

### `BoardConnection` (the consumer-facing interface)

```typescript
interface BoardConnection {
  readonly boardType: "millennium" | "dgt" | "simulator";
  readonly portOrAddress: string;

  /** Returns current board state on demand. */
  getBoardState(): Promise<BoardState>;

  /**
   * Registers a callback invoked whenever the board state changes.
   * Returns an unsubscribe function.
   */
  onStateChange(handler: (state: BoardState) => void): () => void;

  /** Send a LED signal (static state, animation, or off). */
  sendSignal(signal: LedSignal): Promise<void>;

  disconnect(): Promise<void>;
}

// A single lit square with optional colour.
// Boards without colour support treat any colour as "on".
type LedCommand = {
  square: SquareId;
  color?: "white" | "red" | "orange";
};

// One frame of an animation: which squares are lit and for how long.
type LedFrame = {
  leds: LedCommand[];
  durationMs: number;
};

// A LED signal is either a persistent state, a timed animation, or a clear.
type LedSignal =
  | { kind: "static";   leds: LedCommand[] }                      // held until next signal
  | { kind: "sequence"; frames: LedFrame[]; repeat?: number }      // animated; repeat=0 means loop
  | { kind: "off" };                                               // all LEDs off

// Named application signals dispatched by the app layer.
// The adapter translates these to LedSignal using the active BoardProfile.
type BoardSignalKind =
  | "connection_confirmed"   // board just connected: brief all-on flash
  | "position_set"           // position loaded/confirmed: sweep rank 1→8
  | "computer_move"          // engine played; from+to held until user responds
  | "move_accepted"          // user's move auto-advanced: brief from+to flash
  | "illegal_move"           // piece placed illegally: flash affected squares
  | "check"                  // move gave check: king square pulses
  | "hint"                   // user requested hint: from+to lit (like computer_move)
  | "sync_deviation"         // app position ≠ board: mismatch squares held
  | "study_correct"          // correct study answer: positive flash
  | "study_wrong"            // wrong study answer: flash affected squares
  | "all_off";               // explicit clear
```

### `BoardGateway` (I/O injection interface, implemented by Tauri adapters)

```typescript
interface BoardGateway {
  /** List available serial ports (name, description, vid/pid). */
  listPorts(): Promise<PortInfo[]>;
  /** Open a serial port, return a handle. */
  openPort(path: string, baudRate: number): Promise<SerialHandle>;
  /** BLE: scan for boards matching known service UUIDs. */
  bleScan(serviceUuids: string[]): Promise<BlePeripheral[]>;
  /** BLE: connect and return a BLE handle. */
  bleConnect(peripheralId: string): Promise<BleHandle>;
}

interface SerialHandle {
  write(data: Uint8Array): Promise<void>;
  onData(handler: (data: Uint8Array) => void): () => void;
  close(): Promise<void>;
}

interface BleHandle {
  writeCharacteristic(uuid: string, data: Uint8Array): Promise<void>;
  onCharacteristic(uuid: string, handler: (data: Uint8Array) => void): () => void;
  disconnect(): Promise<void>;
}
```

### `BoardProfile` (firmware versioning)

Every protocol-variant detail that can differ between board models or firmware
versions is captured in a `BoardProfile` data object. Adapters and protocol
modules are **generic** — they receive a profile at construction time and
contain no `if (firmwareVersion)` branches.

```typescript
type BoardProfile = {
  /** Human-readable label shown in the connect panel and diagnostics UI. */
  readonly label: string;             // e.g. "Millennium ChessLink v1.x"

  /** Board family — selects which adapter + protocol module to use. */
  readonly family: "millennium" | "dgt" | "simulator";

  /** Firmware version string as reported by the board, or "unknown". */
  readonly firmwareVersion: string;

  // ── Serial / BLE transport ──────────────────────────────────────────
  readonly baudRate: number;          // e.g. 38400 (Millennium), 9600 (DGT)
  readonly bleServiceUuid?: string;   // present for BLE-capable boards
  readonly bleTxCharUuid?: string;    // board → host
  readonly bleRxCharUuid?: string;    // host → board

  // ── Command bytes (host → board) ────────────────────────────────────
  readonly cmd: {
    requestFullScan:  number;   // byte code to request 64-byte board dump
    enableUpdateMode: number;   // byte code to enable live delta updates
    requestFirmware:  number;   // byte code to read firmware version string
    setLeds:          number;   // byte code prefix for LED command
    allLedsOff:       Uint8Array; // complete message to turn all LEDs off
  };

  // ── Message framing ─────────────────────────────────────────────────
  readonly framing: {
    useOddParity: boolean;      // Millennium uses odd-parity bit on each byte
    useCrc: boolean;            // some boards append a block CRC
    deltaMessageLength: number; // expected length of a piece-move delta message
  };

  // ── Piece encoding: byte value → PieceCode ──────────────────────────
  // Index = raw byte from board; value = internal PieceCode (0 = empty).
  readonly pieceEncoding: readonly number[];  // length ≥ 13

  // ── Square byte ordering ─────────────────────────────────────────────
  // Maps raw byte index (0–63) → internal square index (a1=0 … h8=63).
  // Generated by the square mapping wizard; defaults to the formula derived
  // from python-mchess reverse engineering.
  readonly squareMap: readonly number[];      // length 64
};
```

#### Built-in profiles (`boards/domain/board_profile.ts`)

The registry ships with one default profile per known board × firmware
combination. User-calibrated profiles (produced by the diagnostics wizard)
are stored in app config and merged at startup, **overriding** defaults when
the firmware version matches.

```typescript
const BUILT_IN_PROFILES: readonly BoardProfile[] = [
  MILLENNIUM_CHESSLINK_V1,   // reverse-engineered defaults (python-mchess)
  MILLENNIUM_CHESSLINK_V2,   // placeholder — populated after hardware testing
  DGT_USB_V3,                // from public DGT protocol PDF
];
```

#### Firmware version auto-detection

On every new connection, the adapter sends `cmd.requestFirmware`, reads the
response, and looks up a matching profile by `(family, firmwareVersion)`. If
no exact match is found:
1. The closest version (same family, highest version ≤ detected) is used as
   a fallback.
2. A warning is shown in `BoardConnectPanel`: *"Unrecognised firmware vX.Y —
   using profile for vX.Z. Run the square mapping wizard to verify."*
3. The diagnostics panel is auto-opened to the Square mapping wizard tab.

This ensures the app never silently produces wrong moves due to an unknown
firmware variant.

#### Multiple profiles coexisting

The app config can hold any number of saved profiles. This means:
- Two Millennium boards on different firmware versions work correctly at the
  same time (though only one active `BoardConnection` is supported in v1).
- A community-contributed profile for an undocumented firmware variant can be
  imported as a JSON file and added to the registry without a code change.

---

## Protocol details

### Millennium ChessLink

**USB**: CP210x USB-to-Serial, **38400 baud**, 8N1.
**BLE**: Nordic UART Service (NUS).
- Service UUID: `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
- TX characteristic (board → host): `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`
- RX characteristic (host → board): `6E400002-B5A3-F393-E0A9-E50E24DCCA9E`

**Key messages (host → board):**

| Command | Bytes | Description |
|---|---|---|
| Request board scan | `0x44 0x00` | Returns 64-byte board state |
| Enable update mode | `0x44 0x01` | Board sends deltas on piece moves |
| LED command | `0x4C <square_bitmask>` | Light specific squares |
| LED off | `0x4C 0x00 …` | All LEDs off |

**Board state encoding** (64 bytes, a1=index 0):
```
0x00 = empty
0x01 = white pawn    0x02 = white rook   0x03 = white knight
0x04 = white bishop  0x05 = white king   0x06 = white queen
0x07 = black pawn    0x08 = black rook   0x09 = black knight
0x0A = black bishop  0x0B = black king   0x0C = black queen
```
(Matches DGT encoding — same `PieceCode` mapping above.)

**Delta event** (board → host in update mode): 3 bytes:
`[0xE1, square_index, piece_code]`

### DGT Boards

**USB**: FTDI FT232R, **9600 baud**, 8N1. VID: `0x0403`, PID: `0xe0e0`.
**BLE**: BT SPP profile or BLE UART (same UART framing over wireless).

**Key commands (host → board):**

| Symbol | Byte | Description |
|---|---|---|
| `DGT_SEND_RESET` | `0x40` | Reset |
| `DGT_SEND_BRD` | `0x42` | Request full 64-byte board dump |
| `DGT_SEND_UPDATE` | `0x43` | Enable field update mode |
| `DGT_SEND_UPDATE_NICE` | `0x4B` | Nice update mode (debounced) |

**Board state response**: Same 64-byte, same piece encoding as Millennium above.

**Field update message** (board → host): 5 bytes:
`[0x8E, 0x05, 0x00, square_index, piece_code]`

---

## Move detection and reconciliation

Physical boards report piece-on/piece-off events, not moves. Move detection
requires reconciling the difference between two board states:

```typescript
type MoveCandidate = {
  from: SquareId;
  to: SquareId;
  capturedPiece?: PieceCode;   // for position sync validation
  promotionRequired?: boolean; // pawn reached back rank
};

function boardDiff(before: BoardState, after: BoardState): MoveCandidate | null
```

`boardDiff` is a pure function in `boards/protocol/board_diff.ts`. It handles:
- Normal moves (one piece disappears from `from`, appears at `to`)
- Captures (same, destination was occupied)
- Castling detection (king + rook both move in same diff)
- En passant (captured pawn square ≠ destination)
- Promotion detection (pawn reached rank 8/1)

**Reconciliation with the game model** (in `usePhysicalBoard` hook):
1. Receive `MoveCandidate` from `boardDiff`
2. Ask game model for legal moves from the current position
3. If candidate matches exactly one legal move → dispatch `MOVE_PLAYED` action
4. If promotion → open `PromotionPicker` dialog (existing component)
5. If no legal match → emit `BOARD_ILLEGAL_MOVE` event; flash sync LEDs

---

## LED scenarios

LEDs are a general **feedback channel**. The app dispatches named
`BoardSignalKind` values; `usePhysicalBoard` translates them to `LedSignal`
using the active profile's signal map, then calls `connection.sendSignal()`.
Boards without LED support ignore signals silently.

| Signal | Trigger | Default pattern |
|---|---|---|
| `connection_confirmed` | Board connects | All on 300 ms, then off |
| `position_set` | Position loaded or setup confirmed | Sweep rank 1→8 (40 ms/rank), then off |
| `computer_move` | Engine plays a move | `from` orange + `to` red, **held** until physical response |
| `move_accepted` | User's physical move auto-advances | Brief flash `from`+`to` (2× 150 ms), then off |
| `illegal_move` | Piece placed with no legal match | Rapid flash affected squares (3× 100 ms), then off |
| `check` | Move gives check | King square pulses (2× 200 ms), then off |
| `hint` | User presses Hint | Same as `computer_move` (held) |
| `sync_deviation` | App position ≠ board position | Wrong squares lit, **held**; updated on every change |
| `study_correct` | Correct study answer | All on 400 ms (positive), then off |
| `study_wrong` | Wrong study answer | Moved squares rapid-flash (3× 80 ms), then off |
| `all_off` | Explicit clear / navigation away | All LEDs off immediately |

### Signal priority and pre-emption

Signals are pre-emptive — a new `sendSignal()` call always cancels any
in-progress animation and immediately starts the new one. Priority is managed
by the app (e.g. `sync_deviation` is suppressed while `computer_move` is
held; it resumes after the physical move is made).

### Profile signal map

Each `BoardProfile` may override individual signal definitions. A board with
only on/off LEDs maps all colours to `on`. A board with no LEDs sets
`supportsLeds: false` and `usePhysicalBoard` skips all signal dispatch:

```typescript
type BoardProfile = {
  // ... (transport, commands, framing, encoding, squareMap as before)
  supportsLeds: boolean;
  // Per-signal overrides; signals absent from this map use the default above.
  signalOverrides?: Partial<Record<BoardSignalKind, LedSignal>>;
};
```

### Pure helper functions (`board_diff.ts`)

```typescript
// Compute the LedSignal for a sync_deviation from two board states.
function computeSyncSignal(
  appState: BoardState, physicalState: BoardState
): LedSignal;

// Compute the LedSignal for a computer_move or hint.
function computeMoveSignal(from: SquareId, to: SquareId): LedSignal;
```

---

## Simulator

The simulator (`boards/adapters/simulator_adapter.ts`) implements
`BoardConnection` without any hardware. It maintains an in-memory `BoardState`
and exposes imperative methods for tests and the developer UI:

```typescript
interface BoardSimulator extends BoardConnection {
  /** Place pieces from a FEN string (setup convenience). */
  setPositionFromFen(fen: string): void;
  /** Simulate a move: update internal state + fire onStateChange. */
  simulateMove(from: SquareId, to: SquareId): void;
  /** Read current LED state (for assertions in tests). */
  getLeds(): LedCommand[];
}
```

A minimal `BoardSimulatorPanel.tsx` component lets the user:
- Load any FEN position
- Click two squares to simulate a move
- See which LEDs are currently active

Both panels are gated behind the developer tools toggle.

---

## Board Diagnostics panel (dev tools)

`BoardDiagnosticsPanel.tsx` is a persistent developer tool for hardware
verification and low-level debugging. It is gated behind the developer tools
toggle alongside the simulator panel.

### Tabs

**Raw monitor**
- Live hex dump of every incoming byte frame from the connected board, with
  timestamp and direction (↑ sent / ↓ received).
- Toggle: pause/resume capture.
- "Save log" exports the captured frames as a `.txt` file for offline analysis.
- Useful for any firmware debugging, not just calibration.

**Board state**
- Renders the 64 raw byte values in an 8×8 grid (index 0 top-left, index 63
  bottom-right) — the native device layout, not chess orientation.
- Each cell shows the byte index and current value.
- Hovering a cell highlights the corresponding square on the main chess board
  (once the square mapping is known).
- "Scan now" button sends a full board request and refreshes the grid.

**Square mapping wizard**
A guided step-by-step procedure that derives the board's square-to-byte-index
mapping empirically. Run once per board type / firmware version.

Steps presented to the user in sequence, each with a diagram:

1. *Clear the board* — remove all pieces. Click "Scan". Verify all 64 bytes
   are `0x00`. If not, a warning lists non-zero indices (stray pieces).
2. *Place White King on a1* — scan. The wizard finds the single non-zero byte
   and records `squareMap["a1"] = <index>`.
3. *Slide King to b1* — scan. Records `squareMap["b1"]`.
4. *Slide King to a2* — scan. Records `squareMap["a2"]`.
5. *Full board scan* — place all pieces in the starting position, scan. The
   wizard auto-derives all 64 squares from the known piece encoding and the
   three anchor points already measured.
6. *Confirm* — displays the derived mapping formula and a diff against the
   expected formula from the plan. One-click saves the result.

The derived mapping is saved to the app's config store under
`boardConfig.<boardType>.squareMap` and used by the adapter at runtime in
place of the hard-coded formula. This means a firmware update that changes
byte ordering can be corrected without a code change.

**LED tester**
- 8×8 clickable grid; clicking a square toggles its LED on the physical board.
- "All on" / "All off" buttons.
- "Knight tour" animation cycles LEDs around the board — useful for confirming
  LED wiring matches square indices after calibration.

---

## Phase plan

### Phase B1 — Domain + protocol (pure-logic, no hardware)
- Define all types in `boards/domain/board_types.ts`
- Define `BoardGateway` in `boards/domain/board_gateway.ts`
- Define `BoardProfile` type + built-in profile registry in `boards/domain/board_profile.ts`
  — includes `MILLENNIUM_CHESSLINK_V1` default profile (reverse-engineered values)
  — includes `DGT_USB_V3` default profile (from public PDF)
- Implement `millennium_protocol.ts`: profile-driven encode/decode, full board + delta
- Implement `dgt_protocol.ts`: profile-driven encode/decode, full board + delta
- Implement `board_diff.ts`: `boardDiff()`, `computeSyncLeds()`
- Tests: protocol round-trip for each built-in profile, `boardDiff` for all move types

### Phase B2 — Simulator + dev tools skeleton
- Implement `simulator_adapter.ts`: full `BoardConnection` + `BoardSimulator`
- `BoardSimulatorPanel.tsx` (gated behind dev tools)
- `BoardDiagnosticsPanel.tsx` skeleton with Raw monitor and Board state tabs
  (simulator-backed — no hardware needed)
- Tests: move detection end-to-end via simulator

### Phase B3 — React integration (simulator-backed)
- `usePhysicalBoard.ts` hook (wired to simulator or real board via injected `BoardGateway`)
- `BoardConnectPanel.tsx` (port list, BLE scan, connect/disconnect, status)
- LED dispatch integrated with `useEngineAnalysis` (computer move) and game position selector (sync)
- All working with simulator — no Tauri plugin yet

### Phase B4 — USB/Serial (Tauri) + diagnostics wizard
- Add `tauri-plugin-serialport` to `src-tauri/Cargo.toml`
- Implement `board_serial_gateway.ts`: Tauri invoke calls for listPorts / open / read / write
- Wire `millennium_adapter.ts` to serial gateway; validate with hardware
- Complete `BoardDiagnosticsPanel.tsx`: Square mapping wizard + LED tester tabs
  (require live board connection — activate in B4 once serial gateway exists)
- **Run square mapping wizard** against physical Millennium board; confirm or
  correct the `toInternal` formula before any further protocol work
- Wire `dgt_adapter.ts` to serial gateway; validate with hardware (if available)

### Phase B5 — BLE (Tauri)
- Write minimal Rust Tauri plugin wrapping `btleplug` crate (scan, connect, GATT read/write/notify)
- Expose as `tauri-plugin-ble` with typed TypeScript bindings
- Implement `board_ble_gateway.ts`
- BLE path wired into Millennium and DGT adapters via same `BoardGateway` abstraction

---

## Tauri plugin notes

### USB Serial: `tauri-plugin-serialport`
- Existing community plugin: `lzhiyong/tauri-plugin-serialport`
- Wraps Rust `serialport` crate; cross-platform (macOS, Windows, Linux)
- Exposes: `list`, `open`, `write`, `read`, `close`, `available_ports`

### BLE: custom `tauri-plugin-ble`
No mature general-purpose BLE Tauri plugin exists yet. A minimal custom plugin
is required. Scope is narrow:
- `ble_scan(service_uuids: string[]) → Peripheral[]`
- `ble_connect(id: string) → void`
- `ble_write(id, service_uuid, char_uuid, data: number[]) → void`
- `ble_subscribe(id, service_uuid, char_uuid) → void` (events come via Tauri event system)
- `ble_disconnect(id) → void`

Uses `btleplug` Rust crate (cross-platform, mature).

**macOS note**: BLE requires `NSBluetoothAlwaysUsageDescription` in the app's
`Info.plist` and appropriate entitlements in the Tauri configuration.

---

## Integration points with existing codebase

| Existing feature | Integration |
|---|---|
| vs-engine mode (`useEngineAnalysis`) | After engine plays, call `board.setLeds([from, to])` |
| Game position (reducer state) | `usePhysicalBoard` subscribes to current FEN; computes sync LEDs |
| `PromotionPicker` dialog | Reused when board diff detects pawn promotion |
| Developer tools toggle | Gates simulator panel visibility |
| `ServiceContext` | `BoardConnection` added as an optional service, null when no board connected |

---

## Square ordering — research finding

**DGT**: a1=byte 0, b1=byte 1, …, h1=byte 7, a2=byte 8, …, h8=byte 63
(standard file-major order, confirmed by public DGT protocol PDF).

**Millennium** (from `python-mchess` reverse engineering, `chess_link.py`):
```
position[rank][file] = raw_bytes[7 - file + rank * 8]
```
where `rank` = 0 (rank 1) … 7 (rank 8), `file` = 0 (a) … 7 (h).

Byte index `i` → rank = i ÷ 8, file = 7 − (i mod 8).

| Byte 0 | Byte 7 | Byte 8 | Byte 56 | Byte 63 |
|--------|--------|--------|---------|---------|
| h1     | a1     | h2     | h8      | a8      |

**Within each rank, h-file is byte 0 and a-file is byte 7** — the reverse of DGT.

The app uses a1=0 internally. The Millennium adapter converts on ingestion:
```typescript
// millennium byte index → internal square index (a1=0)
const toInternal = (i: number): number =>
  Math.floor(i / 8) * 8 + (7 - (i % 8));
```

The code also applies an **orientation correction**: when the board is placed
cable-left (rotated 180°), the starting position appears mirrored. The adapter
detects this from the first full board state after connection and applies a 180°
rotation if needed (same logic as `python-mchess`).

**Confidence: medium-high** — internally consistent reverse engineering, no
official Millennium documentation found. Verify with hardware using experiment
below.

### Hardware verification experiment (run once when board is available)

Connect board via USB (38400 baud). Then:

1. **Baseline**: remove all pieces, request scan → all 64 bytes should be `0x00`.
2. **Place White King on a1 only** → scan → exactly one non-zero byte.
   Record its index. Expected: **7**. This pins down a1.
3. **Slide King to b1** (one step right) → scan → one byte changes.
   Record new index. Expected: **6** (one lower = h-file-first within rank).
4. **Slide King to a2** (one step up from a1) → scan → one byte changes.
   Record new index. Expected: **15** (= 7 + 8 = rank stride of 8).

Three data points (a1, b1, a2) unambiguously determine the full 64-square
mapping. If the results match expectations, the formula above is confirmed.
If not, update `toInternal` accordingly before Phase B4.

---

## Open questions

1. **Firmware variants**: Millennium firmware versions may differ in exact
   command codes. The adapter should log raw bytes in dev mode for debugging.
2. **BLE plugin**: Evaluate whether `tauri-plugin-ble` (if one exists in the
   ecosystem by implementation time) can substitute for the custom plugin.
3. **Concurrent connections**: Can a USB and BLE connection coexist (e.g. USB
   to one board, BLE to another)? The `ServiceContext` should support at most
   one active `BoardConnection` at a time in v1.
