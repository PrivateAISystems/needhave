# needhave middleman broker — Week-1 batch (PAI-123)

Research only. Checked live on **2026-10-06**. Nothing was posted to [needhave.io](https://needhave.io). No tips, replies, DMs, emails, or directory forms were sent. The Worker was not changed. This file is the only deliverable.

Product lock (Rich, 2026-10-06): broker **both sides** until organic usage. Scout real needs and real haves. Prefer agents already posting. Quality over volume. Invite the originals onto needhave. Do **not** scrape-repost as if we were them. No fake both-sides threads. Rich yes each outbound tip (cap ≤5/week, ≤2/venue).

This batch does **not** send those tips. It ranks venues, locks a quality gate, and shortlists paired opportunities with draft copy ready for Rich.

---

## 0. How this batch differs from PAI-121

[PAI-121](https://linear.app/paisagentic/issue/PAI-121/systematic-finddirect-pipeline-real-needshaves-needhave-no-scrape) designed find → score → invite **one** original to post. This issue adds the broker motion: a **pair** (need-side target + complementary have-side target). Midl does not play either side. Midl does not copy either note onto the list. After Rich yeses, each original is asked to post *their* need or have themselves.

Live `GET /posts` on this check still shows Midl first-party seeds, scrape-copies, and TEST rows. **Zero finished stranger threads.** Do not count scrapes as demand. Do not invite an author whose text is already one of those scrape-copies until Rich's wipe/ops call.

Midl's own have ("pairing time to wire the needhave MCP, open through Tue Oct 6, 11pm America/Chicago") is first-party, not a tip target.

---

## 1. Ranked venues (agents already posting needs/haves)

Ranked by **(agent-shaped posts that already exist) × (legal reply path) ÷ (junk + ToS risk)**. Scout here. Do not announce needhave as a new top-level post in these rooms (that is PAI-115 / PAI-117, gated).

| Rank | Venue | Why it is on the map | How to find (read-only) | Reply-in-place? | Week-1 use |
| --- | --- | --- | --- | --- | --- |
| 1 | **AgentPact** (`agentpact.xyz`, MCP `https://mcp.agentpact.xyz/mcp`) | Highest volume of agents already posting needs and offers. Public overview this check: **4,849 active offers, 532 open needs, 4,687 agents**. Tools include `create_need` / `create_offer`. | `GET https://api.agentpact.xyz/api/needs?status=open` and `/api/offers?status=active` (first page only). | **Usually no.** Profiles are UUIDs/wallets, not HN/GitHub. Do not register, bid, or propose deals to reach them. | Scout + quality-fail most rows. Invite only if the same operator has a public GitHub/HN/Moltbook path. |
| 2 | **GitHub tester READMEs / issues** | The UniFi shape from PAI-108: "need testers from other MCP clients." Agents can finish it. Ordinary `help wanted` tickets are the wrong shape. | `gh search issues --state open 'is:issue "looking for testers" MCP'`. Open READMEs that literally ask for outside client verification. | Yes, **one** comment on that tester call. Disclose. Do not open a drive-by issue. | Sparse this week. [mcp-failure-lab](https://github.com/anilloutombam/mcp-failure-lab) is the live hit (pushed 2026-10-05). |
| 3 | **r/mcp** (then r/cursor) | MCP operators already ask for testers and leftover client runs. | Past-week search: `testers`, `looking for`, `need help`. This environment got Reddit 403; weekly runs use Rich's browser or a registered OAuth app. | Yes, if this week's sidebar allows it, the comment also helps on Reddit, and Rich posts in his voice. Never DM. Never crosspost. | Failure Lab's "looking for MCP implementations to break this against" is the current need-shaped thread. |
| 4 | **Hacker News Ask + leftover freelancer comments** | Builders who run agents read HN. PAI-121 already scored [Ask HN sound models](https://news.ycombinator.com/item?id=49972125) as a shortlist need. | Algolia, no key, one page: Ask HN last 7d; query `looking for testers OR can anyone find`; current freelancer thread [49922572](https://news.ycombinator.com/item?id=49922572). | Yes, **Rich rewrites**. HN forbids generated text and using the site primarily for promotion. Midl drafts only. | Primary human/agent-operator path this week. Who-is-hiring is skip. |
| 5 | **Show HN that literally asks for testers / other-client runs** | Same-day MCP launches sometimes want a stranger client. Most Show HNs only want compliments. | Algolia `tags=show_hn`, last 14d, then filter in software for "try / testers / would love comments / connect your agent". | Same HN rules as #4. One comment, on-topic, disclose. | [SEO MCP wrapper](https://news.ycombinator.com/item?id=49976458) and [Orcah video MCP](https://news.ycombinator.com/item?id=49970078) passed the filter. [Mcpward](https://news.ycombinator.com/item?id=49976078) is a launch — invite only if they will name leftover slots. |
| 6 | **Official MCP Registry + peer remote READMEs** | Agents already probe needhave from the registry. Peer remotes sometimes ask for testers from other clients. | `GET https://registry.modelcontextprotocol.io/v0.1/servers?search=…` then open homepage/README. Keep only literal tester asks. | Use the GitHub/README path (#2). Marketing-site forms = skip. | Glama is a **pointer**, not an invite surface. Do not submit directory forms. |
| 7 | **Moltbook** | Agent-native social. Historical posts recruit testers (BotStore, MoltMatch, K-Work). | `GET https://moltbook.com/api/v1/posts` and `/api/v1/search?q=…`. | Only if Rich already has a verified agent there. No new account this week. | Latest 10 posts (2026-10-04–05) are essays, not needs/haves. Rank the venue; do not mine stale May posts. |
| 8 | **Cursor forum** (Built for Cursor / MCP help) | Operators adding MCP URLs this week. | Browse past 7 days for `testers`, `looking for`, `MCP help`. | Rich only, disclose, not a second Show HN. | Wave 2 unless a thread is an exact-fit need/have. |
| 9 | **X agent accounts** | Talk volume exists; [@rcb384](https://x.com/rcb384) reach is not. | Small recent search after a credits check. `max_results` 10–25. No pagination. | Reply-only under a live matching post. No cold tweet/DM. | Skip this week unless credits are confirmed and a live post is already a need/have. |
| 10 | **Sphere / AgentMarketplace / similar MCP markets** | They have `publish_wanted` / `post_task` shapes. | Glama connector pages for tool names only. Do not scrape HTML. | No, unless the operator also posted on GitHub/HN. | Below AgentPact. Same junk + account risk. |

**Off the map for week 1:** official MCP Discord; unsolicited Discord/Slack DMs; Product Hunt; PulseMCP / mcp.so / mcpservers.org forms; Who-is-hiring; Upwork / Fiverr / Craigslist; r/forhire and r/slavelabour as announcement rooms; new X/Discord/Bluesky accounts.

---

## 2. Quality pass/fail checklist

A pair enters the shortlist only if **both** sides pass. One fail on either side drops the pair. Do not loosen this to fill five pairs.

### Must pass (all)

| Check | Pass | Fail |
| --- | --- | --- |
| **Agent-shaped** | An agent can finish it from a public note (other-client test, pointer, review, leftover run). Operator already uses MCP / Cursor / Claude Code / Codex / an agent market, or the post is written as an agent. | Human freelance résumé, FT job, agency, "I have an agent" ad. |
| **Finishable** | A stranger can complete it from <500 characters with no inventing. Acceptance is visible (report, pointer, test log). | Career advice, opinions, cofounder hunts, unbounded "anything automation." |
| **Named window for haves** | The have names when leftover capacity is real (`tonight`, `through Sunday`, `this week`, `three slots`). If they have not named one yet, the tip may ask them to name one **when they post** — only if leftover capacity is obviously current. | Standing résumé, expired "this week" from months ago, launch with no leftover slots. |
| **No ads / spam / TEST** | One concrete ask or leftover. Unique text. | `TEST`, Pike ignore-me, `self-bootstrap r####`, `Ext free buy #N`, fleet clones, engagement bait, crypto spray. |
| **Still open** | Posted or last-active ≤14 days, or they said they are still looking. | Closed issue, "found someone," window over. |
| **Original, not a scrape** | We would invite *them* to post. Their text is not already on `GET /posts`. | `ALREADY_SCRAPED`. |
| **Legal path** | Reply-in-place on their thread, or they published an email on that post. | Harvested email, unsolicited DM, AgentPact-only UUID with no public surface. |
| **Not both-sides** | Two different originals. Midl/Pike/Rich are not a side. We will not post for them or reply to our own posts. | We would be the only counterparty. |

### Score the pair (keep if each side ≥ 10 and no fail)

Same dimensions as PAI-121: freshness, actionable as a note, audience (MCP/agent > indie > freelance), still open, contact path, leftover/real need (not "I built X, try it").

### Pairing rule

The have must be able to finish the need (or the need must be able to use the have) **without Midl rewriting either ask**. Complementary, not identical. Two tester-tool launches are not a pair unless one has a server and the other has leftover test runs.

---

## 3. Week-1 shortlist (paired, high quality only)

Four pairs. **Send at most the first two this week** if Rich yeses. Five pairs would be ten tips; the cap is five tips and two per venue. HN already has three candidates — do not comment on all three.

| # | Decision | Need-side | Have-side | Why they pair | Flags |
| --- | --- | --- | --- | --- | --- |
| **1** | **Yes-candidate** | [anilloutombam / MCP Failure Lab](https://github.com/anilloutombam/mcp-failure-lab) — need other MCP clients and real servers thrown at repeatable failure cases. Repo pushed **2026-10-05**. Also asked on r/mcp for implementations to break against. | [iliashad / Orcah Studio](https://news.ycombinator.com/item?id=49970078) — have a live video-search MCP for Claude Code / Codex / OpenCode (`https://orcah.app/mcp`). Posted **2026-10-05**. | Lab needs external MCP implementations; Orcah has one and already asked agents to connect. | Have did not name a clock-window. Tip asks them to name one if leftover demo/test slots are real. |
| **2** | **Yes-candidate (one HN comment max)** | [richardbaxter / SEO audit MCP](https://news.ycombinator.com/item?id=49976458) — need comments / other-client runs. Posted **2026-10-06**. "Would love your comments." | [pwizard234 / Mcpward](https://news.ycombinator.com/item?id=49976078) ([repo](https://github.com/TsvetanG2/mcpward)) — have black-box MCP contract/security tests in CI. Posted **2026-10-06**. | One side has a new MCP; the other has leftover test tooling that runs against servers they did not write. | Mcpward is a Show HN launch. Invite the have only if they will name leftover slots this week. If they will not, hold the have and do not invent a window. |
| **3** | **Hold — need only** | [onemiketwelve / Ask HN sound models](https://news.ycombinator.com/item?id=49972125) — need a pointer to audio+text→audio models with a reference clip. Posted **2026-10-05**, 0 comments, still open. PAI-121 already scored this ~16. | No complementary have this week passed the gate. The Oslo HN leftover that mentioned image/audio ML is **already scraped** onto needhave (`source: HN, 2026-10-01`). AgentPact research agents (cited briefs) have **no public reply path**. | — | Do **not** invent a have-side. Do **not** invite the scraped Oslo author. Optional: Rich-only HN pointer on the Ask, without a paired have, is PAI-121 not this broker batch. |
| **4** | **Hold — scout only** | AgentPact need `a1e5b3c7…` — compliance-ready transcription of 8 × ~45 min fintech episodes (2026-10-01). | Agent **mr-money** (`19953956-1632-47f1-91a3-337ff3d735b4`) standing have: transcription + SRT/VTT, posted **2026-10-06**, last seen today. Text says "I am mr-money, an AI agent." | Exact complementary shape, both already posting as agents. | **NO_PATH** (AgentPact UUID only). Compliance / possible PII. Do not register on AgentPact to tip them. Revisit if either appears on GitHub/HN/Moltbook. |

**Not shortlisted (and why):** AgentPact's newest HTTP-sanity / CSV-dedupe / `self-bootstrap r####` flood (one agent posted 39 needs in 7 days) — spam. Oyster-reef marine construction — not agent-shaped. UniFi MCP testers and mcp-web-engine testers — `ALREADY_SCRAPED`. Accounting-tool testers / Fong paper / programming essay — `ALREADY_SCRAPED`. Moltbook BotStore / MoltMatch tester posts — stale (~140–200 days). Show HN Tofu / Golem / Carve — launches, no leftover window.

---

## 4. Draft tip text (ready for Rich yes — not sent)

Rules for every send: disclose that Rich/Midl built needhave; point at https://needhave.io and `https://needhave.io/mcp`; tell them to post **themselves**; do not paste their original text back as a seed; no matcher, no payment, no traction claims; note is public so no contact line; Rich rewrites anything that will land on HN or Reddit.

### Pair 1 — need side (GitHub comment on Failure Lab, not a new issue)

```
If you still want other MCP clients or real servers thrown at Failure Lab, you can also post that need on a public list agents already read: https://needhave.io (MCP: https://needhave.io/mcp — create_need, no account). I will not copy this repo onto that list. Disclosure: I run needhave.
```

### Pair 1 — have side (HN comment under Orcah; Rich rewrites)

```
If the video-search MCP still has leftover slots this week, you can post that have yourself on https://needhave.io (add https://needhave.io/mcp, create_have, keep the secret). Name the window in the note. I will not copy your text there. Disclosure: I built needhave. No account, no matcher, no payment.
```

Help-first line Rich can put above that, only if true after he tries the MCP: one concrete result or a no.

### Pair 2 — need side (HN comment under the SEO MCP; Rich rewrites)

```
If you still want other MCP clients to run the SEO audit wrapper, you can post that need yourself at https://needhave.io/mcp (create_need). I will not copy this Show HN onto the list. Disclosure: I run needhave.
```

### Pair 2 — have side (HN comment under Mcpward; Rich rewrites — only if they have leftover slots)

```
If you have leftover contract-test runs this week for other people's MCP servers, you can post that have at https://needhave.io/mcp (create_have, named window, no contact in the note). I will not copy your launch onto the list. Disclosure: I built needhave.
```

If they do not have leftover slots, **do not send this one**. A launch compliment is not a have.

### Pair 3 / 4

No outbound copy. Hold.

### Agent-operator paste (attach only if they already said their agent would post)

```
Add https://needhave.io/mcp (Streamable HTTP, no key). Call list_posts first so you do not duplicate. If I still need this, create_need. If I have leftover capacity for a named window, create_have. Show me the secret once. Do not put contact details, samples, or anyone else's ask in the note.
```

---

## 5. Skip list (junk patterns)

Drop on sight. Do not "clean up" these into seeds.

| Pattern | Examples from this check |
| --- | --- |
| `TEST` / ignore-me | Pike "Test need… Ignore this."; PAI-106/107 live rows. |
| Exact scrape-copies already on `GET /posts` | UniFi testers, mcp-web-engine, r/forhire code review, r/slavelabour scripts, Oslo LLM freelance, shofetim free plan, Fong paper, programming essay, accounting testers. |
| Expired named windows | "tonight" / "this week" / "this month" from May–July 2026, still sitting on the list as copies. |
| AgentPact bootstrap farm | `Free-tier: public API health sanity report (r4875)`, `self-bootstrap r4840`, `Ext free buy #N`, `Fleet buyer`, `AB need test`, `E2E Gasless Test Need`. |
| Résumé / SEEKING WORK with no leftover window | Most of [HN freelancer Oct 2026](https://news.ycombinator.com/item?id=49922572). |
| Who-is-hiring / FT jobs | [49922569](https://news.ycombinator.com/item?id=49922569). |
| Show HN compliments only | Tofu, Golem, Carve, Docultra, marble games — unless the body asks for testers or leftover runs. |
| "I have an agent" ads | Portfolio-as-MCP, agency spray, "we'll automate anything." |
| Stale Moltbook recruiter posts | BotStore / MoltMatch / K-Work tester posts from ~May 2026 with 0 useful comments. |
| PII-required / compliance dumps | Regulated transcripts that only work if private audio is shared in the public note. |
| No path | AgentPact UUID-only, harvested email, unsolicited Discord/X DM. |
| Both-sides / us | Midl or Pike as the missing side. Replying to Rich's posts as a stranger. |
| Directory junk | Glama/PulseMCP/mcp.so submit forms; official MCP Discord marketing. |

---

## 6. Tracking table (empty rows for Midl)

Caps: ≤5 sends/week, ≤2/venue. Silence from Rich is not yes. Shortlist expires in 7 days if unsent. Outcome values: `invited` / `posted` / `replied` / `no` / `expired`.

| pair | side | found | source | url | author | kind | score | flags | draft | rich | sent | permalink | outcome | needhave_post_id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | need | 2026-10-06 | GitHub / r/mcp | https://github.com/anilloutombam/mcp-failure-lab | anilloutombam | need | 14 | | pair1-need | | | | | |
| 1 | have | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49970078 | iliashad | have | 12 | window-unnamed | pair1-have | | | | | |
| 2 | need | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49976458 | richardbaxter | need | 13 | | pair2-need | | | | | |
| 2 | have | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49976078 | pwizard234 | have | 11 | launch; window-unnamed | pair2-have | | | | | |
| 3 | need | 2026-10-06 | Ask HN | https://news.ycombinator.com/item?id=49972125 | onemiketwelve | need | 16 | no complementary have | — | hold | | | | |
| 3 | have | 2026-10-06 | — | — | — | have | — | NO_HAVE | — | hold | | | | |
| 4 | need | 2026-10-06 | AgentPact | need `a1e5b3c7…` / ~9e208282 | agent a1e5b3c7 | need | — | NO_PATH; PII risk | — | hold | | | | |
| 4 | have | 2026-10-06 | AgentPact | agent `19953956-1632-47f1-91a3-337ff3d735b4` | mr-money | have | — | NO_PATH | — | hold | | | | |

---

## 7. What Midl does next (after this PR)

1. Wait for Rich yes/no on pair 1 and (at most) one HN side of pair 2.
2. Send nothing until a row says **send**. If Rich wants Midl to send, that row must say so.
3. After any send: fill `sent`, `permalink`, then a week later `outcome` and `needhave_post_id` if they posted themselves.
4. Do not add scrape-copies. Do not post to needhave. Do not deploy.
5. Next Tuesday: one new scored comment, not a rewrite of this memo.

**Done for PAI-123:** this memo on a branch. First send is a later issue.
