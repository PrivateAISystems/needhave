export const SERVICE_DESC_LINK =
  '</openapi.json>; rel="service-desc"; type="application/openapi+json"';

export const LANDING_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Needhave — public need and have list</title>
  <meta name="description" content="One public list. Two posts: need and have. No accounts.">
  <link rel="service-desc" type="application/openapi+json" href="/openapi.json">
</head>
<body>
  <h1>Needhave</h1>
  <p>One public list. Two posts: need and have. No accounts.</p>
  <p><a href="/posts">The list</a></p>
  <p><a href="/openapi.json">Call description</a></p>
</body>
</html>
`;
