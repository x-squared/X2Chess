# Training Mode Plan

**File:** `training_mode_c9d0e1f2.plan.md`
**Status:** Draft — awaiting design review.

---

## Goal

Implement a training mode in which the user solves structured tasks derived
from real games. Training is non-destructive: the source game is never mutated
during a session. User activity is captured in a **training transcript** kept
separate from the game data, with an explicit opt-in merge step at the end.

The architecture supports multiple training protocols under a single shared
infrastructure. The first protocol to implement is **Replay**: reproduce one
side of a game from a chosen starting position.

---

## Core invariants

1. **Source immutability**: the source game data is never modified during
   training. The board operates on a read-only shadow copy.
2. **Transcript isolation**: all user moves, timing, and annotations are
   stored in a `TrainingTranscript` object; they do not enter the PGN model
   until the user explicitly merges them.
3. **Protocol extensibility**: adding a new training protocol requires only
   implementing the `TrainingProtocol` interface; no changes to the core
   infrastructure.
4. **Engine optional**: engine assistance (hints) is available only when an
   engine is configured, and can be disabled per-session by the protocol.

---

## Module layout

```
frontend/src/training/
├── domain/
│   ├── training_protocol.ts   # TrainingProtocol interface + lifecycle types
│   ├── training_transcript.ts # TrainingTranscript, PlyRecord, TrainingAnnotation
│   └── training_result.ts     # ResultSummary, MergeSelection
├── protocols/
│   ├── replay_protocol.ts     # "Play one side" — first protocol to implement
│   ├── guess_protocol.ts      # Future: guess next move at each ply
│   └── tactics_protocol.ts    # Future: find winning combination from position
├── components/
│   ├── TrainingLauncher.tsx   # Dialog to configure and start a session
│   ├── TrainingOverlay.tsx    # Mode banner, progress bar, score indicator
│   ├── TrainingResult.tsx     # End-of-session score + merge selection dialog
│   └── MoveOutcomeHint.tsx    # Temporary overlay: "Correct!" / "Missed: Nf6"
├── hooks/
│   └── useTrainingSession.ts  # Session state machine + move interception
└── index.ts
```

---

## Domain contracts

### TrainingProtocol interface

```typescript
interface TrainingProtocol {
  readonly id: string;           // e.g. "replay"
  readonly label: string;        // e.g. "Game Replay"
  readonly description: string;

  // Called once when session starts. Returns initial session state.
  initialize(config: TrainingConfig): TrainingSessionState;

  // Called for each move the user attempts.
  // Returns: accept/reject decision + feedback to show.
  evaluateMove(
    move: UserMoveInput,
    state: TrainingSessionState,
  ): MoveEvalResult;

  // Called after evaluateMove accepted a move. Returns updated state.
  advance(state: TrainingSessionState): TrainingSessionState;

  // True when the session is over (all moves done, or abort condition met).
  isComplete(state: TrainingSessionState): boolean;

  // Compute the final result summary.
  summarize(state: TrainingSessionState, transcript: TrainingTranscript): ResultSummary;
}

type TrainingConfig = {
  sourceGameRef: PgnGameRef;
  pgnText: string;              // resolved at launch time
  protocol: string;             // protocol id
  protocolOptions: Record<string, unknown>;
};

type UserMoveInput = {
  uci: string;
  san: string;
  timestamp: number;
};

type MoveEvalResult = {
  accepted: boolean;
  feedback: "correct" | "wrong" | "skip" | "legal_variant";
  correctMove?: { uci: string; san: string };   // provided when accepted === false
  annotation?: string;                          // text to record in transcript
};
```

### TrainingTranscript

