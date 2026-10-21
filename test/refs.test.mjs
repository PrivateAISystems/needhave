import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app.js";
import { ONBOARDING_TEXT, POSITIONING_LEAD } from "../src/copy.js";
import { incrementSourceCount } from "../src/db.js";
import { MCP_SERVER_CARD } from "../src/discovery.js";
import { LANDING_HTML } from "../src/landing.js";
import { LLMS_TXT } from "../src/llms.js";
import { openapi } from "../src/openapi.js";
import {
  MAX_REFS_PER_DAY,
  NONE_REF,
  OTHER_REF,
  normalizeRef,
  utcDay,
} from "../src/source-counts.js";
import worker from "../src/worker.js";
import { createLocalEnv, loadLocalSql } from "./d1-sqlite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = loadLocalSql(root);

function ok(label) {
  console.log(`ok ${label}`);
}

function freshEnv() {
  return createLocalEnv(schema);
}

async function mcp(env, body, { path = "/mcp", ctx } = {}) {
  const request = new Request(`http://needhave.local${path}`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const response = await worker.fetch(request, env, ctx);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, json, text };
}

function captureCtx() {
  const jobs = [];
  return {
    ctx: {
      waitUntil(promise) {
        jobs.push(promise);
      },
    },
    flush() {
      return Promise.all(jobs);
    },
  };
}

async function home(env, path = "/", { headers = {}, ctx } = {}) {
  const gate = ctx ? null : captureCtx();
  const request = new Request(`http://needhave.local${path}`, { headers });
  const response = await worker.fetch(request, env, ctx || gate.ctx);
  if (gate) await gate.flush();
  const text = await response.text();
  return { status: response.status, text, headers: response.headers };
}

async function stats(env, query = "") {
  const request = new Request(`http://needhave.local/stats/refs${query}`);
  const response = await handle(request, env);
  const json = await response.json();
  return { status: response.status, json };
}

function initializeBody(id = 1) {
  return {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } },
  };
}

function callBody(name, args = {}, id = 2) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  };
}

assert.equal(normalizeRef(undefined), NONE_REF);
assert.equal(normalizeRef(null), NONE_REF);
assert.equal(normalizeRef(""), NONE_REF);
assert.equal(normalizeRef("Cursor"), "cursor");
assert.equal(normalizeRef("CLAUDE-CODE"), "claude-code");
assert.equal(normalizeRef("bad_ref"), NONE_REF);
assert.equal(normalizeRef("has space"), NONE_REF);
assert.equal(normalizeRef("slash/ref"), NONE_REF);
assert.equal(normalizeRef("a".repeat(32)), "a".repeat(32));
assert.equal(normalizeRef("a".repeat(33)), NONE_REF);
assert.equal(normalizeRef("ok-1"), "ok-1");
ok("ref normalization: case, invalid chars, over 32, missing → none");

