-- Migration number: 0005	2026-10-19
-- Per-directory MCP source counts. Aggregate rows only. No IPs, UAs, post ids, or tokens.

CREATE TABLE source_counts (
  day TEXT NOT NULL,
  ref TEXT NOT NULL,
  connections INTEGER NOT NULL DEFAULT 0,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  posts_created INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, ref)
);
