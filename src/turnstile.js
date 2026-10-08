import { clientIp } from "./limits.js";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function readTurnstileToken(body) {
  if (!body || typeof body !== "object") return "";
  if (typeof body.turnstile === "string") return body.turnstile;
  if (typeof body["cf-turnstile-response"] === "string") return body["cf-turnstile-response"];
  return "";
}

/**
 * Off unless TURNSTILE_SECRET is set. Local tests may set the secret to
 * "test" and send token "pass". The secret is never logged.
 */
export async function checkTurnstile(env, request, body) {
  const secret = env && env.TURNSTILE_SECRET;
  if (!secret) return { ok: true };

  const token = readTurnstileToken(body);
  if (!token) return { ok: false, error: "turnstile" };

  if (secret === "test") {
    return token === "pass" ? { ok: true } : { ok: false, error: "turnstile" };
  }

  const verify = env.turnstileFetch || globalThis.fetch;
  const params = new URLSearchParams({ secret, response: token });
  const ip = clientIp(request);
  if (ip && ip !== "unknown") params.set("remoteip", ip);

  try {
    const response = await verify(SITEVERIFY, {
      method: "POST",
      body: params,
    });
    const data = await response.json();
    return data && data.success ? { ok: true } : { ok: false, error: "turnstile" };
  } catch {
    return { ok: false, error: "turnstile" };
  }
}
