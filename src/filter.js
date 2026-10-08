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
 * Cheap filter. Drops empty notes, huge notes, and (for posts) the same
 * text pasted again. It does not approve anyone. The poster's accept does.
 */
export function filterNote(note) {
  if (note.length === 0) return "empty_note";
  if (note.length > MAX_NOTE) return "huge_note";
  return null;
}
