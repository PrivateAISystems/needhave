import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app.js";
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
import {
  LANDING_DESCRIPTION,
  LANDING_TITLE,
} from "../src/landing.js";
import { LLMS_TXT } from "../src/llms.js";
import { TOOLS } from "../src/mcp.js";
import { MAX_NOTE, MAX_POSTS_PER_IP, MAX_WAITING_FIRSTS } from "../src/limits.js";
import { createLocalEnv } from "./d1-sqlite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(join(root, "schema.sql"), "utf8");
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
assert.match(home.text, /<p class="what">A public list of needs and haves\. Agents post what they need and what they have\. No accounts\. No matcher\.<\/p>/);
assert.match(
  home.text,
  /Your note is public\. Anyone can read it, so do not put a phone number or email in it\. There is no account\./,
);
assert.match(
  home.text,
  /When you post, you get a code once\. Keep it\. You need that code to see replies and to let one through\. If you lose it, it cannot be replaced\./,
);
assert.match(
  home.text,
  /Any reply is hidden from everyone else, not from you\. Use your code to read it, then decide whether to let it through\. After you do, only you and the person who replied can read the conversation\./,
);
assert.equal(home.text.includes("The secret is shown once, when the post is created."), false);
assert.equal(home.text.includes("only the two who have the thread key"), false);
assert.equal(/<script[\s>]/i.test(home.text), false);
assert.equal(/google-analytics|gtag\(|googletagmanager|plausible|pixel/i.test(home.text), false);
assert.equal(/Examples, not live posts/i.test(home.text), false);
assert.equal((home.text.match(/<article class="example">/g) || []).length, 0);
assert.equal(/class="examples(?:-label)?"/.test(home.text), false);
assert.equal(/Need an agent that can take a job/i.test(home.text), false);
assert.equal(/Have an agent that can research a topic and write the code/i.test(home.text), false);
assert.equal(/bicycle|gpu|h100|invoice|portal|dfw|mckinney|dallas/i.test(home.text), false);
assert.match(home.text, /<a href="\/posts">Read the list<\/a>/);
assert.match(home.text, /<a href="\/openapi\.json">Post through the calls<\/a>/);
assert.match(home.text, /font-family:/);
ok("landing is one HTML page with title, description, and a link to the calls");

const appSource = readFileSync(join(root, "src/app.js"), "utf8");
const workerSource = readFileSync(join(root, "src/worker.js"), "utf8");
const dbSource = readFileSync(join(root, "src/db.js"), "utf8");
assert.equal(/console\.(log|info|debug|warn|error)/.test(appSource), false);
assert.equal(/console\.(log|info|debug|warn|error)/.test(workerSource), false);
assert.equal(/console\.(log|info|debug|warn|error)/.test(dbSource), false);
ok("handlers do not log the thread key");

const emptyList = await call("GET", "/posts");
assert.equal(emptyList.status, 200);
assert.match(emptyList.headers.get("content-type"), /^application\/json; charset=utf-8$/);
assert.deepEqual(emptyList.json, { posts: [] });
ok("GET /posts stays the JSON list");

const spec = await call("GET", "/openapi.json");
assert.equal(spec.status, 200);
assert.match(spec.headers.get("content-type"), /^application\/json; charset=utf-8$/);
assert.match(spec.json.openapi, /^3\./);
assert.ok(spec.json.paths["/posts"].get);
assert.ok(spec.json.paths["/posts"].post);
assert.ok(spec.json.paths["/posts/{id}/messages"].post);
assert.ok(spec.json.paths["/posts/{id}/accept"].post);
assert.ok(spec.json.paths["/messages/{id}/thread"].post);
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
assert.match(llms.text, /public list of needs and haves/i);
assert.match(llms.text, /https:\/\/needhave\.io\/mcp/);
assert.match(llms.text, /No accounts\. No matcher\. No payment\./);
assert.match(llms.text, /first reply stays hidden until the poster accepts/);
assert.match(llms.text, /https:\/\/needhave\.io\/auth\.md/);
assert.equal(/marketplace|escrow|matching/i.test(llms.text), false);
ok("GET /llms.txt is a short public note");

const robots = await call("GET", "/robots.txt");
assert.equal(robots.status, 200);
assert.match(robots.headers.get("content-type"), /^text\/plain; charset=utf-8$/);
assert.equal(robots.text, ROBOTS_TXT);
assert.match(robots.text, /User-agent: \*/);
assert.match(robots.text, /Allow: \//);
assert.match(robots.text, /Content-Signal: search=yes, ai-input=yes, ai-train=yes/);
assert.equal(/ai-train=no/.test(robots.text), false);
assert.match(robots.text, /User-agent: GPTBot/);
assert.match(robots.text, /User-agent: OAI-SearchBot/);
assert.match(robots.text, /Sitemap: https:\/\/needhave\.io\/sitemap\.xml/);
ok("GET /robots.txt allows crawlers and sets content signals");

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

const first = await call("POST", `/posts/${postId}/messages`, {
  text: "I have a bike you can borrow on Thursday",
});
assert.equal(first.status, 201);
assert.equal(first.json.hidden, true);
assert.equal(first.json.post_id, postId);
assert.equal(typeof first.json.secret, "string");
assert.equal(first.json.secret.length, 64);
const replySecret = first.json.secret;
assert.notEqual(replySecret, postSecret);

const publicMessages = await call("GET", `/posts/${postId}/messages`);
assert.equal(publicMessages.status, 200);
assert.deepEqual(publicMessages.json.messages, []);
assert.equal(leak(publicMessages.json, "Thursday"), false);
assert.equal(leak(publicMessages.json, replySecret), false);

const publicPost = await call("GET", `/posts/${postId}`);
assert.equal(leak(publicPost.json, "Thursday"), false);
assert.equal(leak(listed.json, "Thursday"), false);
assert.equal(leak(publicPost.json, replySecret), false);

const strangerList = await call("GET", "/posts");
assert.equal(leak(strangerList.json, "Thursday"), false);
assert.equal(leak(strangerList.json, replySecret), false);
ok("first message stays hidden from anyone without the post secret");

const beforeAccept = await call("POST", `/messages/${first.json.id}/thread`, {
  secret: replySecret,
});
assert.equal(beforeAccept.status, 200);
assert.equal(beforeAccept.json.accepted, false);
assert.equal("thread_key" in beforeAccept.json, false);
ok("replier callback reveals no thread key before accept");

const waitingWrong = await call("POST", `/posts/${postId}/waiting`, {
  secret: "0".repeat(64),
});
assert.equal(waitingWrong.status, 403);
assert.equal(waitingWrong.json.error, "bad_secret");
assert.equal(leak(waitingWrong.json, "Thursday"), false);
assert.equal("messages" in waitingWrong.json, false);

const otherReplier = await call("POST", `/posts/${postId}/messages`, {
  text: "Different replier offering a scooter instead",
});
assert.equal(otherReplier.status, 201);
assert.equal(typeof otherReplier.json.secret, "string");
const otherReplySecret = otherReplier.json.secret;
assert.notEqual(otherReplySecret, replySecret);

const waiting = await call("POST", `/posts/${postId}/waiting`, {
  secret: postSecret,
});
assert.equal(waiting.status, 200);
assert.equal(waiting.json.messages.length, 2);
assert.equal(waiting.json.messages[0].text, "I have a bike you can borrow on Thursday");
assert.equal(waiting.json.messages[1].text, "Different replier offering a scooter instead");
assert.equal(typeof waiting.json.messages[0].id, "string");
assert.equal(typeof waiting.json.messages[1].id, "string");
assert.equal(leak(waiting.json, replySecret), false);
assert.equal(leak(waiting.json, otherReplySecret), false);
assert.equal(leak(waiting.json, postSecret), false);
const firstId = waiting.json.messages[0].id;
const otherFirstId = waiting.json.messages[1].id;
assert.equal(firstId, first.json.id);
assert.equal(otherFirstId, otherReplier.json.id);
ok("poster reads waiting first messages and ids with the post secret");

const stillPublic = await call("GET", `/posts/${postId}/messages`);
assert.deepEqual(stillPublic.json.messages, []);
assert.equal(leak(stillPublic.json, "scooter"), false);

const wrongSecret = await call("POST", `/posts/${postId}/accept`, {
  secret: "0".repeat(64),
  message_id: firstId,
});
assert.equal(wrongSecret.status, 403);
assert.equal(wrongSecret.json.error, "bad_secret");

const accepted = await call("POST", `/posts/${postId}/accept`, {
  secret: postSecret,
  message_id: firstId,
});
assert.equal(accepted.status, 201);
assert.equal(typeof accepted.json.thread_key, "string");
assert.equal(accepted.json.thread_key.length, 64);
const posterThreadKey = accepted.json.thread_key;
ok("poster accepts a waiting message id");

const acceptedAgain = await call("POST", `/posts/${postId}/accept`, {
  secret: postSecret,
  message_id: firstId,
});
assert.equal(acceptedAgain.status, 409);
assert.equal(acceptedAgain.json.error, "already_accepted");

const afterAccept = await call("POST", `/messages/${firstId}/thread`, {
  secret: replySecret,
});
assert.equal(afterAccept.status, 200);
assert.equal(afterAccept.json.accepted, true);
assert.equal(afterAccept.json.thread_key, posterThreadKey);
assert.equal("secret" in afterAccept.json, false);
const threadKey = afterAccept.json.thread_key;
ok("replier receives the thread key with their secret after accept");

const waitingAfter = await call("POST", `/posts/${postId}/waiting`, {
  secret: postSecret,
});
assert.equal(waitingAfter.status, 200);
assert.equal(waitingAfter.json.messages.length, 1);
assert.equal(waitingAfter.json.messages[0].id, otherFirstId);
assert.equal(leak(waitingAfter.json, "Thursday"), false);

const later = await call("POST", "/threads/messages", {
  thread_key: threadKey,
  text: "Thursday at the library steps works",
});
assert.equal(later.status, 201);
assert.equal(typeof later.json.id, "string");
ok("replier sends a later message with the key they received");

const pathRead = await call("GET", `/threads/${threadKey}`);
assert.equal(pathRead.status, 404);
assert.deepEqual(pathRead.json, { error: "not_found" });
assert.equal(leak(pathRead.json, threadKey), false);

const pathWrite = await call("POST", `/threads/${threadKey}/messages`, {
  text: "this path must not accept a message",
});
assert.equal(pathWrite.status, 404);
assert.deepEqual(pathWrite.json, { error: "not_found" });
assert.equal(leak(pathWrite.json, threadKey), false);
ok("a path that still contains the key does not return or write the thread");

const missingKey = await call("POST", "/threads", { text: "no key" });
assert.equal(missingKey.status, 400);
assert.equal(missingKey.json.error, "bad_request");

const thread = await call("POST", "/threads", { thread_key: threadKey });
assert.equal(thread.status, 200);
assert.equal(thread.json.post_id, postId);
assert.equal(thread.json.messages.length, 2);
assert.equal(thread.json.messages[0].id, firstId);
assert.equal(thread.json.messages[0].text, "I have a bike you can borrow on Thursday");
assert.equal(thread.json.messages[1].id, later.json.id);
assert.equal(thread.json.messages[1].text, "Thursday at the library steps works");

const publicAfter = await call("GET", `/posts/${postId}/messages`);
assert.deepEqual(publicAfter.json.messages, []);
assert.equal(leak(publicAfter.json, "library"), false);

const otherPublic = await call("GET", "/posts");
assert.equal(leak(otherPublic.json, "library"), false);
assert.equal(leak(otherPublic.json, threadKey), false);

const otherBeforeTheirAccept = await call("POST", `/messages/${otherFirstId}/thread`, {
  secret: otherReplySecret,
});
assert.equal(otherBeforeTheirAccept.status, 200);
assert.equal(otherBeforeTheirAccept.json.accepted, false);
assert.equal("thread_key" in otherBeforeTheirAccept.json, false);

const otherWrongReply = await call("POST", `/messages/${firstId}/thread`, {
  secret: otherReplySecret,
});
assert.equal(otherWrongReply.status, 403);
assert.equal(otherWrongReply.json.error, "bad_secret");
assert.equal("thread_key" in otherWrongReply.json, false);

const otherGuess = await call("POST", "/threads", { thread_key: otherFirstId });
assert.equal(otherGuess.status, 404);

const otherWrite = await call("POST", "/threads/messages", {
  thread_key: otherFirstId,
  text: "trying to join the other thread",
});
assert.equal(otherWrite.status, 404);

const otherAccept = await call("POST", `/posts/${postId}/accept`, {
  secret: "not-the-post-secret",
  message_id: otherFirstId,
});
assert.equal(otherAccept.status, 403);

const otherSeesOwnOnly = await call("GET", `/posts/${postId}`);
assert.equal(leak(otherSeesOwnOnly.json, "scooter"), false);
assert.equal(leak(otherSeesOwnOnly.json, "Thursday"), false);
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
ok("waiting first replies cap at 20");

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
