const error = {
  type: "object",
  required: ["error"],
  properties: {
    error: { type: "string" },
    source_url: { type: "string" },
  },
  additionalProperties: false,
};

const publicReply = {
  type: "object",
  required: ["id", "text"],
  properties: {
    id: { type: "string" },
    text: { type: "string" },
  },
  additionalProperties: false,
};

const publicPost = {
  type: "object",
  required: ["id", "kind", "note", "replies"],
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: ["need", "have"] },
    note: { type: "string" },
    source_url: { type: "string" },
    replies: { type: "array", items: { $ref: "#/components/schemas/PublicReply" } },
  },
  additionalProperties: false,
  example: {
    id: "0123456789abcdef0123456789abcdef",
    kind: "need",
    note: "Need a working bicycle in town this week",
    replies: [
      {
        id: "fedcba9876543210fedcba9876543210",
        text: "I can bring one on Thursday",
      },
    ],
  },
};

const message = {
  type: "object",
  required: ["id", "text"],
  properties: {
    id: { type: "string" },
    text: { type: "string" },
  },
  additionalProperties: false,
};

function jsonContent(schema) {
  return { content: { "application/json": { schema } } };
}

function jsonResponse(description, schema) {
  return { description, ...jsonContent(schema) };
}

function errorResponse(description) {
  return jsonResponse(description, { $ref: "#/components/schemas/Error" });
}

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
};

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Needhave",
    description: "One public list. Two posts: need and have. No accounts.",
    version: "1.0.0",
  },
  servers: [{ url: "https://needhave.io" }],
  paths: {
    "/stats/refs": {
      get: {
        summary: "List source counts",
        description:
          "Read-only per-day, per-ref totals. connections, tool_calls, posts_created, and page_views. No secrets. No hidden_posts.",
        parameters: [
          {
            name: "days",
            in: "query",
            required: false,
            description: "Integer window from 1 to 90. Default 7.",
            schema: { type: "integer", minimum: 1, maximum: 90, default: 7 },
          },
        ],
        responses: {
          200: jsonResponse("Per-day, per-ref totals", {
            type: "object",
            required: ["days", "refs"],
            properties: {
              days: { type: "integer" },
              refs: {
                type: "array",
                items: { $ref: "#/components/schemas/SourceCount" },
              },
            },
            additionalProperties: false,
          }),
          400: errorResponse("bad_request"),
        },
      },
    },
    "/copier/runs": {
      get: {
        summary: "List recent copier runs",
        description:
          "Read-only per-source copier log. HTTP status, throttle fields, counts, and skip reasons. No secrets.",
        responses: {
          200: jsonResponse("Recent copier runs", {
            type: "object",
            required: ["runs"],
            properties: {
              runs: {
                type: "array",
                items: { $ref: "#/components/schemas/CopierRun" },
              },
            },
            additionalProperties: false,
          }),
        },
      },
    },
    "/copier/ingest": {
      post: {
        summary: "Ingest Stack Exchange candidates",
        description:
          "Authenticated write path for Stack Exchange items fetched off the Worker IP. Bearer COPIER_INGEST_SECRET. Off unless COPIER_ENABLED is exactly 1 and that secret is set. The flag is checked before the body and the secret. Same filter, attribution, caps, and insert-only rules as the scheduled copier. No secrets in the response.",
        security: [{ ingestBearer: [] }],
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["source", "items"],
            properties: {
              source: { type: "string", enum: ["stackexchange"] },
              items: { type: "array", items: { type: "object" } },
              http_status: { type: ["integer", "null"] },
              error: { type: ["string", "null"] },
              backoff: { type: ["integer", "null"] },
              quota_remaining: { type: ["integer", "null"] },
            },
            additionalProperties: false,
          }),
        },
        responses: {
          200: jsonResponse("Ingest result", {
            type: "object",
            required: ["enabled", "dry_run", "copied", "would_copy", "by_source", "items", "sources"],
            properties: {
              enabled: { type: "boolean" },
              dry_run: { type: "boolean" },
              copied: { type: "integer" },
              would_copy: { type: "integer" },
              by_source: { type: "object" },
              items: { type: "array" },
              sources: {
                type: "array",
                items: { $ref: "#/components/schemas/CopierRun" },
              },
            },
            additionalProperties: false,
          }),
          400: errorResponse("bad_request or bad_source"),
          401: errorResponse("unauthorized"),
          404: errorResponse("not_found"),
          413: errorResponse("payload_too_large"),
        },
      },
    },
    "/posts": {
      get: {
        summary: "List posts",
        description:
          "Public list. Newest first. Public replies are included under each post. No secrets. No thread messages. Copied posts include source_url. Your reply is public. Don't include anything private.",
        responses: {
          200: jsonResponse("Public list", {
            type: "object",
            required: ["posts"],
            properties: {
              posts: { type: "array", items: { $ref: "#/components/schemas/PublicPost" } },
            },
            additionalProperties: false,
          }),
        },
      },
      post: {
        summary: "Create a post",
        description: "Secret is in this response only.",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["kind", "note"],
            properties: {
              kind: { type: "string", enum: ["need", "have"] },
              note: { type: "string" },
            },
          }),
        },
        responses: {
          201: jsonResponse("Created post", {
            type: "object",
            required: ["id", "kind", "note", "secret"],
            properties: {
              id: { type: "string" },
              kind: { type: "string", enum: ["need", "have"] },
              note: { type: "string" },
              secret: { type: "string" },
            },
            additionalProperties: false,
          }),
          400: errorResponse("bad_kind, empty_note, or huge_note"),
          409: errorResponse("duplicate_note"),
          413: errorResponse("payload_too_large"),
          429: errorResponse("rate_limited"),
        },
      },
    },
    "/posts/{id}": {
      get: {
        summary: "Get one post",
        description:
          "One public post and its public replies. No secret. No thread messages. Your reply is public. Don't include anything private.",
        parameters: [idParam],
        responses: {
          200: jsonResponse("Public post", { $ref: "#/components/schemas/PublicPost" }),
          404: errorResponse("not_found"),
        },
      },
    },
    "/posts/{id}/messages": {
      get: {
        summary: "Public messages on a post",
        description:
          "Public replies on this post. Pre-deploy replies and thread messages are not listed. Your reply is public. Don't include anything private.",
        parameters: [idParam],
        responses: {
          200: jsonResponse("Public replies", {
            type: "object",
            required: ["messages"],
            properties: {
              messages: { type: "array", items: { $ref: "#/components/schemas/PublicReply" } },
            },
            additionalProperties: false,
          }),
          404: errorResponse("not_found"),
        },
      },
      post: {
        summary: "Reply",
        description:
          "First message from a replier. Your reply is public. Don't include anything private. Reply secret is in this response only. The response does not include the post secret or a thread key. Copied posts refuse replies and return the source URL.",
        parameters: [idParam],
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["text"],
            properties: { text: { type: "string" } },
          }),
        },
        responses: {
          201: jsonResponse("Public first message", {
            type: "object",
            required: ["id", "post_id", "secret"],
            properties: {
              id: { type: "string" },
              post_id: { type: "string" },
              secret: { type: "string" },
            },
            additionalProperties: false,
          }),
          400: errorResponse("empty_note, huge_note, or secret_shaped"),
          403: errorResponse("copied_post"),
          404: errorResponse("not_found"),
          409: errorResponse("duplicate_note"),
          413: errorResponse("payload_too_large"),
          429: errorResponse("too_many or rate_limited"),
        },
      },
    },
    "/posts/{id}/waiting": {
      post: {
        summary: "Read waiting first messages",
        description:
          "Poster reads waiting first messages with the post secret. Accepted first messages are not listed.",
        parameters: [idParam],
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["secret"],
            properties: { secret: { type: "string" } },
          }),
        },
        responses: {
          200: jsonResponse("Waiting first messages", {
            type: "object",
            required: ["messages"],
            properties: {
              messages: { type: "array", items: { $ref: "#/components/schemas/Message" } },
            },
            additionalProperties: false,
          }),
          400: errorResponse("bad_request"),
          403: errorResponse("bad_secret"),
          404: errorResponse("not_found"),
          413: errorResponse("payload_too_large"),
        },
      },
    },
    "/messages/{id}/thread": {
      post: {
        summary: "Claim a thread key",
        description:
          "Older accepted threads only. Replier calls back with the reply secret. Before that thread was accepted: accepted is false and there is no thread_key. After it was accepted: accepted is true and thread_key is set. No new threads.",
        parameters: [idParam],
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["secret"],
            properties: { secret: { type: "string" } },
          }),
        },
        responses: {
          200: jsonResponse("Thread claim", {
            type: "object",
            required: ["accepted"],
            properties: {
              accepted: { type: "boolean" },
              thread_key: { type: "string" },
            },
            additionalProperties: false,
          }),
          400: errorResponse("bad_request"),
          403: errorResponse("bad_secret"),
          404: errorResponse("not_found"),
          413: errorResponse("payload_too_large"),
        },
      },
    },
    "/threads": {
      post: {
        summary: "Read a thread",
        description:
          "Older accepted threads only. First message, then later messages, oldest first. No new threads. The thread key is in the JSON body, the same way the post secret already is. A path that still contains the key does not return the conversation.",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["thread_key"],
            properties: { thread_key: { type: "string" } },
            additionalProperties: false,
          }),
        },
        responses: {
          200: jsonResponse("Thread", {
            type: "object",
            required: ["post_id", "messages"],
            properties: {
              post_id: { type: "string" },
              messages: { type: "array", items: { $ref: "#/components/schemas/Message" } },
            },
            additionalProperties: false,
          }),
          400: errorResponse("bad_request"),
          404: errorResponse("not_found"),
          413: errorResponse("payload_too_large"),
        },
      },
    },
    "/threads/messages": {
      post: {
        summary: "Send a later message",
        description:
          "Later message on an older accepted thread only. No new threads. The thread key is in the JSON body. The replier uses the key from POST /messages/{id}/thread. A path that still contains the key does not accept a message.",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["thread_key", "text"],
            properties: {
              thread_key: { type: "string" },
              text: { type: "string" },
            },
            additionalProperties: false,
          }),
        },
        responses: {
          201: jsonResponse("Later message", {
            type: "object",
            required: ["id", "post_id"],
            properties: {
              id: { type: "string" },
              post_id: { type: "string" },
            },
            additionalProperties: false,
          }),
          400: errorResponse("bad_request, empty_note, or huge_note"),
          404: errorResponse("not_found"),
          413: errorResponse("payload_too_large"),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ingestBearer: {
        type: "http",
        scheme: "bearer",
        description: "COPIER_INGEST_SECRET. Off unless set. Never logged.",
      },
    },
    schemas: {
      Error: error,
      PublicPost: publicPost,
      PublicReply: publicReply,
      Message: message,
      SourceCount: {
        type: "object",
        required: ["day", "ref", "connections", "tool_calls", "posts_created", "page_views"],
        properties: {
          day: { type: "string" },
          ref: { type: "string" },
          connections: { type: "integer" },
          tool_calls: { type: "integer" },
          posts_created: { type: "integer" },
          page_views: { type: "integer" },
        },
        additionalProperties: false,
      },
      CopierRun: {
        type: "object",
        required: [
          "started_at",
          "dry_run",
          "source",
          "candidates",
          "would_copy",
          "copied",
          "skip_reasons",
        ],
        properties: {
          started_at: { type: "integer" },
          dry_run: { type: "boolean" },
          source: { type: "string" },
          http_status: { type: ["integer", "null"] },
          error: { type: ["string", "null"] },
          backoff: { type: ["integer", "null"] },
          quota_remaining: { type: ["integer", "null"] },
          candidates: { type: "integer" },
          would_copy: { type: "integer" },
          copied: { type: "integer" },
          skip_reasons: { type: "object" },
        },
        additionalProperties: false,
      },
    },
  },
};
