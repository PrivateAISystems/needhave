-- Migration number: 0002	2026-10-08
-- Hide junk copies insert-only. Apply to the existing D1. No deletes.

CREATE TABLE hidden_posts (
  post_id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  hidden_at INTEGER NOT NULL
);

CREATE TABLE copier_repo_copies (
  source_url TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  copied_at INTEGER NOT NULL
);

CREATE INDEX copier_repo_copies_repo_at ON copier_repo_copies(repo, copied_at);

-- Live needhave.io copies from GET /posts on 2026-10-08. Hidden_at is 16:00 UTC.
INSERT INTO hidden_posts (post_id, reason, hidden_at) VALUES
  ('1409933e8afb2acfca8aefc8b7929104', 'hn_comment_junk', 1791475200000),
  ('0a6c95fce4302d8be7e20649aca0a662', 'hn_comment_junk', 1791475200000),
  ('e46e3201306590da51457ee90b83a2a3', 'vague_title', 1791475200000),
  ('0dc477dccbce2315feb6c5a1f738a43f', 'joke_title', 1791475200000),
  ('bb08fc2c352649f6fed0dc6316c592bd', 'github_bulk_tasks', 1791475200000),
  ('a389d21313a31adf2f43d64090bffce1', 'github_bulk_tasks', 1791475200000),
  ('673292d28c7b4c08e01d625d278d4c04', 'github_bulk_tasks', 1791475200000),
  ('42dea747ebc1fe43d1413928e7a9fa0f', 'github_bulk_tasks', 1791475200000);
