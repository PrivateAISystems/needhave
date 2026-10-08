import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app.js";
import { runCopier, sourceRequests } from "../src/copier.js";
import { createLocalEnv, loadLocalSql } from "./d1-sqlite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = Date.parse("2026-10-08T00:00:00.000Z");
const hn = JSON.parse(readFileSync(join(root, "test/fixtures/copier/hn.json"), "utf8"));
const stack = JSON.parse(readFileSync(join(root, "test/fixtures/copier/stackexchange.json"), "utf8"));
const github = JSON.parse(readFileSync(join(root, "test/fixtures/copier/github.json"), "utf8"));

function fixtureFetch(payloads = { hn, stackexchange: stack, github }) {
  return async (input) => {
    const url = String(input);
    if (url.startsWith("https://hn.algolia.com/")) {
      return new Response(JSON.stringify(payloads.hn), { status: 200 });
    }
    if (url.startsWith("https://api.stackexchange.com/")) {
      return new Response(JSON.stringify(payloads.stackexchange), { status: 200 });
    }
    if (url.startsWith("https://api.github.com/")) {
      return new Response(JSON.stringify(payloads.github), { status: 200 });
    }
    throw new Error(`live network forbidden: ${url}`);
  };
}

function env(extra = {}) {
  return createLocalEnv(loadLocalSql(root), extra);
}

