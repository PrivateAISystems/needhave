import { newId, newSecret, sha256Hex } from "./crypto.js";
import {
  findAcceptByThreadHash,
  findAcceptForFirst,
  findMessage,
  findPost,
  findPostByNote,
  insertMessage,
  insertPost,
  listLaterByThreadHash,
  listPosts,
  listWaitingFirsts,
} from "./db.js";
import { filterNote, trimNote } from "./filter.js";
import { LANDING_HTML, SERVICE_DESC_LINK } from "./landing.js";
import { openapi } from "./openapi.js";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function html(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      link: SERVICE_DESC_LINK,
    },
  });
}

function error(code, status) {
  return json({ error: code }, status);
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function publicPost(row) {
  return { id: row.id, kind: row.kind, note: row.note };
}

function readSecret(body) {
  return body && typeof body.secret === "string" ? body.secret : null;
}

async function createPost(env, body) {
  if (!body || (body.kind !== "need" && body.kind !== "have")) {
    return error("bad_kind", 400);
  }
  const note = trimNote(body.note);
  const filtered = filterNote(note);
  if (filtered) return error(filtered, 400);

  const existing = await findPostByNote(env.DB, note);
  if (existing) return error("duplicate_note", 409);

  const id = newId();
  const secret = newSecret();
  const inserted = await insertPost(env.DB, {
    id,
    kind: body.kind,
    note,
    secret_hash: await sha256Hex(secret),
    created_at: Date.now(),
  });
  if (!inserted.ok) return error(inserted.error, 409);

  return json({ id, kind: body.kind, note, secret }, 201);
}

async function getPosts(env) {
  const posts = await listPosts(env.DB);
  return json({ posts: posts.map(publicPost) });
}

async function getPost(env, postId) {
  const post = await findPost(env.DB, postId);
  if (!post) return error("not_found", 404);
  return json(publicPost(post));
}

async function publicMessages() {
  return json({ messages: [] });
}

async function createFirstMessage(env, postId, body) {
  const post = await findPost(env.DB, postId);
  if (!post) return error("not_found", 404);

  const text = trimNote(body && body.text);
  const filtered = filterNote(text);
  if (filtered) return error(filtered, 400);

  const id = newId();
  const secret = newSecret();
  await insertMessage(env.DB, {
    id,
    post_id: postId,
    text,
    secret_hash: await sha256Hex(secret),
    thread_key: null,
    thread_key_hash: null,
    parent_id: null,
    role: "first",
    created_at: Date.now(),
  });
  return json({ id, post_id: postId, hidden: true, secret }, 201);
}

async function waitingMessages(env, postId, body) {
  const secret = readSecret(body);
  if (secret == null) return error("bad_request", 400);

  const post = await findPost(env.DB, postId);
  if (!post) return error("not_found", 404);
  if (post.secret_hash !== (await sha256Hex(secret))) {
    return error("bad_secret", 403);
  }

  const messages = await listWaitingFirsts(env.DB, postId);
  return json({
    messages: messages.map((row) => ({ id: row.id, text: row.text })),
  });
}

async function acceptMessage(env, postId, body) {
  const secret = readSecret(body);
  if (secret == null || !body || typeof body.message_id !== "string") {
    return error("bad_request", 400);
  }

  const post = await findPost(env.DB, postId);
  if (!post) return error("not_found", 404);
  if (post.secret_hash !== (await sha256Hex(secret))) {
    return error("bad_secret", 403);
  }

  const first = await findMessage(env.DB, body.message_id);
  if (!first || first.post_id !== postId || first.role !== "first") {
    return error("not_found", 404);
  }

  const already = await findAcceptForFirst(env.DB, first.id);
  if (already) return error("already_accepted", 409);

  const thread_key = newSecret();
  const inserted = await insertMessage(env.DB, {
    id: newId(),
    post_id: postId,
    text: null,
    secret_hash: null,
    thread_key,
    thread_key_hash: await sha256Hex(thread_key),
    parent_id: first.id,
    role: "accept",
    created_at: Date.now(),
  });
  if (!inserted.ok) return error(inserted.error, 409);

  return json({ thread_key }, 201);
}

async function claimThread(env, messageId, body) {
  const secret = readSecret(body);
  if (secret == null) return error("bad_request", 400);

  const first = await findMessage(env.DB, messageId);
  if (!first || first.role !== "first") return error("not_found", 404);
  if (!first.secret_hash || first.secret_hash !== (await sha256Hex(secret))) {
    return error("bad_secret", 403);
  }

  const accept = await findAcceptForFirst(env.DB, first.id);
  if (!accept || !accept.thread_key) {
    return json({ accepted: false });
  }
  return json({ accepted: true, thread_key: accept.thread_key });
}

async function loadThread(env, threadKey) {
  const accept = await findAcceptByThreadHash(env.DB, await sha256Hex(threadKey));
  if (!accept) return null;
  const first = await findMessage(env.DB, accept.parent_id);
  const later = await listLaterByThreadHash(env.DB, accept.thread_key_hash);
  const messages = [];
  if (first && first.text != null) {
    messages.push({ id: first.id, text: first.text });
  }
  for (const row of later) {
    messages.push({ id: row.id, text: row.text });
  }
  return { post_id: accept.post_id, messages };
}

async function getThread(env, threadKey) {
  const thread = await loadThread(env, threadKey);
  if (!thread) return error("not_found", 404);
  return json(thread);
}

async function createLaterMessage(env, threadKey, body) {
  const thread = await loadThread(env, threadKey);
  if (!thread) return error("not_found", 404);

  const text = trimNote(body && body.text);
  const filtered = filterNote(text);
  if (filtered) return error(filtered, 400);

  const id = newId();
  await insertMessage(env.DB, {
    id,
    post_id: thread.post_id,
    text,
    secret_hash: null,
    thread_key: null,
    thread_key_hash: await sha256Hex(threadKey),
    parent_id: null,
    role: "later",
    created_at: Date.now(),
  });
  return json({ id, post_id: thread.post_id }, 201);
}

export async function handle(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const method = request.method;

  if (parts.length === 0 && method === "GET") {
    return html(LANDING_HTML);
  }
  if (parts.length === 1 && parts[0] === "openapi.json" && method === "GET") {
    return json(openapi);
  }
  if (parts.length === 1 && parts[0] === "posts" && method === "GET") {
    return getPosts(env);
  }
  if (parts.length === 1 && parts[0] === "posts" && method === "POST") {
    return createPost(env, await readBody(request));
  }
  if (parts.length === 2 && parts[0] === "posts" && method === "GET") {
    return getPost(env, parts[1]);
  }
  if (parts.length === 3 && parts[0] === "posts" && parts[2] === "messages" && method === "GET") {
    if (!(await findPost(env.DB, parts[1]))) return error("not_found", 404);
    return publicMessages();
  }
  if (parts.length === 3 && parts[0] === "posts" && parts[2] === "messages" && method === "POST") {
    return createFirstMessage(env, parts[1], await readBody(request));
  }
  if (parts.length === 3 && parts[0] === "posts" && parts[2] === "waiting" && method === "POST") {
    return waitingMessages(env, parts[1], await readBody(request));
  }
  if (parts.length === 3 && parts[0] === "posts" && parts[2] === "accept" && method === "POST") {
    return acceptMessage(env, parts[1], await readBody(request));
  }
  if (parts.length === 3 && parts[0] === "messages" && parts[2] === "thread" && method === "POST") {
    return claimThread(env, parts[1], await readBody(request));
  }
  if (parts.length === 2 && parts[0] === "threads" && method === "GET") {
    return getThread(env, parts[1]);
  }
  if (parts.length === 3 && parts[0] === "threads" && parts[2] === "messages" && method === "POST") {
    return createLaterMessage(env, parts[1], await readBody(request));
  }

  return error("not_found", 404);
}