```typescript
type TrainingTranscript = {
  sessionId: string;
  protocol: string;
  sourceGameRef: PgnGameRef;
  startedAt: string;            // ISO timestamp
  completedAt?: string;
  aborted: boolean;
  config: Record<string, unknown>;

  plyRecords: PlyRecord[];
  annotations: TrainingAnnotation[];
};

type PlyRecord = {
  ply: number;
  sourceMoveUci: string;        // expected move from game
  sourceMoveSan: string;
  userMoveUci?: string;         // move the user played (undefined = skipped)
  userMoveSan?: string;
  outcome: "correct" | "wrong" | "skip" | "engine_filled";
  attemptsCount: number;        // how many tries before correct or skip
  timeTakenMs: number;          // clock time spent on this move
};

type TrainingAnnotation = {
  ply: number;
  kind: "comment" | "variation" | "nag" | "clock";
  content: string;
  source: "user" | "engine" | "protocol";
};
```

### ResultSummary

```typescript
type ResultSummary = {
  correct: number;
  wrong: number;
  skipped: number;
  total: number;
  scorePercent: number;         // correct / (total - skipped) * 100
  avgTimeMsPerMove?: number;
  gradeLabel: string;           // "Excellent" / "Good" / "Fair" / "Needs work"
  highlights: ResultHighlight[];
};

type ResultHighlight = {
  ply: number;
  kind: "best_move" | "blunder" | "comeback" | "flawless_streak";
  description: string;
};
```

### MergeSelection (post-session)

```typescript
type MergeSelection = {
  annotations: Array<{
    annotation: TrainingAnnotation;
    include: boolean;           // user's checkbox choice
  }>;
  mergeTarget: "source_game" | "new_variation" | "keep_separate";
};
```

---

## Session state machine

```
Idle ──[launch]──► Configuring ──[start]──► InProgress
                                                │
                             [all moves done / abort]
                                                ▼
                                           Reviewing
                                                │
                                   [merge/discard decision]
                                                ▼
                                             Idle
```

The state machine lives in `useTrainingSession`. It:
- Holds `TrainingSessionState` as `useReducer` state
- Intercepts board input during `InProgress` phase
- Exposes `submitMove`, `skipMove`, `requestHint`, `abort` actions
- Fires callbacks that the `TrainingOverlay` and `TrainingResult` components consume

---

## Replay Protocol — detailed design

### Configuration options

```typescript
type ReplayProtocolOptions = {
  side: "white" | "black" | "both";
  startPly: number;             // default 0
  allowRetry: boolean;          // show correct move and offer retry on wrong
  showOpponentMoves: boolean;   // animate opponent moves automatically
  opponentMoveDelayMs: number;  // default 800
  allowHints: boolean;          // show engine hint on request
  maxHintsPerGame: number;      // default 3; 0 = unlimited
};
```

### Move evaluation logic

For each ply where it is the user's turn:
1. User plays a move on the board.
2. Move legality is checked by chess.js (illegal moves are silently rejected
   by the board — no training feedback needed).
3. Move is compared to the source game's mainline move:
   - **Exact match** (same UCI): `accepted = true, feedback = "correct"`.
   - **Legal but different**:
     - If the moved piece reaches the same destination (transposition candidate):
       check if it matches any annotated variation in the source game. If so:
       `feedback = "legal_variant"`, accepted.
     - Otherwise: `accepted = false, feedback = "wrong"`. Show correct move.
   - **After showing correct move**: if `allowRetry`, the user can try again
     (retry resets the board to before the move; attempt count is incremented).
     If not `allowRetry`, auto-advance after 1.5 seconds.

### Opponent move handling

When it is the opponent's turn (or always, when `side = "both"` and opponent
moves exist): play the source game move automatically after `opponentMoveDelayMs`.
Animate the move on the board. The user cannot input during this period.

### End conditions

The session ends when:
- All user-side plies in the game have been attempted (regardless of skips), OR
- The user aborts manually.

### Transcript annotation capture

During replay, the protocol optionally captures:
- User's time per move (always captured in `PlyRecord`).
- If the user played a wrong move: record both moves as a variation annotation
  (`kind: "variation"`) at that ply — "I played X, correct was Y".
- If the user adds a comment in an inline comment field (future): captured as
  `kind: "comment"`.

---

## Merge dialog design

After session completion, `TrainingResult` shows:

