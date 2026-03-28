## 49. Technology Stack

### 49.1 Backend — Python

```
FastAPI (async)
  ├── Granian (ASGI server — higher throughput than Uvicorn for sustained load)
  ├── asyncpg (direct PostgreSQL driver — bypasses ORM for hot paths)
  ├── Pydantic v2 (Rust-core validation — fast enough for request-path use)
  ├── Redis (caching, pub/sub, session state)
  └── ARQ / Celery (background tasks — report generation, notifications, projections)
```

### 49.2 Frontend — TypeScript / React

```
React 19
  ├── TanStack Query (server state, cache, background refetch)
  ├── TanStack Router (type-safe, code-split routing)
  ├── TanStack Virtual (virtualised lists — large ward/result grids)
  ├── Zustand (local UI state — lightweight)
  └── Vite (build, code splitting by domain)
```

### 49.3 Database

```
PostgreSQL (primary)
  ├── Clinical compositions    — JSONB document store
  ├── Projection tables        — materialised, typed, fast reads
  ├── Resource / scheduling    — relational with gist exclusion constraints
  ├── Billing                  — relational
  └── Audit log                — append-only, partitioned by month

ClickHouse or DuckDB (analytical)
  — Fed by event stream from PostgreSQL
  — Population health, reporting, billing analytics
  — Never queried by operational code paths

Redis
  — Session state
  — Hot projections (latest vitals per patient)
  — Pub/sub for real-time ward updates
```

### 49.4 Performance-Critical Decisions

- **asyncpg directly** for high-frequency reads — SQLAlchemy ORM adds measurable overhead at scale
- **Archetype schemas cached in memory** at startup — never re-parsed per request
- **Projection tables always current** — updated by PostgreSQL `LISTEN/NOTIFY` event stream asynchronously; operational reads never hit raw compositions
- **Code splitting by domain** — a ward nurse never loads the pharmacy or billing bundle
- **WASM for client-side computation** — drug interaction checking, early warning scores, scheduling conflict detection run in-browser (Rust → WASM), reducing server round-trips and enabling offline use
- **Optimistic UI** for high-frequency actions — observations, medication administration records update immediately; reconciled in background
- **Offline-first for ward devices** — Service Worker + IndexedDB; sync on reconnect

---

