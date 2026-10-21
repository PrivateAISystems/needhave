import { MAX_NOTE } from "./limits.js";

export function trimNote(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeNote(note) {
  return trimNote(note)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function stripContacts(text) {
  return trimNote(text)
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "")
    .replace(/\b(?:\+?\d{1,3}[-.\s])?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cheap filter. Drops empty notes and huge notes. Duplicate text is checked
 * by the caller. It does not approve anyone.
 */
export function filterNote(note) {
  if (note.length === 0) return "empty_note";
  if (note.length > MAX_NOTE) return "huge_note";
  return null;
}

/**
 * Post secrets and thread keys are 32 random bytes, hex. Skip spaces,
 * dashes, underscores, and dots, then reject a run of 32 or more hex
 * characters. This is a straight scan: a long hex quantifier overflows
 * the regex engine on a multi-megabyte reply.
 */
function isHexCode(code) {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
}

function isSecretSeparator(code) {
  if (code === 0x2d || code === 0x5f || code === 0x2e) return true;
  return (
    code === 0x09 ||
    code === 0x0a ||
    code === 0x0b ||
    code === 0x0c ||
    code === 0x0d ||
    code === 0x20 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200a) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0xfeff
  );
}

export function looksLikeSecret(text) {
  const s = typeof text === "string" ? text : String(text || "");
  let run = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (isSecretSeparator(code)) continue;
    if (isHexCode(code)) {
      run += 1;
      if (run >= 32) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/**
 * Public reply text. Same empty, huge, and contact rules as the list.
 * Length is checked before any regex. Contact-only junk becomes empty.
 * Anything shaped like a post secret or thread key is rejected. The
 * caller still drops duplicates and applies the per-IP cap.
 */
export function prepareReply(raw) {
  const trimmed = trimNote(raw);
  if (trimmed.length > MAX_NOTE) return { error: "huge_note" };
  if (looksLikeSecret(trimmed)) return { error: "secret_shaped" };
  const text = stripContacts(trimmed);
  if (looksLikeSecret(text)) return { error: "secret_shaped" };
  const filtered = filterNote(text);
  if (filtered) return { error: filtered };
  return { text };
}