{
  const env = freshEnv();
  const raw = "Evil<script>alert(1)</script>";
  const init = await mcp(env, initializeBody(), { path: `/mcp?ref=${encodeURIComponent(raw)}` });
  assert.equal(init.status, 200);
  const listed = await mcp(env, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  const listPosts = listed.json.result.tools.find((tool) => tool.name === "list_posts");
  const home = await handle(new Request("http://needhave.local/"), env);
  const homeText = await home.text();
  const llms = await handle(new Request("http://needhave.local/llms.txt"), env);
  const llmsText = await llms.text();
  const card = await handle(new Request("http://needhave.local/.well-known/mcp/server-card.json"), env);
  const cardJson = await card.json();
  const payload = JSON.stringify({
    instructions: init.json.result.instructions,
    list_posts: listPosts.description,
    home: homeText,
    llms: llmsText,
    card: cardJson,
    stats: (await stats(env)).json,
  });
  assert.equal(payload.includes(raw), false);
  assert.equal(payload.includes("<script>"), false);
  assert.equal(payload.includes("Evil"), false);
  const counted = (await stats(env)).json.refs;
  assert.equal(counted.length, 1);
  assert.equal(counted[0].ref, NONE_REF);
  ok("raw ref is never echoed in HTML, llms.txt, or MCP text");
}

{
  const env = freshEnv();
  const missing = await mcp(env, initializeBody(), { path: "/mcp" });
  assert.equal(missing.status, 200);
  const invalid = await mcp(env, initializeBody(2), { path: "/mcp?ref=Not_Valid" });
  assert.equal(invalid.status, 200);
  const long = await mcp(env, initializeBody(3), { path: `/mcp?ref=${"b".repeat(33)}` });
  assert.equal(long.status, 200);
  const cased = await mcp(env, initializeBody(4), { path: "/mcp?ref=Cursor" });
  assert.equal(cased.status, 200);
  const rows = (await stats(env)).json.refs;
  const none = rows.find((row) => row.ref === NONE_REF);
  const cursor = rows.find((row) => row.ref === "cursor");
  assert.equal(none.connections, 3);
  assert.equal(cursor.connections, 1);
  assert.equal(rows.some((row) => row.ref === "Not_Valid"), false);
  assert.equal(rows.some((row) => row.ref === "Cursor"), false);
  ok("missing, invalid, and overlong refs count as none; case is lowercased");
}

{
  const env = freshEnv();
  const day = utcDay();
  for (let i = 0; i < MAX_REFS_PER_DAY; i++) {
    const ref = `dir-${String(i).padStart(2, "0")}`;
    await incrementSourceCount(env.DB, day, ref, {
      connections: 1,
      tool_calls: 0,
      posts_created: 0,
    });
  }
  const overflow = await mcp(env, initializeBody(), { path: "/mcp?ref=fresh-directory" });
  assert.equal(overflow.status, 200);
  const noneCap = await mcp(env, initializeBody(2), { path: "/mcp" });
  assert.equal(noneCap.status, 200);
  const existing = await mcp(env, initializeBody(3), { path: "/mcp?ref=dir-00" });
  assert.equal(existing.status, 200);
  const rows = (await stats(env)).json.refs;
  assert.equal(rows.some((row) => row.ref === "fresh-directory"), false);
  assert.equal(rows.some((row) => row.ref === NONE_REF), false);
  const other = rows.find((row) => row.ref === OTHER_REF);
  const dir00 = rows.find((row) => row.ref === "dir-00");
  assert.equal(other.connections, 2);
  assert.equal(dir00.connections, 2);
  assert.equal(rows.length, MAX_REFS_PER_DAY + 1);
  ok("51st distinct ref and a new none bucket overflow to other; existing refs still increment");
}

{
  const env = freshEnv();
  const init = await mcp(env, initializeBody(), { path: "/mcp?ref=synth-dir" });
  assert.equal(init.status, 200);
  const listed = await mcp(env, { jsonrpc: "2.0", id: 2, method: "tools/list" }, { path: "/mcp?ref=synth-dir" });
  assert.equal(listed.status, 200);
  const read = await mcp(env, callBody("list_posts"), { path: "/mcp?ref=synth-dir" });
  assert.equal(read.status, 200);
  const need = await mcp(
    env,
    callBody("create_need", { note: "Need a synthetic spare charger for a one-hour test window" }, 3),
    { path: "/mcp?ref=synth-dir" },
  );
  assert.equal(need.status, 200);
  assert.equal(JSON.parse(need.json.result.content[0].text).kind, "need");
  const have = await mcp(
    env,
    callBody("create_have", { note: "Have a synthetic folding chair free after six tonight" }, 4),
    { path: "/mcp?ref=synth-dir" },
  );
  assert.equal(have.status, 200);
  assert.equal(JSON.parse(have.json.result.content[0].text).kind, "have");
  const rows = (await stats(env)).json.refs;
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    day: utcDay(),
    ref: "synth-dir",
    connections: 1,
    tool_calls: 3,
    posts_created: 2,
    page_views: 0,
  });
  ok("counters increment on initialize, tools/call, and create_need/create_have");
}

{
  const env = freshEnv();
  const inner = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    if (String(sql).includes("source_counts")) {
      throw new Error("synthetic counter path failure");
    }
    return inner(sql);
  };
  const init = await mcp(env, initializeBody(), { path: "/mcp?ref=broken-dir" });
  assert.equal(init.status, 200);
  assert.equal(init.json.result.serverInfo.name, "needhave");
  const created = await mcp(
    env,
    callBody("create_need", { note: "Need a synthetic umbrella for a noon walk test" }, 2),
    { path: "/mcp?ref=broken-dir" },
  );
  assert.equal(created.status, 200);
  assert.equal(JSON.parse(created.json.result.content[0].text).kind, "need");
  const listed = await mcp(env, callBody("list_posts", {}, 3));
  assert.equal(listed.status, 200);
  assert.equal(JSON.parse(listed.json.result.content[0].text).posts.length, 1);
  ok("D1 error in the counter path still serves initialize and tools/call");
}

