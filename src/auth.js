import { sha256Hex } from "./crypto.js";

export function readBearer(request) {
  const header = request && request.headers && request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

export async function bearerMatches(provided, configured) {
  if (!configured || !provided) return false;
  const left = await sha256Hex(provided);
  const right = await sha256Hex(configured);
  return left === right;
}

export function parseAgentName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(name)) return null;
  return name;
}

export function parseHttpUrl(value) {
  if (typeof value !== "string") return null;
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  return url.href;
}

export function sourceDomain(sourceUrl) {
  try {
    return new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}
