# needhave

This repo is the Worker and the public calls for a need/have list. The list itself does not live here. There are no live rows in this repo.

Two people should be able to implement the same list from this file and `src/`.

## Locked shape

Cloudflare Worker plus one D1 database. Binding name: `DB`. Schema: `schema.sql`.

Two row kinds only.

- A **post** is `need` or `have`, a public note, and a secret shown once.
- A **message** is one replier's text on that post, or a later line on a thread, or the insert-only accept decision that writes the thread key.

No accounts. No contact field. No short list. No payment. No edits. No deletes. A decision is a new row.

The first message waits until the poster accepts. Accept writes one thread key shared by that poster and that replier. Later messages use that key. Other repliers never see that thread.

A cheap filter drops empty notes, huge notes, and the same text pasted across posts. It does not approve anyone. The poster's accept does.

## Limits

- Empty: after trim, length 0. Error `empty_note`.
- Huge: after trim, more than 500 characters. Error `huge_note`.
- Same text pasted across posts: exact trimmed note already in `posts.note`. Error `duplicate_note`. Kind does not matter.

The same empty and huge rules apply to message text. Duplicate-text is a post rule only.

## Ids and secrets

- Post id and message id: 16 random bytes, hex (32 characters).
- Post secret and thread key: 32 random bytes, hex (64 characters).
- Store `SHA-256` hex of the secret or thread key. Never store the plaintext. Never return a post secret after the create response.

## Public calls

Host is the Worker. Paths below are the contract. Request bodies are JSON. Responses are JSON.

### `POST /posts`

Create a post. Secret is in this response only.

```json
{ "kind": "need", "note": "Need a working bicycle in town this week" }
```

`kind` is `need` or `have`.

`201`

```json
{
  "id": "…32 hex…",
  "kind": "need",
  "note": "Need a working bicycle in town this week",
  "secret": "…64 hex…"
}
```

`400` `{ "error": "bad_kind" | "empty_note" | "huge_note" }`
`409` `{ "error": "duplicate_note" }`

### `GET /posts`

Public list. Newest first. No secrets. No messages.

`200` `{ "posts": [ { "id": "…", "kind": "need", "note": "…" } ] }`

### `GET /posts/:id`

One public post. No secret. No messages.

`200` `{ "id": "…", "kind": "need", "note": "…" }`
`404` `{ "error": "not_found" }`

### `POST /posts/:id/messages`

First message from a replier. It stays hidden until the poster accepts, and it never appears on the public post calls.

```json
{ "text": "I have a bike you can borrow on Thursday" }
```

`201` `{ "id": "…", "post_id": "…", "hidden": true }`
`400` `{ "error": "empty_note" | "huge_note" }`
`404` `{ "error": "not_found" }`

### `GET /posts/:id/messages`

Public view of messages on a post. Always empty. Pending first messages and accepted threads are not listed here.

`200` `{ "messages": [] }`
`404` `{ "error": "not_found" }` if the post does not exist.

### `POST /posts/:id/accept`

Poster accepts one first message with the post secret. Inserts an accept row. Does not edit the first message. Returns one thread key.

```json
{ "secret": "…post secret…", "message_id": "…first message id…" }
```

`201` `{ "thread_key": "…64 hex…" }`
`400` `{ "error": "bad_request" }`
`403` `{ "error": "bad_secret" }`
`404` `{ "error": "not_found" }`
`409` `{ "error": "already_accepted" }`

### `GET /threads/:thread_key`

Read that thread. First message, then later messages, oldest first. Anyone without this key gets `404`.

`200`

```json
{
  "post_id": "…",
  "messages": [
    { "id": "…", "text": "…" }
  ]
}
```

`404` `{ "error": "not_found" }`

### `POST /threads/:thread_key/messages`

Later message on that thread.

```json
{ "text": "Thursday at the library steps works" }
```

`201` `{ "id": "…", "post_id": "…" }`
`400` `{ "error": "empty_note" | "huge_note" }`
`404` `{ "error": "not_found" }`

## Rows

`posts`: `id`, `kind`, `note`, `secret_hash`, `created_at`.

`messages.role`:

- `first` — replier text on a post. `text` set. `thread_key_hash` and `parent_id` null.
- `accept` — decision row. `parent_id` is the first message. `thread_key_hash` set. `text` null. At most one accept per first message.
- `later` — text on the thread. `thread_key_hash` set.

Insert only. `created_at` is Unix time in milliseconds.

## Local test

No Cloudflare account. No deploy. No remote URL.

```bash
npm test
```

The test loads `schema.sql` into an in-memory SQLite database that speaks the D1 `prepare`/`bind`/`first`/`all`/`run` calls, then runs the Worker `handle` against it.

It checks: create a post and see the secret once; reject an empty note, a huge note, and the same text pasted again; post a first message that stays hidden; accept with the post secret and get one thread key; send a later message with that key; show that a different replier cannot read that thread.

## Out of this build

Research memos, Lambda, and DynamoDB drafts are not part of this list. Do not add live rows. Do not treat this README as a public deployment URL.
