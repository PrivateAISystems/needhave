-- Migration number: 0007	2026-10-20
-- Home-page views. One aggregate column on source_counts. No IPs, user agents, or per-request rows.

ALTER TABLE source_counts ADD COLUMN page_views INTEGER NOT NULL DEFAULT 0;
