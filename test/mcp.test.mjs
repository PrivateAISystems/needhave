import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app.js";
import { newId, sha256Hex } from "../src/crypto.js";
import { insertPost } from "../src/db.js";
import { LANDING_HTML } from "../src/landing.js";
import { createListClient, LIVE_LIST } from "../src/list-client.js";
import { MAX_BODY_BYTES, MAX_NOTE, MAX_POSTS_PER_IP } from "../src/limits.js";
import { ONBOARDING_TEXT, POSITIONING_LEAD } from "../src/copy.js";
import { handleMcp, SERVER_VERSION, TOOLS } from "../src/mcp.js";
import worker from "../src/worker.js";
import { createLocalEnv, loadLocalSql } from "./d1-sqlite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = loadLocalSql(root);
const env = createLocalEnv(schema);

async function mcp(body, { method = "POST", path = "/mcp", headers = {} } = {}) {
  const request = new Request(`http://needhave.local${path}`, {
    method,
    headers: {
      accept: "application/json, text/event-stream",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const response = await worker.fetch(request, env);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: response.status, json, text, headers: response.headers };
}

async function callTool(name, args = {}, id = 1) {
  const response = await mcp({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
  assert.equal(response.status, 200);
  assert.equal(response.json.jsonrpc, "2.0");
  assert.equal(response.json.id, id);
  const payload = JSON.parse(response.json.result.content[0].text);
  return {
    isError: Boolean(response.json.result.isError),
    data: payload,
    raw: response.json,
  };
}

function ok(label) {
  console.log(`ok ${label}`);
}

function leak(payload, fragment) {
  return JSON.stringify(payload).includes(fragment);
}

assert.equal(/<form[\s>]/i.test(LANDING_HTML), false);
assert.equal(LANDING_HTML.includes("/mcp"), false);
assert.match(
  LANDING_HTML,
  /Your note is public\. Anyone can read it, so do not put a phone number or email in it\. There is no account\./,
);
assert.match(
  LANDING_HTML,
  /When you post, you get a code once\. Keep it\. If you lose it, it cannot be replaced\./,
);
assert.match(LANDING_HTML, /Your reply is public\. Don't include anything private\./);
ok("landing page is unchanged and has no form");

const home = await worker.fetch(new Request("http://needhave.local/"), env);
assert.equal(home.status, 200);
assert.match(home.headers.get("content-type"), /^text\/html/);
const homeText = await home.text();
assert.equal(homeText, LANDING_HTML);
ok("GET / still serves the same landing HTML");

const defaultClient = await handleMcp(
  new Request("http://needhave.local/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  }),
);
assert.equal(defaultClient.status, 200);
const defaultInstructions = (await defaultClient.json()).result.instructions;
assert.match(defaultInstructions, /https:\/\/needhave\.io/);
assert.equal(defaultInstructions.startsWith(POSITIONING_LEAD), true);
assert.equal(defaultInstructions.includes(ONBOARDING_TEXT), true);
assert.equal(LIVE_LIST, "https://needhave.io");
assert.equal(createListClient().baseUrl, LIVE_LIST);
const stdioSource = readFileSync(join(root, "src/mcp-stdio.js"), "utf8");
assert.match(stdioSource, /NEEDHAVE_LIST_URL \|\| LIVE_LIST/);
assert.equal(stdioSource.includes("createInProcessListClient"), false);
const listClientSource = readFileSync(join(root, "src/list-client.js"), "utf8");
assert.match(listClientSource, /call\("POST", "\/threads", \{ thread_key: threadKey \}\)/);
assert.match(
  listClientSource,
  /call\("POST", "\/threads\/messages", \{ thread_key: threadKey, text \}\)/,
);
assert.equal(listClientSource.includes("/threads/${"), false);
assert.equal(listClientSource.includes("/threads/`"), false);
ok("local stdio client stays pointed at the live list");

const htmlList = createListClient({
  fetch: async () =>
    new Response("<!DOCTYPE html><html><body>needhave</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
});
const htmlResult = await htmlList.listPosts();
assert.deepEqual(htmlResult.data, { error: "bad_list_response" });
ok("HTTP list client reports bad_list_response when the body is not JSON");

const originalFetch = globalThis.fetch;
let fetchedLive = false;
globalThis.fetch = async (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("needhave.io")) {
    fetchedLive = true;
    return new Response("<!DOCTYPE html><html><body>self-fetch</body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  if (typeof originalFetch === "function") return originalFetch(input, init);
  throw new Error(`unexpected fetch: ${url}`);
};
try {
  const inProcess = await mcp({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "list_posts", arguments: {} },
  });
  assert.equal(inProcess.status, 200);
  assert.deepEqual(JSON.parse(inProcess.json.result.content[0].text), { posts: [] });
  assert.equal(inProcess.json.result.isError, false);
  assert.equal(fetchedLive, false);
} finally {
  globalThis.fetch = originalFetch;
}
ok("Worker MCP calls the list handlers in process and does not fetch needhave.io");

const init = await mcp({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "0" } },
});
assert.equal(init.status, 200);
assert.match(init.headers.get("content-type"), /^application\/json/);
assert.equal(init.json.result.protocolVersion, "2025-03-26");
assert.equal(init.json.result.serverInfo.name, "needhave");
assert.equal(init.json.result.serverInfo.version, SERVER_VERSION);
assert.equal(SERVER_VERSION, JSON.parse(readFileSync(join(root, "server.json"), "utf8")).version);
assert.deepEqual(init.json.result.capabilities, { tools: { listChanged: false } });
ok("initialize");

const initialized = await mcp({ jsonrpc: "2.0", method: "notifications/initialized" });
assert.equal(initialized.status, 202);
ok("initialized notification is 202");

const listed = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" });
assert.equal(listed.status, 200);
const names = listed.json.result.tools.map((tool) => tool.name);
assert.deepEqual(names, [
  "list_posts",
  "create_need",
  "create_have",
  "read_post",
  "write_first_reply",
  "read_thread",
  "write_thread_message",
]);
assert.equal(TOOLS.length, 7);
assert.equal(names.includes("accept_reply"), false);
assert.equal(names.includes("list_waiting"), false);
assert.equal(names.includes("create_account"), false);
assert.equal(names.includes("pay"), false);
assert.equal(names.includes("match"), false);
for (const tool of listed.json.result.tools) {
  assert.match(tool.description, /Use when/i);
  assert.equal(/marketplace|escrow|payment/i.test(tool.description), false);
}
assert.match(init.json.result.instructions, /Use this list when/);
assert.equal(init.json.result.instructions.startsWith(POSITIONING_LEAD), true);
assert.equal(init.json.result.instructions.includes(ONBOARDING_TEXT), true);
const listPostsTool = listed.json.result.tools.find((tool) => tool.name === "list_posts");
assert.equal(listPostsTool.description.startsWith(ONBOARDING_TEXT), true);
assert.match(listPostsTool.description, /Use when/i);
const writeFirst = listed.json.result.tools.find((tool) => tool.name === "write_first_reply");
assert.equal(writeFirst.description.includes(ONBOARDING_TEXT), false);
assert.match(writeFirst.description, /Your reply is public\. Don't include anything private\./);
assert.match(
  listed.json.result.tools.find((tool) => tool.name === "read_thread").description,
  /older accepted threads only/,
);
assert.match(
  listed.json.result.tools.find((tool) => tool.name === "write_thread_message").description,
  /older accepted threads only/,
);
ok("exactly the seven tools");
ok("accept_reply is gone from tools/list");

const empty = await callTool("list_posts");
assert.equal(empty.isError, false);
assert.deepEqual(empty.data, { posts: [] });
ok("list posts");

const emptyNeed = await callTool("create_need", { note: "   " });
assert.equal(emptyNeed.isError, true);
assert.equal(emptyNeed.data.error, "empty_note");

const hugeHave = await callTool("create_have", { note: "x".repeat(MAX_NOTE + 1) });
assert.equal(hugeHave.isError, true);
assert.equal(hugeHave.data.error, "huge_note");
ok("drop empty and huge notes");

const need = await callTool("create_need", {
  note: "Need a working bicycle in town this week",
});
assert.equal(need.isError, false);
assert.equal(need.data.kind, "need");
assert.equal(need.data.note, "Need a working bicycle in town this week");
assert.equal(need.data.id.length, 32);
assert.equal(need.data.secret.length, 64);
const postId = need.data.id;
const postSecret = need.data.secret;
// created_at is millisecond resolution. A tie sorts by id and can fail newest-first.
await new Promise((resolve) => setTimeout(resolve, 5));

const have = await callTool("create_have", {
  note: "Have a spare tent someone can pick up tonight",
});
assert.equal(have.isError, false);
assert.equal(have.data.kind, "have");
assert.equal("secret" in have.data, true);

const duplicate = await callTool("create_have", {
  note: "Need a working bicycle in town this week",
});
assert.equal(duplicate.isError, true);
assert.equal(duplicate.data.error, "duplicate_note");
ok("create a need and a have; drop duplicate text");

const posts = await callTool("list_posts");
assert.equal(posts.data.posts.length, 2);
assert.equal(posts.data.posts[0].id, have.data.id);
assert.equal("secret" in posts.data.posts[0], false);
assert.equal(leak(posts.data, postSecret), false);

const one = await callTool("read_post", { id: postId });
assert.equal(one.isError, false);
assert.deepEqual(one.data, {
  id: postId,
  kind: "need",
  note: "Need a working bicycle in town this week",
  replies: [],
});
assert.equal("secret" in one.data, false);
ok("read one post; secret is not on later reads");

const PRE_DEPLOY = "MCP_PRE_DEPLOY_CONFIDENTIAL_REPLY_9f3a";
const PRIVATE_LATER = "MCP_PRIVATE_THREAD_LATER_9f3a";
const OLD_FIRST = "MCP_OLD_THREAD_FIRST_9f3a";
const THREAD_KEY = "ef".repeat(32);
const OLD_REPLY_SECRET = "12".repeat(32);

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

await insertRaw({
  id: newId(),
  post_id: postId,
  text: PRE_DEPLOY,
  role: "first",
  created_at: 1,
  visible: 0,
});
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

const reply = await callTool("write_first_reply", {
  post_id: postId,
  text: "I have a bike you can borrow on Thursday",
});
assert.equal(reply.isError, false);
assert.equal(reply.data.post_id, postId);
assert.equal(reply.data.secret.length, 64);
assert.equal("hidden" in reply.data, false);
assert.equal("thread_key" in reply.data, false);
assert.equal(leak(reply.data, postSecret), false);
assert.equal(leak(reply.data, THREAD_KEY), false);
const replyId = reply.data.id;
const replySecret = reply.data.secret;
ok("write_first_reply does not echo the post secret or a thread key");

const publicAgain = await callTool("read_post", { id: postId });
assert.equal(publicAgain.isError, false);
assert.equal(
  publicAgain.data.replies.some((row) => row.text === "I have a bike you can borrow on Thursday"),
  true,
);
assert.equal(leak(publicAgain.data, PRE_DEPLOY), false);
assert.equal(leak(publicAgain.data, PRIVATE_LATER), false);
assert.equal(leak(publicAgain.data, OLD_FIRST), false);
assert.equal(leak(publicAgain.data, replySecret), false);
assert.equal(leak(publicAgain.data, THREAD_KEY), false);
ok("a new reply is visible on read_post");
ok("pre-deploy reply stays hidden on read_post");

const listedAgain = await callTool("list_posts");
assert.equal(
  listedAgain.data.posts.some((post) =>
    (post.replies || []).some((row) => row.text === "I have a bike you can borrow on Thursday"),
  ),
  true,
);
assert.equal(leak(listedAgain.data, PRE_DEPLOY), false);
assert.equal(leak(listedAgain.data, PRIVATE_LATER), false);
assert.equal(leak(listedAgain.data, THREAD_KEY), false);
ok("pre-deploy reply stays hidden on list_posts");

const junk = await callTool("write_first_reply", {
  post_id: postId,
  text: "spam-bot@example.com",
});
assert.equal(junk.isError, true);
assert.equal(junk.data.error, "empty_note");
ok("a junk reply is filtered");

const gone = await mcp({
  jsonrpc: "2.0",
  id: 50,
  method: "tools/call",
  params: { name: "accept_reply", arguments: { post_id: postId, secret: postSecret } },
});
assert.equal(gone.json.error.code, -32602);
ok("accept_reply is gone from tools/call");

const beforeAccept = await callTool("read_thread", {
  message_id: replyId,
  secret: replySecret,
});
assert.equal(beforeAccept.isError, false);
assert.equal(beforeAccept.data.accepted, false);
assert.equal("thread_key" in beforeAccept.data, false);
ok("a new reply does not open a thread");

const thread = await callTool("read_thread", { thread_key: THREAD_KEY });
assert.equal(thread.isError, false);
assert.equal(thread.data.messages.some((row) => row.text === OLD_FIRST), true);
assert.equal(thread.data.messages.some((row) => row.text === PRIVATE_LATER), true);
ok("an existing thread is still readable with its key");

const later = await callTool("write_thread_message", {
  thread_key: THREAD_KEY,
  text: "Thursday at the library steps works",
});
assert.equal(later.isError, false);
assert.equal(typeof later.data.id, "string");
assert.equal(later.data.post_id, postId);

const threadAgain = await callTool("read_thread", { thread_key: THREAD_KEY });
assert.equal(threadAgain.isError, false);
assert.equal(threadAgain.data.messages.some((row) => row.text === "Thursday at the library steps works"), true);
const stillPublic = await callTool("read_post", { id: postId });
assert.equal(leak(stillPublic.data, "library"), false);
assert.equal(leak(stillPublic.data, PRIVATE_LATER), false);
ok("read a thread with its key and write the next message");

const emptyLater = await callTool("write_thread_message", {
  thread_key: THREAD_KEY,
  text: "  ",
});
assert.equal(emptyLater.isError, true);
assert.equal(emptyLater.data.error, "empty_note");

const claimed = await callTool("read_thread", {
  message_id: oldFirstId,
  secret: OLD_REPLY_SECRET,
});
assert.equal(claimed.isError, false);
assert.equal(claimed.data.accepted, true);
assert.equal(claimed.data.thread_key, THREAD_KEY);
assert.equal(claimed.data.messages.some((row) => row.text === OLD_FIRST), true);

const otherGuess = await callTool("read_thread", { thread_key: replyId });
assert.equal(otherGuess.isError, true);
assert.equal(otherGuess.data.error, "not_found");
assert.equal(leak(otherGuess.data, "library"), false);
assert.equal(leak(otherGuess.data, PRIVATE_LATER), false);
ok("a different replier cannot read that thread");


const unknownTool = await mcp({
  jsonrpc: "2.0",
  id: 99,
  method: "tools/call",
  params: { name: "create_account", arguments: {} },
});
assert.equal(unknownTool.json.error.code, -32602);
ok("unknown tools are rejected");

const options = await mcp(undefined, { method: "OPTIONS" });
assert.equal(options.status, 204);
assert.equal(options.headers.get("access-control-allow-origin"), "*");

const get = await mcp(undefined, { method: "GET" });
assert.equal(get.status, 405);

const slash = await mcp(
  { jsonrpc: "2.0", id: 3, method: "ping" },
  { path: "/mcp/" },
);
assert.equal(slash.status, 200);
assert.deepEqual(slash.json.result, {});
ok("HTTP /mcp is the streamable endpoint");

const stillList = await worker.fetch(new Request("http://needhave.local/posts"), env);
assert.equal(stillList.status, 200);
assert.match(stillList.headers.get("content-type"), /^application\/json/);
const stillListJson = await stillList.json();
assert.equal(stillListJson.posts.length, 2);
assert.equal("secret" in stillListJson.posts[0], false);
ok("the Worker still serves the same JSON list");

const batch = [];
for (let i = 0; i < MAX_POSTS_PER_IP + 2; i++) {
  batch.push({
    jsonrpc: "2.0",
    id: 200 + i,
    method: "tools/call",
    params: {
      name: "create_need",
      arguments: { note: `Need a batch flood note ${i} for the per-ip cap` },
    },
  });
}
const batched = await mcp(batch, { headers: { "cf-connecting-ip": "198.51.100.77" } });
assert.equal(batched.status, 200);
assert.equal(Array.isArray(batched.json), true);
const batchPayloads = batched.json.map((item) => JSON.parse(item.result.content[0].text));
const batchOk = batchPayloads.filter((item) => item.id && item.secret);
const batchLimited = batchPayloads.filter((item) => item.error === "rate_limited");
assert.equal(batchOk.length, MAX_POSTS_PER_IP);
assert.equal(batchLimited.length, 2);
ok("MCP JSON-RPC batch cannot skip the per-ip create-post limit");

const stdio = await new Promise((resolve, reject) => {
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    const headers = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers[key] = value;
    }
    const request = new Request(`http://needhave.local${req.url}`, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : raw,
    });
    const response = await handle(request, env);
    res.writeHead(response.status, {
      "content-type": response.headers.get("content-type") || "application/json",
    });
    res.end(await response.text());
  });
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    const child = spawn(process.execPath, [join(root, "src/mcp-stdio.js")], {
      cwd: root,
      env: { ...process.env, NEEDHAVE_LIST_URL: `http://127.0.0.1:${port}` },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
      if (out.includes("\n")) {
        child.stdin.end();
      }
    });
    child.on("error", reject);
    child.on("close", () => {
      server.close();
      resolve(out);
    });
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })}\n`,
    );
  });
});

const stdioMessage = JSON.parse(stdio.trim().split("\n")[0]);
assert.deepEqual(
  stdioMessage.result.tools.map((tool) => tool.name),
  names,
);
ok("stdio MCP server lists the same seven tools");

await insertPost(env.DB, {
  id: "e46e3201306590da51457ee90b83a2a3",
  kind: "need",
  note: "Looking for Help from https://news.ycombinator.com/item?id=49968927",
  secret_hash: "cd".repeat(32),
  created_at: Date.now(),
  source_url: "https://news.ycombinator.com/item?id=49968927",
  note_hash: "hidden-mcp",
});
const listedHidden = await callTool("list_posts");
assert.equal(
  (listedHidden.data.posts || []).some((post) => post.id === "e46e3201306590da51457ee90b83a2a3"),
  false,
);
const readHidden = await callTool("read_post", { id: "e46e3201306590da51457ee90b83a2a3" });
assert.equal(readHidden.data.error, "not_found");
ok("MCP list and read exclude hidden posts");

const mcpOver = await worker.fetch(
  new Request("http://needhave.local/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: {
        name: "write_first_reply",
        arguments: { post_id: "ab".repeat(16), text: "ab".repeat(MAX_BODY_BYTES) },
      },
    }),
  }),
  env,
);
assert.equal(mcpOver.status, 413);
assert.equal((await mcpOver.json()).error, "payload_too_large");
ok("MCP rejects an oversized reply body");

console.log("all mcp calls passed");
