# Training — Move Acceptance Algorithm

**File:** `training_move_acceptance_3e4f5a6b.plan.md`
**Status:** Draft — design complete, ready for implementation.
**Parent plan:** `training_mode_c9d0e1f2.plan.md`

---

## Goal

Replace the current hard-coded exact-match evaluation in `replay_protocol.ts`
with a principled move acceptance algorithm that recognises good alternatives,
penalises blunders, and rewards finding improvements over flawed game moves.

The algorithm reads the following signal sources — in override order:

```
[%train] tag  ←  overrides all other rules when present
    │
    ▼
NAG on the game move  +  NAGs on variation first-moves
    │
    ▼
[%eval] values in move comments  (quantitative fallback)
    │
    ▼
Raw legality  (last resort — no annotation at all)
```

---

## Extended `MoveEvalResult`

Replace the current `feedback` union and add two optional fields.

```typescript
export type MoveEvalFeedback =
  | "correct"           // user played the canonical best move
  | "correct_better"    // user played a move better than the (flawed) game move
  | "correct_dubious"   // user played the game move, but a better move exists
  | "legal_variant"     // accepted equivalent alternative
  | "inferior"          // dubious but real — matched a ?! RAV
  | "wrong"             // not accepted; canonical move is shown
  | "skip";

export type MoveEvalResult = {
  accepted: boolean;
  feedback: MoveEvalFeedback;

  /** The canonical best move. Provided whenever the user did not play it. */
  correctMove?: { uci: string; san: string };

  /**
   * A strictly better move exists even though the user's move was accepted.
   * Set when user plays the game move but that move is annotated ?! or worse.
   */
  betterMoveExists?: { uci: string; san: string; annotation?: string };

  /** Explanatory text for the feedback overlay (sourced from RAV comment or
   *  [%train] hint field). */
  annotation?: string;
};
```

### Feedback semantics

| feedback | `accepted` | Meaning |
|---|---|---|
| `correct` | `true` | Played the canonical best |
| `correct_better` | `true` | Found the refutation of a flawed game move |
| `correct_dubious` | `true` | Played the game move; a better option exists |
| `legal_variant` | `true` | Played an endorsed alternative (! !! !? or unannotated RAV) |
| `inferior` | configurable | Played a ?! RAV — dubious but the annotator considered it |
| `wrong` | `false` | Played a move in a ?/?? RAV, or outside any RAV |
| `skip` | `false` | No expected move exists at this ply |

Whether `inferior` is accepted or rejected is a per-protocol option
(`inferiorMovePolicy: "accept" | "reject"`; default `"reject"`). When rejected
the feedback overlay shows the improvement with the RAV comment as context.

---

## The `[%train]` PGN Annotation Tag

A new comment-embedded tag for curated training material. It attaches to the
**position comment** immediately before the move to be trained (i.e., in the
comment token that follows the preceding move, or at the start of the game for
ply 0).

### Syntax

```
[%train accept="<uci-list>" reject="<uci-list>" hint="<text>"]
```

| Field | Required | Meaning |
|---|---|---|
| `accept` | no | Comma-separated UCI moves (e.g. `"e2e4,d2d4"`) accepted as correct |
| `reject` | no | UCI moves that trigger a specific trap warning rather than generic "wrong" |
| `hint` | no | Text shown when the user requests a hint |

All three fields are optional; an empty tag `[%train]` is valid and means
"use the tag's presence to suppress algorithm inference" (only the mainline move
is accepted).

### Override rule

When a `[%train]` tag is found for the current ply:
- The `accept` list is the complete accepted set. No NAG/RAV/eval scanning occurs.
- The `reject` list identifies trap moves: they return `feedback: "wrong"` but
  with the specific annotation sourced from the matching RAV's comment, not a
  generic message.
- Moves outside both lists are `feedback: "wrong"` with a generic correction.
- The mainline move is implicitly in `accept` unless it is listed in `reject`.

### Parser location

`[%train]` parsing lives in a new helper
`frontend/src/training/domain/train_tag_parser.ts`:

```typescript
export type TrainTag = {
  accept: string[];   // UCI strings
  reject: string[];   // UCI strings
  hint?: string;
};

/** Extract [%train ...] from a PGN comment string, or null if absent. */
export const parseTrainTag = (comment: string): TrainTag | null;
```

---

## The Move Acceptance Algorithm

Implemented in a new pure module:
`frontend/src/training/domain/move_acceptance.ts`

### Inputs

```typescript
type MoveAcceptanceContext = {
  userMove: UserMoveInput;
  ply: number;
  /** The PGN model node at this ply (carries mainline move, NAGs, RAVs, comments). */
  node: PgnMoveNode;
  inferiorMovePolicy: "accept" | "reject";
};
```

### Step 1 — Check for `[%train]` tag

Scan the position comment at `ply` for a `[%train]` tag via `parseTrainTag`.

If found: apply the override rule above. Return immediately. Do not proceed to
Steps 2–5.

### Step 2 — Classify the game move's NAG

Read the NAG(s) attached to the mainline move node.

| NAG(s) | Classification |
|---|---|
| `$3` (‼) or `$1` (!) | `GAME_MOVE_GOOD` — game move is the canonical answer |
| `$5` (!?) | `GAME_MOVE_INTERESTING` — game move is the answer; note ambiguity |
| `$6` (?!) | `GAME_MOVE_DUBIOUS` — game move is accepted but betterMoveExists search runs |
| `$2` (?) or `$4` (??) | `GAME_MOVE_BAD` — game move is NOT the canonical answer |
| none | `GAME_MOVE_NEUTRAL` — game move is the answer |

### Step 3 — Find the canonical answer

- If `GAME_MOVE_GOOD`, `GAME_MOVE_INTERESTING`, or `GAME_MOVE_NEUTRAL`:
  canonical answer = mainline move.
- If `GAME_MOVE_DUBIOUS`:
  canonical answer = mainline move, but `betterMoveExists` search runs in Step 4.
- If `GAME_MOVE_BAD`:
  scan the immediate RAVs for a first-move with NAG `$1` or `$3`.
  If found: canonical answer = that RAV's first move.
  Fallback: canonical answer = mainline move (no better information available).

### Step 4 — Build the move sets

**Accepted set** (any of these → game advances):
```
canonical answer (always)
mainline move (unless GAME_MOVE_BAD and a better RAV was found)
RAV first-moves with NAG $1 (!) $3 (!!) $5 (!?)
RAV first-moves with no NAG (unannotated alternative)
```

**Inferior set** (dubious but acknowledged):
```
RAV first-moves with NAG $6 (?!)
```

**Trap set** (explicitly bad — give specific comment):
```
RAV first-moves with NAG $2 (?) or $4 (??)
```

**betterMoveExists** candidates:
- When user plays the mainline move and `GAME_MOVE_DUBIOUS` or `GAME_MOVE_BAD`:
  set `betterMoveExists` to the canonical answer (if different from mainline).

### Step 5 — `[%eval]` fallback

Only reached for moves outside all RAVs (no annotation to classify them).

Scan position and move comments for `[%eval <centipawns>]` tokens.

If the mainline position comment has `[%eval M]` and a candidate RAV has
`[%eval N]`:
```
|N - M| ≤ 30 cp  →  treat the variation as unannotated (accepted)
|N - M| ≤ 80 cp  →  treat as ?! (inferior set)
|N - M| > 80 cp  →  treat as ? (trap set)
```

Thresholds are constants in `move_acceptance.ts` and should be configurable via
`ReplayProtocolOptions` in a later phase.

If no `[%eval]` is present and the move is outside all RAVs: `feedback: "wrong"`.

### Step 6 — Classify the user's move

```
user move = canonical answer         → feedback: "correct"
  and canonical answer ≠ game move   → feedback: "correct_better"

user move in accepted set            → feedback: "legal_variant"
  and betterMoveExists               → feedback: "correct_dubious"  (when user = game move)

user move in inferior set            → feedback: "inferior"
  accepted or rejected per protocol inferiorMovePolicy

user move in trap set                → feedback: "wrong"
  annotation: sourced from that RAV's comment

user move in no set                  → feedback: "wrong"
  annotation: generic correction
```

---

## Updated `PlyOutcome` in `TrainingTranscript`