1. **Score bar** — visual representation of correct/wrong/skipped.
2. **Ply breakdown** — per-move table: move number, user move vs source move,
   outcome icon (✓/✗/→), time taken.
3. **Annotation list** — checkboxes for each captured annotation; pre-checked
   for "correct" annotations, unchecked for "wrong" ones.
4. **Merge target selector**:
   - "Add to source game" — annotations applied inline to the original PGN.
   - "Create new variation" — annotations applied to a copy of the game
     stored in the same resource (prefixed with `[Event "Training: ..."]`).
   - "Keep separate" — transcript saved to sidecar storage only.
5. **"Apply" / "Discard"** buttons.

---

## Transcript storage

Transcripts are persisted as JSON alongside the game resource:

- For `.x2chess` DB: stored in a dedicated `training_transcripts` table
  (version 5 migration).
- For directory resources: stored in `.x2chess-training/` subdirectory
  next to the games folder; filename `{gameId}-{sessionId}.json`.
- For single-file PGN resources: stored in
  `{filename}.x2chess-training/{gameId}-{sessionId}.json`.

The `TrainingTranscriptStore` interface abstracts over these backends, with
adapters following the same gateway injection pattern as `FsGateway`/`DbGateway`.

---

## Integration with board and session model

### Move interception

A `TrainingInterceptor` sits between board input and the session model:

```typescript
interface TrainingInterceptor {
  // Returns true if the move is accepted by the training protocol.
  // May modify the move (e.g. promote to correct move) or reject it.
  interceptMove(move: UserMoveInput): MoveEvalResult;
  readonly isActive: boolean;
}
```

When `isActive`, all board move submissions go through the interceptor before
reaching the PGN model. The PGN model itself is not updated during training
(the board operates on a shadow FEN, not the model).

### Session model isolation

Training operates on a **shadow session**: a frozen copy of the source game's
PGN model at the time of training launch. The main session (tab bar) is not
disturbed. When training ends:
- The shadow session is discarded.
- The user returns to the source session.
- If merge was selected, the source game in the resource is updated.

The shadow session is created by `sessionStore.openTrainingSession(sourceRef, pgnText)`,
which opens a second session that is not persisted to autosave and not shown in
the session tab bar (it has a special `training` flag).

---

## Future protocols

| Protocol | Description | Core challenge |
|---|---|---|
| **Guess the move** | At each ply, guess the move played in the game | Same as replay but both sides; scoring rewards "finding" GM moves |
| **Tactics trainer** | Given a position with a known tactic, find the winning sequence | Need a separate tactics problem dataset; sequence must be fully correct |
| **Endgame technique** | Given a won/drawn endgame position, demonstrate correct technique | Requires tablebase integration to verify correctness |
| **Opening trainer** | Reproduce an opening repertoire from memory | Built on replay protocol, restricted to opening phase; fork at known deviation points |
| **Blindfold** | Replay without seeing the pieces | Board hidden; move entered as SAN text |

---

## UI sketches

### TrainingLauncher dialog

```
┌─ Start Training ──────────────────────────────┐
│ Protocol:  [Replay  ▾]                        │
│ Game:      Alice – Bob, Test Event, 2024       │
│ Side:      ○ White  ● Black  ○ Both            │
│ Start ply: [0     ] (move 1)                   │
│ Hints:     [3     ] per game                   │
│ ☑ Show opponent moves  Delay: [800] ms         │
│ ☑ Allow retry on wrong move                    │
│               [ Cancel ]  [ Start Training ]   │
└────────────────────────────────────────────────┘
```

### TrainingOverlay (in-session banner)

```
┌──────────────────────────────────────────────────────┐
│ 🎯 Replay — Black  │  Move 12 / 34  │  Score: 8/11  │
│ [Hint (2 left)]  [Skip]  [Abort]                     │
└──────────────────────────────────────────────────────┘
```

### MoveOutcomeHint (brief overlay on wrong move)

```
┌───────────────────────────┐
│  ✗ Missed: Nf6 was best   │
│  [Try again]  [Skip]      │
└───────────────────────────┘
```

