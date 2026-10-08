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

const CONTACT_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /\b(?:\+?\d{1,3}[-.\s])?(?:\(?\d{3}\)?[-.\s])\d{3}[-.\s]\d{4}\b/,
  /\b(?:whatsapp|telegram|signal)\b/i,
  /\b(?:email me|e-mail me|dm me|pm me|text me|call me|reach me|contact me)\b/i,
  /\b(?:phone|cellphone|mobile|tel)\s*:/i,
];

export function hasContactDetails(note) {
  return CONTACT_PATTERNS.some((pattern) => pattern.test(note));
}

/**
 * Cheap filter. Drops empty notes, huge notes, contact details, and
 * (for posts) the same text pasted again. It does not approve anyone.
 */
export function filterNote(note, { allowContact = false } = {}) {
  if (note.length === 0) return "empty_note";
  if (note.length > MAX_NOTE) return "huge_note";
  if (!allowContact && hasContactDetails(note)) return "contact_details";
  return null;
}
