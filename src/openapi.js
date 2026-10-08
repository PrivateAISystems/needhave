const error = {
  type: "object",
  required: ["error"],
  properties: { error: { type: "string" } },
  additionalProperties: false,
};

const publicPost = {
  type: "object",
  required: ["id", "kind", "note", "source"],
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: ["need", "have"] },
    note: { type: "string" },
    source: { type: "string" },
  },
  additionalProperties: false,
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
    description:
      "One public list. Two posts: need and have. No accounts. Every post names its source: self, agent:<name>, or tip-confirmed:<url>.",
    version: "1.1.0",
  },
  servers: [{ url: "https://needhave.io" }],
  paths: {
    "/posts": {
      get: {
        summary: "List posts",
        description: "Public list. Newest first. No secrets. No messages.",
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
            required: ["id", "kind", "note", "source", "secret"],
            properties: {
              id: { type: "string" },
              kind: { type: "string", enum: ["need", "have"] },
              note: { type: "string" },
              source: { type: "string" },
              secret: { type: "string" },
            },
            additionalProperties: false,
          }),
          400: errorResponse("bad_kind, empty_note, huge_note, or contact_details"),
          409: errorResponse("duplicate_note"),
          429: errorResponse("rate_limited"),
        },
      },
    },
    "/posts/{id}": {
      get: {
        summary: "Get one post",
        description: "One public post. No secret. No messages.",
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
          "Always empty. Waiting first messages and accepted threads are not listed here.",
        parameters: [idParam],
        responses: {
          200: jsonResponse("Empty public message list", {
            type: "object",
            required: ["messages"],
            properties: {
              messages: { type: "array", maxItems: 0, items: { $ref: "#/components/schemas/Message" } },
            },
            additionalProperties: false,
          }),
          404: errorResponse("not_found"),
        },
      },
      post: {
        summary: "Reply",
        description:
          "First message from a replier. Reply secret is in this response only. The message stays hidden from anyone without the post secret.",
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
          201: jsonResponse("Hidden first message", {
            type: "object",
            required: ["id", "post_id", "hidden", "secret"],
            properties: {
              id: { type: "string" },
              post_id: { type: "string" },
              hidden: { type: "boolean" },
              secret: { type: "string" },
            },
            additionalProperties: false,
          }),
          400: errorResponse("empty_note or huge_note"),
          404: errorResponse("not_found"),
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
        },
      },
    },
    "/posts/{id}/accept": {
      post: {
        summary: "Accept a first message",
        description:
          "Poster accepts one first message with the post secret. Writes one thread key. The replier uses POST /messages/{id}/thread.",
        parameters: [idParam],
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["secret", "message_id"],
            properties: {
              secret: { type: "string" },
              message_id: { type: "string" },
            },
          }),
        },
        responses: {
          201: jsonResponse("Accepted", {
            type: "object",
            required: ["thread_key"],
            properties: { thread_key: { type: "string" } },
            additionalProperties: false,
          }),
          400: errorResponse("bad_request"),
          403: errorResponse("bad_secret"),
          404: errorResponse("not_found"),
          409: errorResponse("already_accepted"),
        },
      },
    },
    "/messages/{id}/thread": {
      post: {
        summary: "Claim a thread key",
        description:
          "Replier calls back with the reply secret. Before accept: accepted is false and there is no thread_key. After accept: accepted is true and thread_key is set.",
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
        },
      },
    },
    "/threads": {
      post: {
        summary: "Read a thread",
        description:
          "First message, then later messages, oldest first. The thread key is in the JSON body, the same way the post secret already is. A path that still contains the key does not return the conversation.",
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
        },
      },
    },
    "/intake": {
      get: {
        summary: "Small HTTP intake form",
        description: "Self-submit only. Optional Turnstile widget when configured.",
        responses: {
          200: { description: "HTML form" },
        },
      },
      post: {
        summary: "Self-submit a post",
        description:
          "Same filters and 10/IP/hour limit as POST /posts. source is self. Turnstile is required only when TURNSTILE_SECRET is set.",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["kind", "note"],
            properties: {
              kind: { type: "string", enum: ["need", "have"] },
              note: { type: "string" },
              turnstile: { type: "string" },
            },
          }),
        },
        responses: {
          201: jsonResponse("Created post", { $ref: "#/components/schemas/CreatedPost" }),
          400: errorResponse("bad_kind, empty_note, huge_note, or contact_details"),
          403: errorResponse("turnstile"),
          409: errorResponse("duplicate_note"),
          429: errorResponse("rate_limited"),
        },
      },
    },
    "/agent": {
      post: {
        summary: "Team agent hook",
        description:
          "Authenticated. Posts a genuine blocked need or have. source is agent:<name>. Off unless AGENT_HOOK_SECRET is set. Real blocked needs only.",
        security: [{ agentHook: [] }],
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["kind", "note", "agent"],
            properties: {
              kind: { type: "string", enum: ["need", "have"] },
              note: { type: "string" },
              agent: { type: "string" },
            },
          }),
        },
        responses: {
          201: jsonResponse("Created post", { $ref: "#/components/schemas/CreatedPost" }),
          400: errorResponse("bad_kind, bad_agent, empty_note, huge_note, or contact_details"),
          403: errorResponse("unauthorized"),
          409: errorResponse("duplicate_note"),
          429: errorResponse("rate_limited"),
          503: errorResponse("not_configured"),
        },
      },
    },
    "/tips": {
      post: {
        summary: "Store a private pending tip",
        description:
          "Authenticated. Never public. Never posted directly. Returns a one-time invite path. Off unless TIP_CREATE_SECRET is set.",
        security: [{ tipCreate: [] }],
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["source_url", "author_handle", "proposed_note"],
            properties: {
              source_url: { type: "string" },
              author_handle: { type: "string" },
              proposed_note: { type: "string" },
            },
          }),
        },
        responses: {
          201: jsonResponse("Pending tip", {
            type: "object",
            required: ["id", "invite_path"],
            properties: {
              id: { type: "string" },
              invite_path: { type: "string" },
            },
            additionalProperties: false,
          }),
          400: errorResponse("bad_source_url, bad_handle, empty_note, huge_note, or contact_details"),
          403: errorResponse("unauthorized"),
          429: errorResponse("rate_limited"),
          503: errorResponse("not_configured"),
        },
      },
    },
    "/tips/confirm": {
      post: {
        summary: "Confirm a tip",
        description:
          "Author confirms with the single-use expiring token. Then the post appears as tip-confirmed:<url>. The confirmer receives the post secret. The tip creator never sees it.",
        requestBody: {
          required: true,
          ...jsonContent({
            type: "object",
            required: ["token"],
            properties: {
              token: { type: "string" },
              note: { type: "string" },
            },
          }),
        },
        responses: {
          201: jsonResponse("Confirmed post", { $ref: "#/components/schemas/CreatedPost" }),
          400: errorResponse("bad_request, empty_note, huge_note, or contact_details"),
          404: errorResponse("not_found"),
          409: errorResponse("already_confirmed or duplicate_note"),
          410: errorResponse("expired"),
        },
      },
    },
    "/threads/messages": {
      post: {
        summary: "Send a later message",
        description:
          "Later message on that thread. The thread key is in the JSON body. The poster uses the key from accept. The replier uses the key from POST /messages/{id}/thread after accept. A path that still contains the key does not accept a message.",
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
        },
      },
    },
  },
  components: {
    securitySchemes: {
      agentHook: { type: "http", scheme: "bearer" },
      tipCreate: { type: "http", scheme: "bearer" },
    },
    schemas: {
      Error: error,
      PublicPost: publicPost,
      CreatedPost: {
        type: "object",
        required: ["id", "kind", "note", "source", "secret"],
        properties: {
          id: { type: "string" },
          kind: { type: "string", enum: ["need", "have"] },
          note: { type: "string" },
          source: { type: "string" },
          secret: { type: "string" },
        },
        additionalProperties: false,
      },
      Message: message,
    },
  },
};
