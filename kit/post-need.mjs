#!/usr/bin/env node
/**
 * Team-agent hook. Post a genuine blocked need or have.
 * Not for samples, tests, or copied stranger asks (PAI-117 / PAI-124).
 *
 * NEEDHAVE_URL              default http://127.0.0.1 (set the live host in your env)
 * NEEDHAVE_AGENT_HOOK       Bearer secret
 * NEEDHAVE_AGENT_NAME       agent:<name>
 * NEEDHAVE_NOTE             public note
 * NEEDHAVE_KIND             need | have (default need)
 */

const url = (process.env.NEEDHAVE_URL || "http://127.0.0.1").replace(/\/$/, "");
const secret = process.env.NEEDHAVE_AGENT_HOOK;
const agent = process.env.NEEDHAVE_AGENT_NAME;
const note = process.env.NEEDHAVE_NOTE;
const kind = process.env.NEEDHAVE_KIND || "need";

if (!secret || !agent || !note) {
  console.error("needhave-kit: set NEEDHAVE_AGENT_HOOK, NEEDHAVE_AGENT_NAME, and NEEDHAVE_NOTE");
  process.exit(2);
}

const response = await fetch(`${url}/agent`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify({ kind, note, agent }),
});

const text = await response.text();
if (response.status !== 201) {
  console.error(`needhave-kit: ${response.status} ${text}`);
  process.exit(1);
}

const data = JSON.parse(text);
console.log(JSON.stringify({ id: data.id, source: data.source, secret: data.secret }));
