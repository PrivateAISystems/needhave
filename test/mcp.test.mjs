import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app.js";
import { LANDING_HTML } from "../src/landing.js";
import { createListClient, LIVE_LIST } from "../src/list-client.js";
import { MAX_NOTE, MAX_POSTS_PER_IP } from "../src/limits.js";
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
  /When you post, you get a code once\. Keep it\. You need that code to see replies and to let one through\. If you lose it, it cannot be replaced\./,
);
assert.match(
  LANDING_HTML,
  /Any reply is hidden from everyone else, not from you\. Use your code to read it, then decide whether to let it through\. After you do, only you and the person who replied can read the conversation\./,
);
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
assert.match((await defaultClient.json()).result.instructions, /https:\/\/needhave\.io/);
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
  "accept_reply",
  "read_thread",
  "write_thread_message",
]);
assert.equal(TOOLS.length, 8);
assert.equal(names.includes("list_waiting"), false);
assert.equal(names.includes("create_account"), false);
assert.equal(names.includes("pay"), false);
assert.equal(names.includes("match"), false);
for (const tool of listed.json.result.tools) {
  assert.match(tool.description, /Use when/i);
  assert.equal(/marketplace|escrow|payment/i.test(tool.description), false);
}
assert.match(init.json.result.instructions, /Use this list when/);
ok("exactly the eight tools");

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
assert.equal(need.data.source, "self");
assert.equal(need.data.id.length, 32);
assert.equal(need.data.secret.length, 64);
const postId = need.data.id;
const postSecret = need.data.secret;

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
  source: "self",
});
assert.equal("secret" in one.data, false);
ok("read one post; secret is not on later reads");

const reply = await callTool("write_first_reply", {
  post_id: postId,
  text: "I have a bike you can borrow on Thursday",
});
assert.equal(reply.isError, false);
assert.equal(reply.data.hidden, true);
assert.equal(reply.data.post_id, postId);
assert.equal(reply.data.secret.length, 64);
const replyId = reply.data.id;
const replySecret = reply.data.secret;

const otherReply = await callTool("write_first_reply", {
  post_id: postId,
  text: "Different replier offering a scooter instead",
});
assert.equal(otherReply.isError, false);
const otherReplyId = otherReply.data.id;
const otherReplySecret = otherReply.data.secret;

const publicAgain = await callTool("read_post", { id: postId });
assert.equal(leak(publicAgain.data, "Thursday"), false);
assert.equal(leak(publicAgain.data, replySecret), false);
const listedAgain = await callTool("list_posts");
assert.equal(leak(listedAgain.data, "Thursday"), false);
ok("first reply stays hidden from anyone without the post secret");

const waitingWrong = await callTool("accept_reply", {
  post_id: postId,
  secret: "0".repeat(64),
});
assert.equal(waitingWrong.isError, true);
assert.equal(waitingWrong.data.error, "bad_secret");
assert.equal(leak(waitingWrong.data, "Thursday"), false);

const waiting = await callTool("accept_reply", {
  post_id: postId,
  secret: postSecret,
});
assert.equal(waiting.isError, false);
assert.equal(waiting.data.messages.length, 2);
assert.equal(waiting.data.messages[0].id, replyId);
assert.equal(waiting.data.messages[0].text, "I have a bike you can borrow on Thursday");
assert.equal(waiting.data.messages[1].id, otherReplyId);
assert.equal("thread_key" in waiting.data, false);
assert.equal(leak(waiting.data, replySecret), false);
ok("accept without message_id reads waiting first replies");

const beforeAccept = await callTool("read_thread", {
  message_id: replyId,
  secret: replySecret,
});
assert.equal(beforeAccept.isError, false);
assert.equal(beforeAccept.data.accepted, false);
assert.equal("thread_key" in beforeAccept.data, false);
ok("replier claim reveals no thread key before accept");

const accepted = await callTool("accept_reply", {
  post_id: postId,
  secret: postSecret,
  message_id: replyId,
});
assert.equal(accepted.isError, false);
assert.equal(accepted.data.thread_key.length, 64);
const threadKey = accepted.data.thread_key;
ok("accept that reply with the post secret returns the thread key");

const acceptedAgain = await callTool("accept_reply", {
  post_id: postId,
  secret: postSecret,
  message_id: replyId,
});
assert.equal(acceptedAgain.isError, true);
assert.equal(acceptedAgain.data.error, "already_accepted");

const claimed = await callTool("read_thread", {
  message_id: replyId,
  secret: replySecret,
});
assert.equal(claimed.isError, false);
assert.equal(claimed.data.accepted, true);
assert.equal(claimed.data.thread_key, threadKey);
assert.equal(claimed.data.post_id, postId);
assert.equal(claimed.data.messages[0].text, "I have a bike you can borrow on Thursday");
ok("replier reads the thread with the reply secret after accept");

const later = await callTool("write_thread_message", {
  thread_key: threadKey,
  text: "Thursday at the library steps works",
});
assert.equal(later.isError, false);
assert.equal(typeof later.data.id, "string");
assert.equal(later.data.post_id, postId);

const thread = await callTool("read_thread", { thread_key: threadKey });
assert.equal(thread.isError, false);
assert.equal(thread.data.messages.length, 2);
assert.equal(thread.data.messages[1].text, "Thursday at the library steps works");
ok("read a thread with its key and write the next message");

const emptyLater = await callTool("write_thread_message", {
  thread_key: threadKey,
  text: "  ",
});
assert.equal(emptyLater.isError, true);
assert.equal(emptyLater.data.error, "empty_note");

const otherClaim = await callTool("read_thread", {
  message_id: replyId,
  secret: otherReplySecret,
});
assert.equal(otherClaim.isError, true);
assert.equal(otherClaim.data.error, "bad_secret");
assert.equal("thread_key" in otherClaim.data, false);

const otherGuess = await callTool("read_thread", { thread_key: otherReplyId });
assert.equal(otherGuess.isError, true);
assert.equal(otherGuess.data.error, "not_found");
assert.equal(leak(otherGuess.data, "library"), false);
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
ok("stdio MCP server lists the same eight tools");

console.log("all mcp calls passed");