Add `"inferior"` and `"correct_better"` to the outcome union so the transcript
faithfully records all outcomes:

```typescript
export type PlyOutcome =
  | "correct"
  | "correct_better"
  | "correct_dubious"
  | "legal_variant"
  | "inferior"
  | "wrong"
  | "skip"
  | "engine_filled";
```

---

## Updated `ReplayProtocolOptions`

```typescript
type ReplayProtocolOptions = {
  // … existing fields …

  /**
   * Whether to accept moves in the inferior (?!) set or require the user
   * to find a better move.
   * Default: "reject"
   */
  inferiorMovePolicy: "accept" | "reject";

  /**
   * Centipawn threshold below which a non-annotated legal move is accepted
   * as equivalent (requires [%eval] in PGN). Default: 30.
   */
  evalAcceptThresholdCp: number;

  /**
   * Centipawn threshold below which a non-annotated legal move is treated
   * as ?! (inferior). Default: 80.
   */
  evalInferiorThresholdCp: number;
};
```

---

## Updated `summarize` — scoring weights

When computing `scorePercent`, weight outcomes:

| Outcome | Score contribution |
|---|---|
| `correct` / `correct_better` | 1.0 |
| `correct_dubious` / `legal_variant` | 1.0 |
| `inferior` (accepted) | 0.5 |
| `inferior` (rejected, user retried and found it) | 1.0 |
| `wrong` | 0.0 |
| `skip` / `engine_filled` | excluded from denominator |

`correct_better` also contributes a `"best_move"` highlight entry in
`ResultHighlight`.

---

## Module layout additions

```
frontend/src/training/
└── domain/
    ├── train_tag_parser.ts        # NEW — [%train] tag parsing
    ├── move_acceptance.ts         # NEW — MoveAcceptanceContext + algorithm
    ├── training_protocol.ts       # EDIT — extend MoveEvalResult
    └── training_transcript.ts     # EDIT — extend PlyOutcome
frontend/src/training/
└── protocols/
    └── replay_protocol.ts         # EDIT — wire move_acceptance, new options
frontend/test/training/
    ├── train_tag_parser.test.ts   # NEW
    └── move_acceptance.test.ts    # NEW — covers all Step 1–6 cases
```

---

## User manual updates (`doc/user-manual.qmd`)

### Section: "Training mode — During training" (replacement)

Replace the current sparse bullet list with:

```markdown
### During training

The board shows the current position. You are expected to play the move that
was played in the game — or any move the game's annotator has judged as equally
good.

#### Move outcomes

| Indicator | Meaning |
|---|---|
| ✓ Correct | You played the game move or a recognized strong alternative. |
| ✓ Better! | You found an improvement over the game move (the game move was flawed). |
| ✓ (note) | You played the game move, but a better option existed. Training continues. |
| ~ Dubious | Your move is in the game's analysis but considered questionable.  Depending on settings, training may continue or ask you to try again. |
| ✗ Wrong | Your move was not accepted. The best move is revealed. |

#### Hints

Click **Hint** in the training overlay to reveal the canonical best move for
the current position. Using a hint reduces your final score for that move.
The number of hints available is shown in the overlay.

#### Skipping a move

Click **Skip** to advance without playing. Skipped moves are excluded from
your score denominator but are listed in the result summary.

#### Session end

When all moves have been attempted, the result summary shows your score,
per-move breakdown, and merge options (see "Merging training results").
```

### Section: "Training mode — Annotating games for training" (new section, after "During training")

