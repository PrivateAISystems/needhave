-- Migration number: 0001	2026-10-08
-- Copied public needs. Apply to the existing D1. Do not put rows here.

ALTER TABLE posts ADD COLUMN source_url TEXT;
ALTER TABLE posts ADD COLUMN note_hash TEXT;
CREATE UNIQUE INDEX posts_source_url ON posts(source_url) WHERE source_url IS NOT NULL;
CREATE UNIQUE INDEX posts_note_hash ON posts(note_hash) WHERE note_hash IS NOT NULL;