async function call(environment, method, path, body) {
  const request = new Request(`http://needhave.local${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const response = await handle(request, environment);
  return { status: response.status, json: await response.json() };
}

function ok(label) {
  console.log(`ok ${label}`);
}

const off = env();
let fetches = 0;
const offResult = await runCopier(off, {
  now: NOW,
  fetchFn: async () => {
    fetches += 1;
    throw new Error("should not fetch");
  },
});
assert.deepEqual(offResult, { enabled: false, copied: 0, items: [] });
assert.equal(fetches, 0);
assert.deepEqual((await call(off, "GET", "/posts")).json, { posts: [] });
ok("copier is off unless COPIER_ENABLED is set");

const on = env({ COPIER_ENABLED: "1" });
const first = await runCopier(on, { now: NOW, fetchFn: fixtureFetch() });
assert.equal(first.enabled, true);
assert.equal(first.copied, 4);
const notes = first.items.map((item) => item.note);
assert.equal(
  notes.includes("Looking for a public MCP test client this week from https://news.ycombinator.com/item?id=111"),
  true,
);
assert.equal(
  notes.includes("Looking for a spare bike trailer, email me at from https://news.ycombinator.com/item?id=113"),
  true,
);
assert.equal(notes.some((note) => note.includes("ada@example.com")), false);
assert.equal(notes.some((note) => note.includes("Who is hiring")), false);
assert.equal(notes.some((note) => note.includes("Show HN")), false);
assert.equal(notes.some((note) => note.includes("intern last month")), false);
assert.equal(
  notes.includes(
    "Looking for a browser library that converts CSV to JSON from https://stackoverflow.com/questions/9001/looking-for-a-browser-library-that-converts-csv-to-json",
  ),
  true,
);
assert.equal(notes.some((note) => note.includes("reverse a string")), false);
assert.equal(
  notes.includes("Need a reviewer for the public docs build from https://github.com/example/docs/issues/12"),
  true,
);
assert.equal(notes.some((note) => note.includes("/pull/44")), false);
ok("copies recent real needs and skips hiring, old, non-need, and pull requests");

const listed = await call(on, "GET", "/posts");
assert.equal(listed.status, 200);
assert.equal(listed.json.posts.length, 4);
for (const post of listed.json.posts) {
  assert.match(post.note, / from https?:\/\//);
  assert.equal(typeof post.source_url, "string");
  assert.equal("secret" in post, false);
  assert.equal(post.kind, "need");
}
const copied = listed.json.posts.find((post) => post.source_url.includes("item?id=111"));
assert.ok(copied);
assert.equal("secret" in copied, false);
const one = await call(on, "GET", `/posts/${copied.id}`);
assert.equal(one.json.source_url, copied.source_url);
assert.equal("secret" in one.json, false);
ok("copied posts expose source_url and never a secret");

const reply = await call(on, "POST", `/posts/${copied.id}/messages`, { text: "I can help" });
assert.equal(reply.status, 403);
assert.equal(reply.json.error, "copied_post");
assert.equal(reply.json.source_url, copied.source_url);
assert.equal("secret" in reply.json, false);

const waiting = await call(on, "POST", `/posts/${copied.id}/waiting`, { secret: "0".repeat(64) });
assert.equal(waiting.status, 403);
assert.equal(waiting.json.error, "copied_post");
assert.equal(waiting.json.source_url, copied.source_url);

const accept = await call(on, "POST", `/posts/${copied.id}/accept`, {
  secret: "0".repeat(64),
  message_id: "nope",
});
assert.equal(accept.status, 403);
assert.equal(accept.json.error, "copied_post");
ok("waiting replies on copied posts are refused with the source link");

const again = await runCopier(on, { now: NOW, fetchFn: fixtureFetch() });
assert.equal(again.copied, 0);
assert.equal((await call(on, "GET", "/posts")).json.posts.length, 4);
ok("dedupes by source URL on a second run");

const hashEnv = env({ COPIER_ENABLED: "1" });
await runCopier(hashEnv, { now: NOW, fetchFn: fixtureFetch() });
const hashDup = {
  hits: [
    {
      objectID: "999",
      title: "Looking for a public MCP test client this week!!!",
      created_at_i: 1791414000,
    },
  ],
};
const hashed = await runCopier(hashEnv, {
  now: NOW,
  fetchFn: fixtureFetch({ hn: hashDup, stackexchange: { items: [] }, github: { items: [] } }),
});
assert.equal(hashed.copied, 0);
ok("dedupes by normalized-text hash across source URLs");

const hugeTitle = `Need a ${"x".repeat(600)}`;
const hugeEnv = env({ COPIER_ENABLED: "1" });
const hugeRun = await runCopier(hugeEnv, {
  now: NOW,
  fetchFn: fixtureFetch({
    hn: { hits: [{ objectID: "800", title: hugeTitle, created_at_i: 1791414000 }] },
    stackexchange: { items: [] },
    github: { items: [] },
  }),
});
assert.equal(hugeRun.copied, 1);
assert.ok(hugeRun.items[0].note.length <= 500);
assert.match(hugeRun.items[0].note, / from https:\/\/news\.ycombinator\.com\/item\?id=800$/);
ok("trims copied notes to 500 characters including the source link");

const capHits = [];
for (let i = 0; i < 25; i++) {
  capHits.push({
    objectID: String(2000 + i),
    title: `Looking for a unique cap-test need ${i}`,
    created_at_i: 1791414000,
  });
}
const capEnv = env({ COPIER_ENABLED: "1", COPIER_MAX_PER_RUN: "5", COPIER_MAX_PER_SOURCE: "8" });
const capped = await runCopier(capEnv, {
  now: NOW,
  fetchFn: fixtureFetch({
    hn: { hits: capHits },
    stackexchange: { items: [] },
    github: { items: [] },
  }),
});
assert.equal(capped.copied, 5);
ok("per-run cap stops copies");

const sourceCapEnv = env({ COPIER_ENABLED: "1", COPIER_MAX_PER_RUN: "20", COPIER_MAX_PER_SOURCE: "2" });
const sourceCapped = await runCopier(sourceCapEnv, {
  now: NOW,
  fetchFn: fixtureFetch({
    hn: { hits: capHits },
    stackexchange: stack,
    github: github,
  }),
});
assert.equal(sourceCapped.copied, 4);
assert.equal(sourceCapped.items.filter((item) => item.source_url.includes("news.ycombinator.com")).length, 2);
ok("per-source cap applies inside a run");

const normal = env({ COPIER_ENABLED: "1" });
const created = await call(normal, "POST", "/posts", {
  kind: "need",
  note: "Need a hand-written note that still gets a secret",
});
assert.equal(created.status, 201);
assert.equal(typeof created.json.secret, "string");
assert.equal("source_url" in created.json, false);
const firstReply = await call(normal, "POST", `/posts/${created.json.id}/messages`, {
  text: "I can help with that handwritten need",
});
assert.equal(firstReply.status, 201);
assert.equal(firstReply.json.hidden, true);
ok("ordinary posts still issue a secret and accept replies");

const urls = sourceRequests(NOW, 3 * 24 * 60 * 60 * 1000).map((row) => row.url);
assert.equal(urls.some((url) => url.startsWith("https://hn.algolia.com/")), true);
assert.equal(urls.some((url) => url.startsWith("https://api.stackexchange.com/")), true);
assert.equal(urls.some((url) => url.startsWith("https://api.github.com/")), true);
ok("allowlisted sources are official API hosts only");

const copierSource = readFileSync(join(root, "src/copier.js"), "utf8");
assert.equal(/console\.(log|info|debug|warn|error)/.test(copierSource), false);
ok("copier does not log secrets");

console.log("all copier calls passed");
