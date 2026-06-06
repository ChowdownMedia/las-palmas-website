-- Las Palmas site D1 schema (feedback portal + chat CRM)
-- Apply: wrangler d1 execute las-palmas-site --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS feedback_records (
  id TEXT PRIMARY KEY,
  location TEXT NOT NULL,
  overall_rating INTEGER NOT NULL DEFAULT 0,
  ratings TEXT NOT NULL DEFAULT '[]',          -- JSON [{label, value}]
  comments TEXT NOT NULL DEFAULT '',
  server_name TEXT NOT NULL DEFAULT '',
  guest_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  permission_public INTEGER NOT NULL DEFAULT 0,
  responses TEXT NOT NULL DEFAULT '{}',        -- JSON raw section answers
  followups TEXT NOT NULL DEFAULT '[]',        -- JSON [{text, ts}] AI follow-up replies
  concern INTEGER NOT NULL DEFAULT 0,          -- set by the model (v3 contract)
  submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_location ON feedback_records (location);
CREATE INDEX IF NOT EXISTS idx_feedback_submitted ON feedback_records (submitted_at);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  last_at TEXT NOT NULL,
  flagged INTEGER NOT NULL DEFAULT 0,
  flag_reason TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0              -- admin Chat CRM read-state
);
CREATE INDEX IF NOT EXISTS idx_chat_threads_last ON chat_threads (last_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id),
  role TEXT NOT NULL,                          -- 'user' | 'assistant' | 'feedback'
  text TEXT NOT NULL,
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages (thread_id);

-- Admin back-office sessions (token issued by /api/admin/login)
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_exp ON admin_sessions (expires_at);