```markdown
### Annotating games for training

X2Chess reads the standard PGN annotation conventions when evaluating your
moves. Richer annotation produces better training feedback.

#### Move symbols (NAGs)

Attach move symbols to individual moves in the editor using the NAG buttons
(! !! ? ?? !? ?!). The training engine uses them as follows:

| Symbol | Meaning for training |
|---|---|
| !! ‼ — Brilliant | This move is the canonical answer. |
| ! — Good | This move is the canonical answer. |
| !? — Interesting | This move is the canonical answer. Training notes its speculative nature. |
| ?! — Dubious | This move is the game move; training notes that better may exist. |
| ? — Mistake | This move is **not** the canonical answer. Add a variation (see below) to show the correct move. |
| ?? — Blunder | As above. The variation's first move, if annotated !, becomes the expected answer. |

#### Variations as alternatives

Any variation (RAV) you add immediately after a move is considered by the
training engine:

- A variation starting with `!` or `!!` is accepted as a strong alternative
  (full credit).
- A variation starting with `!?` is accepted as a speculative alternative
  (full credit).
- A variation with no NAG is accepted as a neutral alternative (full credit).
- A variation starting with `?!` marks a dubious option (partial credit or
  prompted retry, depending on settings).
- A variation starting with `?` or `??` is treated as a trap line: if the
  user plays that move, they receive the variation's comment as feedback
  explaining why it fails.

**Example:** The game continued 24. Nf3? — a mistake. Add a variation
`(24. Nd5! with the comment "Centralises the knight and controls e7")`.
The training engine will expect Nd5, reward players who find it with
"Better!" feedback, and show the comment as explanation.

#### Engine evaluations

If you annotate a game using the engine, the resulting `[%eval]` values are
used as a quantitative fallback when a move has no symbol or variation.
Moves within 0.3 pawns of the position evaluation are accepted; moves 0.3–0.8
pawns worse are treated as dubious; moves more than 0.8 pawns worse are
rejected. These thresholds can be adjusted in Training Settings.

#### The `[%train]` tag (advanced)

For precise control, embed a `[%train]` tag in the comment *before* a move.
This overrides all other rules for that ply.

```
{[%train accept="g1f3,d1h5" reject="g1h3" hint="Activate the knight"]}
24. Nf3
```

Fields:

| Field | Meaning |
|---|---|
| `accept` | Comma-separated UCI moves that count as correct. The game move is included unless listed in `reject`. |
| `reject` | UCI moves that receive a specific trap warning (sourced from the matching variation comment). |
| `hint` | Text shown to the user when they request a hint. |

Use `[%train]` when the NAG/variation inference is insufficient or you need to
accept a set of moves that cannot be expressed as variations.
```

---

## Implementation phases

These phases are appended to the existing T1–T16 phase list in
`training_mode_c9d0e1f2.plan.md`.

| Phase | Deliverable | Dependencies |
|---|---|---|
| T17 | `train_tag_parser.ts` + `train_tag_parser.test.ts` | None |
| T18 | `move_acceptance.ts` — Steps 1–4 (NAG + RAV logic), no eval | PGN model RAV access |
| T19 | `move_acceptance.test.ts` — full coverage of Steps 1–4 | T17, T18 |
| T20 | Wire `move_acceptance` into `replay_protocol.ts`; extend `MoveEvalResult` and `PlyOutcome` | T18, T19 |
| T21 | `inferiorMovePolicy` option in `ReplayProtocolOptions`; update `TrainingLauncher` dialog | T20 |
| T22 | `[%eval]` fallback — Step 5; eval threshold options | T20, engines plan |
| T23 | Updated scoring weights in `summarize`; `correct_better` highlight | T20 |
| T24 | `MoveOutcomeHint` UI: distinct styling per feedback category; `betterMoveExists` note | T20 |
| T25 | User manual updates — "During training" + "Annotating games for training" | T20 |

---

## Open questions

1. **Unannotated RAV depth**: should the algorithm look only at the first move
   of each RAV, or recurse into multi-move variations to check if the user's
   full continuation matches? First-move-only is simpler and covers 95% of cases.

2. **`[%eval]` sign convention**: `[%eval]` is always from White's perspective.
   The algorithm must flip the comparison sign when it is Black's turn.

3. **Promotion moves**: UCI promotion suffix (e.g. `e7e8q`) must be normalized
   before comparison. Confirm the existing `normalizeUci` helper covers all
   cases including under-promotion.

4. **Multiple `[%eval]` in one comment**: engine annotation sometimes writes
   several `[%eval]` tags. Define which one wins (last? highest-depth?).

5. **`correct_dubious` scoring**: currently weighted 1.0. Consider reducing to
   0.9 when `GAME_MOVE_DUBIOUS` — the user played a move their annotator had
   doubts about. Requires UX discussion.
