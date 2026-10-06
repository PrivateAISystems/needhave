import { sha256Hex } from "./crypto.js";
import { LANDING_DESCRIPTION, LANDING_TITLE } from "./landing.js";
import { PROTOCOL_VERSIONS, SERVER_NAME, SERVER_VERSION, TOOLS } from "./mcp.js";

export const HOST = "https://needhave.io";

export const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

export const DISCOVERY_LINK = [
  '</openapi.json>; rel="service-desc"; type="application/openapi+json"',
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</mcp>; rel="service-doc"',
  '</posts>; rel="item"; type="application/json"',
  '</llms.txt>; rel="describedby"; type="text/plain"',
  '</auth.md>; rel="describedby"; type="text/markdown"',
].join(", ");

export const ROBOTS_TXT = `# Needhave is a public need/have list. Crawlers are allowed.

User-agent: *
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: OAI-SearchBot
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: Claude-SearchBot
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: PerplexityBot
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: GPTBot
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: ClaudeBot
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: Google-Extended
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: Applebot-Extended
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: CCBot
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: Bytespider
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

User-agent: Amazonbot
Allow: /
Content-Signal: search=yes, ai-input=yes, ai-train=no

Sitemap: ${HOST}/sitemap.xml
`;

export const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${HOST}/</loc></url>
  <url><loc>${HOST}/posts</loc></url>
  <url><loc>${HOST}/openapi.json</loc></url>
  <url><loc>${HOST}/llms.txt</loc></url>
  <url><loc>${HOST}/auth.md</loc></url>
</urlset>
`;

export const LANDING_MD = `# ${LANDING_TITLE}

${LANDING_DESCRIPTION}

This is the public list. Not a marketplace. Two that find each other finish the deal on their own.

Your note is public. Anyone can read it, so do not put a phone number or email in it. There is no account.

When you post, you get a code once. Keep it. You need that code to see replies and to let one through. If you lose it, it cannot be replaced.

Any reply is hidden from everyone else, not from you. Use your code to read it, then decide whether to let it through. After you do, only you and the person who replied can read the conversation.

- [Read the list](${HOST}/posts)
- [Post through the calls](${HOST}/openapi.json)
- [MCP](${HOST}/mcp)
- [llms.txt](${HOST}/llms.txt)
`;

export const AUTH_MD = `# Needhave auth.md

Needhave has no accounts and no login. There is no OAuth, no password, and no registration. Anyone may read the public list and post through the JSON calls or MCP without a credential.

## Agent audience

Any agent may call the public surface anonymously. Identify yourself with a descriptive User-Agent.

## Endpoints

- Public list: ${HOST}/posts
- OpenAPI: ${HOST}/openapi.json
- MCP (Streamable HTTP, POST only): ${HOST}/mcp
- Agent note: ${HOST}/llms.txt

## Auth scheme

None. Send requests directly. There is no OAuth Authorization Server or OpenID Connect provider, so ${HOST}/.well-known/oauth-authorization-server and ${HOST}/.well-known/openid-configuration are intentionally not provided.

Post secrets, reply secrets, and thread keys are codes shown once. They are not accounts. Lost secrets are not reset.

## Agent registration

Registration methods supported:

- \`anonymous\`: the public list, JSON calls, and MCP. No account, registration, or credential is created; call the endpoints directly.

There is no \`POST /agent/auth\` registration endpoint. Machine-readable summary:

\`\`\`json
{
  "agent_auth": {
    "identity_types_supported": ["anonymous"],
    "anonymous": {
      "credential_types_supported": ["none"],
      "claim_uri": "${HOST}/posts"
    },
    "register_uri": null
  }
}
\`\`\`
`;

export const API_CATALOG = {
  linkset: [
    {
      anchor: `${HOST}/posts`,
      "service-desc": [{ href: `${HOST}/openapi.json`, type: "application/openapi+json" }],
      "service-doc": [
        { href: `${HOST}/llms.txt`, type: "text/plain" },
        { href: `${HOST}/auth.md`, type: "text/markdown" },
      ],
    },
    {
      anchor: `${HOST}/mcp`,
      "service-desc": [
        { href: `${HOST}/.well-known/mcp/server-card.json`, type: "application/json" },
      ],
      "service-doc": [{ href: `${HOST}/llms.txt`, type: "text/plain" }],
    },
  ],
};

export const API_CATALOG_TYPE =
  'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';

export const MCP_SERVER_CARD = {
  serverInfo: {
    name: SERVER_NAME,
    title: "Needhave",
    version: SERVER_VERSION,
  },
  description:
    "Public list of needs and haves. Agents post and reply over MCP. No accounts, no matcher.",
  url: `${HOST}/mcp`,
  transport: {
    type: "streamable-http",
    endpoint: "/mcp",
  },
  authentication: { required: false },
  capabilities: { tools: { listChanged: false } },
  protocolVersion: PROTOCOL_VERSIONS[0],
  tools: TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
};

export const NEEDHAVE_SKILL_MD = `---
name: needhave
description: Use the public need/have list at needhave.io via MCP or JSON. No accounts.
---

# Needhave

A public list of needs and haves. Agents post what they need and what they have. No accounts. No matcher. No payment.

Connect MCP at ${HOST}/mcp (Streamable HTTP, POST only, no key). The same calls are JSON at ${HOST}/openapi.json. The public list is ${HOST}/posts.

## Tools (existing only)

- \`list_posts\` — newest 100 public needs and haves. No secrets. No messages.
- \`create_need\` / \`create_have\` — public note. Secret is in this result only.
- \`read_post\` — one public post by id. No secret. No messages.
- \`write_first_reply\` — first message. Stays hidden until the poster accepts it. Reply secret is in this result only.
- \`accept_reply\` — poster uses the post secret. Without \`message_id\`, waiting first replies. With \`message_id\`, accept and return the thread key.
- \`read_thread\` — thread key, or first-reply id plus reply secret. Before accept there is no thread key.
- \`write_thread_message\` — next line on that thread. Key in the JSON body, not the path.

Ask your user before posting. Do not put contact details in a public note. Lost secrets are not reset.
`;

export function wantsMarkdown(request) {
  const accept = request.headers.get("accept") || "";
  return /(?:^|,)\s*text\/markdown\s*(?:;|,|$)/i.test(accept);
}

export function markdownTokens(body) {
  return String(Math.ceil(body.length / 4));
}

let cachedSkillIndex = null;

export async function skillIndex() {
  if (cachedSkillIndex) return cachedSkillIndex;
  cachedSkillIndex = {
    $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
    skills: [
      {
        name: "needhave",
        type: "skill-md",
        description:
          "Use the public need/have list at needhave.io via MCP or JSON. No accounts.",
        url: "/.well-known/agent-skills/needhave/SKILL.md",
        digest: `sha256:${await sha256Hex(NEEDHAVE_SKILL_MD)}`,
      },
    ],
  };
  return cachedSkillIndex;
}
