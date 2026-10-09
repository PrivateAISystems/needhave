import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app.js";
import {
  buildCopiedNote,
  bulkReposFromIssues,
  hasConcreteObject,
  ingestCopierSource,
  isAskNeed,
  isCommentNeed,
  isGithubJunk,
  isQuestionNeed,
  isSeNeed,
  runCopier,
  sourceRequests,
  sourceSuffix,
} from "../src/copier.js";
import { insertPost } from "../src/db.js";
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

async function call(environment, method, path, body, extraHeaders = {}) {
  const request = new Request(`http://needhave.local${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...extraHeaders,
    },
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
  sources: [],
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
assert.deepEqual(first.by_source, { hn: 3, stackexchange: 3, github: 3 });
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
assert.equal(notes.some((note) => note.includes("item?id=119")), false);
assert.equal(notes.some((note) => note.includes("item?id=120")), false);
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
assert.equal(notes.some((note) => note.includes("item?id=50007416")), false);
assert.equal(notes.some((note) => note.includes("item?id=50006926")), false);
assert.equal(notes.some((note) => note.includes("item?id=49968927")), false);
assert.equal(notes.some((note) => note.includes("item?id=50003240")), false);
assert.equal(notes.some((note) => note.includes("Looking for Help")), false);
assert.equal(notes.some((note) => note.includes("curry from the moon")), false);
assert.equal(notes.some((note) => note.includes("soro-mutants")), false);
assert.equal(notes.filter((note) => note.includes("example/one-repo")).length, 2);
const hnStat = first.sources.find((row) => row.source === "hn");
assert.ok(hnStat);
assert.equal(hnStat.candidates, 27);
assert.equal(hnStat.would_copy, 3);
assert.equal(hnStat.skip_reasons.repeat, 18);
assert.equal(hnStat.skip_reasons.filter, 5);
assert.equal(hnStat.skip_reasons.duplicate, 1);
assert.equal(
  hnStat.would_copy +
    hnStat.skip_reasons.filter +
    hnStat.skip_reasons.duplicate +
    hnStat.skip_reasons.repeat +
    hnStat.skip_reasons.cap,
  hnStat.candidates,
);
const seStat = first.sources.find((row) => row.source === "stackexchange");
assert.equal(seStat.candidates, 12);
assert.equal(seStat.would_copy, 3);
assert.equal(seStat.skip_reasons.repeat, 9);
assert.equal(
  seStat.would_copy +
    seStat.skip_reasons.filter +
    seStat.skip_reasons.duplicate +
    seStat.skip_reasons.repeat +
    seStat.skip_reasons.cap,
  seStat.candidates,
);
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
assert.equal(sourceCapped.copied, 6);
assert.equal(sourceCapped.by_source.hn, 2);
assert.equal(sourceCapped.by_source.stackexchange, 2);
assert.equal(sourceCapped.by_source.github, 2);
ok("per-source cap applies inside a run");

const dryEnv = env({ COPIER_DRY_RUN: "1" });
const dry = await runCopier(dryEnv, { now: NOW, fetchFn: fixtureFetch() });
assert.equal(dry.enabled, true);
assert.equal(dry.dry_run, true);
assert.equal(dry.copied, 0);
assert.equal(dry.would_copy, 9);
assert.deepEqual(dry.by_source, { hn: 3, stackexchange: 3, github: 3 });
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
assert.equal(urls.some((url) => url.includes("key=")), false);
const keyed = sourceRequests(NOW, 3 * 24 * 60 * 60 * 1000, { STACKEXCHANGE_KEY: "abc-test-key" });
assert.equal(
  keyed.filter((row) => row.source === "stackexchange").every((row) => row.url.includes("key=abc-test-key")),
  true,
);
assert.equal(
  keyed.filter((row) => row.source !== "stackexchange").every((row) => !row.url.includes("key=")),
  true,
);
assert.equal(urls.filter((url) => url.startsWith("https://hn.algolia.com/")).length, 3);
assert.equal(decoded.some((url) => url.includes("tags=ask_hn")), true);
assert.equal(decoded.some((url) => url.includes("tags=comment")), false);
assert.equal(decoded.some((url) => url.includes("tags=story") && url.includes("looking for")), true);
assert.equal(decoded.some((url) => url.includes("looking for OR need")), false);
assert.equal(urls.some((url) => url.startsWith("https://api.stackexchange.com/2.3/search/advanced")), true);
assert.equal(urls.some((url) => url.startsWith("https://api.stackexchange.com/2.3/questions?")), false);
assert.equal(urls.some((url) => url.startsWith("https://api.github.com/")), true);
assert.equal(decoded.some((url) => url.includes("-label:hacktoberfest")), true);
assert.equal(decoded.some((url) => /need|looking for/.test(url) && url.includes("api.github.com")), false);
ok("allowlisted sources use separate HN queries and official API hosts only");

assert.equal(isQuestionNeed("How do I reverse a string in Python?"), true);
assert.equal(isQuestionNeed("Can I stream a CSV from D1?"), true);
assert.equal(isSeNeed("How do I reverse a string in Python?"), true);
assert.equal(isSeNeed("Can I stream a CSV from D1 without buffering the whole file?"), true);
assert.equal(isSeNeed("Why does TypeScript fail to infer a callback parameter?"), false);
assert.equal(isAskNeed("Ask HN: How do I find a technical cofounder in Chicago?"), true);
assert.equal(isAskNeed("Ask HN: I quit my job today"), false);
assert.equal(isAskNeed("Ask HN: Are we losing control of AI?"), false);
assert.equal(isAskNeed("Ask HN: Could someone share a lobste.rs invite?"), true);
assert.equal(isAskNeed("Ask HN: Preferred state management for enterprise Flutter in 2026?"), true);
assert.equal(isAskNeed("Ask HN: Is anyone still working on dLLMs"), true);
assert.equal(isAskNeed("Ask HN: Got a Mac for running agents? what's your setup?"), true);
assert.equal(isAskNeed("Ask HN: Which frontier model can do code security reviews"), true);
assert.equal(isAskNeed("Ask HN: Is the xcancel source code publicly available?"), true);
assert.equal(isAskNeed("Anyone Interested in Prediction Markets"), true);
assert.equal(isAskNeed("Ask HN: What happened with quantum computers anyway?"), false);
assert.equal(hasConcreteObject("Ask HN: Could someone share a lobste.rs invite?"), true);
assert.equal(hasConcreteObject("Looking for Help"), false);
assert.equal(hasConcreteObject("Be my cofounder (curry from the moon)"), false);
assert.equal(isCommentNeed("Looking for a Rust mentor"), false);
assert.equal(
  isCommentNeed(
    "I need a mentor who can review a small public CLI this week and explain the ownership model",
  ),
  true,
);
assert.equal(isCommentNeed("I need to restart nginx after every deploy"), false);
assert.equal(hasConcreteObject("Looking for a public MCP test client this week"), true);
assert.equal(hasConcreteObject("Looking for Help"), false);
assert.equal(hasConcreteObject("Be my cofounder (curry from the moon)"), false);
assert.equal(
  bulkReposFromIssues([
    { title: "Add `list --count-only`", html_url: "https://github.com/Ay-obami/soro-mutants/issues/49" },
    { title: "Document and test stable CLI exit codes", html_url: "https://github.com/Ay-obami/soro-mutants/issues/45" },
    { title: "Add `--output` for writing reports to a file", html_url: "https://github.com/Ay-obami/soro-mutants/issues/48" },
    { title: "Add an `operators` CLI command", html_url: "https://github.com/Ay-obami/soro-mutants/issues/42" },
  ]).has("ay-obami/soro-mutants"),
  true,
);
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

const repoOnly = {
  items: github.items.filter((issue) => String(issue.html_url).includes("example/one-repo")),
};
const repoEnv = env({ COPIER_ENABLED: "1" });
const repoFirst = await runCopier(repoEnv, {
  now: NOW,
  fetchFn: fixtureFetch({ hn: { hits: [] }, stackexchange: { items: [] }, github: repoOnly }),
});
assert.equal(repoFirst.copied, 2);
const repoAgain = await runCopier(repoEnv, {
  now: NOW + 60 * 60 * 1000,
  fetchFn: fixtureFetch({ hn: { hits: [] }, stackexchange: { items: [] }, github: repoOnly }),
});
assert.equal(repoAgain.copied, 0);
ok("cross-run per-repo daily cap is 2");

const hiddenIds = [
  ["1409933e8afb2acfca8aefc8b7929104", "Very cool! Yes, I was looking for the SOTA models. from https://news.ycombinator.com/item?id=50007416"],
  ["0a6c95fce4302d8be7e20649aca0a662", "I am seeking answers I haven't been able to find. from https://news.ycombinator.com/item?id=50006926"],
  ["e46e3201306590da51457ee90b83a2a3", "Looking for Help from https://news.ycombinator.com/item?id=49968927"],
  ["0dc477dccbce2315feb6c5a1f738a43f", "Be my cofounder (curry from the moon) from https://news.ycombinator.com/item?id=50003240"],
  ["bb08fc2c352649f6fed0dc6316c592bd", "Add `list --count-only` from https://github.com/Ay-obami/soro-mutants/issues/49"],
  ["a389d21313a31adf2f43d64090bffce1", "Document and test stable CLI exit codes from https://github.com/Ay-obami/soro-mutants/issues/45"],
  ["673292d28c7b4c08e01d625d278d4c04", "Add `--output` for writing reports to a file from https://github.com/Ay-obami/soro-mutants/issues/48"],
  ["42dea747ebc1fe43d1413928e7a9fa0f", "Add an `operators` CLI command from https://github.com/Ay-obami/soro-mutants/issues/42"],
  ["a40ce491600b8161d7adfa1be78f68ea", "ci-flake: hivecommons/hive from https://github.com/hivecommons/hive/issues/11134"],
];
const hideEnv = env();
for (const [id, note] of hiddenIds) {
  await insertPost(hideEnv.DB, {
    id,
    kind: "need",
    note,
    secret_hash: "ab".repeat(32),
    created_at: NOW,
    source_url: note.split(" from ").pop(),
    note_hash: id,
  });
}
const visible = await call(hideEnv, "POST", "/posts", {
  kind: "need",
  note: "Need a visible handwritten note after junk copies are hidden",
});
assert.equal(visible.status, 201);
const hiddenList = await call(hideEnv, "GET", "/posts");
assert.equal(hiddenList.json.posts.some((post) => hiddenIds.some(([id]) => id === post.id)), false);
assert.equal(hiddenList.json.posts.some((post) => post.id === visible.json.id), true);
const hiddenRead = await call(hideEnv, "GET", `/posts/${hiddenIds[0][0]}`);
assert.equal(hiddenRead.status, 404);
assert.equal(hiddenRead.json.error, "not_found");
ok("public list and read exclude hidden junk copies");

const throttled = JSON.parse(
  readFileSync(join(root, "test/fixtures/copier/stackexchange-throttled.json"), "utf8"),
);
const throttleEnv = env({ COPIER_ENABLED: "1", STACKEXCHANGE_KEY: "abc-test-key" });
const logs = [];
const origLog = console.log;
console.log = (...args) => {
  logs.push(args.map(String).join(" "));
};
let throttledRun;
try {
  throttledRun = await runCopier(throttleEnv, {
    now: NOW,
    fetchFn: async (input) => {
      const url = String(input);
      if (url.includes("key=abc-test-key") === false && url.startsWith("https://api.stackexchange.com/")) {
        throw new Error("SE request missing key");
      }
      if (url.startsWith("https://api.stackexchange.com/")) {
        return new Response(JSON.stringify(throttled), { status: 400 });
      }
      return fixtureFetch({ hn: { hits: [] }, stackexchange: { items: [] }, github: { items: [] } })(url);
    },
  });
} finally {
  console.log = origLog;
}
const seLog = throttledRun.sources.find((row) => row.source === "stackexchange");
assert.ok(seLog);
assert.equal(seLog.http_status, 400);
assert.equal(seLog.error, "throttle_violation");
assert.equal(seLog.backoff, 30);
assert.equal(seLog.quota_remaining, 0);
assert.equal(seLog.would_copy, 0);
assert.ok(seLog.skip_reasons.throttled >= 1);
const logText = logs.join("\n");
assert.match(logText, /throttle_violation/);
assert.equal(logText.includes("abc-test-key"), false);
const publicRuns = await call(throttleEnv, "GET", "/copier/runs");
assert.equal(publicRuns.status, 200);
const sePublic = publicRuns.json.runs.find((row) => row.source === "stackexchange");
assert.ok(sePublic);
assert.equal(sePublic.http_status, 400);
assert.equal(sePublic.error, "throttle_violation");
assert.equal(JSON.stringify(publicRuns.json).includes("abc-test-key"), false);
ok("throttled SE is an explicit status, logged, and listed without secrets");

const copierSource = readFileSync(join(root, "src/copier.js"), "utf8");
assert.match(copierSource, /console\.log\(JSON\.stringify\(\{ copier_run:/);
ok("copier logs structured run status and does not log secrets");

let seFetches = 0;
const skipSe = env({ COPIER_ENABLED: "1" });
const skippedSe = await runCopier(skipSe, {
  now: NOW,
  skipSources: ["stackexchange"],
  fetchFn: async (input) => {
    const url = String(input);
    if (url.startsWith("https://api.stackexchange.com/")) {
      seFetches += 1;
      throw new Error("SE must not be fetched from the Worker cron");
    }
    return fixtureFetch({ hn: { hits: [] }, stackexchange: { items: [] }, github: { items: [] } })(url);
  },
});
assert.equal(seFetches, 0);
assert.equal(skippedSe.sources.some((row) => row.source === "stackexchange"), false);
ok("Worker cron skipSources omits Stack Exchange fetches");

const edge429 = env({ COPIER_ENABLED: "1" });
const edgeRun = await runCopier(edge429, {
  now: NOW,
  fetchFn: async (input) => {
    const url = String(input);
    if (url.startsWith("https://api.stackexchange.com/")) {
      return new Response("", { status: 429 });
    }
    return fixtureFetch({ hn: { hits: [] }, stackexchange: { items: [] }, github: { items: [] } })(url);
  },
});
const edgeSe = edgeRun.sources.find((row) => row.source === "stackexchange");
assert.equal(edgeSe.http_status, 429);
assert.equal(edgeSe.error, "http_429");
assert.equal(edgeSe.candidates, 0);
assert.ok(edgeSe.skip_reasons.throttled >= 1);
ok("empty-body SE 429 is an explicit status, not a silent zero");

const ingestSecret = "c".repeat(32);
const ingestOff = env();
const ingestMissing = await call(ingestOff, "POST", "/copier/ingest", {
  source: "stackexchange",
  items: stack.items,
});
assert.equal(ingestMissing.status, 404);
assert.equal(ingestMissing.json.error, "not_found");
ok("ingest is off unless COPIER_INGEST_SECRET is set");

const ingestEnv = env({ COPIER_INGEST_SECRET: ingestSecret });
const noBearer = await call(ingestEnv, "POST", "/copier/ingest", {
  source: "stackexchange",
  items: stack.items,
});
assert.equal(noBearer.status, 401);
assert.equal(noBearer.json.error, "unauthorized");
const wrongBearer = await call(
  ingestEnv,
  "POST",
  "/copier/ingest",
  { source: "stackexchange", items: stack.items },
  { authorization: "Bearer wrong-secret-value-here" },
);
assert.equal(wrongBearer.status, 401);
const badSource = await call(
  ingestEnv,
  "POST",
  "/copier/ingest",
  { source: "hn", items: [] },
  { authorization: `Bearer ${ingestSecret}` },
);
assert.equal(badSource.status, 400);
assert.equal(badSource.json.error, "bad_source");
const ingestLogs = [];
const ingestLog = console.log;
console.log = (...args) => {
  ingestLogs.push(args.map(String).join(" "));
};
let ingested;
try {
  ingested = await call(
    ingestEnv,
    "POST",
    "/copier/ingest",
    { source: "stackexchange", items: stack.items, http_status: 200, quota_remaining: 9800 },
    { authorization: `Bearer ${ingestSecret}` },
  );
} finally {
  console.log = ingestLog;
}
assert.equal(ingested.status, 200);
assert.equal(ingested.json.copied, 3);
assert.equal(ingested.json.would_copy, 3);
assert.equal(ingested.json.by_source.stackexchange, 3);
assert.equal(ingested.json.dry_run, false);
assert.match(ingested.json.items[0].note, / \(by .+?, CC BY-SA\)$/);
assert.equal(ingestLogs.join("\n").includes(ingestSecret), false);
assert.equal((await call(ingestEnv, "GET", "/posts")).json.posts.length, 3);
const ingestRuns = await call(ingestEnv, "GET", "/copier/runs");
const ingestSe = ingestRuns.json.runs.find((row) => row.source === "stackexchange");
assert.equal(ingestSe.copied, 3);
assert.equal(ingestSe.quota_remaining, 9800);
assert.equal(JSON.stringify(ingestRuns.json).includes(ingestSecret), false);
ok("ingest copies SE with the same filter and attribution and never logs the secret");

const ingestDry = env({ COPIER_INGEST_SECRET: ingestSecret, COPIER_DRY_RUN: "1" });
const dryIngest = await call(
  ingestDry,
  "POST",
  "/copier/ingest",
  { source: "stackexchange", items: stack.items },
  { authorization: `Bearer ${ingestSecret}` },
);
assert.equal(dryIngest.status, 200);
assert.equal(dryIngest.json.copied, 0);
assert.equal(dryIngest.json.would_copy, 3);
assert.equal((await call(ingestDry, "GET", "/posts")).json.posts.length, 0);
ok("ingest dry-run reports would-copy and does not insert");

const inviteEnv = env({ COPIER_ENABLED: "1" });
const inviteRun = await runCopier(inviteEnv, {
  now: NOW,
  fetchFn: fixtureFetch({
    hn: {
      hits: [
        {
          objectID: "130",
          title: "Ask HN: Could someone share a lobste.rs invite?",
          created_at_i: 1791414000,
          _tags: ["story", "ask_hn"],
        },
        {
          objectID: "49968927",
          title: "Looking for Help",
          created_at_i: 1791414000,
          _tags: ["story"],
        },
        {
          objectID: "50003240",
          title: "Be my cofounder (curry from the moon)",
          created_at_i: 1791414000,
          _tags: ["story"],
        },
        {
          objectID: "50007416",
          comment_text: "Very cool! Yes, I was looking for the SOTA models.",
          created_at_i: 1791414000,
          _tags: ["comment"],
          story_id: 115,
        },
        {
          objectID: "50006926",
          comment_text: "I am seeking answers I haven't been able to find.",
          created_at_i: 1791414000,
          _tags: ["comment"],
          story_id: 115,
        },
      ],
    },
    stackexchange: { items: [] },
    github: { items: [] },
  }),
});
assert.equal(inviteRun.copied, 1);
assert.equal(inviteRun.items[0].source_url.includes("item?id=130"), true);
assert.equal(inviteRun.items.some((item) => item.source_url.includes("49968927")), false);
assert.equal(inviteRun.items.some((item) => item.source_url.includes("50003240")), false);
assert.equal(inviteRun.items.some((item) => item.source_url.includes("50007416")), false);
assert.equal(inviteRun.items.some((item) => item.source_url.includes("50006926")), false);
ok("loosened Ask HN keeps known junk out");

assert.equal(typeof ingestCopierSource, "function");
const workerSource = readFileSync(join(root, "src/worker.js"), "utf8");
assert.match(workerSource, /skipSources:\s*\[\s*"stackexchange"\s*\]/);
ok("scheduled Worker skips Stack Exchange");

console.log("all copier calls passed");
