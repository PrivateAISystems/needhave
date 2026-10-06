# Middleman broker — week-1 shortlist (PAI-123)

Research only. Checked 2026-10-06. **Nothing was sent. Nothing was posted to [needhave.io](https://needhave.io).** Product Worker untouched. No scrape-repost.

This is the first broker batch: find agents already posting a need **and** a complementary have, then draft tips so Rich can yes each outbound. Midl does not play both sides. Agents finish the deal on needhave themselves.

Builds on PAI-108 (seed), PAI-110 / PAI-115 (where and how to talk), PAI-117 (pointers), PAI-121 (find → invite originals). Those memos stay in force. This issue does not redo the pipeline. It ranks **agent-native** venues and names **paired** week-1 targets.

Product lock (Rich 2026-10-06): scout both sides; prefer agents already posting; quality over volume; invite both onto needhave; do not copy their text onto the list; no fake both-sides threads; Rich yes every tip; cap **≤5 / week, ≤2 / venue**.

---

## Live list (do not treat as demand)

`GET https://needhave.io/posts` on 2026-10-06 still has three buckets:

| Bucket | Count | Treat as |
| --- | --- | --- |
| Midl first-party | 3 | Ours. Not invite targets. Pairing-time have expires Tue Oct 6, 11pm America/Chicago. |
| Scraped HN / Reddit copies | 14 | Junk on *our* list. `ALREADY_SCRAPED`. Do not invite those originals in wave 1. Do not add more copies. |
| TEST (Pike / PAI-106 / PAI-107) | 4 | Residue. Wipe is an ops call, not this issue. |

Zero finished stranger threads. Glama connector is now live and healthy ([io.github.PrivateAISystems/needhave](https://glama.ai/mcp/connectors/io.github.PrivateAISystems/needhave), last tested 2026-10-06 07:02 UTC). Registry syndication is a pointer (PAI-117), not a posting venue.

---

## 1. Ranked venues (agents already posting)

Rank = how often a **claimed agent or an operator speaking as their agent** posts a concrete need or leftover have, times signal, divided by junk and ToS risk. Human freelance boards rank low on purpose.

| Rank | Venue | Why it scores | How Midl finds | Reply path | Week-1? |
| --- | --- | --- | --- | --- | --- |
| 1 | **GitHub agent / MCP issue trackers** | Standing “need testers” issues and READMEs written for other agents and other MCP clients. Dates are checkable. Empty matrix cells are a real leftover need. | `gh search issues` + README “need testers” on MCP / OpenClaw repos. Ordinary help-wanted tickets are spam. | Comment on the issue. Disclose. Do not open drive-by PRs. | **Yes — one need tip** |
| 2 | **Cursor forum — Built for Cursor** | Operators already posting leftover MCP testers and leftover QA MCP. Same audience that can install `https://needhave.io/mcp`. | Past-week “looking for testers” / “MCP” in [Built for Cursor](https://forum.cursor.com/c/showcase/built-for-cursor/19). | Rich posts, disclose. No AI-posted comments. | **Yes — one need + one have, or one have if GitHub takes the need** |
| 3 | **Moltbook** (`m/agents`, `m/mcp`) | Agents already post “looking for testers / collaborators.” Public API: `GET https://www.moltbook.com/api/v1/posts?sort=new`. Claimed + verified authors exist. | Search `type=posts` for “looking for testers”, “looking for a few agents”. Drop `is_spam`. Recheck `created_at`. | Reply on the post as a human-disclosed tip, or ask Rich to have Midl comment only if that row says send. High junk. | **Hold for week 2** unless a pair above fails a recheck |
| 4 | **MCP peer remotes** | Adjacent remote MCP services already take agent needs or leftover haves: [Hands for Agents](https://handsforagents.com/) (physical-world have, MCP live 2026-09-29), [Pairoa](https://pairoa.com/) (private need/offer publish), [Tribeunal](https://tribeunal.com/mcp), [Pushary](https://pushary.com/). | Read their `llms.txt` / MCP tools. Do not scrape their private intents. | One personal note from Rich after the list gate (PAI-117 #11). Not a directory form. | **Cluster only — no send this week** |
| 5 | **Official MCP Registry + Glama** | Discovery surface. Agents *find* servers here; they do not post needs/haves here. Needhave’s connector is healthy. Glama tool search ranks the eight tools. | Weekly health check (PAI-117 Tue). Search peers whose README literally asks for testers. | None. Do not spam “submit your server” forms. | Scout only |
| 6 | **r/mcp, r/openclaw, r/better_claw** | Operators sometimes ask for testers. Mixed with promo and stale July–August threads. Several already live as scraped rows. | Reddit search, leftover window only. This env 403s without Rich’s browser / OAuth. | Reply after reading that week’s rules. Help on the thread first. | Skip wave 1 (scraped + stale) |
| 7 | **Ask HN** | Real needs exist (example: [sound-model ask](https://news.ycombinator.com/item?id=49972125), 2026-10-05). Almost all humans. | Algolia last 7d. PAI-121 already scored this surface. | Rich rewrites. HN forbids generated text. | Human-hold, not agent-primary |
| 8 | **X agent accounts** | Thin. Recent-count on 2026-10-06: **2** posts in 7 days matching tester/MCP/OpenClaw language. @rcb384 is reply-only (PAI-115). | Recent counts, then at most one small search if a live thread appears. | Reply under that thread. No cold tweet, no DM. | Skip unless a live thread appears |
| 9 | **OpenClaw core issues** | Busy tracker, but the posts are bugs and feature requests, not need/have notes. | Skip as a tip venue. Use only when a README/issue literally asks outside agents to try a client. | — | Skip |
| 10 | **Discord / Slack** | Wave 3+ only if Rich already belongs. Never the official MCP Discord (their comms rules forbid marketing). No unsolicited DMs. | — | — | Skip |

**Not venues:** r/forhire, r/slavelabour, r/SomebodyMakeThis, HN Who is hiring, HN freelancer resume dumps, Virtuals ACP / crypto job boards, Agentverse SEO listings, Telegram OTC classifieds, Kleinanzeigen scrapers, Glama shopping-deals MCP. Those are human freelance or scrape-the-web. PAI-123 prefers agents already posting.

---

## 2. Quality checklist (agent posts)

A target **passes** only if every pass item is true and no fail flag fires. Score is a tie-break, not a reason to loosen flags. Keep if score ≥ 10 and no flags.

### Pass (all required)

1. **Agent-shaped author.** Claimed / verified agent, or a human operator writing as their agent / MCP client. Bio, User-Agent, OpenClaw / Cursor / Claude Code / Grok Bot, or a standing tester issue counts. A freelance resume does not.
2. **Kind is need or have, not a pitch.** Need = blocked on something a stranger agent can finish from the note alone. Have = leftover capacity or a thing, for a **named window**, that they would honor. “I built a product, please look” without a leftover window fails.
3. **Actionable as a ≤500-character public note.** No email, phone, wallet, or “DM me for the form” as the only next step. A public repo, MCP URL, or issue comment path is enough.
4. **Still open.** Updated or created inside ~14 days, or a standing matrix with empty cells. Recheck the thread the morning of send.
5. **Complement exists.** A concrete counterpart (other side, or a venue cluster that already has both). Do not tip one lonely side to fill the weekly cap.
6. **Legal reply path.** Public comment / issue / forum reply. No harvested email. No unsolicited DM. hello@needhave.io only if they published that address on that post.
7. **Would honor a stranger reply.** They asked for outside agents or outside clients, not applause.

### Fail (any one skips)

| Flag | Meaning |
| --- | --- |
| `STALE` | Window named and gone, or last activity >14 days with no standing ask. |
| `CLOSED` | Filled, locked, marked sold, or author said stop. |
| `SPAM` | Moltbook `is_spam`, promo farm, wallet-drop quorum, paid-to-test crypto. |
| `RESUME` | SEEKING WORK / for-hire with no leftover named window. |
| `HUMAN_JUNK` | Craigslist-style freelance, yard sale, cofounder hunt, “I have an agent.” |
| `PII_REQUIRED` | The only way to help is a phone, KYC, or a private form. |
| `NOT_LIST_SHAPED` | Essay, dashboard rant, Show HN that only wants compliments. |
| `ALREADY_SCRAPED` | Text or URL already on `GET /posts` as one of the 14 copies. |
| `ALREADY_INVITED` | In the invite ledger. |
| `NO_PATH` | No public reply path that Rich can use. |
| `WRONG_VENUE` | Official MCP Discord, Product Hunt, directory submit forms. |
| `BOTH_SIDES` | We would have to invent the other side, or reply as the counterpart. |
| `PAIS_OWNED` | Midl / Pike / Rich / this workspace. Not an invite target. |
| `PAID_MATCHER` | They want escrow, a fee, or a private matcher as the product. Fine as a neighbor; not a needhave post. |

Dimensions for the numeric score (use only after flags are clean): freshness (0–4), actionable note (0–3), audience MCP/agent > indie > freelance (0–3), still open (0–2), leftover window / real need (0–2), legal path (0–2).

---

## 3. Week-1 paired shortlist

Cap if Rich yeses: **4 tips, 2 pairs, 2 venues at 2 each.** Zero is a valid week. Recheck the morning of send. Shortlist expires 2026-10-13 if unsent.

### Pair 1 — MCP client matrix (highest signal)

| Side | Target | Venue | Evidence (2026-10-06) | Flags | Score |
| --- | --- | --- | --- | --- | --- |
| **Need** | [mksglu/context-mode#45](https://github.com/mksglu/context-mode/issues/45) (also mirrored as `claude-context-mode`) | GitHub | OPEN, updated 2026-10-05. Standing matrix. **Cursor, OpenClaw, Zed cells empty.** They ask testers to comment OS + platform and report back. | none | 14 |
| **Have** | [qarunbook MCP](https://forum.cursor.com/t/qa-runbook-over-mcp-cursor-reads-tester-reported-bugs-fixes-them-and-sends-them-back-for-a-human-retest/173601) — @ifeanyiejindu | Cursor forum | 2026-10-02. Leftover: a live MCP at `https://qarunbook.com/api/mcp` that already runs tester → agent-fix → human-retest. Asking whether the agent must not self-pass. That is leftover QA/MCP have, not a resume. | none | 12 |

Why they pair: context-mode is blocked on **other MCP clients**. qarunbook already has a Cursor-side tester loop and leftover attention on MCP design. Each can post their own note on needhave (need: “empty Cursor/OpenClaw cell”; have: “one MCP QA pass this week”). They find each other on the list. Midl does not introduce them in a fake thread.

### Pair 2 — MCP test leftover × payment-gate testers

| Side | Target | Venue | Evidence (2026-10-06) | Flags | Score |
| --- | --- | --- | --- | --- | --- |
| **Need** | [AskGrokWallet — looking for MCP testers](https://forum.cursor.com/t/i-built-a-human-approval-layer-for-ai-agent-payments-looking-for-mcp-testers/171326) — @richard7463 | Cursor forum | 2026-09-11, still open. Asked for **five** Grok Bot or Cursor builders to exercise the MCP approve/deny/receipt flow. One tester (@Joseph_Zaki, Sep 14) already ran the verifier. Four seats may remain — recheck. | borderline freshness (25d); recheck before send | 11 |
| **Have** | [Lifeoflunatic/mcp-audit-skill](https://github.com/Lifeoflunatic/mcp-audit-skill) | GitHub | Public leftover: audit / test / health skills for Claude Code, Cursor, Codex, Gemini CLI, “any MCP-aware agent.” Complements a need for outside MCP testers. Tip the **operator**, not a cloned README. | not a dated window — treat as standing have; confirm they still want outside work | 10 |

Why they pair: one side needs strangers on Grok Bot / Cursor to break an MCP payment gate; the other already publishes leftover MCP audit/test capacity. Same shape as needhave (need a test from another client / have one test pass). Not a paid matcher.

### Alternates (do not send unless a pair above fails recheck)

| ID | Pair | Why it is second |
| --- | --- | --- |
| A1 | Moltbook need [Defici posting-flow testers](https://www.moltbook.com/post/8ff8dbb1-ef01-4b05-8e7f-49aab8ca6404) (@letkausko, 2026-07-21, verified, 57 comments) + GitHub have mcp-audit | Real agent-classifieds need, but `STALE` risk (July, many comments). Recheck if still asking. |
| A2 | Ask HN need [sound models](https://news.ycombinator.com/item?id=49972125) (@onemiketwelve, ~12h old) + any agent have of leftover audio-research | Fresh, list-shaped, but **human**. PAI-123 prefers agents. Rich-rewrite only if both agent pairs die. |
| A3 | MCP peer cluster: Hands for Agents (standing have, 0 tasks completed as of 2026-09-29) + Pairoa operators who already publish private needs | Both sides exist as a cluster. Cold partner notes wait for the list gate (PAI-117). Not week-1 tips. |

### Not paired / do not tip

- Midl’s three live first-party notes (`PAIS_OWNED`).
- UniFi MCP testers, mcp-web-engine, Fong / essay / accounting-testers, r/better_claw infra, HN freelancer leftovers — `ALREADY_SCRAPED`.
- Moonsox testers — Moltbook marked `SPAM`.
- AgentVault / K-Work Trust / claw-ldream team-up — stale or spam-bypassed.
- Crypto “drop your wallet for a 3-agent quorum.”

---

## 4. Draft tip text (Rich yes required)

Do not send from this issue. Silence is not yes. Rich rewrites anything that will sit on HN, Reddit, X, or the Cursor forum. Disclose. Do not say we already listed them. Do not imply a matcher, fees, or traction. Do not copy their wording onto needhave.

Shared facts every tip must keep:

- Public list: https://needhave.io
- Agents post at https://needhave.io/mcp (Streamable HTTP, no key)
- Two post kinds only. Need or have. No account, no matcher, no payment.
- Note is public — no email or phone in it. Secret is shown once.
- We will not copy their text onto the list.

### Pair 1 — need side (GitHub comment on context-mode#45)

```
I run a public need/have list that other MCP clients already read.

You are asking for testers on clients this matrix still has empty (Cursor, OpenClaw, Zed). If that ask is still open, you can post it yourself as a need — I will not copy this issue onto the list.

needhave.io — MCP at https://needhave.io/mcp (no account). In Cursor or Claude Code, add that URL, call create_need, keep the secret it shows once. Leave contact out of the public note.

If you'd rather keep tester signup only on this issue, that's fine. Disclosure: I run needhave.
```

### Pair 1 — have side (Cursor forum reply on qarunbook)

```
Useful constraint (agent cannot pass its own fix). If you still have leftover MCP QA attention this week, you can also post that leftover as a have on a public list other agents already read. I will not copy your post there.

needhave.io — MCP https://needhave.io/mcp (no account, no matcher). create_have, keep the one-time secret, no contact in the note.

Happy to stay on this thread either way. Disclosure: I run needhave.
```

### Pair 2 — need side (Cursor forum reply on AskGrokWallet)

```
If you still want the remaining Grok Bot / Cursor MCP testers, you can post that need yourself on a public list. I will not copy this thread onto it.

needhave.io — https://needhave.io/mcp, create_need, secret shown once, no contact in the note. Disclosure: I run needhave.
```

### Pair 2 — have side (GitHub — mcp-audit-skill, new issue or README discussion only if they accept comments)

```
You already publish leftover MCP audit/test capacity for other agents. If that leftover is still real this week, you can post it as a have (named window, no contact in the note) at https://needhave.io/mcp. I will not copy the README onto the list.

Disclosure: I run needhave. If this is the wrong place to mention it, say so and I'll drop it.
```

### Agent-operator paste (if they ask “what do I tell my agent?”)

```
Add MCP https://needhave.io/mcp (Streamable HTTP, no key). Call list_posts first. If your user agrees the note is public, call create_need or create_have with the thing and a named window. Keep the secret. Do not put email or phone in the note. Do not post anyone else's ask.
```

---

## 5. Skip list (junk patterns)

Never scout these as week-1 inventory. Never copy them onto the list.

**Author / venue junk**

- Human freelance: r/forhire, r/slavelabour, Upwork-shaped bios, HN SEEKING WORK with no leftover window
- “I have an agent that can research / code / automate anything”
- Cofounder hunts, “you vibe-code I do marketing”
- Yard-sale goods unless an agent actually has or needs the thing this week
- Official MCP Discord, Product Hunt, “submit to 20 directories”
- Unsolicited DMs, harvested emails, hello@ used as a cold blast
- Virtuals ACP / Agentverse SEO / Telegram OTC / Kleinanzeigen scrapers
- Moltbook `is_spam`, wallet-drop testnets, paid-to-test crypto
- Essay farms and consent-spam loops (same author, same template, many posts/day)

**Shape junk**

- Show HN / launch that only wants compliments
- Who-is-hiring / full-time roles
- Asks that require PII or a private access form as the only step
- Notes that cannot fit in 500 characters without a sales deck
- Anything already on `GET /posts` as a scraped copy
- Anything Midl or Pike would be answering as the other side

**Process junk**

- Scrape-and-repost (banned; already visible as the 14 copies)
- Fake both-sides threads (PAI-107 was a test, not a deal)
- Quota posting to hit 5 sends
- Tipping a need with no complementary have (or the reverse)
- Announcing needhave in find venues that did not ask
- AI-posted HN / Reddit / Cursor comments
- Claiming a matcher, demand numbers, or “we already listed you”

---

## Ops for this batch

| Step | Who | Rule |
| --- | --- | --- |
| Recheck pair 1 and 2 the morning of send | Midl | If a flag flipped, drop that side. Do not replace with junk. |
| Yes / edit / hold / never on each tip | **Rich** | Silence = hold. Rewrite forum/HN/X in his voice. |
| Send | Midl only if that row says send | ≤2 GitHub, ≤2 Cursor forum, total ≤5. This batch plans 4. |
| After send | Midl | Ledger: found, url, author, kind, pair id, rich, sent, permalink, outcome, needhave_post_id. |
| They post | Them | Their words. We do not create the row. |
| They find each other | Them | We do not accept or write on their thread. |

Success this week is not 4 sends. It is: rubric held, 0 new scrapes, 0 both-sides fakes, and ideally **one stranger posted their own note**.

---

## Sources checked (2026-10-06)

- Live list: `GET https://needhave.io/posts` (3 Midl + 14 scraped + 4 TEST).
- Glama connector: https://glama.ai/mcp/connectors/io.github.PrivateAISystems/needhave (healthy).
- Moltbook API: `/api/v1/posts?sort=new`, `/api/v1/search?type=posts`, posts `8ff8dbb1-…`, `c060b806-…`, `d9ba1fe9-…`.
- GitHub: [context-mode#45](https://github.com/mksglu/context-mode/issues/45) (OPEN, 2026-10-05), [mcp-audit-skill](https://github.com/Lifeoflunatic/mcp-audit-skill).
- Cursor forum: qarunbook (2026-10-02), AskGrokWallet (2026-09-11).
- Hands for Agents status line 2026-09-29: MCP live, 0 tasks completed.
- HN: [item 49972125](https://news.ycombinator.com/item?id=49972125); Algolia Ask HN front page the same morning.
- X: `get_posts_counts_recent` on tester/MCP/OpenClaw language — 2 posts / 7 days. No further billed search.
- Prior memos: PAI-108, PAI-117, PAI-121 (do not re-research).
