import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app.js";
import {
  buildCopiedNote,
  isAskNeed,
  isCommentNeed,
  isGithubJunk,
  isQuestionNeed,
  runCopier,
  sourceRequests,
  sourceSuffix,
} from "../src/copier.js";
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
assert.deepEqual(offResult, {
  enabled: false,
  dry_run: false,
  copied: 0,
  would_copy: 0,
  by_source: { hn: 0, stackexchange: 0, github: 0 },
  items: [],
});
assert.equal(fetches, 0);
assert.deepEqual((await call(off, "GET", "/posts")).json, { posts: [] });
ok("copier is off unless COPIER_ENABLED is set");

const on = env({ COPIER_ENABLED: "1" });
const first = await runCopier(on, { now: NOW, fetchFn: fixtureFetch() });
assert.equal(first.enabled, true);
assert.equal(first.dry_run, false);
assert.equal(first.copied, 9);
assert.equal(first.would_copy, 9);
assert.deepEqual(first.by_source, { hn: 5, stackexchange: 3, github: 1 });
const notes = first.items.map((item) => item.note);
assert.equal(
  notes.includes("Looking for a public MCP test client this week from https://news.ycombinator.com/item?id=111"),
  true,
);
assert.equal(
  notes.includes("Looking for a spare bike trailer, email me at from https://news.ycombinator.com/item?id=113"),
  true,
);
assert.equal(
  notes.includes(
    "Ask HN: How do I find a technical cofounder in Chicago? from https://news.ycombinator.com/item?id=117",
  ),
  true,
);
assert.equal(
  notes.includes(
    "Looking for a Rust mentor who can review a small public CLI this week from https://news.ycombinator.com/item?id=119",
  ),
  true,
);
assert.equal(
  notes.includes(
    "Anyone know a cheap VPS that still allows inbound SMTP? from https://news.ycombinator.com/item?id=120",
  ),
  true,
);
assert.equal(notes.some((note) => note.includes("ada@example.com")), false);
assert.equal(notes.some((note) => note.includes("Who is hiring")), false);
assert.equal(notes.some((note) => note.includes("Show HN")), false);
assert.equal(notes.some((note) => note.includes("intern last month")), false);
assert.equal(notes.some((note) => note.includes("I quit my job")), false);
assert.equal(notes.some((note) => note.includes("restart nginx")), false);
assert.equal(
  notes.includes(
    "Looking for a browser library that converts CSV to JSON from https://stackoverflow.com/questions/9001/looking-for-a-browser-library-that-converts-csv-to-json (by Alice, CC BY-SA)",
  ),
  true,
);
assert.equal(
  notes.includes(
    "How do I reverse a string in Python? from https://stackoverflow.com/questions/9003/how-do-i-reverse-a-string-in-python (by Sam, CC BY-SA)",
  ),
  true,
);
assert.equal(
  notes.includes(
    "Can I stream a CSV from D1 without buffering the whole file? from https://stackoverflow.com/questions/9006/can-i-stream-a-csv-from-d1-without-buffering-the-whole-file (by Lee & Co, CC BY-SA)",
  ),
  true,
);
assert.equal(notes.some((note) => note.includes("compiler flag")), false);
assert.equal(notes.some((note) => note.includes("debounce fetch")), false);
assert.equal(notes.some((note) => note.includes("Why does this compile")), false);
assert.equal(
  notes.includes("Document the public webhook retry policy from https://github.com/example/docs/issues/12"),
  true,
);
assert.equal(notes.some((note) => note.includes("/pull/44")), false);
assert.equal(notes.some((note) => note.includes("hacktoberfest") || note.includes("contributors list")), false);
assert.equal(notes.some((note) => note.includes("typo in README")), false);
assert.equal(notes.some((note) => note.includes("App crashes")), false);
assert.equal(notes.some((note) => note.includes("Empty repo")), false);
ok("copies recent real needs and skips hiring, old, junk, and pull requests");

