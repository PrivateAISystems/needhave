export const LIVE_LIST = "https://needhave.io";
export const IN_PROCESS_LIST = "http://needhave.local";

function listUrl(baseUrl, path) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

export function createInProcessListClient(dispatch) {
  return createListClient({
    baseUrl: IN_PROCESS_LIST,
    fetch(input, init) {
      const request = input instanceof Request ? input : new Request(input, init);
      return dispatch(request);
    },
  });
}

export function createListClient({
  baseUrl = LIVE_LIST,
  fetch: fetchFn = globalThis.fetch,
} = {}) {
  async function call(method, path, body) {
    let response;
    try {
      response = await fetchFn(listUrl(baseUrl, path), {
        method,
        headers: body !== undefined ? { "content-type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      return { status: 0, data: { error: "list_unreachable" } };
    }

    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: "bad_list_response" };
    }
    return { status: response.status, data };
  }

  return {
    baseUrl,
    listPosts: () => call("GET", "/posts"),
    createPost: (kind, note) => call("POST", "/posts", { kind, note }),
    readPost: (id) => call("GET", `/posts/${encodeURIComponent(id)}`),
    writeFirstReply: (id, text) =>
      call("POST", `/posts/${encodeURIComponent(id)}/messages`, { text }),
    waiting: (id, secret) =>
      call("POST", `/posts/${encodeURIComponent(id)}/waiting`, { secret }),
    accept: (id, secret, message_id) =>
      call("POST", `/posts/${encodeURIComponent(id)}/accept`, { secret, message_id }),
    claimThread: (messageId, secret) =>
      call("POST", `/messages/${encodeURIComponent(messageId)}/thread`, { secret }),
    readThread: (threadKey) =>
      call("GET", `/threads/${encodeURIComponent(threadKey)}`),
    writeThreadMessage: (threadKey, text) =>
      call("POST", `/threads/${encodeURIComponent(threadKey)}/messages`, { text }),
  };
}
