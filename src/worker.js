import { handle } from "./app.js";
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
};
