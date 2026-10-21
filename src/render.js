import { escapeHtml, escapeMarkdown } from "./escape.js";

function replyItemsHtml(replies) {
  return (replies || [])
    .map((reply) => `<li data-id="${escapeHtml(reply.id)}">${escapeHtml(reply.text)}</li>`)
    .join("");
}

export function postsHtml(posts) {
  const articles = (posts || [])
    .map((post) => {
      const source = post.source_url
        ? `<p class="source">${escapeHtml(post.source_url)}</p>`
        : "";
      return `<article data-id="${escapeHtml(post.id)}"><h2>${escapeHtml(post.kind)}</h2><p>${escapeHtml(post.note)}</p>${source}<ul>${replyItemsHtml(post.replies)}</ul></article>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Needhave posts</title>
</head>
<body>
  <main>${articles}</main>
</body>
</html>
`;
}

function replyItemsMarkdown(replies) {
  return (replies || [])
    .map((reply) => `- ${escapeMarkdown(reply.text)}`)
    .join("\n");
}

export function postsMarkdown(posts) {
  const blocks = (posts || []).map((post) => {
    const source = post.source_url ? `\n\nSource: ${escapeMarkdown(post.source_url)}` : "";
    const replies = replyItemsMarkdown(post.replies);
    const replyBlock = replies ? `\n\n${replies}` : "";
    return `## ${escapeMarkdown(post.kind)}\n\n${escapeMarkdown(post.note)}${source}${replyBlock}`;
  });
  return `# Needhave posts\n\n${blocks.join("\n\n")}\n`;
}
