import { handle } from "./app.js";
import { runCopier } from "./copier.js";
import { createInProcessListClient } from "./list-client.js";
import { handleMcp, isMcpPath } from "./mcp.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isMcpPath(url.pathname)) {
      return handleMcp(request, {
        client: createInProcessListClient((listRequest) => handle(listRequest, env), request),
      });
    }
    return handle(request, env);
  },
  async scheduled(_controller, env, ctx) {
    const run = runCopier(env, { skipSources: ["stackexchange"] });
    if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(run);
    return run;
  },
};
