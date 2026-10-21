import {
  MAX_COPIER_RUNS,
  MAX_LIST_MESSAGES,
  MAX_LIST_POSTS,
  MAX_WAITING_FIRSTS,
  REPLY_WINDOW_MS,
} from "./limits.js";

function isUniqueViolation(err) {
  const msg = String(err && err.message ? err.message : err);
  return /UNIQUE|constraint/i.test(msg);
}

const MESSAGE_COLUMNS =
  "id, post_id, text, secret_hash, thread_key, thread_key_hash, parent_id, role, created_at, visible";

/**
 * Fail closed. Only an explicit visible flag of 1 on a first reply is public.
 * 0, NULL, missing, and any other role stay hidden. A clock is not consulted.
 */
export function isPublicReply(row) {
  if (!row || row.role !== "first") return false;
  if (row.visible !== 1) return false;
  if (typeof row.text !== "string" || row.text.length === 0) return false;
  return true;
}

export async function insertPost(db, row) {
  try {
    await db
      .prepare(
        "INSERT INTO posts (id, kind, note, secret_hash, created_at, source_url, note_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        row.id,
        row.kind,
        row.note,
        row.secret_hash,
        row.created_at,
        row.source_url ?? null,
        row.note_hash ?? null,
      )
      .run();
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate_note" };
    throw err;
  }
}

export async function findPost(db, id) {
  return db
    .prepare(
      `SELECT id, kind, note, secret_hash, created_at, source_url, note_hash FROM posts
       WHERE id = ?
         AND NOT EXISTS (SELECT 1 FROM hidden_posts WHERE post_id = posts.id)`,
    )
    .bind(id)
    .first();
}

export async function listPosts(db) {
  const result = await db
    .prepare(
      `SELECT id, kind, note, source_url FROM posts
       WHERE NOT EXISTS (SELECT 1 FROM hidden_posts WHERE post_id = posts.id)
       ORDER BY created_at DESC, id DESC LIMIT ${MAX_LIST_POSTS}`,
    )
    .all();
  return result.results ?? [];
}

export async function countRepoCopiesSince(db, repo, since) {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM copier_repo_copies WHERE repo = ? AND copied_at >= ?")
    .bind(repo, since)
    .first();
  return Number(row && row.n != null ? row.n : 0);
}

export async function insertCopierRun(db, row) {
  await db
    .prepare(
      `INSERT INTO copier_runs (
        id, started_at, dry_run, source, http_status, error, backoff,
        quota_remaining, candidates, would_copy, copied, skip_reasons
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.started_at,
      row.dry_run ? 1 : 0,
      row.source,
      row.http_status ?? null,
      row.error ?? null,
      row.backoff ?? null,
      row.quota_remaining ?? null,
      row.candidates,
      row.would_copy,
      row.copied,
      row.skip_reasons,
    )
    .run();
  return { ok: true };
}

export async function listCopierRuns(db) {
  const result = await db
    .prepare(
      `SELECT started_at, dry_run, source, http_status, error, backoff,
              quota_remaining, candidates, would_copy, copied, skip_reasons
       FROM copier_runs
       ORDER BY started_at DESC, source ASC
       LIMIT ${MAX_COPIER_RUNS}`,
    )
    .all();
  return result.results ?? [];
}

export async function findSourceCount(db, day, ref) {
  return db
    .prepare("SELECT ref FROM source_counts WHERE day = ? AND ref = ?")
    .bind(day, ref)
    .first();
}

export async function countSourceRefsForDay(db, day) {
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM source_counts WHERE day = ?")
    .bind(day)
    .first();
  return Number(row && row.n != null ? row.n : 0);
}

export async function incrementSourceCount(db, day, ref, deltas) {
  const connections = Number(deltas && deltas.connections) || 0;
  const tool_calls = Number(deltas && deltas.tool_calls) || 0;
  const posts_created = Number(deltas && deltas.posts_created) || 0;
  const page_views = Number(deltas && deltas.page_views) || 0;
  await db
    .prepare(
      `INSERT INTO source_counts (day, ref, connections, tool_calls, posts_created, page_views)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(day, ref) DO UPDATE SET
         connections = connections + excluded.connections,
         tool_calls = tool_calls + excluded.tool_calls,
         posts_created = posts_created + excluded.posts_created,
         page_views = page_views + excluded.page_views`,
    )
    .bind(day, ref, connections, tool_calls, posts_created, page_views)
    .run();
}

export async function listSourceCounts(db, startDay, endDay) {
  const result = await db
    .prepare(
      `SELECT day, ref, connections, tool_calls, posts_created, page_views
       FROM source_counts
       WHERE day >= ? AND day <= ?
       ORDER BY day DESC, ref ASC`,
    )
    .bind(startDay, endDay)
    .all();
  return result.results ?? [];
}

export async function insertRepoCopy(db, row) {
  try {
    await db
      .prepare("INSERT INTO copier_repo_copies (source_url, repo, copied_at) VALUES (?, ?, ?)")
      .bind(row.source_url, row.repo, row.copied_at)
      .run();
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate_note" };
    throw err;
  }
}

export async function findPostByNote(db, note) {
  return db.prepare("SELECT id FROM posts WHERE note = ?").bind(note).first();
}

export async function findPostBySourceUrl(db, sourceUrl) {
  return db.prepare("SELECT id FROM posts WHERE source_url = ?").bind(sourceUrl).first();
}

export async function findPostByNoteHash(db, noteHash) {
  return db.prepare("SELECT id FROM posts WHERE note_hash = ?").bind(noteHash).first();
}

export async function insertMessage(db, row) {
  try {
    await db
      .prepare(
        `INSERT INTO messages (${MESSAGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.id,
        row.post_id,
        row.text,
        row.secret_hash,
        row.thread_key,
        row.thread_key_hash,
        row.parent_id,
        row.role,
        row.created_at,
        row.visible === 1 ? 1 : 0,
      )
      .run();
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "already_accepted" };
    throw err;
  }
}

