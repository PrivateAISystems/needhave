-- Migration number: 0006	2026-10-19
-- Public replies. Insert-only. No deletes. No updates of existing reply text.
-- visible defaults to hidden. Only a new write_first_reply sets visible to 1.
-- A missing or NULL flag stays hidden at read time. A clock cutoff is not used.
-- Pre-deploy replies and thread messages stay private.

ALTER TABLE messages ADD COLUMN visible INTEGER NOT NULL DEFAULT 0;

-- Same shape as hidden_posts: insert-only takedown of one reply. No deletes.
CREATE TABLE hidden_replies (
  message_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  hidden_at INTEGER NOT NULL
);
