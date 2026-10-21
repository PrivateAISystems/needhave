-- Migration number: 0003	2026-10-08
-- Per-source copier run log. Insert-only. No secrets.

CREATE TABLE copier_runs (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  dry_run INTEGER NOT NULL,
  source TEXT NOT NULL,
  http_status INTEGER,
  error TEXT,
  backoff INTEGER,
  quota_remaining INTEGER,
  candidates INTEGER NOT NULL,
  would_copy INTEGER NOT NULL,
  copied INTEGER NOT NULL,
  skip_reasons TEXT NOT NULL
);

CREATE INDEX copier_runs_started ON copier_runs(started_at DESC, source);
