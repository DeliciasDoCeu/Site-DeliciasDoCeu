CREATE TABLE IF NOT EXISTS catalog (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  items TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleting INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS passkeys (
  id TEXT PRIMARY KEY, public_key TEXT NOT NULL, counter INTEGER NOT NULL,
  transports TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_challenges (
  token_hash TEXT PRIMARY KEY, challenge TEXT NOT NULL, kind TEXT NOT NULL,
  invite_hash TEXT NOT NULL DEFAULT '', expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_challenges_expiry ON auth_challenges(expires_at);
CREATE TABLE IF NOT EXISTS auth_invites (
  token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_limits (
  id TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_limits_expiry ON auth_limits(expires_at);
