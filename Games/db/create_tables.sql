CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    total_score INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS whist (
    id TEXT PRIMARY KEY,
    snapshot TEXT NOT NULL,
    final_ranking TEXT,
    participants TEXT,
    scores TEXT,
    created_at INTEGER
);