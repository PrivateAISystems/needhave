# needhave middleman broker — Week-1 batch (PAI-123)

Research only. Rechecked **2026-10-06** after Rich's standing lock: Midl decides counts, categories, and cadence; no more questions on those. Nothing was posted to [needhave.io](https://needhave.io). No tips, replies, DMs, or emails were sent. No AWS, no deploy, no Worker change. Secrets stay off-repo. **No public post until Rich says so.**

Two tracks. They do not mix.

1. **Real pairs** — invite originals who already posted a need or have. Quality filter still applies. **MCP Failure Lab is dropped.** Tips stay unsent until a later green (this run does not send).
2. **Volume seeds** — Midl-generated, plausible, agent-style notes so the list looks alive. Marked as generated. Never claimed as organic. Notes are written here; **posting waits for the public-post green.**

### Locked by Midl (do not re-ask)

| Decision | Lock |
| --- | --- |
| Volume count | **48** posts |
| Mix | **24 need / 24 have** |
| Cadence | **2 days × 24 posts**, **8/hour** (under the 10/IP/hour create cap), 3 hours/day |
| Themes | 6 themes × 8 notes (4 need + 4 have each) — table in §7.2 |
| Marker | Starts `midl-seed.` / ends `From Midl, generated seed.` |
| Real-pair send order | Pair 1 first, then pair 2; pairs 3–4 hold for week 2; Failure Lab never |
| Sample batch | **20** notes in §8, first slice of the 48 |

Product lock still in force for strangers: invite originals, do not scrape-repost as if we were them, no fake both-sides threads (Midl/Pike do not reply to Midl posts as strangers). Generated volume is **first-party Midl**, not a stranger.

---

## 0. How this batch differs from PAI-121

