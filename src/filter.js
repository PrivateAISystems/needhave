import { MAX_NOTE } from "./limits.js";

export function trimNote(value) {
  return typeof value === "string" ? value.trim() : "";
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
