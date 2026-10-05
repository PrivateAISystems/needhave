/** Cheap filter and flood limits. Same numbers for Worker and local test. */
export const MAX_NOTE = 500;
export const MAX_WAITING_FIRSTS = 20;
export const MAX_LIST_POSTS = 100;
export const MAX_LIST_MESSAGES = 100;
export const MAX_POSTS_PER_IP = 10;
export const MAX_FIRST_REPLIES_PER_IP = 20;
export const RATE_WINDOW_MS = 60 * 60 * 1000;

const buckets = new Map();

export function clientIp(request) {
  const headers = request && request.headers;
  if (!headers) return "unknown";
  const cf = headers.get("cf-connecting-ip");
  if (cf && cf.trim()) return cf.trim();
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return "unknown";
}

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Per-IP cap inside create-post and first-reply. One MCP JSON-RPC
 * batch cannot skip this: each handler call counts once.
 * Does not log the IP or any secret.
 */
export function allowIp(request, kind) {
  const max = kind === "post" ? MAX_POSTS_PER_IP : MAX_FIRST_REPLIES_PER_IP;
  const key = `${kind}:${clientIp(request)}`;
  const now = Date.now();
  if (buckets.size > 256) prune(now);
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    buckets.set(key, bucket);
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}
