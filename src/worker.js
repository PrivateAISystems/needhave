import { handle } from "./app.js";
import { handleEmail } from "./email.js";
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
  async email(message, env) {
    return handleEmail(message, env, {
      async sendReply(from, to, raw) {
        const { EmailMessage } = await import("cloudflare:email");
        return message.reply(new EmailMessage(from, to, raw));
      },
    });
  },
};