{
  const env = freshEnv();
  const missing = await stats(env);
  assert.equal(missing.status, 200);
  assert.equal(missing.json.days, 7);
  assert.deepEqual(missing.json.refs, []);

  for (const query of ["?days=0", "?days=91", "?days=abc"]) {
    const bad = await stats(env, query);
    assert.equal(bad.status, 400, query);
    assert.deepEqual(bad.json, { error: "bad_request" });
  }

  const oldDay = utcDay(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const today = utcDay();
  await incrementSourceCount(env.DB, oldDay, "old-dir", {
    connections: 4,
    tool_calls: 1,
    posts_created: 0,
  });
  await incrementSourceCount(env.DB, today, "new-dir", {
    connections: 2,
    tool_calls: 3,
    posts_created: 1,
  });
  const def = await stats(env);
  assert.equal(def.status, 200);
  assert.equal(def.json.days, 7);
  assert.deepEqual(
    def.json.refs.map((row) => row.ref),
    ["new-dir"],
  );
  const wider = await stats(env, "?days=8");
  assert.equal(wider.status, 200);
  assert.equal(wider.json.days, 8);
  assert.deepEqual(
    wider.json.refs.map((row) => row.ref).sort(),
    ["new-dir", "old-dir"],
  );
  assert.equal(JSON.stringify(wider.json).includes("hidden_posts"), false);
  ok("days validation: 0, 91, abc → 400; missing → 7");
}

{
  const server = JSON.parse(readFileSync(join(root, "server.json"), "utf8"));
  assert.equal(LLMS_TXT.startsWith(POSITIONING_LEAD), true);
  assert.equal(MCP_SERVER_CARD.description.startsWith(POSITIONING_LEAD), true);
  assert.equal(server.description.startsWith(POSITIONING_LEAD), true);
  assert.equal(MCP_SERVER_CARD.description.includes(ONBOARDING_TEXT), false);
  ok("positioning lead is at the top of static MCP descriptions");
}

const NEW_ONBOARDING =
  "You can post right now: create_need if you're blocked on something, create_have if you have spare capacity. No signup, no key. Example: create_need with note \"Need someone to test my MCP server from a non-Claude client and report what breaks.\" Use your own note, not this example. Call list_posts first to avoid a duplicate.";

{
  const env = freshEnv();
  assert.equal(ONBOARDING_TEXT, NEW_ONBOARDING);
  const init = await mcp(env, initializeBody(), { path: "/mcp?ref=X-Launch" });
  assert.equal(init.status, 200);
  assert.equal(init.json.result.instructions.includes(NEW_ONBOARDING), true);
  const listed = await mcp(env, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.equal(listed.status, 200);
  const listPosts = listed.json.result.tools.find((tool) => tool.name === "list_posts");
  assert.equal(listPosts.description.includes(NEW_ONBOARDING), true);
  assert.equal(listPosts.description.startsWith(NEW_ONBOARDING), true);
  const viewed = await home(env, "/?ref=x-launch");
  assert.equal(viewed.status, 200);
  assert.equal(viewed.text.includes("X-Launch"), false);
  assert.equal(viewed.text.includes("x-launch"), false);
  const rows = (await stats(env)).json.refs;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ref, "x-launch");
  assert.equal(rows[0].connections, 1);
  assert.equal(rows[0].page_views, 1);
  ok("x-launch normalizes to x-launch on both /mcp and /");
  ok("new ONBOARDING_TEXT shows in both initialize and tools/list");
}

{
  const env = freshEnv();
  const viewed = await home(env, "/?ref=home-only");
  assert.equal(viewed.status, 200);
  assert.equal(viewed.text, LANDING_HTML);
  const rows = (await stats(env)).json.refs;
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    day: utcDay(),
    ref: "home-only",
    connections: 0,
    tool_calls: 0,
    posts_created: 0,
    page_views: 1,
  });
  ok("a home-page view increments page_views and nothing else");
}

{
  const env = freshEnv();
  const bad = await home(env, "/?ref=bad_ref");
  assert.equal(bad.status, 200);
  const missing = await home(env, "/");
  assert.equal(missing.status, 200);
  const rows = (await stats(env)).json.refs;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ref, NONE_REF);
  assert.equal(rows[0].connections, 0);
  assert.equal(rows[0].tool_calls, 0);
  assert.equal(rows[0].posts_created, 0);
  assert.equal(rows[0].page_views, 2);
  assert.equal(rows.some((row) => row.ref === "bad_ref"), false);
  ok("a bad ref counts as none");
}

