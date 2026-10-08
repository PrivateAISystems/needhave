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
  /\b(need|needed|needs|looking for|look for|seeking|wanted|help wanted|does anyone(?: have| know)|anyone (?:have|know|interested)|in search of|be my cofounder)\b/i;
const SKIP_RE =
  /\b(who is hiring|who wants to be hired|hiring thread|who'?s hiring|tell hn:|show hn:)\b/i;
const ASK_RE = /^(ask hn:|ask:)/i;
const QUESTION_RE =
  /^(how|what|why|when|where|which|who|is there|are there|can i|can we|does|do you|has anyone|anyone)\b/i;
const GH_BUSY_RE =
  /\b(typo|readme|add[- ]my[- ]name|add me as contributor|update readme)\b/i;
const GH_STACK_RE = /traceback|stack trace|\berror:\s|exception\b|at [a-z0-9_$.]+\(/i;
const GH_ASK_RE = /\b(need|please|can someone|looking for|how (?:do|can)|help wanted|would like)\b/i;

function enabled(env) {
  const flag = env && env.COPIER_ENABLED;
  return flag === "1" || flag === "true";
}

function dryRunEnabled(env, options) {
  if (options && options.dryRun) return true;
  const flag = env && env.COPIER_DRY_RUN;
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

export function decodeEntities(text) {
  return String(text || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function stripHtml(text) {
  return decodeEntities(String(text || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function isNeedText(text) {
  const note = trimNote(text);
  if (!note) return false;
  if (SKIP_RE.test(note)) return false;
  return NEED_RE.test(note);
}

export function isQuestionNeed(text) {
  const note = trimNote(decodeEntities(text));
  if (!note || SKIP_RE.test(note)) return false;
  if (note.endsWith("?")) return true;
  if (ASK_RE.test(note)) return true;
  if (QUESTION_RE.test(note)) return true;
  return NEED_RE.test(note);
}

export function isAskNeed(text) {
  const note = trimNote(decodeEntities(text));
  if (!note || SKIP_RE.test(note)) return false;
  const rest = note.replace(/^(ask hn:|ask:)\s*/i, "").trim();
  return Boolean(rest) && isQuestionNeed(rest);
}

export function isCommentNeed(text) {
  const note = trimNote(text);
  if (!note || SKIP_RE.test(note)) return false;
  return /\b(looking for|seeking|anyone know|does anyone|in search of|anyone (?:have|know))\b/i.test(
    note,
  );
}

export function sourceSuffix(item) {
  if (item.source === "stackexchange" && item.author) {
    return ` from ${item.source_url} (by ${item.author}, CC BY-SA)`;
  }
  return ` from ${item.source_url}`;
}

export function buildCopiedNote(item) {
  const suffix = sourceSuffix(item);
  const room = MAX_NOTE - suffix.length;
  if (room < 1) return null;
  const body = stripContacts(stripHtml(item.text)).slice(0, room).trim();
  if (!body) return null;
  if (!acceptsSourceText(item, body)) return null;
  const note = `${body}${suffix}`;
  if (filterNote(note)) return null;
  return note;
}

function acceptsSourceText(item, body) {
  if (item.source === "github") return true;
  if (item.source === "stackexchange") return isQuestionNeed(body);
  if (item.kind === "ask") return isAskNeed(body);
  if (item.kind === "comment") return isCommentNeed(body);
  return isNeedText(body);
}

function hnKind(hit) {
  const tags = Array.isArray(hit._tags) ? hit._tags : [];
  if (tags.includes("ask_hn") || ASK_RE.test(hit.title || "")) return "ask";
  if (tags.includes("comment") || hit.comment_text) return "comment";
  return "story";
}

function hnUrl(hit) {
  const id = hit && (hit.objectID || hit.story_id);
  if (!id) return null;
  return `https://news.ycombinator.com/item?id=${id}`;
}

function hnText(hit) {
  if (hnKind(hit) === "comment") {
    return hit.comment_text ? stripHtml(hit.comment_text) : "";
  }
  if (trimNote(hit.title)) return decodeEntities(hit.title);
  if (hit.story_text) return stripHtml(hit.story_text);
  return "";
}

export function parseHnHits(payload, now, maxAgeMs) {
  const hits = payload && Array.isArray(payload.hits) ? payload.hits : [];
  const items = [];
  for (const hit of hits) {
    const created = Number(hit.created_at_i) * 1000;
    const text = hnText(hit);
    const source_url = hnUrl(hit);
    const kind = hnKind(hit);
    if (!text || !source_url || !Number.isFinite(created)) continue;
    if (now - created > maxAgeMs) continue;
    items.push({ source_url, text, created_at: created, source: "hn", kind });
  }
  return items;
}

export function parseStackHits(payload, now, maxAgeMs) {
  const questions = payload && Array.isArray(payload.items) ? payload.items : [];
  const items = [];
  for (const q of questions) {
    const created = Number(q.creation_date) * 1000;
    const title = trimNote(decodeEntities(q.title));
    const source_url = typeof q.link === "string" ? q.link : null;
    const author = trimNote(decodeEntities(q.owner && q.owner.display_name));
    if (!title || !source_url || !Number.isFinite(created)) continue;
    if (now - created > maxAgeMs) continue;
    if (q.closed_reason || q.closed_date) continue;
    if (Number(q.score) < 0) continue;
    items.push({
      source_url,
      text: title,
      created_at: created,
      source: "stackexchange",
      author: author || "unknown",
      unanswered: !q.is_answered && Number(q.answer_count || 0) === 0,
    });
  }
  items.sort((a, b) => Number(b.unanswered) - Number(a.unanswered) || b.created_at - a.created_at);
  return items;
}

function githubLabels(issue) {
  return (issue.labels || []).map((label) => String(label.name || "").toLowerCase());
}

function isLowQualityRepo(issue) {
  const repo = issue.repository;
  if (!repo) return false;
  const stars = Number(repo.stargazers_count || 0);
  const desc = trimNote(repo.description);
  return stars === 0 && !desc;
}

export function isGithubJunk(issue) {
  const labels = githubLabels(issue);
  if (labels.includes("hacktoberfest")) return true;
  const title = trimNote(issue.title);
  const body = issue.body || "";
  if (GH_BUSY_RE.test(`${title}\n${body}`)) return true;
  if (body.trim().length < 40) return true;
  const blob = `${title}\n${body}`;
  if (labels.includes("bug") && GH_STACK_RE.test(body) && !GH_ASK_RE.test(blob)) return true;
  if (labels.includes("good first issue") && !labels.includes("help wanted")) return true;
  if (isLowQualityRepo(issue)) return true;
  return false;
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
    if (isGithubJunk(issue)) continue;
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
  const numeric = encodeURIComponent(`created_at_i>${since}`);
  return [
    {
      source: "hn",
      url: `https://hn.algolia.com/api/v1/search_by_date?tags=ask_hn&hitsPerPage=50&numericFilters=${numeric}`,
      parse: parseHnHits,
    },
    {
      source: "hn",
      url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent("looking for")}&tags=story&hitsPerPage=30&numericFilters=${numeric}`,
      parse: parseHnHits,
    },
    {
      source: "hn",
      url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent("seeking")}&tags=story&hitsPerPage=20&numericFilters=${numeric}`,
      parse: parseHnHits,
    },
    {
      source: "hn",
      url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent("looking for")}&tags=comment&hitsPerPage=30&numericFilters=${numeric}&restrictSearchableAttributes=comment_text`,
      parse: parseHnHits,
    },
    {
      source: "hn",
      url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent("seeking")}&tags=comment&hitsPerPage=20&numericFilters=${numeric}&restrictSearchableAttributes=comment_text`,
      parse: parseHnHits,
    },
    {
      source: "hn",
      url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent("anyone know")}&tags=comment&hitsPerPage=20&numericFilters=${numeric}&restrictSearchableAttributes=comment_text`,
      parse: parseHnHits,
    },
    {
      source: "stackexchange",
      url: `https://api.stackexchange.com/2.3/questions?order=desc&sort=creation&site=stackoverflow&fromdate=${since}&pagesize=50&filter=withbody${seKey}`,
      parse: parseStackHits,
    },
    {
      source: "github",
      url: `https://api.github.com/search/issues?q=${encodeURIComponent(`label:"help wanted" is:issue is:open archived:false created:>${sinceDay} -label:hacktoberfest`)}&sort=created&order=desc&per_page=30`,
      parse: parseGithubHits,
    },
  ];
}

function requestHeaders(url) {
  const headers = {
    accept: "application/json",
    "user-agent": COPIER_USER_AGENT,
  };
  if (url.startsWith("https://api.github.com/")) {
    headers.accept = "application/vnd.github+json";
  }
  return headers;
}

async function readJson(fetchFn, url) {
  const response = await fetchFn(url, { headers: requestHeaders(url) });
  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function insertCopy(env, item, now, dryRun, seenHashes) {
  const note = buildCopiedNote(item);
  if (!note) return { status: "skipped" };
  const body = note.slice(0, note.length - sourceSuffix(item).length);
  const note_hash = await sha256Hex(normalizeNote(body));

  if (seenHashes.has(note_hash)) return { status: "duplicate" };
  if (await findPostBySourceUrl(env.DB, item.source_url)) return { status: "duplicate" };
  if (await findPostByNoteHash(env.DB, note_hash)) return { status: "duplicate" };
  if (await findPostByNote(env.DB, note)) return { status: "duplicate" };

  seenHashes.add(note_hash);
  if (dryRun) {
    return { status: "copied", note, source_url: item.source_url, source: item.source };
  }

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
  return { status: "copied", note, source_url: item.source_url, source: item.source };
}

function emptyBySource() {
  return { hn: 0, stackexchange: 0, github: 0 };
}

/**
 * Pull recent public needs from the allowlisted APIs and insert copies.
 * Off unless COPIER_ENABLED is 1/true. Dry-run reports would-copy counts
 * and does not insert. No live network when fetchFn is injected.
 */
export async function runCopier(env, options = {}) {
  if (!enabled(env) && !dryRunEnabled(env, options)) {
    return {
      enabled: false,
      dry_run: false,
      copied: 0,
      would_copy: 0,
      by_source: emptyBySource(),
      items: [],
    };
  }

  const now = nowMs(env, options);
  const maxAge = intEnv(env, "COPIER_MAX_AGE_MS", COPIER_MAX_AGE_MS);
  const maxRun = intEnv(env, "COPIER_MAX_PER_RUN", COPIER_MAX_PER_RUN);
  const maxSource = intEnv(env, "COPIER_MAX_PER_SOURCE", COPIER_MAX_PER_SOURCE);
  const fetchFn = options.fetchFn || globalThis.fetch;
  const dryRun = dryRunEnabled(env, options);
  const perSource = emptyBySource();
  const seen = new Set();
  const seenHashes = new Set();
  const items = [];
  let copied = 0;

  for (const req of sourceRequests(now, maxAge, env)) {
    const payload = await readJson(fetchFn, req.url);
    const found = req.parse(payload, now, maxAge);
    for (const item of found) {
      if (copied >= maxRun) {
        return resultShape({ enabled: true, dryRun, copied, items, perSource });
      }
      if (seen.has(item.source_url)) continue;
      seen.add(item.source_url);
      const used = perSource[item.source] || 0;
      if (used >= maxSource) continue;
      const result = await insertCopy(env, item, now, dryRun, seenHashes);
      if (result.status === "copied") {
        copied += 1;
        perSource[item.source] = used + 1;
        items.push({
          source: result.source,
          source_url: result.source_url,
          note: result.note,
        });
      }
    }
  }

  return resultShape({ enabled: true, dryRun, copied, items, perSource });
}

function resultShape({ enabled, dryRun, copied, items, perSource }) {
  return {
    enabled,
    dry_run: Boolean(dryRun),
    copied: dryRun ? 0 : copied,
    would_copy: copied,
    by_source: { ...perSource },
    items,
  };
}
