import { newId, newSecret, sha256Hex } from "./crypto.js";
import {
  countWaitingFirsts,
  findAcceptByThreadHash,
  findAcceptForFirst,
  findMessage,
  findPost,
  insertMessage,
  listLaterByThreadHash,
  listPosts,
  listWaitingFirsts,
} from "./db.js";
import { filterNote, trimNote } from "./filter.js";
import { createAgentPost, createSelfPost, publicPost } from "./posts.js";
import { confirmPage, confirmTip, createTip } from "./tips.js";
import {
  API_CATALOG,
  API_CATALOG_TYPE,
  AUTH_MD,
  CONTENT_SIGNAL,
  DISCOVERY_LINK,
  LANDING_MD,
  MCP_SERVER_CARD,
  NEEDHAVE_SKILL_MD,
  ROBOTS_TXT,
  SITEMAP_XML,
  markdownTokens,
  skillIndex,
  wantsMarkdown,
} from "./discovery.js";
import { LANDING_HTML } from "./landing.js";
import { allowIp, MAX_WAITING_FIRSTS } from "./limits.js";
import { LLMS_TXT } from "./llms.js";
import { openapi } from "./openapi.js";

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });
}

function text(body, type, extra = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": `${type}; charset=utf-8`,
      "content-signal": CONTENT_SIGNAL,
      ...extra,
    },
  });
}

function markdown(body, extra = {}) {
  return text(body, "text/markdown", {
    "x-markdown-tokens": markdownTokens(body),
    ...extra,
  });
}

