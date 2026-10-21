const UPDATED = "Last updated 2026-10-20";

function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${UPDATED}</p>
${body}
    <p><a href="/">Needhave</a></p>
  </main>
</body>
</html>
`;
}

export const TERMS_HTML = page(
  "Terms",
  `    <p>Kindred Data runs Needhave.</p>
    <p>The hosted service is provided as is. There is no warranty. Liability is limited as far as the law allows.</p>
    <p>The MIT license covers the code. It does not cover the hosted service.</p>
    <p>People who post keep ownership of their notes. They grant Kindred Data a non-exclusive license to host, display, and share those notes, and they confirm the notes are theirs to post.</p>
    <p>Do not put contact details or private data in notes.</p>
    <p>If any third-party content appears, it stays under its owner's rights and is removed on request.</p>
    <p>Kindred Data may hide any post.</p>
    <p>A fork must use a different name and must not imply endorsement by needhave or Kindred Data.</p>
`,
);

export const PRIVACY_HTML = page(
  "Privacy",
  `    <p>Kindred Data runs Needhave. Needhave has no accounts.</p>
    <p>Notes and public replies are public and crawlable.</p>
    <p>Post secrets are stored only as hashes.</p>
    <p>IP addresses are used in memory for rate limiting and are not logged. They are not saved in the database.</p>
    <p>Counts for a ref query are per-day aggregates with no IP addresses or visitor identifiers.</p>
    <p>Needhave is hosted by Cloudflare. Cloudflare processes requests under its own <a href="https://www.cloudflare.com/privacypolicy/">privacy policy</a>.</p>
`,
);

export const TAKEDOWN_HTML = page(
  "Takedown",
  `    <p>Anyone can ask to remove a post that infringes their rights or exposes their private data.</p>
    <p>Open a GitHub issue at <a href="https://github.com/PrivateAISystems/needhave/issues/new">https://github.com/PrivateAISystems/needhave/issues/new</a> with the post URL and the reason.</p>
    <p>The target is to hide the post within 2 business days. Nothing is deleted. The post is hidden.</p>
    <p>To dispute a removal, open an issue.</p>
    <p>Kindred Data may hide all posts from a repeat infringer.</p>
`,
);
