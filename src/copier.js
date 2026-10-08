import { newId, newSecret, sha256Hex } from "./crypto.js";
import {
  countRepoCopiesSince,
  findPostByNote,
  findPostByNoteHash,
  findPostBySourceUrl,
  insertCopierRun,
  insertPost,
  insertRepoCopy,
} from "./db.js";
import { filterNote, normalizeNote, stripContacts, trimNote } from "./filter.js";
import {
  COPIER_MAX_AGE_MS,
  COPIER_MAX_PER_REPO,
  COPIER_MAX_PER_REPO_DAY,
  COPIER_MAX_PER_RUN,
  COPIER_MAX_PER_SOURCE,
  COPIER_REPO_DAY_MS,
  MAX_NOTE,
} from "./limits.js";

export const COPIER_USER_AGENT = "needhave-copier/1.0 (+https://needhave.io)";

const NEED_RE =
  /\b(need|needed|needs|looking for|look for|seeking|wanted|help wanted|does anyone(?: have| know)|anyone (?:have|know|interested)|in search of|be my cofounder)\b/i;
const SKIP_RE =
  /\b(who is hiring|who wants to be hired|hiring thread|who'?s hiring|tell hn:|show hn:|willing to relocate|looking for full-time|résumé\/cv|resume\/cv)\b/i;
const ASK_RE = /^(ask hn:|ask:)/i;
const QUESTION_RE =
  /^(how|what|why|when|where|which|who|is there|are there|can i|can we|does|do you|has anyone|anyone)\b/i;
const SEEK_RE =
  /\b(looking for|seeking|need|needed|needs|is there|are there|where can i|how (?:do|can) i|can (?:i|someone|anyone)|does anyone|anyone (?:have|know)|recommend|be my cofounder|in search of|what(?:'s| is) the best)\b/i;
const SE_SEEK_RE =
  /\b(looking for|is there|are there|can i|can we|how do i|how can i|how to|does anyone|recommend|where can i|in search of|what(?:'s| is) the best)\b/i;
const GH_BUSY_RE =
  /\b(typo|readme|add[- ]my[- ]name|add me as contributor|update readme)\b/i;
const GH_STACK_RE = /traceback|stack trace|\berror:\s|exception\b|at [a-z0-9_$.]+\(/i;
const GH_ASK_RE = /\b(need|please|can someone|looking for|how (?:do|can)|help wanted|would like)\b/i;
const JOKE_RE = /\b(curry from the moon|from the moon)\b/i;
const VAGUE_ONLY_RE =
  /^(ask hn:\s*)?(looking for help|need help|please help|help wanted|seeking (help|answers|advice)|need (help|advice|answers)|be my cofounder)\s*[.!?]*$/i;
const GENERIC_TOKEN_RE =
  /^(help|someone|somebody|something|anything|anyone|please|thanks|thank|advice|answers|support|input|thoughts|ideas|cofounder|partner|person|people|guys|just|really|very|cool)$/i;
const GH_BULK_TASK_RE = /^(add|document|implement|update|create|write|refactor|rename|extract|move)\b/i;
const COMMENT_NEED_RE =
  /\b(i need|looking for (?:someone|a |an |the )|does anyone know of|recommend a )\b/i;

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

export function flattenText(text) {
  return decodeEntities(text)
    .replace(/[\u00a0\u202f\u2007\u2009]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(text) {
  return decodeEntities(String(text || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

export function isNeedText(text) {
  const note = flattenText(text);
  if (!note) return false;
  if (SKIP_RE.test(note)) return false;
  return NEED_RE.test(note);
}

export function isQuestionNeed(text) {
  const note = flattenText(text);
  if (!note || SKIP_RE.test(note)) return false;
  if (note.endsWith("?")) return true;
  if (ASK_RE.test(note)) return true;
  if (QUESTION_RE.test(note)) return true;
  return NEED_RE.test(note);
}

export function isAskNeed(text) {
  const note = flattenText(text);
  if (!note || SKIP_RE.test(note)) return false;
  const rest = note.replace(/^(ask hn:|ask:)\s*/i, "").trim();
  return Boolean(rest) && SEEK_RE.test(rest);
}

export function isSeNeed(text) {
  const note = flattenText(text);
  if (!note || SKIP_RE.test(note)) return false;
  return SE_SEEK_RE.test(note);
}

export function isCommentNeed(text) {
  const note = flattenText(text);
  if (!note || SKIP_RE.test(note)) return false;
  if (note.length < 80) return false;
  return COMMENT_NEED_RE.test(note);
}

export function hasConcreteObject(text) {
  const note = flattenText(text).replace(/^(ask hn:|ask:)\s*/i, "");
  if (!note || JOKE_RE.test(note) || VAGUE_ONLY_RE.test(note)) return false;
  const stripped = note
    .replace(
      /\b(looking for|look for|seeking|needed?|needs|please|help|wanted|does anyone|anyone know|in search of|be my)\b/gi,
      " ",
    )
    .replace(/[^a-z0-9]+/gi, " ");
  const tokens = stripped.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.some((token) => token.length >= 4 && !GENERIC_TOKEN_RE.test(token));
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
  if (item.source === "stackexchange") return isSeNeed(body);
  if (item.kind === "comment") return isCommentNeed(body) && hasConcreteObject(body);
  if (item.kind === "ask") return isAskNeed(body) && hasConcreteObject(body);
  return isNeedText(body) && hasConcreteObject(body);
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
    if (kind === "comment") continue;
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

export function githubRepo(url) {
  const match = String(url || "").match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\//i);
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : null;
}

export function isRoutineTaskTitle(title) {
  const note = flattenText(title);
  if (!note) return false;
  return GH_BULK_TASK_RE.test(note) && note.length < 80;
}

export function bulkReposFromIssues(issues) {
  const counts = new Map();
  for (const issue of issues) {
    const repo = githubRepo(issue.html_url);
    if (!repo || !isRoutineTaskTitle(issue.title)) continue;
    counts.set(repo, (counts.get(repo) || 0) + 1);
  }
  const bulk = new Set();
  for (const [repo, n] of counts) {
    if (n >= 3) bulk.add(repo);
  }
  return bulk;
}

export function isGithubJunk(issue) {
  const labels = githubLabels(issue);
  if (labels.includes("hacktoberfest")) return true;
  const title = trimNote(issue.title);
  const body = issue.body || "";
  if (GH_BUSY_RE.test(`${title}\n${body}`)) return true;
  if (body.trim().length < 40) return true;
  if (/^\[canary\]/i.test(title) || /\bboard-health\b/i.test(title)) return true;
  const blob = `${title}\n${body}`;
  if (!GH_ASK_RE.test(blob)) return true;
  if (labels.includes("bug") && GH_STACK_RE.test(body) && !GH_ASK_RE.test(blob)) return true;
  if (labels.includes("good first issue") && !labels.includes("help wanted")) return true;
  if (isLowQualityRepo(issue)) return true;
  return false;
}

export function parseGithubHits(payload, now, maxAgeMs) {
  const issues = payload && Array.isArray(payload.items) ? payload.items : [];
  const recent = [];
  for (const issue of issues) {
    const created = Date.parse(issue.created_at);
    const title = trimNote(issue.title);
    const source_url = typeof issue.html_url === "string" ? issue.html_url : null;
    if (!title || !source_url || !Number.isFinite(created)) continue;
    if (issue.pull_request) continue;
    if (now - created > maxAgeMs) continue;
    recent.push(issue);
  }
  const bulk = bulkReposFromIssues(recent);
  const items = [];
  for (const issue of recent) {
    const source_url = issue.html_url;
    const repo = githubRepo(source_url);
    if (repo && bulk.has(repo)) continue;
    if (isGithubJunk(issue)) continue;
    items.push({
      source_url,
      text: trimNote(issue.title),
      created_at: Date.parse(issue.created_at),
      source: "github",
      repo,
    });
  }
  return items;
}

function sinceUnix(now, maxAgeMs) {
  return Math.floor((now - maxAgeMs) / 1000);
}

function sinceIsoDate(now, maxAgeMs) {
  return new Date(now - maxAgeMs).toISOString().slice(0, 10);
}

export function redactCopierUrl(url) {
  return String(url || "").replace(/([?&]key=)[^&]*/gi, "$1redacted");
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
    ...["how do I", "how can I", "is there", "looking for"].map((title) => ({
      source: "stackexchange",
      url: `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=creation&site=stackoverflow&fromdate=${since}&pagesize=30&filter=withbody&title=${encodeURIComponent(title)}${seKey}`,
      parse: parseStackHits,
    })),
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
  try {
    const response = await fetchFn(url, { headers: requestHeaders(url) });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, ok: response.ok, body };
  } catch {
    return { status: 0, ok: false, body: null, error: "network" };
  }
}

function emptySkipReasons() {
  return { throttled: 0, filter: 0, duplicate: 0, cap: 0 };
}

function emptySourceStat(source) {
  return {
    source,
    http_status: null,
    error: null,
    backoff: null,
    quota_remaining: null,
    candidates: 0,
    would_copy: 0,
    copied: 0,
    skip_reasons: emptySkipReasons(),
  };
}

function recordFetch(stat, fetched) {
  const body = fetched.body && typeof fetched.body === "object" ? fetched.body : {};
  stat.http_status = fetched.status;
  if (Number.isFinite(body.backoff)) stat.backoff = body.backoff;
  if (Number.isFinite(body.quota_remaining)) stat.quota_remaining = body.quota_remaining;
  const named = body.error_name || body.error_message || fetched.error || null;
  if (!fetched.ok) {
    stat.error = named || `http_${fetched.status}`;
  } else if (body.error_id || body.error_name) {
    stat.error = named || `error_${body.error_id}`;
  } else if (Number.isFinite(body.backoff)) {
    stat.error = stat.error || "backoff";
  }
  if (!fetched.ok || body.error_id || (Number.isFinite(body.backoff) && !fetched.ok)) {
    stat.skip_reasons.throttled += 1;
  }
}

export function publicSourceStats(stats) {
  return Object.values(stats).map((stat) => ({
    source: stat.source,
    http_status: stat.http_status,
    error: stat.error,
    backoff: stat.backoff,
    quota_remaining: stat.quota_remaining,
    candidates: stat.candidates,
    would_copy: stat.would_copy,
    copied: stat.copied,
    skip_reasons: { ...stat.skip_reasons },
  }));
}

function logCopierRun(stats) {
  console.log(JSON.stringify({ copier_run: publicSourceStats(stats) }));
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
  if (item.source === "github" && item.repo) {
    await insertRepoCopy(env.DB, {
      source_url: item.source_url,
      repo: item.repo,
      copied_at: now,
    });
  }
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
      sources: [],
    };
  }

  const now = nowMs(env, options);
  const maxAge = intEnv(env, "COPIER_MAX_AGE_MS", COPIER_MAX_AGE_MS);
  const maxRun = intEnv(env, "COPIER_MAX_PER_RUN", COPIER_MAX_PER_RUN);
  const maxSource = intEnv(env, "COPIER_MAX_PER_SOURCE", COPIER_MAX_PER_SOURCE);
  const maxRepo = intEnv(env, "COPIER_MAX_PER_REPO", COPIER_MAX_PER_REPO);
  const maxRepoDay = intEnv(env, "COPIER_MAX_PER_REPO_DAY", COPIER_MAX_PER_REPO_DAY);
  const fetchFn = options.fetchFn || globalThis.fetch;
  const dryRun = dryRunEnabled(env, options);
  const perSource = emptyBySource();
  const perRepo = new Map();
  const seen = new Set();
  const seenHashes = new Set();
  const items = [];
  const stats = {
    hn: emptySourceStat("hn"),
    stackexchange: emptySourceStat("stackexchange"),
    github: emptySourceStat("github"),
  };
  let copied = 0;

  for (const req of sourceRequests(now, maxAge, env)) {
    const fetched = await readJson(fetchFn, req.url);
    const stat = stats[req.source] || emptySourceStat(req.source);
    stats[req.source] = stat;
    recordFetch(stat, fetched);
    const found =
      fetched.ok && fetched.body && !fetched.body.error_id ? req.parse(fetched.body, now, maxAge) : [];
    stat.candidates += found.length;
    for (const item of found) {
      if (seen.has(item.source_url)) continue;
      seen.add(item.source_url);
      if (copied >= maxRun) {
        stat.skip_reasons.cap += 1;
        continue;
      }
      const used = perSource[item.source] || 0;
      if (used >= maxSource) {
        stat.skip_reasons.cap += 1;
        continue;
      }
      if (item.source === "github" && item.repo) {
        const usedRepo = perRepo.get(item.repo) || 0;
        if (usedRepo >= maxRepo) {
          stat.skip_reasons.cap += 1;
          continue;
        }
        const dayCount = await countRepoCopiesSince(env.DB, item.repo, now - COPIER_REPO_DAY_MS);
        if (dayCount >= maxRepoDay) {
          stat.skip_reasons.cap += 1;
          continue;
        }
      }
      const result = await insertCopy(env, item, now, dryRun, seenHashes);
      if (result.status === "copied") {
        copied += 1;
        stat.would_copy += 1;
        stat.copied += dryRun ? 0 : 1;
        perSource[item.source] = used + 1;
        if (item.source === "github" && item.repo) {
          perRepo.set(item.repo, (perRepo.get(item.repo) || 0) + 1);
        }
        items.push({
          source: result.source,
          source_url: result.source_url,
          note: result.note,
        });
      } else if (result.status === "duplicate") {
        stat.skip_reasons.duplicate += 1;
      } else {
        stat.skip_reasons.filter += 1;
      }
    }
  }

  const sources = publicSourceStats(stats);
  logCopierRun(stats);
  for (const stat of sources) {
    await insertCopierRun(env.DB, {
      id: newId(),
      started_at: now,
      dry_run: dryRun,
      source: stat.source,
      http_status: stat.http_status,
      error: stat.error,
      backoff: stat.backoff,
      quota_remaining: stat.quota_remaining,
      candidates: stat.candidates,
      would_copy: stat.would_copy,
      copied: stat.copied,
      skip_reasons: JSON.stringify(stat.skip_reasons),
    });
  }

  return resultShape({ enabled: true, dryRun, copied, items, perSource, sources });
}

function resultShape({ enabled, dryRun, copied, items, perSource, sources }) {
  return {
    enabled,
    dry_run: Boolean(dryRun),
    copied: dryRun ? 0 : copied,
    would_copy: copied,
    by_source: { ...perSource },
    items,
    sources: sources || [],
  };
}
