import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { handle } from "../src/app.js";
import { MAX_NOTE } from "../src/limits.js";
import { createLocalEnv } from "./d1-sqlite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = readFileSync(join(root, "schema.sql"), "utf8");
const env = createLocalEnv(schema);

async function call(method, path, body) {
  const request = new Request(`http://needhave.local${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const response = await handle(request, env);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, json };
}

function ok(label) {
  console.log(`ok ${label}`);
}

const created = await call("POST", "/posts", {
  kind: "need",
  note: "Need a working bicycle in town this week",
});
assert.equal(created.status, 201);
assert.equal(created.json.kind, "need");
assert.equal(created.json.note, "Need a working bicycle in town this week");
assert.equal(typeof created.json.id, "string");
assert.equal(created.json.id.length, 32);
assert.equal(typeof created.json.secret, "string");
assert.equal(created.json.secret.length, 64);
const postId = created.json.id;
const postSecret = created.json.secret;
ok("create a post and see the secret once");

const listed = await call("GET", "/posts");
assert.equal(listed.status, 200);
assert.equal(listed.json.posts.length, 1);
assert.equal(listed.json.posts[0].id, postId);
assert.equal(listed.json.posts[0].note, "Need a working bicycle in town this week");
assert.equal("secret" in listed.json.posts[0], false);

const fetched = await call("GET", `/posts/${postId}`);
assert.equal(fetched.status, 200);
assert.equal(fetched.json.id, postId);
assert.equal("secret" in fetched.json, false);
assert.notEqual(JSON.stringify(fetched.json), JSON.stringify(created.json));
ok("secret is not on later public reads");

const empty = await call("POST", "/posts", { kind: "have", note: "   " });
assert.equal(empty.status, 400);
assert.equal(empty.json.error, "empty_note");
ok("reject an empty note");

const huge = await call("POST", "/posts", {
  kind: "have",
  note: "x".repeat(MAX_NOTE + 1),
});
assert.equal(huge.status, 400);
assert.equal(huge.json.error, "huge_note");
ok("reject a huge note");

const pasted = await call("POST", "/posts", {
  kind: "have",
  note: "Need a working bicycle in town this week",
});
assert.equal(pasted.status, 409);
assert.equal(pasted.json.error, "duplicate_note");
ok("reject the same text pasted again");

const first = await call("POST", `/posts/${postId}/messages`, {
  text: "I have a bike you can borrow on Thursday",
});
assert.equal(first.status, 201);
assert.equal(first.json.hidden, true);
assert.equal(first.json.post_id, postId);
const firstId = first.json.id;

const publicMessages = await call("GET", `/posts/${postId}/messages`);
assert.equal(publicMessages.status, 200);
assert.deepEqual(publicMessages.json.messages, []);

const publicPost = await call("GET", `/posts/${postId}`);
assert.equal(JSON.stringify(publicPost.json).includes("Thursday"), false);
assert.equal(JSON.stringify(listed.json).includes("Thursday"), false);

const strangerList = await call("GET", "/posts");
assert.equal(JSON.stringify(strangerList.json).includes("Thursday"), false);
assert.equal(JSON.stringify(strangerList.json).includes(firstId), false);
ok("first message stays hidden from everyone else");

const otherReplier = await call("POST", `/posts/${postId}/messages`, {
  text: "Different replier offering a scooter instead",
});
assert.equal(otherReplier.status, 201);
const otherFirstId = otherReplier.json.id;

const wrongSecret = await call("POST", `/posts/${postId}/accept`, {
  secret: "0".repeat(64),
  message_id: firstId,
});
assert.equal(wrongSecret.status, 403);
assert.equal(wrongSecret.json.error, "bad_secret");

const accepted = await call("POST", `/posts/${postId}/accept`, {
  secret: postSecret,
  message_id: firstId,
});
assert.equal(accepted.status, 201);
assert.equal(typeof accepted.json.thread_key, "string");
assert.equal(accepted.json.thread_key.length, 64);
const threadKey = accepted.json.thread_key;
ok("accept with the post secret and get one thread key");

const acceptedAgain = await call("POST", `/posts/${postId}/accept`, {
  secret: postSecret,
  message_id: firstId,
});
assert.equal(acceptedAgain.status, 409);
assert.equal(acceptedAgain.json.error, "already_accepted");

const later = await call("POST", `/threads/${threadKey}/messages`, {
  text: "Thursday at the library steps works",
});
assert.equal(later.status, 201);
assert.equal(typeof later.json.id, "string");
ok("send a later message with that key");

const thread = await call("GET", `/threads/${threadKey}`);
assert.equal(thread.status, 200);
assert.equal(thread.json.post_id, postId);
assert.equal(thread.json.messages.length, 2);
assert.equal(thread.json.messages[0].id, firstId);
assert.equal(thread.json.messages[0].text, "I have a bike you can borrow on Thursday");
assert.equal(thread.json.messages[1].id, later.json.id);
assert.equal(thread.json.messages[1].text, "Thursday at the library steps works");

const stillPublic = await call("GET", `/posts/${postId}/messages`);
assert.deepEqual(stillPublic.json.messages, []);
assert.equal(JSON.stringify(stillPublic.json).includes("library"), false);

const otherPublic = await call("GET", "/posts");
assert.equal(JSON.stringify(otherPublic.json).includes("library"), false);
assert.equal(JSON.stringify(otherPublic.json).includes(threadKey), false);

const otherGuess = await call("GET", `/threads/${otherFirstId}`);
assert.equal(otherGuess.status, 404);

const otherWrite = await call("POST", `/threads/${otherFirstId}/messages`, {
  text: "trying to join the other thread",
});
assert.equal(otherWrite.status, 404);

const otherAccept = await call("POST", `/posts/${postId}/accept`, {
  secret: "not-the-post-secret",
  message_id: otherFirstId,
});
assert.equal(otherAccept.status, 403);

const otherSeesOwnOnly = await call("GET", `/posts/${postId}`);
assert.equal(JSON.stringify(otherSeesOwnOnly.json).includes("scooter"), false);
assert.equal(JSON.stringify(otherSeesOwnOnly.json).includes("Thursday"), false);
ok("a different replier cannot read that thread");

console.log("all local calls passed");
