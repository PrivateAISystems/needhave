import { handle } from "./app.js";
import { handleMcp, isMcpPath } from "./mcp.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isMcpPath(url.pathname)) {
      return handleMcp(request, {
        baseUrl: (env && env.NEEDHAVE_LIST_URL) || undefined,
        fetch: env && env.NEEDHAVE_FETCH,
      });
    }
    return handle(request, env);
  },
};
