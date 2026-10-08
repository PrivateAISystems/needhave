import { sha256Hex } from "./crypto.js";
import { createEmailPost } from "./posts.js";

const AUTO_SENDERS = /noreply|no-reply|mailer-daemon|postmaster/i;

function headerGet(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  return headers[name] || headers[name.toLowerCase()] || "";
}

export function emailAuthPassed(headers) {
  const results = headerGet(headers, "authentication-results").toLowerCase();
  if (!results) return false;
  const dkim = /\bdkim=pass\b/.test(results);
  const spf = /\bspf=pass\b/.test(results);
  const dmarc = /\bdmarc=pass\b/.test(results);
  return dkim && (spf || dmarc);
}

export function noteFromEmail(headers, rawText) {
  const subject = trimSubject(headerGet(headers, "subject"));
  if (subject) return subject;
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const first = text.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  return first || "";
}

function trimSubject(subject) {
  return subject.replace(/^(re|fwd|fw)\s*:\s*/gi, "").trim();
}

function kindFromNote(note) {
  return /^\s*have\b/i.test(note) ? "have" : "need";
}

function buildReply(from, to, subject, secret) {
  const safeSubject = (subject || "needhave").replace(/[\r\n]+/g, " ");
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: Re: ${safeSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Your note is on the list. The post secret is shown once, only in this email:",
    "",
    secret,
    "",
    "Keep it. Lost secrets are not reset. Do not put contact details on the list.",
    "",
  ].join("\r\n");
}

/**
 * Optional Email Routing intake. No-op unless EMAIL_INTAKE is set.
 * Secret is emailed only to the envelope From address.
 */
export async function handleEmail(message, env, options = {}) {
  if (!env || !env.EMAIL_INTAKE) return;

  const from = message && message.from;
  const to = (env.EMAIL_FROM || (message && message.to) || "").trim();
  if (!from || AUTO_SENDERS.test(from) || from === to) {
    if (message && message.setReject) message.setReject("ignored sender");
    return;
  }
  if (!emailAuthPassed(message.headers)) {
    if (message && message.setReject) message.setReject("unauthenticated sender");
    return;
  }

  const auto = headerGet(message.headers, "auto-submitted");
  if (auto && auto.toLowerCase() !== "no") {
    if (message && message.setReject) message.setReject("automated mail");
    return;
  }

  const note = noteFromEmail(message.headers, options.rawText);
  const request = new Request("http://needhave.local/email", {
    method: "POST",
    headers: { "cf-connecting-ip": `email-${(await sha256Hex(from)).slice(0, 16)}` },
  });
  const result = await createEmailPost(env, request, {
    kind: kindFromNote(note),
    note,
    fromHash: (await sha256Hex(from)).slice(0, 32),
  });

  if (result.status !== 201 || !result.post) {
    if (message && message.setReject) {
      message.setReject(result.error || "rejected");
    }
    return;
  }

  const raw = buildReply(to, from, headerGet(message.headers, "subject"), result.post.secret);
  if (options.sendReply) {
    await options.sendReply(to, from, raw);
    return;
  }
  if (message && message.reply) {
    await message.reply({ from: to, to: from, raw });
  }
}
