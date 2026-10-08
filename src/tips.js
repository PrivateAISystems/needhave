import { bearerMatches, parseHttpUrl, readBearer, sourceDomain } from "./auth.js";
import { newId, newSecret, sha256Hex } from "./crypto.js";
import {
  findPostByNote,
  findPostByNoteHash,
  findTipByTokenHash,
  findTipConfirm,
  insertTip,
  insertTipConfirm,
} from "./db.js";
import { filterNote, normalizeNote, trimNote } from "./filter.js";
import {
  MAX_TIPS_PER_DOMAIN,
  TIP_TTL_MS,
  allowIp,
  nowMs,
} from "./limits.js";
import { allowSourceBucket, createAttributedPost } from "./posts.js";
import { checkTurnstile } from "./turnstile.js";

export async function createTip(env, request, body) {
  const configured = env && env.TIP_CREATE_SECRET;
  if (!configured) return { error: "not_configured", status: 503 };
  if (!(await bearerMatches(readBearer(request), configured))) {
    return { error: "unauthorized", status: 403 };
  }

  const source_url = parseHttpUrl(body && body.source_url);
  if (!source_url) return { error: "bad_source_url", status: 400 };

  const author_handle = trimNote(body && body.author_handle);
  if (!author_handle || author_handle.length > 80) return { error: "bad_handle", status: 400 };

  const proposed_note = trimNote(body && body.proposed_note);
  const filtered = filterNote(proposed_note);
  if (filtered) return { error: filtered, status: 400 };
  const normalized = normalizeNote(proposed_note);
  if (!normalized) return { error: "empty_note", status: 400 };

  if (!allowIp(request, "tip")) return { error: "rate_limited", status: 429 };

  const domain = sourceDomain(source_url);
  if (
    !(await allowSourceBucket(env, `tip-domain:${domain}`, MAX_TIPS_PER_DOMAIN))
  ) {
    return { error: "rate_limited", status: 429 };
  }

  const token = newSecret();
  const created_at = nowMs(env);
  const ttl = typeof env.TIP_TTL_MS === "number" ? env.TIP_TTL_MS : TIP_TTL_MS;
  const id = newId();
  await insertTip(env.DB, {
    id,
    source_url,
    author_handle,
    proposed_note,
    note_hash: await sha256Hex(normalized),
    token_hash: await sha256Hex(token),
    expires_at: created_at + ttl,
    created_at,
  });

  return {
    status: 201,
    tip: {
      id,
      invite_path: `/tips/confirm?token=${token}`,
    },
  };
}

export async function confirmTip(env, request, body) {
  const token = body && typeof body.token === "string" ? body.token : "";
  if (!token) return { error: "bad_request", status: 400 };

  const gate = await checkTurnstile(env, request, body);
  if (!gate.ok) return { error: gate.error || "turnstile", status: 403 };

  const tip = await findTipByTokenHash(env.DB, await sha256Hex(token));
  if (!tip) return { error: "not_found", status: 404 };

  const t = nowMs(env);
  if (t >= tip.expires_at) return { error: "expired", status: 410 };

  const already = await findTipConfirm(env.DB, tip.id);
  if (already) return { error: "already_confirmed", status: 409 };

  const note = trimNote(body && body.note) || tip.proposed_note;
  const filtered = filterNote(note);
  if (filtered) return { error: filtered, status: 400 };

  const normalized = normalizeNote(note);
  if (!normalized) return { error: "empty_note", status: 400 };
  if (await findPostByNote(env.DB, note)) return { error: "duplicate_note", status: 409 };
  if (await findPostByNoteHash(env.DB, await sha256Hex(normalized))) {
    return { error: "duplicate_note", status: 409 };
  }

  const created = await createAttributedPost(env, request, {
    kind: "need",
    note,
    source: `tip-confirmed:${tip.source_url}`,
  });
  if (created.status !== 201) return created;

  const confirm = await insertTipConfirm(env.DB, {
    id: newId(),
    tip_id: tip.id,
    post_id: created.post.id,
    created_at: nowMs(env),
  });
  if (!confirm.ok) return { error: confirm.error, status: 409 };

  return { status: 201, post: created.post };
}

export function confirmPage(token, siteKey) {
  const escaped = token.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const widget = siteKey
    ? `<div class="cf-turnstile" data-sitekey="${String(siteKey).replace(/"/g, "")}"></div>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Confirm a needhave tip</title></head>
<body>
<p>This posts your need on the public list only if you confirm. You can edit the note. The post secret is shown once after confirm.</p>
<form method="post" action="/tips/confirm">
<input type="hidden" name="token" value="${escaped}">
<label>Note <textarea name="note" maxlength="500"></textarea></label>
${widget}
<button type="submit">Confirm and post</button>
</form>
</body></html>`;
}
