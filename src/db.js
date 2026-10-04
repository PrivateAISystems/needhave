function isUniqueViolation(err) {
  const msg = String(err && err.message ? err.message : err);
  return /UNIQUE|constraint/i.test(msg);
}

export async function insertPost(db, row) {
  try {
    await db
      .prepare(
        "INSERT INTO posts (id, kind, note, secret_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(row.id, row.kind, row.note, row.secret_hash, row.created_at)
      .run();
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "duplicate_note" };
    throw err;
  }
}

export async function findPost(db, id) {
  return db
    .prepare("SELECT id, kind, note, secret_hash, created_at FROM posts WHERE id = ?")
    .bind(id)
    .first();
}

export async function listPosts(db) {
  const result = await db
    .prepare("SELECT id, kind, note FROM posts ORDER BY created_at DESC, id DESC")
    .all();
  return result.results ?? [];
}

export async function findPostByNote(db, note) {
  return db.prepare("SELECT id FROM posts WHERE note = ?").bind(note).first();
}

export async function insertMessage(db, row) {
  try {
    await db
      .prepare(
        "INSERT INTO messages (id, post_id, text, thread_key_hash, parent_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        row.id,
        row.post_id,
        row.text,
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
    .prepare(
      "SELECT id, post_id, text, thread_key_hash, parent_id, role, created_at FROM messages WHERE id = ?",
    )
    .bind(id)
    .first();
}

export async function findAcceptForFirst(db, firstId) {
  return db
    .prepare(
      "SELECT id, post_id, thread_key_hash, parent_id, role FROM messages WHERE parent_id = ? AND role = 'accept'",
    )
    .bind(firstId)
    .first();
}

export async function findAcceptByThreadHash(db, threadKeyHash) {
  return db
    .prepare(
      "SELECT id, post_id, thread_key_hash, parent_id, role FROM messages WHERE thread_key_hash = ? AND role = 'accept'",
    )
    .bind(threadKeyHash)
    .first();
}

export async function listLaterByThreadHash(db, threadKeyHash) {
  const result = await db
    .prepare(
      "SELECT id, text, created_at FROM messages WHERE thread_key_hash = ? AND role = 'later' ORDER BY created_at ASC, id ASC",
    )
    .bind(threadKeyHash)
    .all();
  return result.results ?? [];
}