{
  const env = freshEnv();
  const day = utcDay();
  for (let i = 0; i < MAX_REFS_PER_DAY; i++) {
    const ref = `home-${String(i).padStart(2, "0")}`;
    await incrementSourceCount(env.DB, day, ref, {
      connections: 0,
      tool_calls: 0,
      posts_created: 0,
      page_views: 1,
    });
  }
  const overflow = await home(env, "/?ref=fresh-home");
  assert.equal(overflow.status, 200);
  const rows = (await stats(env)).json.refs;
  assert.equal(rows.some((row) => row.ref === "fresh-home"), false);
  const other = rows.find((row) => row.ref === OTHER_REF);
  assert.equal(other.page_views, 1);
  assert.equal(other.connections, 0);
  assert.equal(other.tool_calls, 0);
  assert.equal(other.posts_created, 0);
  assert.equal(rows.length, MAX_REFS_PER_DAY + 1);
  ok("cap overflow goes to other");
}

{
  const env = freshEnv();
  const raw = "Raw Ref Should Not Be Stored";
  const ua = "secret-home-user-agent";
  const cookie = "session=secret-home-cookie";
  const ip = "203.0.113.50";
  const logs = [];
  const originals = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
  for (const level of Object.keys(originals)) {
    console[level] = (...args) => {
      logs.push(args.map((item) => String(item)).join(" "));
    };
  }
  try {
    const viewed = await home(env, `/?ref=${encodeURIComponent(raw)}`, {
      headers: {
        "user-agent": ua,
        cookie,
        "x-forwarded-for": ip,
      },
    });
    assert.equal(viewed.status, 200);
    assert.equal(viewed.text.includes(raw), false);
    assert.equal(viewed.text.includes(ua), false);
    assert.equal(viewed.text.includes(cookie), false);
    assert.equal(viewed.text.includes(ip), false);
  } finally {
    for (const level of Object.keys(originals)) console[level] = originals[level];
  }
  const dumped = JSON.stringify((await stats(env)).json);
  assert.equal(dumped.includes(raw), false);
  assert.equal(dumped.includes(ua), false);
  assert.equal(dumped.includes(cookie), false);
  assert.equal(dumped.includes(ip), false);
  assert.equal(logs.some((line) => line.includes(raw) || line.includes(ua) || line.includes(cookie) || line.includes(ip)), false);
  const rows = (await stats(env)).json.refs;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ref, NONE_REF);
  assert.equal(rows[0].page_views, 1);
  ok("GET / stores and logs nothing from IP, user agent, cookies, headers, or the raw ref");
}

{
  const env = freshEnv();
  const inner = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    if (String(sql).includes("source_counts")) {
      throw new Error("home counter failed");
    }
    return inner(sql);
  };
  const viewed = await home(env, "/?ref=broken-home");
  assert.equal(viewed.status, 200);
  assert.equal(viewed.text, LANDING_HTML);
  ok("errors inside the home-page waitUntil task still serve GET /");
}

{
  const env = freshEnv();
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const inner = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    if (String(sql).includes("source_counts")) {
      const pending = {
        bind() {
          return pending;
        },
        first() {
          return blocked.then(() => null);
        },
        all() {
          return blocked.then(() => ({ results: [] }));
        },
        run() {
          return blocked.then(() => ({ success: true }));
        },
      };
      return pending;
    }
    return inner(sql);
  };
  const gate = captureCtx();
  const responsePromise = worker.fetch(new Request("http://needhave.local/?ref=slow-home"), env, gate.ctx);
  const response = await Promise.race([
    responsePromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("response delayed")), 200)),
  ]);
  assert.equal(response.status, 200);
  release();
  await gate.flush();
  ok("home-page ref count does not delay the response");
}

{
  const migration = readFileSync(join(root, "migrations/0007_page_views.sql"), "utf8");
  assert.match(migration, /page_views INTEGER NOT NULL DEFAULT 0/);
  assert.equal(/\bDELETE\b/i.test(migration), false);
  const sourceCount = openapi.components.schemas.SourceCount;
  assert.equal(sourceCount.required.includes("page_views"), true);
  assert.equal(sourceCount.properties.page_views.type, "integer");
  assert.match(openapi.paths["/stats/refs"].get.description, /page_views/);
  ok("page_views migration and openapi schema");
}

console.log("all ref source-count calls passed");
