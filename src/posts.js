import { bearerMatches, parseAgentName, readBearer } from "./auth.js";
import { newId, newSecret, sha256Hex } from "./crypto.js";
import { findPostByNote, findPostByNoteHash, insertPost, insertWriteEvent } from "./db.js";
import { filterNote, normalizeNote, trimNote } from "./filter.js";
import {
  MAX_AGENT_POSTS,
  MAX_EMAIL_POSTS,
  RATE_WINDOW_MS,
  allowIp,
  nowMs,
} from "./limits.js";
import { checkTurnstile } from "./turnstile.js";

function publicPost(row) {
  return { id: row.id, kind: row.kind, note: row.note, source: row.source };
}

export { publicPost };

export async function allowSourceBucket(env, bucket, max) {
  const { countSourceWrites } = await import("./db.js");
  const createdAt = nowMs(env);
  const used = await countSourceWrites(env.DB, bucket, createdAt - RATE_WINDOW_MS);
  if (used >= max) return false;
  await insertWriteEvent(env.DB, { id: newId(), bucket, created_at: createdAt });
  return true;
}

export async function createAttributedPost(env, request, input) {
  const kind = input && input.kind;
  if (kind !== "need" && kind !== "have") {
    return { error: "bad_kind", status: 400 };
  }

  const note = trimNote(input.note);
  const filtered = filterNote(note);
  if (filtered) return { error: filtered, status: 400 };

  const normalized = normalizeNote(note);
  if (!normalized) return { error: "empty_note", status: 400 };
  const note_hash = await sha256Hex(normalized);

  if (await findPostByNote(env.DB, note)) {
    return { error: "duplicate_note", status: 409 };
  }
  if (await findPostByNoteHash(env.DB, note_hash)) {
    return { error: "duplicate_note", status: 409 };
  }

  if (input.requireTurnstile) {
    const gate = await checkTurnstile(env, request, input.body || input);
    if (!gate.ok) return { error: gate.error || "turnstile", status: 403 };
  }

  if (request && !allowIp(request, "post")) {
    return { error: "rate_limited", status: 429 };
  }

  if (input.sourceBucket) {
    const ok = await allowSourceBucket(env, input.sourceBucket, input.sourceMax);
    if (!ok) return { error: "rate_limited", status: 429 };
  }

  const id = newId();
  const secret = newSecret();
  const source = input.source || "self";
  const inserted = await insertPost(env.DB, {
    id,
    kind,
    note,
    secret_hash: await sha256Hex(secret),
    created_at: nowMs(env),
    source,
    note_hash,
  });
  if (!inserted.ok) return { error: inserted.error, status: 409 };

  return { status: 201, post: { id, kind, note, source, secret } };
}

export async function createSelfPost(env, request, body, { requireTurnstile = false } = {}) {
  return createAttributedPost(env, request, {
    kind: body && body.kind,
    note: body && body.note,
    source: "self",
    body,
    requireTurnstile,
  });
}

export async function createAgentPost(env, request, body) {
  const configured = env && env.AGENT_HOOK_SECRET;
  if (!configured) return { error: "not_configured", status: 503 };
  if (!(await bearerMatches(readBearer(request), configured))) {
    return { error: "unauthorized", status: 403 };
  }

  const name = parseAgentName(body && body.agent);
  if (!name) return { error: "bad_agent", status: 400 };

  return createAttributedPost(env, request, {
    kind: body && body.kind,
    note: body && body.note,
    source: `agent:${name}`,
    sourceBucket: `agent:${name}`,
    sourceMax: MAX_AGENT_POSTS,
  });
}

export async function createEmailPost(env, request, { kind, note, fromHash }) {
  return createAttributedPost(env, request, {
    kind,
    note,
    source: "self",
    sourceBucket: `email:${fromHash}`,
    sourceMax: MAX_EMAIL_POSTS,
  });
}