---

## Sidecar strategy and viewer integration

### One sidecar or several?

Two tiers — not one sidecar per feature:

| Tier | File / directory | Content |
|---|---|---|
| Resource metadata sidecar | `.x2chess-meta.json` (single file) | Game ordering, extra metadata; written by resource viewer operations |
| Training archive | `.x2chess-training/` (subdirectory) | One JSON file per session: `{gameId}-{sessionId}.json` |

The archive is a directory because sessions multiply over time; each is
independently deletable. Two hidden items total per games folder regardless
of how many features are added.

### Resource viewer integration

**Row-level badge** (preferred over a dedicated column for initial implementation):
a small indicator in the `game` cell when a game has training history.
Hover tooltip shows: "3 sessions · best 87%". Clicking opens a training
history side panel or launches a new session.

Implementation: at tab load time, scan the `.x2chess-training/` directory
(if present), build a `Map<gameId, TrainingBadge>` in memory, pass to
`ResourceTable` as an optional `trainingBadges` prop. No schema change to
`TabState`; no localStorage impact.

When users want training data as a sortable/filterable column, promote
to a proper `"Training"` metadata column via the column selector dialog.

### Text editor integration

When a game with training history is open in the editor, show a non-intrusive
summary strip below the PGN headers:

```
🎯 3 training sessions · Best: 87% (Replay, 2024-03-18) · [View] [Train again]
```

Component: `TrainingHistoryStrip` — renders only when the active session has a
`sourceRef` that resolves to training data in the `TrainingTranscriptStore`.
Reads are cheap (index is loaded in memory at session open; individual
transcripts are lazy-loaded only when the user opens the history panel).

### Phases for viewer / editor integration

These are additional phases appended to the main phase list:

| Phase | Deliverable |
|---|---|
| T13 | ✅ `transcript_storage.ts` — localStorage badge + session history store |
| T14 | ✅ `ResourceTable` training badge rendering (`TrainingBadgeChip`) |
| T15 | ✅ `TrainingHistoryStrip` in text editor view |
| T16 | ✅ `TrainingHistoryPanel` — session list with score bars |

---

## Open questions

1. **Variant moves**: should "legal but not mainline" moves be treated as wrong,
   or should the protocol check annotated variations in the source game? Checking
   variations adds value but requires PGN model traversal.
2. **Clock integration**: should training sessions track wall-clock time per move
   (simple) or use a chess clock (Bronstein/Fischer) for time pressure training?
3. **Engine-annotated training**: after game annotation (via engine plan), the
   engine evaluations are stored in the game. Should the replay protocol use
   these to grade moves (e.g. "you found the engine's top 3 moves 70% of the time")?
4. **Difficulty scaling**: should the replay protocol get easier over time (hint
   given sooner) when the user struggles with a particular position, and harder
   when they master it? This implies persisting per-position performance data.
5. **Multi-game training sessions**: train on a repertoire (multiple games) in
   one session, with random position order. Requires a session that spans
   multiple source games and a unified transcript.

---

## Implementation phases

| Phase | Deliverable | Dependencies |
|---|---|---|
| T1 | `training_protocol.ts` + `training_transcript.ts` domain types | None |
| T2 | `replay_protocol.ts` — evaluateMove + advance logic | chess.js |
| T3 | `useTrainingSession` hook — state machine | T1, T2 |
| T4 | `TrainingLauncher.tsx` — configuration dialog | T3 |
| T5 | `TrainingOverlay.tsx` — in-session banner + progress | T3 |
| T6 | `MoveOutcomeHint.tsx` — correct/wrong feedback overlay | T3 |
| T7 | Move interception wired to board input | T3 |
| T8 | `TrainingResult.tsx` — score summary + merge dialog | T3 |
| T9 | Transcript persistence (DB table + directory sidecar) | T1, resource plan |
| T10 | Merge: apply selected annotations back to source game | T8, T9 |
| T11 | Engine hints during replay | T3, engines plan |
| T12 | Opening trainer protocol (variant of replay) | T2 |
