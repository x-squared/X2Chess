CREATE TABLE IF NOT EXISTS game_metadata (
  game_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (game_id, key),
  FOREIGN KEY(game_id) REFERENCES games(id)
);
