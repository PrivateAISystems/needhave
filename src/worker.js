import { handle } from "./app.js";

export default {
  async fetch(request, env) {
    return handle(request, env);
  },
};
