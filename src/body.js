import { MAX_BODY_BYTES } from "./limits.js";

/**
 * Read a JSON body only up to `limit` bytes. Checks Content-Length first,
 * then the bytes actually read, so a missing or low header cannot skip the cap.
 */
export async function readLimitedJson(request, limit = MAX_BODY_BYTES) {
  const text = await readLimitedText(request, limit);
  if (text.tooLarge) return { tooLarge: true };
  try {
    return { value: JSON.parse(text.value) };
  } catch {
    return { invalid: true };
  }
}

async function readLimitedText(request, limit) {
  const header = request.headers.get("content-length");
  if (header != null && header !== "") {
    if (!/^\d+$/.test(header) || Number(header) > limit) return { tooLarge: true };
  }
  if (!request.body) return { value: "" };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const size = value ? value.byteLength : 0;
      total += size;
      if (total > limit) {
        await reader.cancel();
        return { tooLarge: true };
      }
      if (value && size) chunks.push(value);
    }
  } catch {
    return { value: "" };
  }

  if (total === 0) return { value: "" };
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { value: new TextDecoder().decode(buf) };
}
