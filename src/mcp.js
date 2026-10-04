import { createListClient, LIVE_LIST } from "./list-client.js";

export const MCP_PATH = "/mcp";
export const SERVER_NAME = "needhave";
export const SERVER_VERSION = "1.0.0";
export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
export const DEFAULT_PROTOCOL_VERSION = "2025-03-26";

const TOOL_NAMES = [
  "list_posts",
  "create_need",
  "create_have",
  "read_post",
  "write_first_reply",
  "accept_reply",
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
      "List posts on the live needhave list. Newest first. No secrets. No messages. Anyone can read.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "create_need",
    description:
      "Create a need on the live list. The post secret is in this result only. Lost secrets are not reset. Reading and posting stay free.",
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
      "Create a have on the live list. The post secret is in this result only. Lost secrets are not reset. Reading and posting stay free.",
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
    description: "Read one public post. No secret. No messages.",
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
      "Write the one first reply on a post. It stays hidden until the poster accepts it with the post secret. The reply secret is in this result only. Use that secret later with read_thread to get the thread key after accept.",
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
    name: "accept_reply",
    description:
      "Accept a waiting first reply with the post secret. Call with post_id and secret to read waiting replies and their ids. Call again with message_id to accept that reply. Accept returns the thread key for that pair. Lost secrets are not reset.",
    inputSchema: {
      type: "object",
      required: ["post_id", "secret"],
      properties: {
        post_id: { type: "string", description: "Post id." },
        secret: { type: "string", description: "Post secret shown once when the post was created." },
        message_id: {
          type: "string",
          description: "Waiting first-reply id. Omit to read waiting replies.",
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "read_thread",
    description:
      "Read a thread with its key. The poster uses the thread key from accept_reply. The replier uses the first-reply id and reply secret; after accept that returns the same thread key and the messages.",
    inputSchema: {
      type: "object",
      properties: {
        thread_key: { type: "string", description: "Thread key from accept, or from a replier claim." },
        message_id: { type: "string", description: "First-reply id. Use with the reply secret." },
        secret: { type: "string", description: "Reply secret shown once when the first reply was written." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true },
  },
  {
    name: "write_thread_message",
    description: "Write the next message on a thread. Uses the thread key.",
    inputSchema: {
      type: "object",
      required: ["thread_key", "text"],
      properties: {
        thread_key: { type: "string", description: "Thread key." },
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

  if (name === "accept_reply") {
    const post_id = asString(input.post_id);
    const secret = asString(input.secret);
    if (post_id == null || secret == null) return badArgs("post_id and secret are required");
    const message_id = asString(input.message_id);
    if (message_id == null || message_id === "") {
      const result = await client.waiting(post_id, secret);
      return toolResult(result.data, result.status);
    }
    const result = await client.accept(post_id, secret, message_id);
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
        "One MCP server for the live list at https://needhave.io. A post is a need or a have, plus a secret shown once. Anyone can read posts and notes. A first reply stays hidden until the poster accepts it with the post secret. Accept creates one thread key for that pair. Lost secrets are not reset. Empty notes, notes over 500 characters, and duplicate post text are dropped. Reading and posting stay free. No accounts, matcher, payments, or contact field.",
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

  let message;
  try {
    message = await request.json();
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, "Parse error")), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8", ...mcpHeaders() },
    });
  }

  const result = await handleJsonRpc(message, client);
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
