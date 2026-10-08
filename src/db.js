import {
  MAX_LIST_MESSAGES,
  MAX_LIST_POSTS,
  MAX_WAITING_FIRSTS,
} from "./limits.js";

function isUniqueViolation(err) {
  const msg = String(err && err.message ? err.message : err);
  return /UNIQUE|constraint/i.test(msg);
}

const MESSAGE_COLUMNS =
  "id, post_id, text, secret_hash, thread_key, thread_key_hash, parent_id, role, created_at";

export async function insertPost(db, row) {
  try {
    await db
      .prepare(
        "INSERT INTO posts (id, kind, note, secret_hash, created_at, source, note_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        row.id,
        row.kind,
        row.note,
        row.secret_hash,
        row.created_at,
        row.source,
        row.note_hash,
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
      "SELECT id, kind, note, secret_hash, created_at, source, note_hash FROM posts WHERE id = ?",
    )
    .bind(id)
    .first();
}

export async function listPosts(db) {
  const result = await db
    .prepare(
      `SELECT id, kind, note, source FROM posts ORDER BY created_at DESC, id DESC LIMIT ${MAX_LIST_POSTS}`,
    )
    .all();
  return result.results ?? [];
}

export async function findPostByNote(db, note) {
  return db.prepare("SELECT id FROM posts WHERE note = ?").bind(note).first();
}

export async function findPostByNoteHash(db, noteHash) {
  return db.prepare("SELECT id FROM posts WHERE note_hash = ?").bind(noteHash).first();
}

export async function insertTip(db, row) {
  await db
    .prepare(
      "INSERT INTO tips (id, source_url, author_handle, proposed_note, note_hash, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      row.id,
      row.source_url,
      row.author_handle,
      row.proposed_note,
      row.note_hash,
      row.token_hash,
      row.expires_at,
      row.created_at,
    )
    .run();
}

export async function findTipByTokenHash(db, tokenHash) {
  return db
    .prepare(
      "SELECT id, source_url, author_handle, proposed_note, note_hash, token_hash, expires_at, created_at FROM tips WHERE token_hash = ?",
    )
    .bind(tokenHash)
    .first();
}

export async function findTipConfirm(db, tipId) {
  return db
    .prepare("SELECT id, tip_id, post_id, created_at FROM tip_confirms WHERE tip_id = ?")
    .bind(tipId)
    .first();
}

export async function insertTipConfirm(db, row) {
  try {
    await db
      .prepare(
        "INSERT INTO tip_confirms (id, tip_id, post_id, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(row.id, row.tip_id, row.post_id, row.created_at)
      .run();
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "already_confirmed" };
    throw err;
  }
}

export async function countSourceWrites(db, bucket, since) {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM write_events WHERE bucket = ? AND created_at > ?",
    )
    .bind(bucket, since)
    .first();
  return Number(row && row.n != null ? row.n : 0);
}

export async function insertWriteEvent(db, row) {
  await db
    .prepare("INSERT INTO write_events (id, bucket, created_at) VALUES (?, ?, ?)")
    .bind(row.id, row.bucket, row.created_at)
    .run();
}

export async function insertMessage(db, row) {
  try {
    await db
      .prepare(
        `INSERT INTO messages (${MESSAGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
       ORDER BY created_at ASC, id ASC
       LIMIT ${MAX_WAITING_FIRSTS}`,
    )
    .bind(postId)
    .all();
  return result.results ?? [];
}

export async function countWaitingFirsts(db, postId) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages
       WHERE post_id = ? AND role = 'first'
         AND NOT EXISTS (
           SELECT 1 FROM messages AS accept
           WHERE accept.parent_id = messages.id AND accept.role = 'accept'
         )`,
    )
    .bind(postId)
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