const listed = await call(on, "GET", "/posts");
assert.equal(listed.status, 200);
assert.equal(listed.json.posts.length, 9);
for (const post of listed.json.posts) {
  assert.match(post.note, / from https?:\/\//);
  assert.equal(typeof post.source_url, "string");
  assert.equal("secret" in post, false);
  assert.equal(post.kind, "need");
  if (post.source_url.includes("stackoverflow.com")) {
    assert.match(post.note, / \(by .+?, CC BY-SA\)$/);
  } else {
    assert.match(post.note, / from https?:\/\/\S+$/);
    assert.equal(post.note.includes("CC BY-SA"), false);
  }
  assert.ok(post.note.length <= 500);
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
assert.equal((await call(on, "GET", "/posts")).json.posts.length, 9);
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

const hugeSe = env({ COPIER_ENABLED: "1" });
const hugeSeRun = await runCopier(hugeSe, {
  now: NOW,
  fetchFn: fixtureFetch({
    hn: { hits: [] },
    stackexchange: {
      items: [
        {
          question_id: 801,
          title: `How do I ${"y".repeat(600)}?`,
          link: "https://stackoverflow.com/questions/801/huge",
          creation_date: 1791414000,
          score: 1,
          owner: { "display_name": "Pat" },
        },
      ],
    },
    github: { items: [] },
  }),
});
assert.equal(hugeSeRun.copied, 1);
assert.ok(hugeSeRun.items[0].note.length <= 500);
assert.match(
  hugeSeRun.items[0].note,
  / from https:\/\/stackoverflow.com\/questions\/801\/huge \(by Pat, CC BY-SA\)$/,
);
ok("SE notes keep author and CC BY-SA inside 500 characters");

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
assert.equal(sourceCapped.copied, 5);
assert.equal(sourceCapped.by_source.hn, 2);
assert.equal(sourceCapped.by_source.stackexchange, 2);
assert.equal(sourceCapped.by_source.github, 1);
ok("per-source cap applies inside a run");

const dryEnv = env({ COPIER_DRY_RUN: "1" });
const dry = await runCopier(dryEnv, { now: NOW, fetchFn: fixtureFetch() });
assert.equal(dry.enabled, true);
assert.equal(dry.dry_run, true);
assert.equal(dry.copied, 0);
assert.equal(dry.would_copy, 9);
assert.deepEqual(dry.by_source, { hn: 5, stackexchange: 3, github: 1 });
assert.equal((await call(dryEnv, "GET", "/posts")).json.posts.length, 0);
ok("dry-run reports per-source would-copy counts and does not insert");

const dryOpt = env({ COPIER_ENABLED: "1" });
const dryOptRun = await runCopier(dryOpt, { now: NOW, dryRun: true, fetchFn: fixtureFetch() });
assert.equal(dryOptRun.dry_run, true);
assert.equal(dryOptRun.copied, 0);
assert.equal(dryOptRun.would_copy, 9);
assert.equal((await call(dryOpt, "GET", "/posts")).json.posts.length, 0);
ok("options.dryRun is the test helper path");

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
const decoded = urls.map((url) => decodeURIComponent(url));
assert.equal(urls.filter((url) => url.startsWith("https://hn.algolia.com/")).length >= 5, true);
assert.equal(decoded.some((url) => url.includes("tags=ask_hn")), true);
assert.equal(decoded.some((url) => url.includes("tags=comment") && url.includes("looking for")), true);
assert.equal(decoded.some((url) => url.includes("tags=story") && url.includes("looking for")), true);
assert.equal(decoded.some((url) => url.includes("looking for OR need")), false);
assert.equal(urls.some((url) => url.startsWith("https://api.stackexchange.com/2.3/questions")), true);
assert.equal(urls.some((url) => url.startsWith("https://api.github.com/")), true);
assert.equal(decoded.some((url) => url.includes("-label:hacktoberfest")), true);
assert.equal(decoded.some((url) => /need|looking for/.test(url) && url.includes("api.github.com")), false);
ok("allowlisted sources use separate HN queries and official API hosts only");

assert.equal(isQuestionNeed("How do I reverse a string in Python?"), true);
assert.equal(isQuestionNeed("Can I stream a CSV from D1?"), true);
assert.equal(isAskNeed("Ask HN: How do I find a technical cofounder in Chicago?"), true);
assert.equal(isAskNeed("Ask HN: I quit my job today"), false);
assert.equal(isCommentNeed("Looking for a Rust mentor"), true);
assert.equal(isCommentNeed("I need to restart nginx after every deploy"), false);
assert.equal(
  isGithubJunk({
    title: "Fix typo in README",
    body: "There is a typo in the README install snippet.",
    labels: [{ name: "help wanted" }],
  }),
  true,
);
assert.equal(
  isGithubJunk({
    title: "Document the public webhook retry policy",
    body: "We need a short public note that explains how webhook retries work so integrators can implement backoff.",
    labels: [{ name: "help wanted" }],
    repository: { stargazers_count: 12, description: "Public docs" },
  }),
  false,
);
const seNote = buildCopiedNote({
  source: "stackexchange",
  source_url: "https://stackoverflow.com/questions/9001/x",
  text: "Looking for a browser library",
  author: "Alice",
});
assert.equal(seNote, "Looking for a browser library from https://stackoverflow.com/questions/9001/x (by Alice, CC BY-SA)");
assert.equal(
  sourceSuffix({ source: "hn", source_url: "https://news.ycombinator.com/item?id=111" }),
  " from https://news.ycombinator.com/item?id=111",
);
ok("question, comment, junk, and attribution helpers match the spec");

const copierSource = readFileSync(join(root, "src/copier.js"), "utf8");
assert.equal(/console\.(log|info|debug|warn|error)/.test(copierSource), false);
ok("copier does not log secrets");

console.log("all copier calls passed");
