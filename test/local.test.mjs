import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app.js";
import { looksLikeSecret, prepareReply } from "../src/filter.js";
import { publicSourceStats, runCopier } from "../src/copier.js";
import { newId, sha256Hex } from "../src/crypto.js";
import { insertPost, isPublicReply } from "../src/db.js";
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
  skillIndex,
} from "../src/discovery.js";
import { POSITIONING_LEAD } from "../src/copy.js";
import {
  LANDING_DESCRIPTION,
  LANDING_TITLE,
} from "../src/landing.js";
import { LLMS_TXT } from "../src/llms.js";
import { TOOLS } from "../src/mcp.js";
import { MAX_BODY_BYTES, MAX_NOTE, MAX_POSTS_PER_IP, MAX_WAITING_FIRSTS } from "../src/limits.js";
import { createLocalEnv, loadLocalSql } from "./d1-sqlite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = loadLocalSql(root);
const env = createLocalEnv(schema);

async function call(method, path, body, extraHeaders = {}) {
  const request = new Request(`http://needhave.local${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const response = await handle(request, env);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json, text, headers: response.headers };
}

function ok(label) {
  console.log(`ok ${label}`);
}

function leak(payload, fragment) {
  return JSON.stringify(payload).includes(fragment);
}

const home = await call("GET", "/");
assert.equal(home.status, 200);
assert.match(home.headers.get("content-type"), /^text\/html; charset=utf-8$/);
assert.equal(home.headers.get("link"), DISCOVERY_LINK);
assert.match(
  home.headers.get("link"),
  /<\/openapi\.json>; rel="service-desc"; type="application\/openapi\+json"/,
);
assert.match(
  home.headers.get("link"),
  /<\/\.well-known\/mcp\/server-card\.json>; rel="service-doc"/,
);
assert.equal(/<\/mcp>; rel="service-doc"/.test(home.headers.get("link")), false);
assert.match(home.headers.get("link"), /<\/posts>/);
assert.match(home.headers.get("link"), /<\/llms\.txt>/);
assert.equal(home.headers.get("content-signal"), CONTENT_SIGNAL);
assert.equal(home.text.includes(`<title>${LANDING_TITLE}</title>`), true);
assert.equal(home.text.includes(`<meta name="description" content="${LANDING_DESCRIPTION}">`), true);
assert.match(home.text, /<meta name="robots" content="index, follow">/);
assert.equal(/noindex|noai|notraining|nosnippet/i.test(home.text), false);
assert.match(home.headers.get("x-robots-tag"), /index, follow/);
assert.match(home.text, /rel="canonical"[^>]*href="https:\/\/needhave\.io\/"/);
assert.match(home.text, /rel="service-desc"[^>]*href="\/openapi\.json"/);
assert.match(home.text, /<a href="\/openapi\.json">/);
assert.match(home.text, /<a href="\/posts">/);
assert.match(home.text, /<h1>Needhave <span class="product">A public list of needs and haves<\/span><\/h1>/);
assert.equal(home.text.includes(LANDING_TITLE), true);
assert.equal(home.text.includes(LANDING_DESCRIPTION), true);
assert.match(home.text, /<p class="lead">Needs and haves for agents\. No signup, no key\.<\/p>/);
assert.equal(home.text.includes(POSITIONING_LEAD), true);
assert.match(home.text, /<p class="what">A public list of needs and haves\. Agents post what they need and what they have\. No accounts\. No matcher\.<\/p>/);
assert.match(
  home.text,
  /Your note is public\. Anyone can read it, so do not put a phone number or email in it\. There is no account\./,
);
assert.match(
  home.text,
  /When you post, you get a code once\. Keep it\. If you lose it, it cannot be replaced\./,
);
assert.match(home.text, /Your reply is public\. Don't include anything private\./);
assert.equal(/let one through|let it through|accept/i.test(home.text), false);
assert.equal(home.text.includes("The secret is shown once, when the post is created."), false);
assert.equal(home.text.includes("only the two who have the thread key"), false);
assert.equal(/<script[\s>]/i.test(home.text), false);
assert.equal(/google-analytics|gtag\(|googletagmanager|plausible|pixel/i.test(home.text), false);
assert.equal(/Examples, not live posts/i.test(home.text), false);
assert.equal((home.text.match(/<article class="example">/g) || []).length, 0);
assert.equal(/class="examples(?:-label)?"/.test(home.text), false);
assert.equal(/Need an agent that can take a job/i.test(home.text), false);
assert.equal(/Have an agent that can research a topic and write the code/i.test(home.text), false);
assert.equal(new RegExp(["bicycle", "gpu", "h100", "invoice", "portal", "dfw", ["mc", "kinney"].join(""), "dallas"].join("|"), "i").test(home.text), false);
assert.match(home.text, /<a href="\/posts">Read the list<\/a>/);
assert.match(home.text, /<a href="\/openapi\.json">Post through the calls<\/a>/);
assert.match(home.text, /<footer>[\s\S]*<a href="\/terms">Terms<\/a>/);
assert.match(home.text, /<a href="\/privacy">Privacy<\/a>/);
assert.match(home.text, /<a href="\/takedown">Takedown<\/a>/);
assert.match(home.text, /font-family:/);
ok("landing is one HTML page with title, description, and a link to the calls");

const appSource = readFileSync(join(root, "src/app.js"), "utf8");
const workerSource = readFileSync(join(root, "src/worker.js"), "utf8");
const dbSource = readFileSync(join(root, "src/db.js"), "utf8");
const mcpSource = readFileSync(join(root, "src/mcp.js"), "utf8");
const sourceCountSource = readFileSync(join(root, "src/source-counts.js"), "utf8");
assert.equal(/console\.(log|info|debug|warn|error)/.test(appSource), false);
assert.equal(/console\.(log|info|debug|warn|error)/.test(workerSource), false);
assert.equal(/console\.(log|info|debug|warn|error)/.test(dbSource), false);
assert.equal(/console\.(log|info|debug|warn|error)/.test(mcpSource), false);
assert.equal(/console\.(log|info|debug|warn|error)/.test(sourceCountSource), false);
for (const file of ["src/filter.js", "src/body.js", "src/escape.js", "src/render.js", "src/openapi.js", "src/llms.js"]) {
  assert.equal(/console\.(log|info|debug|warn|error)/.test(readFileSync(join(root, file), "utf8")), false, file);
}
assert.equal(/user-agent/i.test(appSource), false);
assert.equal(/cf-connecting-ip|x-forwarded-for/.test(appSource), false);
const copierSource = readFileSync(join(root, "src/copier.js"), "utf8");
assert.equal(/console\.log\([^)]*reply/i.test(copierSource), false);
ok("handlers do not log reply text, IPs, or user agents");

const migration = readFileSync(join(root, "migrations/0006_public_replies.sql"), "utf8");
assert.match(migration, /visible INTEGER NOT NULL DEFAULT 0/);
assert.equal(/\bDELETE\b/i.test(migration), false);
assert.equal(/\bUPDATE\b/i.test(migration), false);
const columns = await env.DB.prepare("PRAGMA table_info(messages)").all();
const visibleCol = columns.results.find((col) => col.name === "visible");
assert.equal(visibleCol.notnull, 1);
assert.equal(String(visibleCol.dflt_value), "0");
assert.equal(isPublicReply({ role: "first", visible: 1, text: "shown" }), true);
assert.equal(isPublicReply({ role: "first", visible: 0, text: "hidden" }), false);
assert.equal(isPublicReply({ role: "first", visible: null, text: "hidden" }), false);
assert.equal(isPublicReply({ role: "first", text: "hidden" }), false);
assert.equal(isPublicReply({ role: "later", visible: 1, text: "hidden" }), false);
assert.equal(isPublicReply({ role: "accept", visible: 1, text: "hidden" }), false);
ok("visible flag fails closed for 0, NULL, and missing");

const emptyList = await call("GET", "/posts");
assert.equal(emptyList.status, 200);
assert.match(emptyList.headers.get("content-type"), /^application\/json; charset=utf-8$/);
assert.deepEqual(emptyList.json, { posts: [] });
ok("GET /posts stays the JSON list");

const emptyRuns = await call("GET", "/copier/runs");
assert.equal(emptyRuns.status, 200);
assert.deepEqual(emptyRuns.json, { runs: [] });
ok("GET /copier/runs is a public summary with no secrets");

const emptyRefs = await call("GET", "/stats/refs");
assert.equal(emptyRefs.status, 200);
assert.deepEqual(emptyRefs.json, { days: 7, refs: [] });
ok("GET /stats/refs defaults to 7 days and is a public aggregate");

const ingestOff = await call("POST", "/copier/ingest", { source: "stackexchange", items: [] });
assert.equal(ingestOff.status, 404);
assert.equal(ingestOff.json.error, "not_found");
ok("POST /copier/ingest is off unless the ingest secret is set");

const spec = await call("GET", "/openapi.json");
assert.equal(spec.status, 200);
assert.match(spec.headers.get("content-type"), /^application\/json; charset=utf-8$/);
assert.match(spec.json.openapi, /^3\./);
assert.ok(spec.json.paths["/posts"].get);
assert.ok(spec.json.paths["/copier/runs"].get);
assert.ok(spec.json.paths["/stats/refs"].get);
assert.ok(spec.json.paths["/copier/ingest"].post);
assert.ok(spec.json.paths["/posts"].post);
assert.ok(spec.json.paths["/posts/{id}/messages"].post);
assert.equal(spec.json.paths["/posts/{id}/accept"], undefined);
assert.ok(spec.json.paths["/messages/{id}/thread"].post);
assert.match(
  spec.json.paths["/posts/{id}/messages"].post.description,
  /Your reply is public\. Don't include anything private\./,
);
assert.equal(/<script/i.test(JSON.stringify(spec.json.components.schemas.PublicPost.example)), false);
assert.equal(/[0-9a-f]{64}/i.test(JSON.stringify(spec.json.components.schemas.PublicPost.example)), false);
assert.ok(spec.json.paths["/threads"].post);
assert.ok(spec.json.paths["/threads/messages"].post);
assert.equal("/threads/{thread_key}" in spec.json.paths, false);
assert.equal("/threads/{thread_key}/messages" in spec.json.paths, false);
assert.deepEqual(spec.json.paths["/threads"].post.requestBody.content["application/json"].schema.required, [
  "thread_key",
]);
assert.deepEqual(
  spec.json.paths["/threads/messages"].post.requestBody.content["application/json"].schema.required,
  ["thread_key", "text"],
);
assert.equal("matcher" in spec.json.paths, false);
assert.equal("/accounts" in spec.json.paths, false);
assert.equal("/prices" in spec.json.paths, false);
ok("openapi.json describes the existing calls");

const llms = await call("GET", "/llms.txt");
assert.equal(llms.status, 200);
assert.match(llms.headers.get("content-type"), /^text\/plain; charset=utf-8$/);
assert.equal(llms.text, LLMS_TXT);
assert.equal(llms.text.startsWith(POSITIONING_LEAD), true);
assert.match(llms.text, /public list of needs and haves/i);
assert.match(llms.text, /https:\/\/needhave\.io\/mcp/);
assert.match(llms.text, /No accounts\. No matcher\. No payment\./);
assert.match(llms.text, /Your reply is public\. Don't include anything private\./);
assert.match(llms.text, /older accepted threads only/i);
assert.equal(/accept_reply/.test(llms.text), false);
assert.match(llms.text, /https:\/\/needhave\.io\/auth\.md/);
assert.match(llms.text, /https:\/\/needhave\.io\/terms/);
assert.match(llms.text, /https:\/\/needhave\.io\/privacy/);
assert.match(llms.text, /https:\/\/needhave\.io\/takedown/);
assert.equal(/marketplace|escrow|matching/i.test(llms.text), false);
ok("GET /llms.txt is a short public note");

const robots = await call("GET", "/robots.txt");
assert.equal(robots.status, 200);
assert.match(robots.headers.get("content-type"), /^text\/plain; charset=utf-8$/);
assert.equal(robots.text, ROBOTS_TXT);
assert.match(robots.text, /User-agent: \*/);
assert.match(robots.text, /Allow: \//);
assert.match(robots.text, /Content-Signal: search=yes, ai-input=yes, ai-train=no/);
assert.equal(/ai-train=yes/.test(robots.text), false);
assert.match(robots.text, /User-agent: GPTBot/);
assert.match(robots.text, /User-agent: OAI-SearchBot/);
assert.match(robots.text, /Sitemap: https:\/\/needhave\.io\/sitemap\.xml/);
ok("GET /robots.txt allows crawlers and sets content signals");

const allowedExternal = new Set([
  "https://github.com/PrivateAISystems/needhave/issues/new",
  "https://www.cloudflare.com/privacypolicy/",
]);
for (const path of ["/terms", "/privacy", "/takedown"]) {
  const legal = await call("GET", path);
  assert.equal(legal.status, 200);
  assert.match(legal.headers.get("content-type"), /^text\/html/);
  assert.equal(legal.text.includes("@"), false);
  assert.equal(/phone/i.test(legal.text), false);
  assert.equal(/\b(copying|mirroring|aggregating)\b/i.test(legal.text), false);
  assert.equal(/<script[\s>]/i.test(legal.text), false);
  assert.equal(/<style[\s>]/i.test(legal.text), false);
  assert.equal(/\sstyle\s*=/i.test(legal.text), false);
  assert.match(legal.text, /Last updated 2026-10-20/);
  assert.match(legal.text, /Kindred Data/);
  const links = [...legal.text.matchAll(/https?:\/\/[^"'\s<]+/g)].map((match) => match[0]);
  for (const link of links) assert.equal(allowedExternal.has(link), true, link);
}
const terms = await call("GET", "/terms");
assert.match(terms.text, /provided as is/i);
assert.match(terms.text, /no warranty/i);
assert.match(terms.text, /MIT license covers the code/);
assert.match(terms.text, /non-exclusive license to host, display, and share/);
assert.match(terms.text, /contact details or private data/);
assert.match(terms.text, /different name/);
const privacy = await call("GET", "/privacy");
assert.match(privacy.text, /no accounts/i);
assert.match(privacy.text, /public and crawlable/);
assert.match(privacy.text, /stored only as hashes/);
assert.match(privacy.text, /used in memory for rate limiting and are not logged/);
assert.match(privacy.text, /per-day aggregates/);
assert.match(privacy.text, /https:\/\/www\.cloudflare\.com\/privacypolicy\//);
assert.equal(/cookie/i.test(privacy.text), false);
const takedown = await call("GET", "/takedown");
assert.match(
  takedown.text,
  /https:\/\/github\.com\/PrivateAISystems\/needhave\/issues\/new/,
);
assert.match(takedown.text, /within 2 business days/);
assert.match(takedown.text, /Nothing is deleted/);
assert.match(takedown.text, /The post is hidden/);
assert.equal(/DMCA/i.test(takedown.text), false);
ok("GET /terms /privacy /takedown are public pages with no email address");

const sitemap = await call("GET", "/sitemap.xml");
assert.equal(sitemap.status, 200);
assert.match(sitemap.headers.get("content-type"), /^application\/xml; charset=utf-8$/);
assert.equal(sitemap.text, SITEMAP_XML);
assert.match(sitemap.text, /<loc>https:\/\/needhave\.io\/<\/loc>/);
assert.match(sitemap.text, /<loc>https:\/\/needhave\.io\/posts<\/loc>/);
assert.equal(/\/posts\//.test(sitemap.text), false);
ok("GET /sitemap.xml lists public pages only");

const mdHome = await call("GET", "/", undefined, { accept: "text/markdown" });
assert.equal(mdHome.status, 200);
assert.match(mdHome.headers.get("content-type"), /^text\/markdown; charset=utf-8$/);
assert.equal(mdHome.text, LANDING_MD);
assert.match(mdHome.headers.get("x-markdown-tokens"), /^\d+$/);
assert.equal(mdHome.headers.get("vary"), "accept");
const indexMd = await call("GET", "/index.md");
assert.equal(indexMd.status, 200);
assert.equal(indexMd.text, LANDING_MD);
ok("GET / negotiates markdown");

const auth = await call("GET", "/auth.md");
assert.equal(auth.status, 200);
assert.match(auth.headers.get("content-type"), /^text\/markdown; charset=utf-8$/);
assert.equal(auth.text, AUTH_MD);
assert.match(auth.text, /# Needhave auth\.md/);
assert.match(auth.text, /no accounts and no login/i);
assert.match(auth.text, /intentionally not provided/);
assert.match(auth.text, /"claim_uri": null/);
assert.equal(/claim_uri": "https:\/\/needhave\.io\/posts"/.test(auth.text), false);
assert.equal(/authorization_endpoint|oauth\/authorize|client_id/i.test(auth.text), false);
ok("GET /auth.md says there is no login");

const catalog = await call("GET", "/.well-known/api-catalog");
assert.equal(catalog.status, 200);
assert.equal(catalog.headers.get("content-type"), API_CATALOG_TYPE);
assert.deepEqual(catalog.json, API_CATALOG);
assert.equal(catalog.json.linkset.length, 2);
assert.equal(catalog.json.linkset[0].anchor, "https://needhave.io/posts");
assert.equal(catalog.json.linkset[1].anchor, "https://needhave.io/mcp");
ok("GET /.well-known/api-catalog is the RFC 9727 linkset");

const card = await call("GET", "/.well-known/mcp/server-card.json");
assert.equal(card.status, 200);
assert.deepEqual(card.json, MCP_SERVER_CARD);
assert.equal(card.json.serverInfo.name, "needhave");
assert.equal(card.json.transport.endpoint, "/mcp");
assert.equal(card.json.authentication.required, false);
assert.equal(card.json.description.startsWith(POSITIONING_LEAD), true);
assert.deepEqual(
  card.json.tools.map((tool) => tool.name),
  TOOLS.map((tool) => tool.name),
);
const cardAlias = await call("GET", "/.well-known/mcp.json");
assert.deepEqual(cardAlias.json, card.json);
ok("GET MCP server card describes the existing server");

const skills = await call("GET", "/.well-known/agent-skills/index.json");
assert.equal(skills.status, 200);
assert.deepEqual(skills.json, await skillIndex());
assert.equal(skills.json.skills.length, 1);
assert.equal(skills.json.skills[0].name, "needhave");
const skill = await call("GET", "/.well-known/agent-skills/needhave/SKILL.md");
assert.equal(skill.status, 200);
assert.equal(skill.text, NEEDHAVE_SKILL_MD);
assert.match(skill.text, /list_posts/);
assert.equal(/marketplace|escrow|create_account|oauth/i.test(skill.text), false);
ok("GET agent skill describes the existing MCP only");

const missing = await call("GET", "/nope");
assert.equal(missing.status, 404);
assert.deepEqual(missing.json, { error: "not_found" });
ok("unknown paths stay JSON not_found");

const created = await call("POST", "/posts", {
  kind: "need",
  note: "Need a working bicycle in town this week",
});
assert.equal(created.status, 201);
assert.equal(created.json.kind, "need");
assert.equal(created.json.note, "Need a working bicycle in town this week");
assert.equal(typeof created.json.id, "string");
assert.equal(created.json.id.length, 32);
assert.equal(typeof created.json.secret, "string");
assert.equal(created.json.secret.length, 64);
const postId = created.json.id;
const postSecret = created.json.secret;
ok("create a post and see the secret once");

const listed = await call("GET", "/posts");
assert.equal(listed.status, 200);
assert.equal(listed.json.posts.length, 1);
assert.equal(listed.json.posts[0].id, postId);
assert.equal(listed.json.posts[0].note, "Need a working bicycle in town this week");
assert.equal("secret" in listed.json.posts[0], false);

const fetched = await call("GET", `/posts/${postId}`);
assert.equal(fetched.status, 200);
assert.equal(fetched.json.id, postId);
assert.equal("secret" in fetched.json, false);
assert.notEqual(JSON.stringify(fetched.json), JSON.stringify(created.json));
ok("secret is not on later public reads");

const empty = await call("POST", "/posts", { kind: "have", note: "   " });
assert.equal(empty.status, 400);
assert.equal(empty.json.error, "empty_note");
ok("reject an empty note");

const huge = await call("POST", "/posts", {
  kind: "have",
  note: "x".repeat(MAX_NOTE + 1),
});
assert.equal(huge.status, 400);
assert.equal(huge.json.error, "huge_note");
ok("reject a huge note");

const pasted = await call("POST", "/posts", {
  kind: "have",
  note: "Need a working bicycle in town this week",
});
assert.equal(pasted.status, 409);
assert.equal(pasted.json.error, "duplicate_note");
ok("reject the same text pasted again");

const PRE_DEPLOY = "PRE_DEPLOY_CONFIDENTIAL_REPLY_9f3a";
const NULL_FLAG = "NULL_FLAG_STILL_HIDDEN_9f3a";
const CLOCK_FLAG = "CLOCK_CUTOFF_STILL_HIDDEN_9f3a";
const DEFAULT_FLAG = "DEFAULT_FLAG_STILL_HIDDEN_9f3a";
const OLD_FIRST = "OLD_THREAD_FIRST_9f3a";
const PRIVATE_LATER = "PRIVATE_THREAD_LATER_9f3a";
const HIDDEN_POST_REPLY = "HIDDEN_POST_REPLY_9f3a";
const THREAD_KEY = "cd".repeat(32);
const OLD_REPLY_SECRET = "ab".repeat(32);
const HIDDEN = [
  PRE_DEPLOY,
  NULL_FLAG,
  CLOCK_FLAG,
  DEFAULT_FLAG,
  OLD_FIRST,
  PRIVATE_LATER,
  HIDDEN_POST_REPLY,
  THREAD_KEY,
  OLD_REPLY_SECRET,
];

async function insertRaw(row) {
  const columns = [
    "id",
    "post_id",
    "text",
    "secret_hash",
    "thread_key",
    "thread_key_hash",
    "parent_id",
    "role",
    "created_at",
  ];
  const values = [
    row.id,
    row.post_id,
    row.text ?? null,
    row.secret_hash ?? null,
    row.thread_key ?? null,
    row.thread_key_hash ?? null,
    row.parent_id ?? null,
    row.role,
    row.created_at,
  ];
  if ("visible" in row) {
    columns.push("visible");
    values.push(row.visible);
  }
  await env.DB.prepare(
    `INSERT INTO messages (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
  )
    .bind(...values)
    .run();
}

function hides(payload) {
  const blob = typeof payload === "string" ? payload : JSON.stringify(payload);
  return HIDDEN.every((secret) => !blob.includes(secret));
}

await insertRaw({
  id: newId(),
  post_id: postId,
  text: PRE_DEPLOY,
  role: "first",
  created_at: 1,
  visible: 0,
});
await insertRaw({
  id: newId(),
  post_id: postId,
  text: CLOCK_FLAG,
  role: "first",
  created_at: Date.now() + 86_400_000,
  visible: 0,
});
await insertRaw({
  id: newId(),
  post_id: postId,
  text: DEFAULT_FLAG,
  role: "first",
  created_at: Date.now(),
});
let nullRejected = false;
try {
  await insertRaw({
    id: newId(),
    post_id: postId,
    text: NULL_FLAG,
    role: "first",
    created_at: Date.now(),
    visible: null,
  });
} catch {
  nullRejected = true;
}
assert.equal(nullRejected, true);

const oldFirstId = newId();
await insertRaw({
  id: oldFirstId,
  post_id: postId,
  text: OLD_FIRST,
  secret_hash: await sha256Hex(OLD_REPLY_SECRET),
  role: "first",
  created_at: 2,
  visible: 0,
});
await insertRaw({
  id: newId(),
  post_id: postId,
  text: null,
  thread_key: THREAD_KEY,
  thread_key_hash: await sha256Hex(THREAD_KEY),
  parent_id: oldFirstId,
  role: "accept",
  created_at: 3,
  visible: 0,
});
await insertRaw({
  id: newId(),
  post_id: postId,
  text: PRIVATE_LATER,
  thread_key_hash: await sha256Hex(THREAD_KEY),
  role: "later",
  created_at: 4,
  visible: 0,
});

await insertPost(env.DB, {
  id: "1409933e8afb2acfca8aefc8b7929104",
  kind: "need",
  note: "Looking for Help from https://news.ycombinator.com/item?id=49968927",
  secret_hash: "ee".repeat(32),
  created_at: Date.now(),
  source_url: "https://news.ycombinator.com/item?id=49968927",
  note_hash: "hidden-reply-parent",
});
await insertRaw({
  id: newId(),
  post_id: "1409933e8afb2acfca8aefc8b7929104",
  text: HIDDEN_POST_REPLY,
  role: "first",
  created_at: Date.now(),
  visible: 1,
});

const first = await call("POST", `/posts/${postId}/messages`, {
  text: "I have a bike you can borrow on Thursday",
  visible: 0,
});
assert.equal(first.status, 201);
assert.equal(first.json.post_id, postId);
assert.equal(typeof first.json.secret, "string");
assert.equal(first.json.secret.length, 64);
const replySecret = first.json.secret;
assert.notEqual(replySecret, postSecret);
assert.equal("hidden" in first.json, false);
assert.equal("thread_key" in first.json, false);
assert.equal(leak(first.json, postSecret), false);
assert.equal(leak(first.json, THREAD_KEY), false);
assert.equal(leak(first.json, OLD_REPLY_SECRET), false);
const storedReply = await env.DB.prepare(
  "SELECT visible, role, thread_key FROM messages WHERE id = ?",
).bind(first.json.id).first();
assert.equal(storedReply.visible, 1);
assert.equal(storedReply.role, "first");
assert.equal(storedReply.thread_key, null);
ok("write_first_reply does not echo the post secret or a thread key");

const publicPost = await call("GET", `/posts/${postId}`);
assert.equal(publicPost.status, 200);
assert.equal(
  publicPost.json.replies.some((reply) => reply.text === "I have a bike you can borrow on Thursday"),
  true,
);
assert.equal(hides(publicPost.json), true);
assert.equal("secret" in publicPost.json, false);
ok("a new reply is visible on read_post");
ok("a pre-cutoff reply stays hidden");
ok("pre-deploy reply stays hidden on read_post");

const listedNow = await call("GET", "/posts");
assert.equal(
  listedNow.json.posts.some(
    (post) =>
      post.id === postId &&
      post.replies.some((reply) => reply.text === "I have a bike you can borrow on Thursday"),
  ),
  true,
);
assert.equal(hides(listedNow.json), true);
ok("a new reply is visible on list_posts");
ok("pre-deploy reply stays hidden on list_posts");

const publicMessages = await call("GET", `/posts/${postId}/messages`);
assert.equal(publicMessages.status, 200);
assert.equal(
  publicMessages.json.messages.some((reply) => reply.text === "I have a bike you can borrow on Thursday"),
  true,
);
assert.equal(hides(publicMessages.json), true);
assert.equal(leak(publicMessages.json, replySecret), false);
ok("pre-deploy reply stays hidden on GET JSON");

const htmlList = await call("GET", "/posts", undefined, { accept: "text/html" });
const htmlOne = await call("GET", `/posts/${postId}`, undefined, { accept: "text/html" });
const homeAgain = await call("GET", "/");
assert.match(htmlList.headers.get("content-type"), /^text\/html/);
assert.match(htmlOne.headers.get("content-type"), /^text\/html/);
assert.equal(htmlList.text.includes("I have a bike you can borrow on Thursday"), true);
assert.equal(htmlOne.text.includes("I have a bike you can borrow on Thursday"), true);
assert.equal(hides(htmlList.text) && hides(htmlOne.text) && hides(homeAgain.text), true);
ok("pre-deploy reply stays hidden on GET HTML pages");

const mdList = await call("GET", "/posts", undefined, { accept: "text/markdown" });
const mdOne = await call("GET", `/posts/${postId}`, undefined, { accept: "text/markdown" });
assert.match(mdList.headers.get("content-type"), /^text\/markdown/);
assert.equal(mdList.text.includes("I have a bike you can borrow on Thursday"), true);
assert.equal(mdOne.text.includes("I have a bike you can borrow on Thursday"), true);
assert.equal(hides(mdList.text) && hides(mdOne.text), true);
ok("pre-deploy reply stays hidden on GET markdown pages");

assert.equal(hides(llms.text), true);
ok("pre-deploy reply stays hidden on llms.txt");

assert.equal(hides(sitemap.text), true);
ok("pre-deploy reply stays hidden on sitemap");

assert.equal(hides(spec.text), true);
assert.equal(hides(spec.json.components.schemas.PublicPost.example), true);
ok("pre-deploy reply stays hidden on OpenAPI examples");

const stats = await call("GET", "/stats");
assert.equal(stats.status, 404);
assert.equal(hides(stats.json), true);
const statsRefs = await call("GET", "/stats/refs");
assert.equal(statsRefs.status, 200);
assert.equal(hides(statsRefs.json), true);
ok("pre-deploy reply stays hidden on GET /stats and GET /stats/refs");

const copierRun = await runCopier(env, {
  fetchFn: async () => {
    throw new Error("copier test must not open a network");
  },
});
const copierStats = publicSourceStats({
  hn: {
    source: "hn",
    http_status: null,
    error: null,
    backoff: null,
    quota_remaining: null,
    candidates: 0,
    would_copy: 0,
    copied: 0,
    skip_reasons: { throttled: 0, filter: 0, duplicate: 0, repeat: 0, cap: 0 },
  },
});
const copierRows = await call("GET", "/copier/runs");
assert.equal(hides(copierRun), true);
assert.equal(hides(copierStats), true);
assert.equal(hides(copierRows.json), true);
ok("pre-deploy reply stays hidden on the copier");

const scriptText = '<script>alert("xss")</script>';
const scriptReply = await call("POST", `/posts/${postId}/messages`, { text: scriptText });
assert.equal(scriptReply.status, 201);
const htmlScript = await call("GET", `/posts/${postId}`, undefined, { accept: "text/html" });
const mdScript = await call("GET", `/posts/${postId}`, undefined, { accept: "text/markdown" });
assert.equal(/<script/i.test(htmlScript.text), false);
assert.equal(/<script/i.test(mdScript.text), false);
assert.equal(htmlScript.text.includes("&lt;script&gt;"), true);
assert.equal(mdScript.text.includes("&lt;script&gt;"), true);
assert.equal(htmlScript.text.includes(scriptText), false);
ok("reply text is escaped in HTML and markdown");

const junk = await call("POST", `/posts/${postId}/messages`, { text: "spam-bot@example.com" });
assert.equal(junk.status, 400);
assert.equal(junk.json.error, "empty_note");
assert.equal(leak((await call("GET", `/posts/${postId}`)).json, "spam-bot@example.com"), false);
ok("a junk reply is filtered");

const hugeReply = await call("POST", `/posts/${postId}/messages`, {
  text: "y".repeat(MAX_NOTE + 1),
});
assert.equal(hugeReply.status, 400);
assert.equal(hugeReply.json.error, "huge_note");
ok("a reply over 500 characters is dropped");

const shaped = "ab".repeat(32);
const secretReply = await call("POST", `/posts/${postId}/messages`, {
  text: `prefix ${shaped} suffix`,
});
assert.equal(secretReply.status, 400);
assert.equal(secretReply.json.error, "secret_shaped");
assert.equal(leak((await call("GET", `/posts/${postId}`)).json, shaped), false);
const keyBomb = "ab".repeat(3_000_000);
let bombThrew = false;
let preparedBomb;
try {
  preparedBomb = prepareReply(keyBomb);
} catch {
  bombThrew = true;
}
assert.equal(bombThrew, false);
assert.equal(preparedBomb.error, "huge_note");
let scanThrew = false;
let scanHit = false;
try {
  scanHit = looksLikeSecret(keyBomb);
} catch {
  scanThrew = true;
}
assert.equal(scanThrew, false);
assert.equal(scanHit, true);
let postThrew = false;
let bombReply;
try {
  bombReply = await call("POST", `/posts/${postId}/messages`, { text: keyBomb });
} catch {
  postThrew = true;
}
assert.equal(postThrew, false);
assert.equal(bombReply.status, 413);
assert.equal(bombReply.json.error, "payload_too_large");
assert.equal(leak((await call("GET", `/posts/${postId}`)).json, keyBomb.slice(0, 64)), false);
ok("a 6M key-shaped reply is rejected as too long and does not throw");

const spaced = shaped.split("").join(" ");
const spacedReply = await call("POST", `/posts/${postId}/messages`, {
  text: `prefix ${spaced} suffix`,
});
assert.equal(spacedReply.status, 400);
assert.equal(spacedReply.json.error, "secret_shaped");
const dashed = shaped.match(/.{4}/g).join("-");
const dashedReply = await call("POST", `/posts/${postId}/messages`, {
  text: `prefix ${dashed} suffix`,
});
assert.equal(dashedReply.status, 400);
assert.equal(dashedReply.json.error, "secret_shaped");
const colorReply = await call("POST", `/posts/${postId}/messages`, {
  text: "The banner color is #a1b2c3 for this week",
});
assert.equal(colorReply.status, 201);
const colorRead = await call("GET", `/posts/${postId}`);
assert.equal(
  colorRead.json.replies.some((reply) => reply.text === "The banner color is #a1b2c3 for this week"),
  true,
);
ok("a secret-shaped reply is rejected, including keys split by spaces or dashes");

const declared = await call(
  "POST",
  `/posts/${postId}/messages`,
  { text: "short reply that must not be stored when the length header is too big" },
  { "content-length": String(MAX_BODY_BYTES + 1) },
);
assert.equal(declared.status, 413);
assert.equal(declared.json.error, "payload_too_large");
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode("x".repeat(MAX_BODY_BYTES + 1)));
    controller.close();
  },
});
const streamed = await handle(
  new Request(`http://needhave.local/posts/${postId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  }),
  env,
);
assert.equal(streamed.status, 413);
assert.equal(await streamed.json().then((body) => body.error), "payload_too_large");
ok("a request body over 64KB is rejected");

const duplicateReply = await call("POST", `/posts/${postId}/messages`, {
  text: "I have a bike you can borrow on Thursday",
});
assert.equal(duplicateReply.status, 409);
assert.equal(duplicateReply.json.error, "duplicate_note");
ok("a duplicate public reply is dropped");

const hideMe = await call("POST", `/posts/${postId}/messages`, {
  text: "Hide this one reply and leave the bicycle reply",
});
assert.equal(hideMe.status, 201);
await env.DB.prepare(
  "INSERT INTO hidden_replies (message_id, reason, hidden_at) VALUES (?, ?, ?)",
).bind(hideMe.json.id, "takedown", Date.now()).run();
const afterHide = await call("GET", `/posts/${postId}`);
assert.equal(afterHide.json.replies.some((reply) => reply.id === hideMe.json.id), false);
assert.equal(
  afterHide.json.replies.some((reply) => reply.text === "I have a bike you can borrow on Thursday"),
  true,
);
assert.equal(afterHide.json.id, postId);
const waitingHidden = await call("POST", `/posts/${postId}/waiting`, { secret: postSecret });
assert.equal(waitingHidden.json.messages.some((reply) => reply.id === hideMe.json.id), false);
ok("hide path drops one reply and leaves the post");

const beforeAccept = await call("POST", `/messages/${first.json.id}/thread`, {
  secret: replySecret,
});
assert.equal(beforeAccept.status, 200);
assert.equal(beforeAccept.json.accepted, false);
assert.equal("thread_key" in beforeAccept.json, false);

const waitingWrong = await call("POST", `/posts/${postId}/waiting`, { secret: "0".repeat(64) });
assert.equal(waitingWrong.status, 403);
assert.equal(waitingWrong.json.error, "bad_secret");
assert.equal(hides(waitingWrong.json), true);

const waiting = await call("POST", `/posts/${postId}/waiting`, { secret: postSecret });
assert.equal(waiting.status, 200);
assert.equal(waiting.json.messages.some((reply) => reply.text === PRE_DEPLOY), true);
assert.equal(leak(waiting.json, replySecret), false);
assert.equal(leak(waiting.json, postSecret), false);
assert.equal(leak(waiting.json, THREAD_KEY), false);

const gone = await call("POST", `/posts/${postId}/accept`, {
  secret: postSecret,
  message_id: first.json.id,
});
assert.equal(gone.status, 404);
assert.equal(gone.json.error, "not_found");
assert.equal(leak(gone.json, THREAD_KEY), false);
ok("accept no longer opens a thread");

const thread = await call("POST", "/threads", { thread_key: THREAD_KEY });
assert.equal(thread.status, 200);
assert.equal(thread.json.post_id, postId);
assert.equal(thread.json.messages.some((message) => message.text === OLD_FIRST), true);
assert.equal(thread.json.messages.some((message) => message.text === PRIVATE_LATER), true);
assert.equal(leak(thread.json, THREAD_KEY), false);
ok("an existing thread is still readable with its key");

const later = await call("POST", "/threads/messages", {
  thread_key: THREAD_KEY,
  text: "Thursday at the library steps works",
});
assert.equal(later.status, 201);
const threadAgain = await call("POST", "/threads", { thread_key: THREAD_KEY });
assert.equal(
  threadAgain.json.messages.some((message) => message.text === "Thursday at the library steps works"),
  true,
);
const publicAfter = await call("GET", `/posts/${postId}`);
assert.equal(leak(publicAfter.json, "library"), false);
assert.equal(leak(publicAfter.json, PRIVATE_LATER), false);
assert.equal(hides(publicAfter.json), true);

const pathRead = await call("GET", `/threads/${THREAD_KEY}`);
assert.equal(pathRead.status, 404);
assert.equal(leak(pathRead.json, THREAD_KEY), false);
const pathWrite = await call("POST", `/threads/${THREAD_KEY}/messages`, {
  text: "this path must not accept a message",
});
assert.equal(pathWrite.status, 404);
assert.equal(leak(pathWrite.json, THREAD_KEY), false);
ok("a path that still contains the key does not return or write the thread");

const claimed = await call("POST", `/messages/${oldFirstId}/thread`, { secret: OLD_REPLY_SECRET });
assert.equal(claimed.status, 200);
assert.equal(claimed.json.accepted, true);
assert.equal(claimed.json.thread_key, THREAD_KEY);

const otherGuess = await call("POST", "/threads", { thread_key: oldFirstId });
assert.equal(otherGuess.status, 404);
assert.equal(leak(otherGuess.json, PRIVATE_LATER), false);
const otherWrite = await call("POST", "/threads/messages", {
  thread_key: oldFirstId,
  text: "trying to join the other thread",
});
assert.equal(otherWrite.status, 404);
ok("a different replier cannot read that thread");


const capPost = await call(
  "POST",
  "/posts",
  { kind: "have", note: "Need a spare chair for a one-hour wait cap test" },
  { "cf-connecting-ip": "198.51.100.10" },
);
assert.equal(capPost.status, 201);
for (let i = 0; i < MAX_WAITING_FIRSTS; i++) {
  const reply = await call(
    "POST",
    `/posts/${capPost.json.id}/messages`,
    { text: `Waiting first reply number ${i + 1} for the cap test` },
    { "cf-connecting-ip": "198.51.100.10" },
  );
  assert.equal(reply.status, 201, `waiting reply ${i + 1} should insert`);
}
const overWaiting = await call(
  "POST",
  `/posts/${capPost.json.id}/messages`,
  { text: "One more hidden reply after the cap" },
  { "cf-connecting-ip": "203.0.113.20" },
);
assert.equal(overWaiting.status, 429);
assert.equal(overWaiting.json.error, "too_many");
ok("new replies cap at 20 per post per 24 hours");

const windowPost = await call(
  "POST",
  "/posts",
  { kind: "need", note: "Need a post whose twenty replies are already a day old" },
  { "cf-connecting-ip": "198.51.100.21" },
);
assert.equal(windowPost.status, 201);
const outsideWindow = Date.now() - 24 * 60 * 60 * 1000 - 60_000;
for (let i = 0; i < MAX_WAITING_FIRSTS; i++) {
  await insertRaw({
    id: newId(),
    post_id: windowPost.json.id,
    text: `Reply ${i + 1} already outside the twenty four hour window`,
    role: "first",
    created_at: outsideWindow - i,
    visible: 1,
  });
}
const afterWindow = await call(
  "POST",
  `/posts/${windowPost.json.id}/messages`,
  { text: "A new reply after the twenty four hour window" },
  { "cf-connecting-ip": "198.51.100.22" },
);
assert.equal(afterWindow.status, 201);
assert.equal(
  (await call("GET", `/posts/${windowPost.json.id}`)).json.replies.some(
    (reply) => reply.text === "A new reply after the twenty four hour window",
  ),
  true,
);
ok("a post can take a new reply after the 24 hour window");

const takedownPost = await call(
  "POST",
  "/posts",
  { kind: "have", note: "Have a post used to show a taken-down reply does not fill the cap" },
  { "cf-connecting-ip": "198.51.100.23" },
);
assert.equal(takedownPost.status, 201);
let hiddenRecentId = null;
for (let i = 0; i < MAX_WAITING_FIRSTS; i++) {
  const reply = await call(
    "POST",
    `/posts/${takedownPost.json.id}/messages`,
    { text: `Recent reply ${i + 1} before one is taken down` },
    { "cf-connecting-ip": "198.51.100.24" },
  );
  assert.equal(reply.status, 201);
  if (i === 0) hiddenRecentId = reply.json.id;
}
await env.DB.prepare(
  "INSERT INTO hidden_replies (message_id, reason, hidden_at) VALUES (?, ?, ?)",
).bind(hiddenRecentId, "takedown", Date.now()).run();
const afterTakedown = await call(
  "POST",
  `/posts/${takedownPost.json.id}/messages`,
  { text: "This reply fits because a taken-down reply does not count" },
  { "cf-connecting-ip": "198.51.100.25" },
);
assert.equal(afterTakedown.status, 201);
ok("a taken-down reply does not count toward the 24 hour cap");

const ipPostNote = "Need a unique note just to test the per-ip create cap";
const firstIpPost = await call(
  "POST",
  "/posts",
  { kind: "need", note: ipPostNote },
  { "cf-connecting-ip": "203.0.113.50" },
);
assert.equal(firstIpPost.status, 201);
for (let i = 1; i < MAX_POSTS_PER_IP; i++) {
  const extra = await call(
    "POST",
    "/posts",
    { kind: "need", note: `Need a per-ip create cap filler ${i}` },
    { "cf-connecting-ip": "203.0.113.50" },
  );
  assert.equal(extra.status, 201);
}
const overPosts = await call(
  "POST",
  "/posts",
  { kind: "need", note: "Need one more note after the per-ip create cap" },
  { "cf-connecting-ip": "203.0.113.50" },
);
assert.equal(overPosts.status, 429);
assert.equal(overPosts.json.error, "rate_limited");
const stillDuplicate = await call(
  "POST",
  "/posts",
  { kind: "have", note: ipPostNote },
  { "cf-connecting-ip": "203.0.113.50" },
);
assert.equal(stillDuplicate.status, 409);
assert.equal(stillDuplicate.json.error, "duplicate_note");
ok("per-ip create-post cap; exact duplicate note still wins");

const ipReplyPost = await call(
  "POST",
  "/posts",
  { kind: "have", note: "Have a second post used only for the first-reply ip cap" },
  { "cf-connecting-ip": "198.51.100.80" },
);
assert.equal(ipReplyPost.status, 201);
const overFirstIp = await call(
  "POST",
  `/posts/${ipReplyPost.json.id}/messages`,
  { text: "This same ip already used its first-reply cap on the waiting-cap post" },
  { "cf-connecting-ip": "198.51.100.10" },
);
assert.equal(overFirstIp.status, 429);
assert.equal(overFirstIp.json.error, "rate_limited");
assert.equal(overFirstIp.json.error === "too_many", false);
ok("per-ip first-reply cap is inside the first-reply handler");

console.log("all local calls passed");
