CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  locator TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  title TEXT NOT NULL,
  pgn_text TEXT NOT NULL,
  revision_token TEXT NOT NULL,
  FOREIGN KEY(resource_id) REFERENCES resources(id)
);
