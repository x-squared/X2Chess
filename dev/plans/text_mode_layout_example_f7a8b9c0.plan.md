# Text-Mode Layout Example

**File:** `text_mode_layout_example_f7a8b9c0.plan.md`
**Status:** Design reference.

---

## Goal

Demonstrate how a well-annotated game should be formatted in text mode, using
the `[[br]]` and `[[indent]]` marker system. The source game is
**Bluebaum, Matthias vs Indjic, Aleksandar** (Bundesliga 2025/26, Round 11,
E90 King's Indian). It is 30 moves long, has an intro comment, multiple
inline comments, and six nested variations.

---

## Rendering rules recap

| Marker | Effect in text mode |
|---|---|
| `[[br]]` | Inserts a block break (new line) in the rendered output |
| `[[indent]]` at start of a comment | Wraps the following variation in an indented block |
| First comment before first move | Rendered as an italic "intro" paragraph above the move flow |

Text mode renders moves as a continuous flow of tokens within blocks. Each
`[[br]]` in a comment splits the block. `[[indent]]` before a RAV indents
the entire alternate line as a sub-block.

---

## Design principles for layout

1. **Intro comment**: the opening remark about the game goes before the first
   move as an intro. It is separated from the move flow by a block break.
   Keep it concise — it is the "subtitle" of the game.

2. **Inline comments after moves**: short evaluation notes (≤ 2 sentences)
   stay inline. They follow the move token without a block break.

3. **Variations**: each RAV should be introduced with `[[indent]]` on the
   comment that precedes it, so it renders as an indented sub-block. For
   variations without a leading comment, a terse label (e.g. `[[indent]]` on
   a short note) still wraps them for visual separation.

4. **Break usage**: use `[[br]]` to separate conceptually distinct paragraphs
   within a long comment. Do not break after every sentence.

5. **Result**: the game result token (`1-0`, `0-1`, `½-½`) appears at the
   end of the move flow, separated by a space.

---

## Formatted PGN source

Below is the PGN for Game-3 reformatted with layout markers. Markers shown
inside `{ }` are PGN comments. This is the recommended source format for
well-laid-out games in text mode.

```pgn
[Event "Bundesliga 2025/26"]
[Site "Deggendorf GER"]
[Date "2026.01.10"]
[Round "11.1"]
[White "Bluebaum, Matthias"]
[Black "Indjic, Aleksandar"]
[Result "1-0"]
[WhiteElo "2679"]
[BlackElo "2635"]
[EventDate "2025.09.27"]
[ECO "E90"]
[PlyCount "60"]
[Board "1"]

{White outplays Black in a King's Indian where Black's unusual 5...Bg4
costs him time and activity. A patient pawn advance on the queenside
gradually suffocates the position.}

1.d4 d6 2.Nf3 Nf6 3.c4 g6 4.Nc3 Bg7 5.e4 Bg4

{Unusual — O-O is expected. The idea becomes clear in the main variation
after 6.Be2, but Black loses time.}

( {[[indent]] If White plays routinely:}
  6.Be2 Bxf3 7.Bxf3 e5 8.d5 h5 9.h4 Bh6
  {and Black aims for a positional Q-side game.} )

6.Be3 Nbd7 7.Be2 Bxf3

{The bishop must take now — it would be trapped otherwise.}

8.Bxf3 e5 9.dxe5 Nxe5

( {[[indent]] The recapture with the d-pawn is worse:}
  9...dxe5 10.Qb3 Qc8 11.g4 h5 12.g5 Nh7 13.O-O-O
  {and Black is cramped.} )

10.Be2 Ned7

{Preempting f4. Black's pieces lack coordination.}

11.f4 O-O 12.Bf3 Re8

{White has the e5 advance in reserve. The unprotected Be3 is a factor
Black should watch.}

13.O-O h5

{To exchange dark bishops and plant the knight on g4.}

14.h3 Bf8

{Second thoughts? This covers d6, hoping for c6-Qc7 to connect the rooks.
Black is already cramped and struggling to break out.}

( {[[indent]] An alternative try:}
  14...Qe7
  {and if White plays as in the game:}
  15.Qb3 Nxe4 16.Nxe4 f5 17.c5+ Kh8 18.cxd6 cxd6 19.Rad1 fxe4 20.Be2
  {Black is fighting but certainly not better.} )

15.Qb3 b6

{This locks in the queenside knight and weakens the white squares,
especially c6 — an invitation for the White bishop.
Black's position becomes progressively immobile.}

16.Qa4

( {[[indent]] A kingside alternative:}
  16.Qc2 Rc8 17.g4 hxg4 18.hxg4 c6 19.g5 Nh7 20.Rad1 Qe7 21.Rd2 Bg7
  {and White can press on the d-file or swing to the K-side with Rh2.} )

( {[[indent]] The tempting central thrust:}
  16.e5 Rb8
  {and the e5 pawn is pinned — it doesn't work yet.} )

16...Rb8 17.Rad1

( {[[indent]] Trying to win a pawn immediately:}
  17.Qxa7 Nc5
  {threatens to catch the queen. White should be much better in the
  ending after a pawn, but sidelining the queen feels premature.[[br]]
  Example line:}
  18.Bxc5 bxc5 19.Rad1 Qc8 20.Nb5 Bh6 21.Qxc7 Qxc7 22.Nxc7 Re7 23.Nb5 Bxf4
  )

17...Bh6 18.Rfe1 Nc5 19.Qc2

{White prefers a slow approach.}

( {[[indent]] A more forcing try:}
  19.Bxc5 bxc5 20.e5 Nh7 21.Bc6 Re6 22.Bd5 Re8 23.Qc2
  {threatening Qxg — this looks good too.} )

19...Qe7 20.b4 Ne6

( {[[indent]] The apparent counter:}
  20...Ncxe4
  {leads to:}
  21.Nxe4 Nxe4 22.Bc1
  {pin and win for White.} )

21.Qc1

{The slow approach again — but Black might try c5 to block the expansion.}

21...Nd7

( {[[indent]] Black could try:}
  21...c5 22.bxc5 bxc5

  ( {[[indent]] Not:}
    23.f5 Bxe3+ 24.Qxe3 Nd4
    {and the advantage has evaporated.} )

  ( {[[indent]] Nor:}
    23.e5 dxe5 24.fxe5 Bxe3+ 25.Rxe3 Nd4
    {and Black has freed himself.} )
  )

22.e5 dxe5 23.Bc6 Red8 24.Nd5

{Eyeing f6, threatening a fork.}

24...Qf8 25.Bxd7 exf4 26.Bf2 f3 27.Qa3 Bg7 28.Bxe6 fxe6 29.Rxe6 Qf7
30.Rde1

{A devastating battery. For example:}

( {[[indent]] A sample line after Rde1:}
  30...c6 31.Ne7+ Kh7 32.Nxc6 Re8 33.Qxf3 Qxf3 34.gxf3 Rxe6 35.Rxe6
  )

1-0
```

---

## Rendered text-mode layout (visual sketch)

The sketch below shows the intended visual output. Indented blocks appear
with a visible left border or padding. Move numbers are styled distinctly
from move tokens. Comments are rendered in a lighter or italic weight.

```
Bluebaum, Matthias  —  Indjic, Aleksandar
Bundesliga 2025/26 · Deggendorf · 2026-01-10 · E90

──────────────────────────────────────────────────────────────────
White outplays Black in a King's Indian where Black's unusual 5…Bg4
costs him time and activity. A patient pawn advance on the queenside
gradually suffocates the position.
──────────────────────────────────────────────────────────────────

1 d4  d6  2 Nf3  Nf6  3 c4  g6  4 Nc3  Bg7  5 e4  Bg4

  Unusual — O-O is expected. The idea becomes clear in the main
  variation after 6.Be2, but Black loses time.

  │  If White plays routinely:
  │  6 Be2  Bxf3  7 Bxf3  e5  8 d5  h5  9 h4  Bh6
  │  and Black aims for a positional Q-side game.

6 Be3  Nbd7  7 Be2  Bxf3

  The bishop must take now — it would be trapped otherwise.

8 Bxf3  e5  9 dxe5  Nxe5

  │  The recapture with the d-pawn is worse:
  │  9…dxe5  10 Qb3  Qc8  11 g4  h5  12 g5  Nh7  13 O-O-O
  │  and Black is cramped.

10 Be2  Ned7

  Preempting f4. Black's pieces lack coordination.

11 f4  O-O  12 Bf3  Re8

  White has the e5 advance in reserve. The unprotected Be3 is a
  factor Black should watch.

13 O-O  h5

  To exchange dark bishops and plant the knight on g4.

14 h3  Bf8

  Second thoughts? This covers d6, hoping for c6-Qc7 to connect
  the rooks. Black is already cramped and struggling to break out.

  │  An alternative try:
  │  14…Qe7  and if White plays as in the game:
  │  15 Qb3  Nxe4  16 Nxe4  f5  17 c5+  Kh8  18 cxd6  cxd6
  │  19 Rad1  fxe4  20 Be2
  │  Black is fighting but certainly not better.

15 Qb3  b6

  This locks in the queenside knight and weakens the white squares,
  especially c6 — an invitation for the White bishop. Black's
  position becomes progressively immobile.

16 Qa4

  │  A kingside alternative:
  │  16 Qc2  Rc8  17 g4  hxg4  18 hxg4  c6  19 g5  Nh7
  │  20 Rad1  Qe7  21 Rd2  Bg7
  │  and White can press on the d-file or swing to the K-side.

  │  The tempting central thrust:
  │  16 e5  Rb8  — and e5 is pinned. It doesn't work yet.

16…Rb8  17 Rad1

  │  Trying to win a pawn immediately:
  │  17 Qxa7  Nc5  — threatens to catch the queen.
  │  Example line:
  │  18 Bxc5  bxc5  19 Rad1  Qc8  20 Nb5  Bh6  21 Qxc7  Qxc7
  │  22 Nxc7  Re7  23 Nb5  Bxf4

17…Bh6  18 Rfe1  Nc5  19 Qc2

  White prefers a slow approach.

  │  A more forcing try:
  │  19 Bxc5  bxc5  20 e5  Nh7  21 Bc6  Re6  22 Bd5  Re8  23 Qc2
  │  threatening Qxg — this looks good too.

19…Qe7  20 b4  Ne6

  │  The apparent counter: 20…Ncxe4  leads to:
  │  21 Nxe4  Nxe4  22 Bc1  — pin and win for White.

21 Qc1

  The slow approach again — but Black might try c5.

21…Nd7

  │  Black could try:
  │  21…c5  22 bxc5  bxc5
  │
  │    │  Not: 23 f5  Bxe3+  24 Qxe3  Nd4 — advantage evaporated.
  │
  │    │  Nor: 23 e5  dxe5  24 fxe5  Bxe3+  25 Rxe3  Nd4
  │         — and Black has freed himself.

22 e5  dxe5  23 Bc6  Red8  24 Nd5

  Eyeing f6, threatening a fork.

24…Qf8  25 Bxd7  exf4  26 Bf2  f3  27 Qa3  Bg7  28 Bxe6  fxe6
29 Rxe6  Qf7  30 Rde1

  A devastating battery. For example:

  │  30…c6  31 Ne7+  Kh7  32 Nxc6  Re8  33 Qxf3  Qxf3
  │  34 gxf3  Rxe6  35 Rxe6

1-0
```

---

## Observations and layout rules derived

1. **Two-column move pairs** (white + black on the same line) are only
   practical in tree mode. In text mode, the continuous token flow is the
   natural format — numbers and moves flow left to right like prose.

2. **Variation depth**: double indentation (variation within a variation) is
   supported by the `[[indent]]` system. The visual sketch uses `│` as the
   left border indicator; the actual rendering uses CSS `border-left` or
   `padding-left`.

3. **Long comments**: wrap naturally within the block width. No manual line
   breaks needed unless two distinct ideas need separation (`[[br]]`).

4. **Variation-preceding comments**: the comment that introduces a RAV should
   be placed immediately before the RAV in the PGN source, with `[[indent]]`
   as the first word. This is what drives the block indentation.

5. **Move numbers in variations**: chess convention requires a move number
   restart after a variation comment if the side to move changes. The text
   editor handles this automatically.

6. **Intro paragraph width**: limit intro text to 2–4 sentences. Longer
   introductions belong in a separate metadata field ("Description") rather
   than the PGN pre-comment.