export async function findMessage(db, id) {
  return db
    .prepare(`SELECT ${MESSAGE_COLUMNS} FROM messages WHERE id = ?`)
    .bind(id)
    .first();
}

export async function findAcceptForFirst(db, firstId) {
  return db
    .prepare(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE parent_id = ? AND role = 'accept'`,
    )
    .bind(firstId)
    .first();
}

export async function findAcceptByThreadHash(db, threadKeyHash) {
  return db
    .prepare(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE thread_key_hash = ? AND role = 'accept'`,
    )
    .bind(threadKeyHash)
    .first();
}

export async function listWaitingFirsts(db, postId) {
  const result = await db
    .prepare(
      `SELECT id, text FROM messages
       WHERE post_id = ? AND role = 'first'
         AND NOT EXISTS (
           SELECT 1 FROM messages AS accept
           WHERE accept.parent_id = messages.id AND accept.role = 'accept'
         )
         AND NOT EXISTS (
           SELECT 1 FROM hidden_replies WHERE message_id = messages.id
         )
       ORDER BY created_at ASC, id ASC
       LIMIT ${MAX_WAITING_FIRSTS}`,
    )
    .bind(postId)
    .all();
  return result.results ?? [];
}

export async function listPublicReplies(db, postId) {
  const result = await db
    .prepare(
      `SELECT id, text, role, visible FROM messages
       WHERE post_id = ? AND role = 'first' AND visible = 1
         AND NOT EXISTS (
           SELECT 1 FROM hidden_replies WHERE message_id = messages.id
         )
       ORDER BY created_at ASC, id ASC
       LIMIT ${MAX_LIST_MESSAGES}`,
    )
    .bind(postId)
    .all();
  return (result.results ?? []).filter(isPublicReply).map((row) => ({
    id: row.id,
    text: row.text,
  }));
}

export async function findPublicReplyByText(db, text) {
  return db
    .prepare(
      `SELECT id FROM messages
       WHERE text = ? AND role = 'first' AND visible = 1
       LIMIT 1`,
    )
    .bind(text)
    .first();
}

/**
 * Rolling cap: new first replies on one post inside the last 24 hours.
 * Taken-down replies do not count. Older replies fall out of the window.
 */
export async function countRecentFirsts(db, postId, now) {
  const since = now - REPLY_WINDOW_MS;
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages
       WHERE post_id = ? AND role = 'first' AND created_at >= ?
         AND NOT EXISTS (
           SELECT 1 FROM hidden_replies WHERE message_id = messages.id
         )`,
    )
    .bind(postId, since)
    .first();
  return Number(row && row.n != null ? row.n : 0);
}

export async function listLaterByThreadHash(db, threadKeyHash) {
  const result = await db
    .prepare(
      `SELECT id, text, created_at FROM messages WHERE thread_key_hash = ? AND role = 'later' ORDER BY created_at ASC, id ASC LIMIT ${MAX_LIST_MESSAGES}`,
    )
    .bind(threadKeyHash)
    .all();
  return result.results ?? [];
}
