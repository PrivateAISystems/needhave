import { newId, newSecret, sha256Hex } from "./crypto.js";
import {
  findPostByNote,
  findPostByNoteHash,
  findPostBySourceUrl,
  insertPost,
} from "./db.js";
import { filterNote, normalizeNote, stripContacts, trimNote } from "./filter.js";
import {
  COPIER_MAX_AGE_MS,
  COPIER_MAX_PER_RUN,
  COPIER_MAX_PER_SOURCE,
  MAX_NOTE,
} from "./limits.js";

export const COPIER_USER_AGENT = "needhave-copier/1.0 (+https://needhave.io)";

const NEED_RE =
  /\b(need|needed|needs|looking for|look for|seeking|wanted|help wanted|does anyone(?: have| know)|anyone have|in search of)\b/i;
const SKIP_RE = /\b(who is hiring|who wants to be hired|hiring thread|who'?s hiring)\b/i;

function enabled(env) {
  const flag = env && env.COPIER_ENABLED;
  return flag === "1" || flag === "true";
}

function intEnv(env, key, fallback) {
  const raw = env && env[key];
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw || ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function nowMs(env, options) {
  if (options && typeof options.now === "number") return options.now;
  if (env && typeof env.now === "number") return env.now;
  return Date.now();
}

export function isNeedText(text) {
  const note = trimNote(text);
  if (!note) return false;
  if (SKIP_RE.test(note)) return false;
  return NEED_RE.test(note);
}

export function sourceSuffix(sourceUrl) {
  return ` from ${sourceUrl}`;
}

export function buildCopiedNote(text, sourceUrl) {
  const suffix = sourceSuffix(sourceUrl);
  const room = MAX_NOTE - suffix.length;
  if (room < 1) return null;
  const body = stripContacts(text).slice(0, room).trim();
  if (!body) return null;
  const note = `${body}${suffix}`;
  if (filterNote(note) || !isNeedText(body)) return null;
  return note;
}

function hnUrl(hit) {
  const id = hit && (hit.objectID || hit.story_id);
  if (!id) return null;
  return `https://news.ycombinator.com/item?id=${id}`;
}

export function parseHnHits(payload, now, maxAgeMs) {
  const hits = payload && Array.isArray(payload.hits) ? payload.hits : [];
  const items = [];
  for (const hit of hits) {
    const created = Number(hit.created_at_i) * 1000;
    const title = trimNote(hit.title);
    const source_url = hnUrl(hit);
    if (!title || !source_url || !Number.isFinite(created)) continue;
    if (now - created > maxAgeMs) continue;
    items.push({ source_url, text: title, created_at: created, source: "hn" });
  }
  return items;
}

export function parseStackHits(payload, now, maxAgeMs) {
  const questions = payload && Array.isArray(payload.items) ? payload.items : [];
  const items = [];
  for (const q of questions) {
    const created = Number(q.creation_date) * 1000;
    const title = trimNote(q.title);
    const source_url = typeof q.link === "string" ? q.link : null;
    if (!title || !source_url || !Number.isFinite(created)) continue;
    if (now - created > maxAgeMs) continue;
    items.push({ source_url, text: title, created_at: created, source: "stackexchange" });
  }
  return items;
}

export function parseGithubHits(payload, now, maxAgeMs) {
  const issues = payload && Array.isArray(payload.items) ? payload.items : [];
  const items = [];
  for (const issue of issues) {
    const created = Date.parse(issue.created_at);
    const title = trimNote(issue.title);
    const source_url = typeof issue.html_url === "string" ? issue.html_url : null;
    if (!title || !source_url || !Number.isFinite(created)) continue;
    if (issue.pull_request) continue;
    if (now - created > maxAgeMs) continue;
    items.push({ source_url, text: title, created_at: created, source: "github" });
  }
  return items;
}

function sinceUnix(now, maxAgeMs) {
  return Math.floor((now - maxAgeMs) / 1000);
}

function sinceIsoDate(now, maxAgeMs) {
  return new Date(now - maxAgeMs).toISOString().slice(0, 10);
}

export function sourceRequests(now, maxAgeMs, env = {}) {
  const since = sinceUnix(now, maxAgeMs);
  const sinceDay = sinceIsoDate(now, maxAgeMs);
  const seKey = env.STACKEXCHANGE_KEY ? `&key=${encodeURIComponent(env.STACKEXCHANGE_KEY)}` : "";
  return [
    {
      source: "hn",
      url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent("looking for OR need")}&tags=(story,ask_hn)&hitsPerPage=30&numericFilters=${encodeURIComponent(`created_at_i>${since}`)}`,
      parse: parseHnHits,
    },
    {
      source: "stackexchange",
      url: `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&q=${encodeURIComponent("looking for")}&site=stackoverflow&fromdate=${since}&pagesize=20&filter=default${seKey}`,
      parse: parseStackHits,
    },
    {
      source: "github",
      url: `https://api.github.com/search/issues?q=${encodeURIComponent(`label:"help wanted" is:issue is:open created:>${sinceDay}`)}&sort=created&order=desc&per_page=20`,
      parse: parseGithubHits,
    },
  ];
}

async function readJson(fetchFn, url) {
  const response = await fetchFn(url, {
    headers: {
      accept: "application/json",
      "user-agent": COPIER_USER_AGENT,
    },
  });
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function insertCopy(env, item, now) {
  const note = buildCopiedNote(item.text, item.source_url);
  if (!note) return { status: "skipped" };
  const body = note.slice(0, note.length - sourceSuffix(item.source_url).length);
  const note_hash = await sha256Hex(normalizeNote(body));

  if (await findPostBySourceUrl(env.DB, item.source_url)) return { status: "duplicate" };
  if (await findPostByNoteHash(env.DB, note_hash)) return { status: "duplicate" };
  if (await findPostByNote(env.DB, note)) return { status: "duplicate" };

  const discarded = newSecret();
  const inserted = await insertPost(env.DB, {
    id: newId(),
    kind: "need",
    note,
    secret_hash: await sha256Hex(discarded),
    created_at: now,
    source_url: item.source_url,
    note_hash,
  });
  if (!inserted.ok) return { status: "duplicate" };
  return { status: "copied", note, source_url: item.source_url };
}

/**
 * Pull recent public needs from the allowlisted APIs and insert copies.
 * Off unless COPIER_ENABLED is 1/true. No live network when fetchFn is injected.
 */
export async function runCopier(env, options = {}) {
  if (!enabled(env)) return { enabled: false, copied: 0, items: [] };

  const now = nowMs(env, options);
  const maxAge = intEnv(env, "COPIER_MAX_AGE_MS", COPIER_MAX_AGE_MS);
  const maxRun = intEnv(env, "COPIER_MAX_PER_RUN", COPIER_MAX_PER_RUN);
  const maxSource = intEnv(env, "COPIER_MAX_PER_SOURCE", COPIER_MAX_PER_SOURCE);
  const fetchFn = options.fetchFn || globalThis.fetch;
  const perSource = new Map();
  const items = [];
  let copied = 0;

  for (const req of sourceRequests(now, maxAge, env)) {
    const payload = await readJson(fetchFn, req.url);
    const found = req.parse(payload, now, maxAge);
    for (const item of found) {
      if (copied >= maxRun) {
        return { enabled: true, copied, items };
      }
      const used = perSource.get(item.source) || 0;
      if (used >= maxSource) continue;
      const result = await insertCopy(env, item, now);
      if (result.status === "copied") {
        copied += 1;
        perSource.set(item.source, used + 1);
        items.push({ source_url: result.source_url, note: result.note });
      }
    }
  }

  return { enabled: true, copied, items };
}
