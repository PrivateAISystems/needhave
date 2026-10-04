-- Two row kinds only. Apply this file to the one D1 database.
-- This repo does not hold rows.

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('need', 'have')),
  note TEXT NOT NULL,
  secret_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX posts_note ON posts(note);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  text TEXT,
  secret_hash TEXT,
  thread_key TEXT,
  thread_key_hash TEXT,
  parent_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('first', 'accept', 'later')),
  created_at INTEGER NOT NULL
);

CREATE INDEX messages_post ON messages(post_id);
CREATE INDEX messages_thread ON messages(thread_key_hash);
CREATE UNIQUE INDEX messages_one_accept_per_first
  ON messages(parent_id)
  WHERE role = 'accept';
