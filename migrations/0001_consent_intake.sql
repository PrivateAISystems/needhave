-- Migration number: 0001	2026-10-08
-- Consent-based intake. Apply to the existing D1. Do not put rows here.

ALTER TABLE posts ADD COLUMN source TEXT NOT NULL DEFAULT 'self';
ALTER TABLE posts ADD COLUMN note_hash TEXT;
CREATE UNIQUE INDEX posts_note_hash ON posts(note_hash);

CREATE TABLE tips (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  author_handle TEXT NOT NULL,
  proposed_note TEXT NOT NULL,
  note_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX tips_token_hash ON tips(token_hash);

CREATE TABLE tip_confirms (
  id TEXT PRIMARY KEY,
  tip_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX tip_confirms_tip ON tip_confirms(tip_id);

CREATE TABLE write_events (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX write_events_bucket ON write_events(bucket, created_at);
