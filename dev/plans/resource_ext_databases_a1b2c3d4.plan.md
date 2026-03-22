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

Configuration lives in `config/ext-sources.json` in the app data directory.
The structure is versioned and user-editable; the app provides a settings UI
to manage it.

```typescript
type ExtSourceConfig = {
  gameDatabases: GameDbSourceConfig[];
  openingDatabases: OpeningDbSourceConfig[];
  endgameTablebases: TbSourceConfig[];
};

type GameDbSourceConfig =
  | { type: "lichess"; maxResults?: number }
  | { type: "chessdotcom"; username?: string }
  | { type: "x2chess_backend"; url: string; apiKey?: string; label: string }
  | { type: "custom"; url: string; apiKey?: string; label: string };

type OpeningDbSourceConfig =
  | { type: "lichess"; defaultSpeeds?: string[]; defaultRatingRange?: [number, number] }
  | { type: "chessdotcom" }
  | { type: "x2chess_backend"; url: string; label: string }
  | { type: "custom"; url: string; label: string };

type TbSourceConfig =
  | { type: "lichess" }
  | { type: "x2chess_backend"; url: string; label: string }
  | { type: "syzygy_local"; enginePath: string; tbPath: string }
  | { type: "custom"; url: string; label: string };
```

**Configuration is additive**: users can have multiple providers of each type
active simultaneously. The client fans out to all enabled providers and merges
results (for game search) or uses the first available (for opening/endgame).

---

## Own backend support

An X2Chess backend service can proxy all three external source types. This is
useful when:
- A commercial API requires a server-side API key (not safe to embed in client)
- Rate-limit pooling across many users is needed
- A large tablebase (Syzygy 7-piece, ~149GB) is hosted once for all users
- YottaBase / LumbrasGigaBase or other commercial DBs are licensed server-side

The `x2chess_backend` adapter type targets an X2Chess-hosted REST API that
mirrors the same interfaces as the individual third-party adapters:

```
GET /api/ext/opening?fen=...&speeds=...      → OpeningResult
GET /api/ext/tablebase?fen=...               → TbProbeResult
POST /api/ext/games/search                   → GameSearchResult
GET  /api/ext/games/{id}                     → PGN text
```

This means the frontend adapter layer is identical for hosted and self-service
sources — only the base URL differs. Backend implementation is out of scope
for the initial release but the `x2chess_backend` adapter type reserves the
integration point in the config schema.

---

## Concrete adapters to implement first

### Phase E1 — Lichess opening explorer (highest value, fully free)

Lichess provides a well-documented REST API:
- `GET /lichess?fen=...&speeds=...&ratings=...` for master/club games
- `GET /masters?fen=...` for over-the-board master games
- No API key required; rate-limited to ~5 req/s

Implementation: `resource-ext/adapters/opening/lichess_opening.ts`

**First adapter to build** — no auth, exercises the full `OpeningDatabaseAdapter`
contract, immediately useful.

### Phase E2 — Lichess tablebase API (7-piece, free)

`GET /standard?fen=...` at tablebase.lichess.ovh.

Returns WDL, DTZ, and per-move breakdown. No auth required. Piece-count check
before querying (reject positions with > 7 pieces). Powers the endgame probe
panel.

The adapter is written against the generic `EndgameTbAdapter` contract so that
an `x2chess_backend` or `custom` tablebase can be hot-swapped with zero
frontend changes.

### Phase E3 — Lichess game search

`GET /api/games/user/{username}` (streams NDJSON).

First implementation: public games only. OAuth token optional for private
games; stored in OS keychain via Tauri's secure store.

### Phase E4 — Chess.com games

`GET /pub/player/{username}/games/{YYYY}/{MM}`.
Public, no auth. PGN embedded in response JSON.

### Phase E5 — Local Syzygy (deferred)

Requires engine integration (see engines plan) — the engine can probe Syzygy
natively via UCI `setoption name SyzygyPath`. Defer to engine phase.

---

## UI integration points

| Location | Integration |
|---|---|
| Board view — position panel | Opening statistics for current position |
| Board view — endgame panel | Tablebase probe for current position (when ≤ 7 pieces) |
| Resource viewer — search bar | Cross-database game search |
| Import dialog | Import selected external games into local `.x2chess` DB |
| Settings dialog | Configure active providers per category |

Opening explorer and tablebase panels render below the board when enabled.
They update as the user navigates moves (debounced 200ms).

---

## Caching strategy

- Opening queries: `Map<fen+options, OpeningResult>` in-memory per session;
  no persistence (data changes as games are played).
- Tablebase probes: `Map<fen, TbProbeResult>` in-memory per session; probes
  are deterministic so results may also be persisted to `localStorage`.
- Game searches: no caching (user-initiated; results change).

---

## Open questions

1. **Auth flow**: Lichess/Chess.com OAuth tokens — OS keychain (Tauri secure
   store) or local config file?
2. **Rate limiting**: global rate-limiter in the client, or per-adapter?
3. **Offline mode**: adapters degrade gracefully (return empty + show
   "unavailable" badge) vs blocking the panel entirely.
4. **YottaBase / LumbrasGigaBase / OpeningMaster**: no public REST APIs found;
   access requires bulk PGN download or commercial agreements. Candidate for
   own-backend proxy when/if licensed.
5. **Backend hosting**: if a shared X2Chess backend is deployed, should the app
   default to it, or require explicit opt-in?

---

## Implementation phases

| Phase | Deliverable | Dependencies |
|---|---|---|
| E1 | `opening_db.ts` contract + `lichess_opening.ts` adapter | None |
| E2 | `endgame_tb.ts` contract + `lichess_tb.ts` adapter | None |
| E3 | `ext_config.ts` + `opening_client.ts` + opening panel UI | E1 |
| E4 | Endgame panel UI + `endgame_client.ts` | E2 |
| E5 | `game_db.ts` contract + `lichess_games.ts` adapter | None |
| E6 | Game search UI + import to local DB | E5 + resource plan |
| E7 | Chess.com opening + games adapters | E1, E5 |
| E8 | `x2chess_backend` adapter (all three categories) | E1, E2, E5 |
| E9 | Settings UI for provider configuration | E3, E4, E6 |
| E10 | Local Syzygy adapter | Engines plan |
