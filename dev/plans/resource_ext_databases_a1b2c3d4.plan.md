# External Databases Plan

**File:** `resource_ext_databases_a1b2c3d4.plan.md`
**Status:** Draft — awaiting design review.

---

## Goal

Integrate external game, opening, and endgame databases as a first-class
capability layer on top of the canonical resource system. Users can query
external sources from within the app, import games into local resources, and
enrich position analysis with opening statistics and endgame probe results.

The system is **user-configurable**: each source type defines an adapter
interface; users register concrete sources in their configuration, and the app
instantiates adapters at startup. Unknown adapter types are skipped with a
warning.

---

## Scope overview

| Category | What it provides | Access model |
|---|---|---|
| Game databases | Search millions of games by player/event/position; import to local DB | REST API (per provider) |
| Opening databases | Move statistics for a given position; top games; engine evaluations | REST API (per provider) |
| Endgame tablebases | Probe exact WDL + DTM for positions with ≤ N pieces | Local binary or REST API |

---

## Module layout

```
resource-ext/
├── domain/
│   ├── game_db.ts          # GameDatabaseAdapter contract
│   ├── opening_db.ts       # OpeningDatabaseAdapter + OpeningResult types
│   ├── endgame_tb.ts       # EndgameTbAdapter + TbProbeResult types
│   └── ext_config.ts       # ExtSourceConfig (user-configurable registry)
├── adapters/
│   ├── game/
│   │   ├── lichess_games.ts       # Lichess.org games export API (free)
│   │   ├── chessdotcom_games.ts   # Chess.com published games API (free)
│   │   └── pgn_import.ts         # Local PGN file import (offline)
│   ├── opening/
│   │   ├── lichess_opening.ts    # Lichess opening explorer (free, recommended first)
│   │   └── chessdotcom_opening.ts # Chess.com opening explorer
│   └── endgame/
│       ├── lichess_tb.ts         # Lichess tablebase API, up to 7-piece (free)
│       └── syzygy_local.ts       # Local Syzygy probe via engine sidecar
├── client/
│   ├── game_db_client.ts         # Fan-out search across registered game DBs
│   ├── opening_client.ts         # Priority-ordered opening query with caching
│   └── endgame_client.ts         # Tablebase client with piece-count routing
└── index.ts                       # Public API surface
```

---

## Domain contracts

### Game database adapter

```typescript
interface GameDatabaseAdapter {
  readonly id: string;           // stable identifier, e.g. "lichess"
  readonly label: string;        // display name, e.g. "Lichess.org"
  readonly supportsPositionSearch: boolean;

  search(query: GameSearchQuery): Promise<GameSearchResult>;
  loadGame(ref: ExtGameRef): Promise<string>;  // returns PGN text
}

type GameSearchQuery = {
  player?: { name: string; color?: "white" | "black" | "any" };
  position?: string;             // FEN — for position search
  event?: string;
  dateFrom?: string;             // ISO date "YYYY-MM-DD"
  dateTo?: string;
  ratingMin?: number;
  ratingMax?: number;
  maxResults?: number;           // default 20, max per-adapter
  pageToken?: string;            // pagination cursor
};

type ExtGameRef = {
  adapterId: string;
  gameId: string;                // adapter-specific game identifier
};

type GameSearchResult = {
  entries: ExtGameEntry[];
  totalCount?: number;           // estimate when available
  nextPageToken?: string;
};

type ExtGameEntry = {
  ref: ExtGameRef;
  white: string;
  black: string;
  result: string;
  event?: string;
  date?: string;
  whiteElo?: number;
  blackElo?: number;
};
```

### Opening database adapter

```typescript
interface OpeningDatabaseAdapter {
  readonly id: string;
  readonly label: string;

  queryPosition(fen: string, options?: OpeningQueryOptions): Promise<OpeningResult>;
}

type OpeningQueryOptions = {
  speeds?: string[];             // e.g. ["blitz", "rapid", "classical"]
  ratingRange?: [number, number];
  since?: string;                // ISO month "YYYY-MM"
  until?: string;
  moves?: number;                // max moves to return (default 12)
};

type OpeningMoveStats = {
  san: string;                   // "e4"
  uci: string;                   // "e2e4"
  games: number;
  white: number;                 // white win count
  draws: number;
  black: number;
  averageRating?: number;
  performance?: number;          // average performance rating
};

type OpeningResult = {
  moves: OpeningMoveStats[];
  topGames?: ExtGameEntry[];     // notable games from this position
  openingName?: string;          // ECO name if known
  openingEco?: string;           // ECO code
};
```

### Endgame tablebase adapter

