import { createListClient, LIVE_LIST } from "./list-client.js";
import { handleJsonRpc } from "./mcp.js";

const client = createListClient({
  baseUrl: process.env.NEEDHAVE_LIST_URL || LIVE_LIST,
});

const decoder = new TextDecoder();
let buffer = "";

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function onLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  let message;
  try {
    message = JSON.parse(trimmed);
  } catch {
    write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  const result = await handleJsonRpc(message, client);
  if (result == null) return;
  if (Array.isArray(result) && result.length === 0) return;
  write(result);
}

for await (const chunk of process.stdin) {
  buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
  let newline;
  while ((newline = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    await onLine(line);
  }
}

if (buffer.trim()) {
  await onLine(buffer);
}
