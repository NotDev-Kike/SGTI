CREATE TABLE IF NOT EXISTS microsoft_login_states (
  state VARCHAR(120) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS microsoft_login_codes (
  code VARCHAR(120) PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_microsoft_login_codes_expires_at ON microsoft_login_codes(expires_at);
