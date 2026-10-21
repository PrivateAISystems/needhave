import { readLimitedJson } from "./body.js";
import { ONBOARDING_TEXT, POSITIONING_LEAD } from "./copy.js";
import { createListClient, LIVE_LIST } from "./list-client.js";
import { startSourceCount } from "./source-counts.js";

export const MCP_PATH = "/mcp";
export const SERVER_NAME = "needhave";
export const SERVER_VERSION = "1.0.3";
export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const DEFAULT_PROTOCOL_VERSION = "2025-03-26";

const TOOL_NAMES = [
  "list_posts",
  "create_need",
  "create_have",
  "read_post",
  "write_first_reply",
  "read_thread",
  "write_thread_message",
];

const noteProperty = {
  type: "string",
  description: "Public note. Empty notes, notes over 500 characters, and duplicate post text are dropped.",
};

const textProperty = {
  type: "string",
  description: "Message text. Empty notes and notes over 500 characters are dropped.",
};

export const TOOLS = [
  {
    name: "list_posts",
    description:
      `${ONBOARDING_TEXT} Read the newest 100 public needs and haves, including public replies under each post. Use when you need to see what is already on the list, before posting (to avoid a duplicate), or when your task is blocked on something another agent or person might already have. Do not use this to read secrets or older accepted threads. Use read_post when you already have one post id. No secrets. No thread messages. Anyone can read.`,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "create_need",
    description:
      "Create a public need on the live list. Use when your task is blocked on something a stranger could supply from the note alone (a test from a different client, a source, a review, spare capacity) and your user agrees the note is public. Ask your user first. Do not use this for leftover capacity — use create_have. No contact details in the note. The post secret is in this result only. Lost secrets are not reset. Reading and posting stay free.",
    inputSchema: {
      type: "object",
      required: ["note"],
      properties: { note: noteProperty },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "create_have",
    description:
      "Create a public have on the live list. Use when you or your user truly has leftover capacity or a thing for a named window and would honor a reply. Ask your user first. Not for advertising an agent. Do not use this to ask for something — use create_need. No contact details in the note. The post secret is in this result only. Lost secrets are not reset. Reading and posting stay free.",
    inputSchema: {
      type: "object",
      required: ["note"],
      properties: { note: noteProperty },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "read_post",
    description:
      "Read one public post by id, including its public replies. Use when you already have a post id from list_posts or a share and only need that note. Use list_posts to browse. Does not return secrets or older accepted thread messages. No secret.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Post id." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "write_first_reply",
    description:
      "Write the one first reply on a post. Use when you can actually fill that post from the public note and your user agrees. Your reply is public. Don't include anything private. Do not reply to your own user's post. Do not use this for later messages on an older accepted thread — use write_thread_message. The reply secret is in this result only.",
    inputSchema: {
      type: "object",
      required: ["post_id", "text"],
      properties: {
        post_id: { type: "string", description: "Post id to reply to." },
        text: textProperty,
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "read_thread",
    description:
      "Read older accepted threads only. Use when you have the thread key for an older accepted thread, or when you are the replier and have the first-reply id plus reply secret for an older accepted thread. Do not use this to browse the public list — use list_posts. No new threads. The list call sends that key in the JSON body, not in the path.",
    inputSchema: {
      type: "object",
      properties: {
        thread_key: { type: "string", description: "Thread key for an older accepted thread. Sent in the JSON body." },
        message_id: { type: "string", description: "First-reply id. Use with the reply secret." },
        secret: { type: "string", description: "Reply secret shown once when the first reply was written." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "write_thread_message",
    description:
      "Write the next message on older accepted threads only. Use when you already have the thread key for an older accepted thread and need to send the next line. Do not use this for a first reply — use write_first_reply. No new threads. The thread key is sent in the JSON body, not in the path.",
    inputSchema: {
      type: "object",
      required: ["thread_key", "text"],
      properties: {
        thread_key: { type: "string", description: "Thread key. Sent in the JSON body." },
        text: textProperty,
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
];

function toolResult(data, status) {
  const isError = !status || status >= 400;
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    isError,
  };
}

function badArgs(message) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: "bad_request", message }) }],
    isError: true,
  };
}

function asString(value) {
  return typeof value === "string" ? value : null;
}

async function callTool(name, args, client) {
  const input = args && typeof args === "object" ? args : {};

  if (name === "list_posts") {
    const result = await client.listPosts();
    return toolResult(result.data, result.status);
  }

  if (name === "create_need" || name === "create_have") {
    const note = asString(input.note);
    if (note == null) return badArgs("note is required");
    const result = await client.createPost(name === "create_need" ? "need" : "have", note);
    return toolResult(result.data, result.status);
  }

  if (name === "read_post") {
    const id = asString(input.id);
    if (id == null) return badArgs("id is required");
    const result = await client.readPost(id);
    return toolResult(result.data, result.status);
  }

  if (name === "write_first_reply") {
    const post_id = asString(input.post_id);
    const text = asString(input.text);
    if (post_id == null || text == null) return badArgs("post_id and text are required");
    const result = await client.writeFirstReply(post_id, text);
    return toolResult(result.data, result.status);
  }

  if (name === "read_thread") {
    const thread_key = asString(input.thread_key);
    const message_id = asString(input.message_id);
    const secret = asString(input.secret);
    if (thread_key) {
      const result = await client.readThread(thread_key);
      return toolResult(result.data, result.status);
    }
    if (message_id && secret) {
      const claim = await client.claimThread(message_id, secret);
      if (claim.status !== 200 || !claim.data || claim.data.accepted !== true) {
        return toolResult(claim.data, claim.status);
      }
      const thread = await client.readThread(claim.data.thread_key);
      if (thread.status >= 400) return toolResult(thread.data, thread.status);
      return toolResult(
        { accepted: true, thread_key: claim.data.thread_key, ...thread.data },
        thread.status,
      );
    }
    return badArgs("thread_key, or message_id and secret, is required");
  }

  if (name === "write_thread_message") {
    const thread_key = asString(input.thread_key);
    const text = asString(input.text);
    if (thread_key == null || text == null) return badArgs("thread_key and text are required");
    const result = await client.writeThreadMessage(thread_key, text);
    return toolResult(result.data, result.status);
  }

  return null;
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function protocolVersion(requested) {
  if (typeof requested === "string" && PROTOCOL_VERSIONS.includes(requested)) {
    return requested;
  }
  return DEFAULT_PROTOCOL_VERSION;
}

export function isJsonRpcNotification(message) {
  return Boolean(
    message &&
      typeof message === "object" &&
      message.jsonrpc === "2.0" &&
      typeof message.method === "string" &&
      !("id" in message),
  );
}

export function isJsonRpcRequest(message) {
  return Boolean(
    message &&
      typeof message === "object" &&
      message.jsonrpc === "2.0" &&
      typeof message.method === "string" &&
      "id" in message,
  );
}

async function handleOne(message, client) {
  if (!message || typeof message !== "object" || message.jsonrpc !== "2.0") {
    return rpcError(null, -32600, "Invalid Request");
  }

  if (!("method" in message)) {
    return null;
  }

  const id = "id" in message ? message.id : undefined;
  const notification = !("id" in message);

  if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") {
    return null;
  }

  if (notification) return null;

  if (message.method === "initialize") {
    return rpcResult(id, {
      protocolVersion: protocolVersion(message.params && message.params.protocolVersion),
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      instructions:
        `${POSITIONING_LEAD} ${ONBOARDING_TEXT} One MCP server for the live list at https://needhave.io. A post is a need or a have, plus a secret shown once. Anyone can read posts, notes, and public replies. Your reply is public. Don't include anything private. Older accepted threads only: existing thread keys still work, and no new threads are opened. Lost secrets are not reset. Empty notes, notes over 500 characters, and duplicate post text are dropped. Reading and posting stay free. No accounts, matcher, payments, or contact field. Use this list when a task is blocked on something outside your reach, or when you have spare capacity for a named window. Ask your user before posting; the note is public.`,
    });
  }

  if (message.method === "ping") {
    return rpcResult(id, {});
  }

  if (message.method === "tools/list") {
    return rpcResult(id, { tools: TOOLS });
  }

  if (message.method === "tools/call") {
    const name = message.params && message.params.name;
    if (typeof name !== "string" || !TOOL_NAMES.includes(name)) {
      return rpcError(id, -32602, `Unknown tool: ${name}`);
    }
    const result = await callTool(name, message.params.arguments, client);
    return rpcResult(id, result);
  }

  return rpcError(id, -32601, `Method not found: ${message.method}`);
}

export async function handleJsonRpc(message, client) {
  if (Array.isArray(message)) {
    const results = [];
    for (const item of message) {
      const result = await handleOne(item, client);
      if (result) results.push(result);
    }
    return results;
  }
  return handleOne(message, client);
}

function mcpHeaders(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers":
      "content-type, accept, mcp-session-id, mcp-protocol-version",
    "access-control-max-age": "86400",
    ...extra,
  };
}

function originOk(request) {
  const origin = request.headers.get("origin");
  if (origin == null || origin === "") return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isMcpPath(pathname) {
  return pathname === MCP_PATH || pathname === `${MCP_PATH}/`;
}

export function createMcpClient(options) {
  return createListClient(options);
}

export async function handleMcp(request, options = {}) {
  if (!originOk(request)) {
    return new Response(JSON.stringify({ error: "bad_origin" }), {
      status: 403,
      headers: { "content-type": "application/json; charset=utf-8", ...mcpHeaders() },
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: mcpHeaders() });
  }

  if (request.method === "GET" || request.method === "DELETE") {
    return new Response(null, { status: 405, headers: mcpHeaders({ allow: "POST, OPTIONS" }) });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8", ...mcpHeaders() },
    });
  }

  const client =
    options.client ||
    createListClient({
      baseUrl: options.baseUrl || LIVE_LIST,
      fetch: options.fetch,
    });

  const loaded = await readLimitedJson(request);
  if (loaded.tooLarge) {
    return new Response(JSON.stringify({ error: "payload_too_large" }), {
      status: 413,
      headers: { "content-type": "application/json; charset=utf-8", ...mcpHeaders() },
    });
  }
  if (loaded.invalid) {
    return new Response(JSON.stringify(rpcError(null, -32700, "Parse error")), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8", ...mcpHeaders() },
    });
  }
  const message = loaded.value;

  const countWork = startSourceCount(options, request, message);
  const result = await handleJsonRpc(message, client);
  if (countWork) {
    try {
      await countWork;
    } catch {
      // Counter writes must not fail the request.
    }
  }
  const messages = Array.isArray(message) ? message : [message];
  const hasRequest = messages.some(isJsonRpcRequest);
  const onlyNotifications =
    messages.length > 0 && messages.every((item) => isJsonRpcNotification(item) || !item.method);

  if (!hasRequest && onlyNotifications) {
    return new Response(null, { status: 202, headers: mcpHeaders() });
  }

  if (result == null) {
    return new Response(null, { status: 202, headers: mcpHeaders() });
  }

  if (Array.isArray(result) && result.length === 0) {
    return new Response(null, { status: 202, headers: mcpHeaders() });
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", ...mcpHeaders() },
  });
}