function html(body, request) {
  if (wantsMarkdown(request)) {
    return markdown(LANDING_MD, {
      link: DISCOVERY_LINK,
      "x-robots-tag": "index, follow",
      vary: "accept",
    });
  }
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      link: DISCOVERY_LINK,
      "x-robots-tag": "index, follow",
      "content-signal": CONTENT_SIGNAL,
      vary: "accept",
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

function readSecret(body) {
  return body && typeof body.secret === "string" ? body.secret : null;
}

function readThreadKey(body) {
  return body && typeof body.thread_key === "string" ? body.thread_key : null;
}

async function readInput(request) {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  if (type.includes("application/x-www-form-urlencoded")) {
    try {
      return Object.fromEntries(new URLSearchParams(await request.text()));
    } catch {
      return null;
    }
  }
  return readBody(request);
}

function resultResponse(result) {
  if (result.post) {
    return json(result.post, result.status);
  }
  if (result.tip) {
    return json(result.tip, result.status);
  }
  return error(result.error || "bad_request", result.status || 400);
}

async function createPost(env, body, request) {
  return resultResponse(await createSelfPost(env, request, body));
}

async function createIntake(env, body, request) {
  return resultResponse(
    await createSelfPost(env, request, body, { requireTurnstile: true }),
  );
}

function intakePage(env) {
  const siteKey = env && env.TURNSTILE_SITEKEY;
  const widget = siteKey
    ? `<div class="cf-turnstile" data-sitekey="${String(siteKey).replace(/"/g, "")}"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Post a need</title></head>
<body>
<p>Post your own need or have. The secret is shown once. No contact details.</p>
<form method="post" action="/intake">
<label>Kind
<select name="kind"><option value="need">need</option><option value="have">have</option></select>
</label>
<label>Note <textarea name="note" maxlength="500" required></textarea></label>
${widget}
<button type="submit">Post</button>
</form>
</body></html>`;
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

async function createFirstMessage(env, postId, body, request) {
  const post = await findPost(env.DB, postId);
  if (!post) return error("not_found", 404);

  const text = trimNote(body && body.text);
  const filtered = filterNote(text);
  if (filtered) return error(filtered, 400);

  const waiting = await countWaitingFirsts(env.DB, postId);
  if (waiting >= MAX_WAITING_FIRSTS) return error("too_many", 429);

  if (!allowIp(request, "first")) return error("rate_limited", 429);

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

async function getThread(env, body) {
  const threadKey = readThreadKey(body);
  if (threadKey == null) return error("bad_request", 400);
  const thread = await loadThread(env, threadKey);
  if (!thread) return error("not_found", 404);
  return json(thread);
}

async function createLaterMessage(env, body) {
  const threadKey = readThreadKey(body);
  if (threadKey == null) return error("bad_request", 400);

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
    return html(LANDING_HTML, request);
  }
  if (parts.length === 1 && parts[0] === "index.md" && method === "GET") {
    return markdown(LANDING_MD);
  }
  if (parts.length === 1 && parts[0] === "robots.txt" && method === "GET") {
    return text(ROBOTS_TXT, "text/plain");
  }
  if (parts.length === 1 && parts[0] === "sitemap.xml" && method === "GET") {
    return text(SITEMAP_XML, "application/xml");
  }
  if (parts.length === 1 && parts[0] === "auth.md" && method === "GET") {
    return markdown(AUTH_MD);
  }
  if (parts.length === 2 && parts[0] === ".well-known" && parts[1] === "api-catalog" && method === "GET") {
    return new Response(JSON.stringify(API_CATALOG), {
      status: 200,
      headers: {
        "content-type": API_CATALOG_TYPE,
        "content-signal": CONTENT_SIGNAL,
      },
    });
  }
  if (parts.length === 2 && parts[0] === ".well-known" && parts[1] === "mcp.json" && method === "GET") {
    return json(MCP_SERVER_CARD);
  }
  if (
    parts.length === 3 &&
    parts[0] === ".well-known" &&
    parts[1] === "mcp" &&
    parts[2] === "server-card.json" &&
    method === "GET"
  ) {
    return json(MCP_SERVER_CARD);
  }
  if (
    parts.length === 3 &&
    parts[0] === ".well-known" &&
    parts[1] === "agent-skills" &&
    parts[2] === "index.json" &&
    method === "GET"
  ) {
    return json(await skillIndex());
  }
  if (
    parts.length === 4 &&
    parts[0] === ".well-known" &&
    parts[1] === "agent-skills" &&
    parts[2] === "needhave" &&
    parts[3] === "SKILL.md" &&
    method === "GET"
  ) {
    return markdown(NEEDHAVE_SKILL_MD);
  }
  if (parts.length === 1 && parts[0] === "openapi.json" && method === "GET") {
    return json(openapi);
  }
  if (parts.length === 1 && parts[0] === "llms.txt" && method === "GET") {
    return text(LLMS_TXT, "text/plain");
  }
  if (parts.length === 1 && parts[0] === "intake" && method === "GET") {
    return html(intakePage(env), request);
  }
  if (parts.length === 1 && parts[0] === "intake" && method === "POST") {
    return createIntake(env, await readInput(request), request);
  }
  if (parts.length === 1 && parts[0] === "agent" && method === "POST") {
    return resultResponse(await createAgentPost(env, request, await readBody(request)));
  }
  if (parts.length === 1 && parts[0] === "tips" && method === "POST") {
    return resultResponse(await createTip(env, request, await readBody(request)));
  }
  if (parts.length === 2 && parts[0] === "tips" && parts[1] === "confirm" && method === "GET") {
    const token = url.searchParams.get("token") || "";
    if (!token) return error("bad_request", 400);
    return html(confirmPage(token, env && env.TURNSTILE_SITEKEY), request);
  }
  if (parts.length === 2 && parts[0] === "tips" && parts[1] === "confirm" && method === "POST") {
    return resultResponse(await confirmTip(env, request, await readInput(request)));
  }
  if (parts[0] === "tips") {
    return error("not_found", 404);
  }
  if (parts.length === 1 && parts[0] === "posts" && method === "GET") {
    return getPosts(env);
  }
  if (parts.length === 1 && parts[0] === "posts" && method === "POST") {
    return createPost(env, await readInput(request), request);
  }
  if (parts.length === 2 && parts[0] === "posts" && method === "GET") {
    return getPost(env, parts[1]);
  }
  if (parts.length === 3 && parts[0] === "posts" && parts[2] === "messages" && method === "GET") {
    if (!(await findPost(env.DB, parts[1]))) return error("not_found", 404);
    return publicMessages();
  }
  if (parts.length === 3 && parts[0] === "posts" && parts[2] === "messages" && method === "POST") {
    return createFirstMessage(env, parts[1], await readBody(request), request);
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
  if (parts.length === 1 && parts[0] === "threads" && method === "POST") {
    return getThread(env, await readBody(request));
  }
  if (parts.length === 2 && parts[0] === "threads" && parts[1] === "messages" && method === "POST") {
    return createLaterMessage(env, await readBody(request));
  }
  if (parts[0] === "threads") {
    return error("not_found", 404);
  }

  return error("not_found", 404);
}
