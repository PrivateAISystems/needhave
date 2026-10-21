#!/usr/bin/env node
/**
 * Fetch Stack Exchange from GitHub-hosted runners (not Cloudflare egress)
 * and POST raw items to the Worker ingest endpoint. Used by the scheduled
 * Action. Does not insert locally. Does not print secrets or API keys.
 *
 *   COPIER_INGEST_SECRET=… node scripts/copier-se-ingest.mjs
 */
import { COPIER_USER_AGENT, redactCopierUrl, sourceRequests } from "../src/copier.js";

const ingestUrl = process.env.NEEDHAVE_INGEST_URL || "https://needhave.io/copier/ingest";
const secret = process.env.COPIER_INGEST_SECRET || "";
const seKey = process.env.STACKEXCHANGE_KEY || "";

if (!secret) {
  process.stdout.write("ingest off: COPIER_INGEST_SECRET unset\n");
  process.exit(0);
}

const now = Date.now();
const maxAgeMs = 3 * 24 * 60 * 60 * 1000;
const requests = sourceRequests(now, maxAgeMs, seKey ? { STACKEXCHANGE_KEY: seKey } : {}).filter(
  (req) => req.source === "stackexchange",
);

const items = [];
const seen = new Set();
let httpStatus = 0;
let error = null;
let quotaRemaining = null;
let backoff = null;

for (const req of requests) {
  let response;
  try {
    response = await fetch(req.url, {
      headers: { accept: "application/json", "user-agent": COPIER_USER_AGENT },
    });
  } catch {
    httpStatus = httpStatus || 0;
    error = error || "network";
    process.stdout.write(`${JSON.stringify({ fetch: redactCopierUrl(req.url), status: 0, error: "network" })}\n`);
    continue;
  }
  httpStatus = response.status;
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (body && Number.isFinite(body.quota_remaining)) quotaRemaining = body.quota_remaining;
  if (body && Number.isFinite(body.backoff)) backoff = body.backoff;
  if (!response.ok) {
    error = (body && (body.error_name || body.error_message)) || `http_${response.status}`;
  } else if (body && (body.error_id || body.error_name)) {
    error = body.error_name || body.error_message || `error_${body.error_id}`;
  }
  const batch = body && Array.isArray(body.items) ? body.items : [];
  for (const item of batch) {
    const link = item && item.link;
    if (!link || seen.has(link)) continue;
    seen.add(link);
    items.push(item);
  }
  process.stdout.write(
    `${JSON.stringify({
      fetch: redactCopierUrl(req.url),
      status: response.status,
      items: batch.length,
      quota_remaining: body && Number.isFinite(body.quota_remaining) ? body.quota_remaining : null,
    })}\n`,
  );
}

const payload = {
  source: "stackexchange",
  items,
  http_status: httpStatus || null,
  error,
  backoff,
  quota_remaining: quotaRemaining,
};

const posted = await fetch(ingestUrl, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${secret}`,
    "user-agent": COPIER_USER_AGENT,
  },
  body: JSON.stringify(payload),
});

let result = null;
try {
  result = await posted.json();
} catch {
  result = null;
}

process.stdout.write(
  `${JSON.stringify({
    ingest_status: posted.status,
    posted_items: items.length,
    copied: result && result.copied,
    would_copy: result && result.would_copy,
    error: result && result.error,
  })}\n`,
);

if (posted.status >= 400) process.exit(1);
