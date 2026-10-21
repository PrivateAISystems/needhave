import {
  countSourceRefsForDay,
  findSourceCount,
  incrementSourceCount,
  listSourceCounts,
} from "./db.js";

export const NONE_REF = "none";
export const OTHER_REF = "other";
export const MAX_REFS_PER_DAY = 50;
export const MIN_STATS_DAYS = 1;
export const MAX_STATS_DAYS = 90;
export const DEFAULT_STATS_DAYS = 7;

const VALID_REF = /^[a-z0-9-]{1,32}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeRef(raw) {
  if (typeof raw !== "string") return NONE_REF;
  const lowered = raw.toLowerCase();
  if (!VALID_REF.test(lowered)) return NONE_REF;
  return lowered;
}

export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function parseStatsDays(searchParams) {
  if (!searchParams.has("days")) return DEFAULT_STATS_DAYS;
  const raw = searchParams.get("days");
  if (raw == null || !/^\d+$/.test(raw)) return null;
  const days = Number(raw);
  if (!Number.isInteger(days) || days < MIN_STATS_DAYS || days > MAX_STATS_DAYS) {
    return null;
  }
  return days;
}

export async function resolveRefBucket(db, day, ref) {
  const existing = await findSourceCount(db, day, ref);
  if (existing) return ref;
  const n = await countSourceRefsForDay(db, day);
  if (n >= MAX_REFS_PER_DAY) return OTHER_REF;
  return ref;
}

export async function recordSourceActivity(db, rawRef, deltas) {
  try {
    if (!db) return;
    const connections = Number(deltas && deltas.connections) || 0;
    const tool_calls = Number(deltas && deltas.tool_calls) || 0;
    const posts_created = Number(deltas && deltas.posts_created) || 0;
    const page_views = Number(deltas && deltas.page_views) || 0;
    if (connections === 0 && tool_calls === 0 && posts_created === 0 && page_views === 0) return;
    const day = utcDay();
    const ref = normalizeRef(rawRef);
    const bucket = await resolveRefBucket(db, day, ref);
    await incrementSourceCount(db, day, bucket, {
      connections,
      tool_calls,
      posts_created,
      page_views,
    });
  } catch {
    return;
  }
}

export function deltasFromRpc(message) {
  const items = Array.isArray(message) ? message : [message];
  let connections = 0;
  let tool_calls = 0;
  let posts_created = 0;
  for (const item of items) {
    if (!item || typeof item !== "object" || typeof item.method !== "string") continue;
    if (item.method === "initialize") connections += 1;
    if (item.method === "tools/call") {
      tool_calls += 1;
      const name = item.params && item.params.name;
      if (name === "create_need" || name === "create_have") posts_created += 1;
    }
  }
  return { connections, tool_calls, posts_created };
}

export function startSourceCount(options, request, message) {
  const db = options && options.env && options.env.DB;
  if (!db) return null;
  const deltas = deltasFromRpc(message);
  if (deltas.connections === 0 && deltas.tool_calls === 0 && deltas.posts_created === 0) {
    return null;
  }
  let rawRef = null;
  try {
    rawRef = new URL(request.url).searchParams.get("ref");
  } catch {
    rawRef = null;
  }
  const work = recordSourceActivity(db, rawRef, deltas);
  if (options.ctx && typeof options.ctx.waitUntil === "function") {
    options.ctx.waitUntil(work);
    return null;
  }
  return work;
}

// Home-page aggregate only. Caller passes the query ref, never the request.
// The task normalizes that ref before the upsert and swallows its own errors.
export function startHomePageView(ctx, db, rawRef) {
  if (!ctx || typeof ctx.waitUntil !== "function") return;
  const task = (async () => {
    try {
      const ref = normalizeRef(rawRef);
      await recordSourceActivity(db, ref, { page_views: 1 });
    } catch {
      return;
    }
  })();
  try {
    ctx.waitUntil(task);
  } catch {
    return;
  }
}

export async function readSourceCounts(db, days, now = Date.now()) {
  const endDay = utcDay(now);
  const startMs = Date.parse(`${endDay}T00:00:00.000Z`) - (days - 1) * MS_PER_DAY;
  const startDay = utcDay(startMs);
  const rows = await listSourceCounts(db, startDay, endDay);
  return rows.map((row) => ({
    day: row.day,
    ref: row.ref,
    connections: Number(row.connections) || 0,
    tool_calls: Number(row.tool_calls) || 0,
    posts_created: Number(row.posts_created) || 0,
    page_views: Number(row.page_views) || 0,
  }));
}