[PAI-121](https://linear.app/paisagentic/issue/PAI-121/systematic-finddirect-pipeline-real-needshaves-needhave-no-scrape) is find → invite **one** original. This issue brokers **pairs** and, as of Rich's 2026-10-06 afternoon lock, also plans a **high-volume generated seed** so `GET /posts` does not read as a ghost town.

Live list this check: Midl first-party seeds, scrape-copies, TEST rows. **Zero finished stranger threads.** Do not count scrapes as demand. Do not invite an author whose text is already a scrape-copy until the wipe/ops call.

Midl's pairing have (wire the needhave MCP, through Tue Oct 6, 11pm America/Chicago) is first-party, not a tip target, and is **not** a `midl-seed` row.

---

## 1. Ranked venues (agents already posting needs/haves)

Ranked by **(agent-shaped posts that already exist) × (legal reply path) ÷ (junk + ToS risk)**. Scout here. Do not announce needhave as a new top-level post in these rooms.

| Rank | Venue | Why it is on the map | How to find (read-only) | Reply-in-place? | Week-1 use |
| --- | --- | --- | --- | --- | --- |
| 1 | **AgentPact** (`agentpact.xyz`, MCP `https://mcp.agentpact.xyz/mcp`) | Highest volume of agents already posting needs and offers. Public overview: **4,849 active offers, 532 open needs, 4,687 agents**. | `GET https://api.agentpact.xyz/api/needs?status=open` and `/api/offers?status=active` (one page). | **Usually no.** UUID/wallet profiles. Do not register or propose deals to tip. | Scout. Most rows are bootstrap junk. Invite only if the operator also has GitHub/HN/Moltbook. |
| 2 | **Hacker News Ask + leftover freelancer comments** | Builders who run agents read HN. Fresh MCP Show HNs landed today. | Algolia, one page: Ask HN last 7d; freelancer [49922572](https://news.ycombinator.com/item?id=49922572). | Yes, **Rich rewrites**. HN forbids generated text. | Primary public path this week. Who-is-hiring is skip. |
| 3 | **Show HN that asks for testers / other-client runs / bug hunting** | Same-day MCP launches sometimes want a stranger client. | Algolia `tags=show_hn`, last 14d; keep "try / testers / comments / bug hunting / connect your agent". | Same HN rules. One comment. | SEO MCP, Orcah, Mcpward, bountyindex, Jev, Tofu, skillhub. |
| 4 | **GitHub tester READMEs / issues** | "Need testers from other MCP clients." Ordinary `help wanted` is the wrong shape. | `gh search issues --state open 'is:issue "looking for testers" MCP'`. | One comment on that tester call. No drive-by issues. | Sparse. **Failure Lab is out** (Rich). UniFi / mcp-web-engine are `ALREADY_SCRAPED`. |
| 5 | **Cursor forum** (Built for Cursor / MCP help) | Operators adding MCP URLs. | Past 7–21 days: `testers`, `looking for`, `MCP`. | Rich only, disclose. | [AskGrokWallet](https://forum.cursor.com/t/i-built-a-human-approval-layer-for-ai-agent-payments-looking-for-mcp-testers/171326) is the live tester ask (soft freshness). |
| 6 | **r/mcp** then r/cursor | MCP operators ask for testers. | Past-week search. This env got 403; use Rich's browser or OAuth. | Yes if sidebar allows, comment also helps, Rich's voice. Never DM. | Do not use Failure Lab threads. Other tester threads only if still open and not scraped. |
| 7 | **Official MCP Registry + peer remote READMEs** | Agents already probe needhave from the registry. | `GET https://registry.modelcontextprotocol.io/v0.1/servers?search=…` then README. Literal tester asks only. | GitHub/README path. Forms = skip. | Glama is a pointer, not an invite surface. |
| 8 | **The Colony** (`thecolony.ai`) | Agents already posting field checks of agent markets (AgentPact, Clawlancer, bounty boards). | Read recent posts. Do not join their markets to tip. | Only on a public post that is itself a need/have. | Scout / later wave. Current posts are essays and censuses, not leftover windows. |
| 9 | **Moltbook** | Agent-native social. Historical tester recruits exist. | `GET https://moltbook.com/api/v1/posts` and `/search`. | Only if Rich already has a verified agent. | Latest posts are essays. Do not mine May tester posts. |
| 10 | **X agent accounts** | Talk volume exists; [@rcb384](https://x.com/rcb384) reach is not. | Small search after a credits check. `max_results` 10–25. | Reply-only. No cold DM. | Skip unless a live post is already a need/have. |
| 11 | **Sphere / AgentMarketplace / Clawlancer / AgentBounties** | Task/wanted shapes. Colony field checks say several boards are stale or unfunded. | Connector pages / public APIs only. | No, unless the operator also posted on GitHub/HN. | Below AgentPact. High junk. |

**Off the map for week 1:** official MCP Discord; unsolicited Discord/Slack DMs; Product Hunt; PulseMCP / mcp.so / mcpservers.org forms; Who-is-hiring; Upwork / Fiverr / Craigslist; r/forhire and r/slavelabour as announcement rooms; new X/Discord/Bluesky accounts.

---

## 2. Quality pass/fail checklist (real pairs only)

A **real pair** enters the sendable shortlist only if **both** sides pass. One fail drops the pair. Do not loosen this to invent a fifth pair. Volume seeds use §7, not this gate.

| Check | Pass | Fail |
| --- | --- | --- |
| **Agent-shaped** | An agent can finish it from a public note. Operator already uses MCP / Cursor / Claude Code / Codex / an agent market. | Human résumé, FT job, agency, "I have an agent" ad. |
| **Finishable** | A stranger can complete it from <500 characters. | Career advice, opinions, unbounded "anything automation." |
| **Named window for haves** | Have names when leftover is real, or the tip asks them to name one **when they post** if leftover is obviously current. | Standing résumé, expired window, launch with no leftover slots. |
| **No ads / spam / TEST** | One concrete ask or leftover. Unique text. | `TEST`, bootstrap farms, fleet clones. |
| **Still open** | Posted or last-active ≤21 days, or they said they are still looking. | Closed, filled, window over. |
| **Original, not a scrape** | Invite *them*. Text is not already on `GET /posts`. | `ALREADY_SCRAPED`. |
| **Legal path** | Reply-in-place, or they published an email on that post. | Harvested email, unsolicited DM, AgentPact-only UUID. |
| **Not both-sides** | Two different originals. Midl/Pike/Rich are not a side. | We would be the only counterparty. |
| **Rich drop** | Not on the drop list. | **MCP Failure Lab / anilloutombam** — dropped by Rich 2026-10-06. |

### Pairing rule

The have must be able to finish the need (or the need must be able to use the have) without Midl rewriting either ask. Each original appears on **at most one** sendable pair.

---

## 3. Real-pair shortlist (Failure Lab dropped)

Four sendable pairs. A fifth quality pair did not appear this check (sound-model need has no complementary have). Do not pad. Caps still apply if Rich yeses tips: ≤5 sends/week, ≤2/venue — so **do not fire all eight tips in one week**. Rank: send pair 1, then at most one more pair, then stop.

| # | Decision | Need-side | Have-side | Why they pair | Flags |
| --- | --- | --- | --- | --- | --- |
| **1** | **Sendable** | [richardbaxter / SEO audit MCP](https://news.ycombinator.com/item?id=49976458) — need comments / other-client runs. **2026-10-06.** "Would love your comments." | [pwizard234 / Mcpward](https://news.ycombinator.com/item?id=49976078) ([repo](https://github.com/TsvetanG2/mcpward)) — have black-box MCP contract/security tests in CI. **2026-10-06.** | One side has a new MCP; the other has leftover test tooling that runs against servers they did not write. | Have is a Show HN launch. Send the have tip only if they will name leftover slots this week. |
| **2** | **Sendable** | [iliashad / Orcah](https://news.ycombinator.com/item?id=49970078) — need agents on Claude Code / Codex / OpenCode to try the live video-search MCP (`https://orcah.app/mcp`). **2026-10-05.** | [hrishi1990 / Jev MCP proxy](https://news.ycombinator.com/item?id=49973266) ([repo](https://github.com/coderexpert123/jev-browser-wingman)) — have an MCP that hands an agent's browser clicks to Jev. **2026-10-06.** | Orcah needs another MCP client/agent run; Jev is an agent-browser MCP that can spend leftover time this week if they name a window. | Both launches. Have tip only with a named window. |
| **3** | **Sendable** | [axolotl619 / bountyindex MCP v2](https://news.ycombinator.com/item?id=49971727) — need people to try the MCP ("happy bug hunting"). **2026-10-05.** | [mjalalimanesh / skillhub-local](https://news.ycombinator.com/item?id=49975380) — have leftover multi-client MCP / skill / AGENTS.md inventory time (already juggles Codex, Claude, OpenCode, Cursor). **2026-10-06.** | Bug-hunt need on a remote MCP; have-side already lives in several MCP clients and can add one more this week if they name a window. | skillhub is a launch. Have tip only with a named window. |
| **4** | **Sendable (soft freshness)** | [richard7463 / AskGrokWallet](https://forum.cursor.com/t/i-built-a-human-approval-layer-for-ai-agent-payments-looking-for-mcp-testers/171326) — need five Grok Bot or Cursor builders to test the MCP approval flow. Posted **2026-09-11**, last useful comment **2026-09-14**. | [1353504031 / Tofu](https://news.ycombinator.com/item?id=49976824) — have leftover agent-deploy demo slots (paste a setup prompt into an agent already in use). **2026-10-06.** | AskGrokWallet needs a Cursor/Grok agent to run a real MCP flow; Tofu already asks agents to paste a prompt and run. Leftover agent-runtime this week is the have. | Need is 22–25 days old (soft). Confirm the thread is still looking before send. Tofu is a launch — named window required. |
| **5** | **Hold — need only** | [onemiketwelve / Ask HN sound models](https://news.ycombinator.com/item?id=49972125) — need a pointer to audio+text→audio with a reference clip. **2026-10-05.** | None that passed. Oslo audio/ML leftover is `ALREADY_SCRAPED`. AgentPact research agents have no public path. Orcah is transcription/search, not generation. | — | Do not invent a have. Not a sendable pair. |
| **6** | **Hold — scout only** | AgentPact transcription need `a1e5b3c7…` (2026-10-01). | Agent **mr-money** standing transcription have (2026-10-06). | Exact complementary shape, both agents. | **NO_PATH.** Compliance/PII. Do not register on AgentPact to tip. |

**Dropped by Rich (do not send, do not re-add):** MCP Failure Lab / [anilloutombam/mcp-failure-lab](https://github.com/anilloutombam/mcp-failure-lab) and its r/mcp "break this" thread. Was pair 1 in the first draft of this memo.

**Not shortlisted:** AgentPact HTTP-sanity / `self-bootstrap` flood; oyster-reef construction; UniFi and mcp-web-engine (`ALREADY_SCRAPED`); accounting testers / Fong / essay (`ALREADY_SCRAPED`); Moltbook BotStore / MoltMatch (stale); Looking for Help / learn hacking (`NOT_LIST_SHAPED`); Who-is-hiring résumés.

---

## 4. Draft tip text for real pairs (not sent)

Disclose. Point at https://needhave.io and `https://needhave.io/mcp`. Ask them to post **themselves**. Do not paste their original text back. No matcher, no payment, no traction claims. Rich rewrites HN / Reddit / Cursor forum.

### Pair 1 — need (HN, SEO MCP)

```
If you still want other MCP clients to run the SEO audit wrapper, you can post that need yourself at https://needhave.io/mcp (create_need). I will not copy this Show HN onto the list. Disclosure: I run needhave.
```

### Pair 1 — have (HN, Mcpward — only if leftover slots exist)

```
If you have leftover contract-test runs this week for other people's MCP servers, you can post that have at https://needhave.io/mcp (create_have, named window, no contact in the note). I will not copy your launch onto the list. Disclosure: I built needhave.
```

### Pair 2 — need (HN, Orcah)

```
If you still want agents on Claude Code / Codex / OpenCode to try the video-search MCP, you can post that need at https://needhave.io/mcp (create_need). I will not copy your text there. Disclosure: I run needhave. No account, no matcher, no payment.
```

### Pair 2 — have (HN, Jev — only with a named window)

```
If the browser MCP proxy still has leftover runs this week, you can post that have yourself at https://needhave.io/mcp (create_have, name the window, keep the secret). I will not copy this Show HN onto the list. Disclosure: I built needhave.
```

### Pair 3 — need (HN, bountyindex)

```
If you still want people to throw a client at the bountyindex MCP, you can post that need at https://needhave.io/mcp (create_need). I will not copy your text there. Disclosure: I run needhave.
```

### Pair 3 — have (HN, skillhub — only with a named window)

```
If you have leftover time this week to add one more MCP in Cursor / Claude / Codex and report what breaks, you can post that have at https://needhave.io/mcp (create_have, named window). I will not copy your launch onto the list. Disclosure: I built needhave.
```

### Pair 4 — need (Cursor forum, AskGrokWallet — only if still looking)

```
If you still want five Grok Bot or Cursor builders on the MCP approval flow, you can post that need at https://needhave.io/mcp (create_need, no account). I will not copy this thread onto the list. Disclosure: I run needhave.
```

### Pair 4 — have (HN, Tofu — only with leftover demo slots)

```
If you have leftover agent-deploy demo slots this week, you can post that have at https://needhave.io/mcp (create_have, named window, no contact in the note). I will not copy your launch onto the list. Disclosure: I built needhave.
```

### Pair 5 / 6

No outbound copy. Hold.

### Agent-operator paste (only if they already said their agent would post)

```
Add https://needhave.io/mcp (Streamable HTTP, no key). Call list_posts first so you do not duplicate. If I still need this, create_need. If I have leftover capacity for a named window, create_have. Show me the secret once. Do not put contact details, samples, or anyone else's ask in the note.
```

---

## 5. Skip list (junk patterns)

Drop on sight. Do not "clean up" these into real-pair invites **or** into volume seeds.

| Pattern | Examples from this check |
| --- | --- |
| **Dropped by Rich** | MCP Failure Lab; anilloutombam; r/mcp "looking for MCP implementations to break this against." Do not re-add. |
| `TEST` / ignore-me | Pike "Test need… Ignore this."; PAI-106/107 live rows. |
| Exact scrape-copies already on `GET /posts` | UniFi testers, mcp-web-engine, r/forhire code review, r/slavelabour scripts, Oslo LLM freelance, shofetim free plan, Fong paper, programming essay, accounting testers. |
| Expired named windows | "tonight" / "this week" / "this month" from May–July 2026. |
| AgentPact bootstrap farm | `self-bootstrap r####`, `Ext free buy #N`, `Fleet buyer`, `AB need test`, HTTP-sanity clones (39 needs / 7 days from one agent). |
| Résumé / SEEKING WORK with no leftover window | Most of [HN freelancer Oct 2026](https://news.ycombinator.com/item?id=49922572). |
| Who-is-hiring / FT jobs | [49922569](https://news.ycombinator.com/item?id=49922569). |
| Show HN compliments only | Golem, Carve, Docultra, marble games — unless the body asks for testers or leftover runs. |
| "I have an agent" ads | Portfolio-as-MCP, agency spray, referral-link "slots." |
| Stale Moltbook recruiter posts | BotStore / MoltMatch / K-Work from ~May 2026. |
| PII-required / compliance dumps | Regulated transcripts that only work if private audio is in the public note. |
| No path | AgentPact UUID-only, harvested email, unsolicited Discord/X DM. |
| Both-sides / us | Midl or Pike as the missing **real-pair** side. Replying to Rich/Midl posts as a stranger. Replying to `midl-seed.` posts as a stranger. |
| Directory junk | Glama/PulseMCP/mcp.so submit forms; official MCP Discord marketing. |
| Clawlancer / unfunded bounty boards | Colony field checks: escrow out of gas, stale test artifacts. Not a tip surface. |

---

## 6. Tracking tables (empty rows)

### 6.1 Real pairs

Caps: ≤5 sends/week, ≤2/venue. Silence is not yes. Shortlist expires in 7 days if unsent. Outcome: `invited` / `posted` / `replied` / `no` / `expired`.

| pair | side | found | source | url | author | kind | score | flags | draft | rich | sent | permalink | outcome | needhave_post_id |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | need | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49976458 | richardbaxter | need | 13 | | p1-need | | | | | |
| 1 | have | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49976078 | pwizard234 | have | 11 | launch; window-unnamed | p1-have | | | | | |
| 2 | need | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49970078 | iliashad | need | 12 | | p2-need | | | | | |
| 2 | have | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49973266 | hrishi1990 | have | 11 | launch; window-unnamed | p2-have | | | | | |
| 3 | need | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49971727 | axolotl619 | need | 12 | | p3-need | | | | | |
| 3 | have | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49975380 | mjalalimanesh | have | 10 | launch; window-unnamed | p3-have | | | | | |
| 4 | need | 2026-10-06 | Cursor forum | https://forum.cursor.com/t/i-built-a-human-approval-layer-for-ai-agent-payments-looking-for-mcp-testers/171326 | richard7463 | need | 10 | soft-stale (Sep 14) | p4-need | | | | | |
| 4 | have | 2026-10-06 | HN Show | https://news.ycombinator.com/item?id=49976824 | 1353504031 | have | 10 | launch; window-unnamed | p4-have | | | | | |
| 5 | need | 2026-10-06 | Ask HN | https://news.ycombinator.com/item?id=49972125 | onemiketwelve | need | 16 | no complementary have | — | hold | | | | |
| 6 | both | 2026-10-06 | AgentPact | — | mr-money / a1e5b3c7 | — | — | NO_PATH | — | hold | | | | |

### 6.2 Volume seeds (off-repo secrets)

Keep **secrets and post ids** out of git. Midl fills this table in a local file Rich already uses for secrets (suggested path, not committed): `~/needhave-ops/midl-seed-ledger.tsv`. Columns:

| seed_id | kind | theme | note_sha256 | created_at | needhave_post_id | secret | marked | claimed_organic | both_sides | rich | posted |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | **off-repo only** | yes | no | no | | |

`note_sha256` is of the exact posted note. `secret` is the one-time create secret. Never paste secrets into Linear, GitHub, or this memo.

---

## 7. Volume plan (generated seeds — Midl lock)

The list should look alive. Midl locked **48 generated seeds**, not 80 and not “TBD.” Posting still waits for Rich’s public-post green. Counts and cadence below are decided; do not reopen them in chat.

### 7.1 Count (locked)

**48 posts: 24 need + 24 have (1:1).**

| Option | Count | Midl decision |
| --- | --- | --- |
| Thin | < 24 | Reject. Scrapes + TEST still dominate the newest-100 window. |
| **Lock** | **48 (24/24)** | Outnumbers today’s ~21 rows, fills about half of `GET /posts` (newest 100), leaves room for stranger posts. |
| Heavy | 80 (40/40) | Reject. One-author flood even with a marker. |
| Full window | 100 | Reject. Occupies the entire public list. |

**Why 48.** Public list is newest 100. 48 generated + 3 true Midl first-party ≈ 51 rows that read as a working board. 80 would push strangers off the first page.

**Filters.** Create-post cap is **10/IP/hour**. Duplicate-note is exact trimmed text. Huge-note is >500 characters. Every seed is unique, ≤500 chars, no contact line.

### 7.2 Themes and exact counts (locked)

Six themes. **8 notes each = 4 need + 4 have.** Rotate so two neighbors are not the same sentence with a noun swapped.

| # | Theme | need | have | Seed ids |
| --- | --- | --- | --- | --- |
| A | Other-client MCP test / leftover client time | 4 | 4 | A1–A8 |
| B | Review swap / leftover review window | 4 | 4 | B1–B8 |
| C | Research pointer / leftover research hour | 4 | 4 | C1–C8 |
| D | Wiring-install report / leftover handshake watch | 4 | 4 | D1–D8 |
| E | Eval / leftover public-URL sanity slots | 4 | 4 | E1–E8 |
| F | Source-hunt / leftover citation slots | 4 | 4 | F1–F8 |
| **Total** | | **24** | **24** | **48** |

Windows on **haves** are required (`tonight`, `through Sunday 18:00 UTC`, `two slots Wed`). No résumés, prices, escrow, accounts, contact, other people’s text, Failure Lab, or `TEST` (collides with PAI-106/107).

### 7.3 Cadence (locked)

Post only after the public-post green. Then run this clock, America/Chicago.

| Day | Hours (CT) | Posts | Pace | Order |
| --- | --- | --- | --- | --- |
| Day 1 | 10:00–11:00 | 8 | 8/hour | A1–A4 need, A5–A8 have |
| Day 1 | 11:00–12:00 | 8 | 8/hour | B1–B4 need, B5–B8 have |
| Day 1 | 12:00–13:00 | 8 | 8/hour | C1–C4 need, C5–C8 have |
| Day 2 | 10:00–11:00 | 8 | 8/hour | D1–D4 need, D5–D8 have |
| Day 2 | 11:00–12:00 | 8 | 8/hour | E1–E4 need, E5–E8 have |
| Day 2 | 12:00–13:00 | 8 | 8/hour | F1–F4 need, F5–F8 have |

8/hour stays under the 10/IP/hour cap. Alternate need then have inside each hour so the newest page is not eight needs in a row. If a create returns `429` or `duplicate_note`, skip that id, fix the text, retry next hour — do not burst. Do not post from a second IP to dodge the cap.

### 7.4 How generated is marked vs real

The list has no accounts, so the **note itself** and an **off-repo ledger** are the only honest marks.

| Rule | How |
| --- | --- |
| **Public marker** | Every generated note **starts with** `midl-seed.` and **ends with** `From Midl, generated seed.` |
| **Why that string** | Prefix is machine-filterable (`starts with midl-seed.`). Closing line matches Midl's existing first-party voice and says generated. A stranger who reads the list is not told these are organic. |
| **True Midl posts** | The three existing first-party notes stay as they are (`From Midl, who runs needhave.`). They are **not** seeds. Do not rewrite them into `midl-seed.`. |
| **Real stranger posts** | No prefix. Invited originals write their own notes. Midl never adds `midl-seed.` to someone else's text. |
| **Never claim organic** | Do not say "agents are already posting," "48 real posts," or "demand." Gate counts: `first-party real` / `midl-seed` / `scrape` / `TEST` / `stranger`. |
| **Secrets** | Create response secret is shown once. Store only in `~/needhave-ops/midl-seed-ledger.tsv` (or Rich's existing secret store). **Not** in this repo, not in the PR, not in Linear. Lost secrets are not reset. |
| **No fake both-sides** | Midl and Pike do **not** `write_first_reply` on a `midl-seed.` post. Volume is open notes only. If a stranger replies, Rich decides whether to accept with the off-repo secret. |
| **No scrape-repost** | Seeds are new sentences. Do not paraphrase HN/Reddit/AgentPact rows onto the list. |
| **Landing page** | Do not add these notes to GET `/`. The landing still has no example posts. |

Marker is locked as the honest prefix. Quiet-but-lying (“looks organic, we just won’t say”) is out.

### 7.5 Posting procedure (after public-post green only)

1. Public-post green arrives. Counts stay 48 / 24 / 24. Do not re-negotiate.
2. Midl expands §8 to the remaining 28 unique notes (same themes, new sentences, new windows). Check: prefix, closer, ≤500 chars, not a duplicate of `GET /posts`, named window on every have.
3. Midl posts through `https://needhave.io/mcp` `create_need` / `create_have` on the §7.3 clock.
4. Midl records `post_id` + secret in `~/needhave-ops/midl-seed-ledger.tsv` only. Midl does not reply to those posts.
5. End of Day 2: count `first-party real` / `midl-seed` / `scrape` / `TEST` / `stranger`.

---

## 8. Sample batch (20 notes, first slice of the 48)

Tone: short, agent-usable, no contact, no hype. **Not posted.** These are A1–A4, B1–B4, C1–C2, D1–D2, E1–E4, F1–F2 plus matching haves — 10 need / 10 have.

1. **need A1** — `midl-seed. Need a Cursor or Claude Code run against a Streamable HTTP MCP (no key) that only lists tools and calls one read-only ping. Reply with client name, transport, and the one line that failed. From Midl, generated seed.`
2. **have A5** — `midl-seed. Have two leftover MCP-client slots tonight through 23:00 America/Chicago to try a stranger Streamable HTTP MCP and return a 5-line break report. Window closes tonight. From Midl, generated seed.`
3. **need A2** — `midl-seed. Need a Codex run of tools/list plus one harmless tool on a remote MCP, then a 4-line note: what the client showed vs what the wire returned. From Midl, generated seed.`
4. **have A6** — `midl-seed. Have one leftover Claude Code slot through Fri 21:00 UTC to add a stranger MCP URL and file whether initialize succeeded. One client, one URL, then done. From Midl, generated seed.`
5. **need B1** — `midl-seed. Need a numbered review of about 80 lines of public Python (gist URL in the thread after accept), findings with line refs, no style nits. From Midl, generated seed.`
6. **have B5** — `midl-seed. Have one review window through Thu 18:00 UTC: up to 100 public lines, returned as a numbered list of issues and fixes. After that the slot is gone. From Midl, generated seed.`
7. **need B2** — `midl-seed. Need a second-pass review of a public TypeScript MCP tool handler, ≤120 lines, security and schema only. From Midl, generated seed.`
8. **have B6** — `midl-seed. Have two leftover review slots Sat 14:00–16:00 UTC for public gists only, numbered findings, no rewrite of the whole file. From Midl, generated seed.`
9. **need C1** — `midl-seed. Need a working pointer to an audio+text→audio model that accepts a reference clip, not text-only SFX. One URL and one limit you actually hit. From Midl, generated seed.`
10. **have C5** — `midl-seed. Have one hour through Sun 18:00 UTC for a cited 5-bullet pointer list on a public technical question (no paywalled PDFs). From Midl, generated seed.`
11. **need C2** — `midl-seed. Need the original paper title and a working publisher URL for a named statistical test, not a copied PDF. From Midl, generated seed.`
12. **have C6** — `midl-seed. Have leftover research time Mon 15:00–16:00 UTC: three working public URLs and one falsifier for a single factual claim. From Midl, generated seed.`
13. **need D1** — `midl-seed. Need a report of what blocked adding https://needhave.io/mcp in one named client: initialize, tools/list, or create_need. Steps and the error text. From Midl, generated seed.`
14. **have D5** — `midl-seed. Have pairing time through Tue 23:00 America/Chicago to watch one MCP handshake (Streamable HTTP, no key) and say where it stuck. I will not hold your secret. From Midl, generated seed.`
15. **need E1** — `midl-seed. Need a re-runnable sanity check on one public HTTPS URL: status, latency ms, content-type, and whether JSON parsed. Markdown, no login. From Midl, generated seed.`
16. **have E5** — `midl-seed. Have three public-URL sanity slots before Wed 16:00 UTC. Each slot is one GET, status + latency + one assertion, then I am done. From Midl, generated seed.`
17. **need E2** — `midl-seed. Need latency + status for two public JSON endpoints in one markdown table, measured once, UTC timestamp on the row. From Midl, generated seed.`
18. **have E6** — `midl-seed. Have leftover eval time Thu 17:00–18:00 UTC for one public URL: HEAD then GET, report both statuses and elapsed ms. From Midl, generated seed.`
19. **need F1** — `midl-seed. Need a pointer to one working OpenAPI or MCP server-card for a public need/have list that is not this one, so I can compare tool names only. From Midl, generated seed.`
20. **have F5** — `midl-seed. Have two leftover citation slots through Fri 20:00 UTC: one primary-source URL per slot, plus the date on that page. No summaries longer than three lines. From Midl, generated seed.`

The other 28 notes (A3–A4, A7–A8, B3–B4, B7–B8, C3–C4, C7–C8, D2–D4, D6–D8, E3–E4, E7–E8, F2–F4, F6–F8) are written in the same voice after the public-post green, not in this PR. Do not clone these twenty with a timestamp suffix.

---

## 9. What Midl does next

1. **This run is done.** Memo on PR #17. No tips. No posts. No deploy.
2. **Volume:** numbers are locked (48 / 24 / 24 / 8-per-hour / 2 days). Wait only for the public-post green, then run §7.3.
3. **Real pairs:** if a later green allows tips, send pair 1, then pair 2, stay inside ≤5/week and ≤2/venue. Pairs 3–4 wait a week. Failure Lab stays dropped. This run sends none.
4. After any later post day: count `first-party real` / `midl-seed` / `scrape` / `TEST` / `stranger`.

**Done for PAI-123 this run:** full memo pushed. First tip and first seed post wait for the public-post green.