```typescript
interface EndgameTbAdapter {
  readonly id: string;
  readonly label: string;
  readonly maxPieces: number;    // 5, 6, or 7

  probe(fen: string): Promise<TbProbeResult>;
  isAvailable(): Promise<boolean>;
}

type TbWdl = "win" | "cursed_win" | "draw" | "blessed_loss" | "loss";

type TbProbeResult = {
  wdl: TbWdl;
  dtz?: number;                  // Distance to zeroing move
  dtm?: number;                  // Distance to mate (Gaviota only)
  moves: TbMoveEntry[];
  insufficientMaterial?: boolean;
};

type TbMoveEntry = {
  uci: string;
  san: string;
  wdl: TbWdl;
  dtz?: number;
  dtm?: number;
  zeroing: boolean;              // is this a capture or pawn move?
  checkmate?: boolean;
  stalemate?: boolean;
};
```

### User configuration

```typescript
type ExtSourceConfig = {
  gameDatabases: GameDbSourceConfig[];
  openingDatabases: OpeningDbSourceConfig[];
  endgameTablebases: TbSourceConfig[];
};

type GameDbSourceConfig =
  | { type: "lichess"; maxResults?: number }
  | { type: "chessdotcom"; username?: string }
  | { type: "custom"; url: string; apiKey?: string; label: string };

type OpeningDbSourceConfig =
  | { type: "lichess"; defaultSpeed?: string[]; defaultRatingRange?: [number, number] }
  | { type: "chessdotcom" }
  | { type: "custom"; url: string; label: string };

type TbSourceConfig =
  | { type: "lichess" }
  | { type: "syzygy_local"; enginePath: string; tbPath: string }
  | { type: "custom"; url: string; label: string };
```

---

## Concrete adapters to implement first

### Phase E1 — Lichess opening explorer (highest value, fully free)

Lichess provides a well-documented REST API at `https://explorer.lichess.ovh/`:
- `GET /lichess?fen=...&speeds=...&ratings=...` for master/club games
- `GET /masters?fen=...` for over-the-board master games
- No API key required; rate-limited to ~5 req/s

Implementation: `resource-ext/adapters/opening/lichess_opening.ts`

This is the **first concrete adapter to build** — it has no auth requirement,
returns immediate value, and exercises the full `OpeningDatabaseAdapter` contract.

### Phase E2 — Lichess tablebase API (7-piece, free)

`https://tablebase.lichess.ovh/standard?fen=...`

Returns WDL, DTZ, and per-move breakdown. No auth required. Piece-count check
before querying (reject positions with > 7 pieces). This powers an "endgame
probe" panel in the board view.

### Phase E3 — Lichess game search

`https://lichess.org/api/games/user/{username}` (stream NDJSON).

Most useful for "load my recent games from Lichess." Requires optional
OAuth token for private games. First implementation: public games only.

### Phase E4 — Chess.com games

`https://api.chess.com/pub/player/{username}/games/{YYYY}/{MM}`.
Public, no auth. Slightly different structure (PGN embedded in JSON).

### Phase E5 — Local Syzygy (optional, deferred)

Requires a locally installed Syzygy tablebase path and a probe binary or
engine integration. Defer until engine integration (see engines plan) is in
place, since the engine can probe Syzygy natively.

---

## UI integration points

| Location | Integration |
|---|---|
| Board view — position panel | Opening statistics for current position |
| Board view — endgame panel | Tablebase probe for current position (when ≤ 7 pieces) |
| Resource viewer — search bar | Cross-database game search |
| Import dialog | Import selected external games into local `.x2chess` DB |

The opening explorer panel and tablebase panel are rendered below the board
when available. They update as the user navigates moves (debounced 200ms).

---

## Caching strategy

- Opening queries: `Map<fen+options, OpeningResult>` in-memory per session;
  no persistence (data changes over time).
- Tablebase probes: `Map<fen, TbProbeResult>` in-memory per session; probes
  are deterministic so results can be persisted to `localStorage` long-term.
- Game searches: no caching (user-initiated, results change).

---

## Open questions

1. **Auth flow for Chess.com / Lichess OAuth**: should tokens be stored in
   the OS keychain via Tauri's secure store, or in a local config file?
2. **Rate limiting**: should the client expose a global rate-limiter, or
   trust each adapter to handle its own limits?
3. **Offline mode**: should adapters degrade gracefully (return empty) or
   surface a clear "unavailable" state in the UI?
4. **YottaBase / OpeningMaster**: these don't appear to have public APIs;
   may require scraping or bulk PGN download. Defer until an official API exists.

---

## Implementation phases

| Phase | Deliverable | Dependencies |
|---|---|---|
| E1 | `opening_db.ts` contract + `lichess_opening.ts` adapter | None |
| E2 | `endgame_tb.ts` contract + `lichess_tb.ts` adapter | None |
| E3 | `ext_config.ts` + `opening_client.ts` + opening panel UI | E1 |
| E4 | Endgame panel UI + tablebase client | E2 |
| E5 | `game_db.ts` contract + `lichess_games.ts` adapter | None |
| E6 | Game search UI + import to local DB | E5 + resource plan |
| E7 | Chess.com opening + games adapters | E1, E5 |
| E8 | Local Syzygy adapter | Engines plan |
