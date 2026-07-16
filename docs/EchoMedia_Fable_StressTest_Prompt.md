# MASTER STRESS-TEST & AMENDMENT PROMPT — EchoMedia Automations
### For: Claude Fable 5 (adversarial planner) · Drafted by Opus 4.8 · 2026-07-16
*(Paste this whole message into a fresh Fable session, then attach the four reference files named below. Fable PLANS; it does not write build code — Sonnet executes afterward.)*

---

You are a **senior adversarial systems architect and red-team reviewer**. Your job is NOT to build. Your job is to **try to break this plan before it costs the owner money**, then **amend it** and hand a hardened, execution-ready package to Sonnet.

Adopt three hostile reviewers simultaneously and surface what **each** would kill:
- a **skeptical SRE** (what breaks in production, at 3am, at 10 clients),
- a **tight-fisted investor** (why the unit economics don't work, why churn eats it),
- a **cautious lawyer** (what gets the owner sued, ToS-banned, or in breach).

Assume the plan is wrong until proven right. Prefer "**this fails when X**" over "looks fine."

## 📎 READ THESE FIRST (attached)
1. `EchoMedia_Sonnet_Build_Brief.md` — the current build plan (locked decisions, 6 reality-checks, phases, legal + outreach appendices, §11 gap-fixes).
2. `EchoMedia_Research_and_Gaps.md` — real-operator research + the gap analysis behind the plan.
3. `EchoMedia_Sonnet_Execution_Prompt.md` — the DRAFT handoff prompt for Sonnet. You will finalize this as one of your outputs.
4. *(context)* the original `EchoMedia_Automations_Business_Plan.md` if provided.

Read all fully. Do not trust their internal claims — **re-verify the load-bearing ones yourself (below).**

---

## 🎯 GOALS (what your review must achieve)
1. **Find every way this plan fails** before Sonnet writes a line of code — technical, economic, legal, security, operational.
2. **Verify the uncertain, load-bearing assumptions live** (APIs, pricing, ToS, audit gates) instead of trusting the docs.
3. **Amend the plan** — add what's missing, fix what's wrong, and **cut what's over-engineered**.
4. **Protect the owner's hard constraints:** near-zero operator interaction after setup; low COGS; few-client viability; legal safety.
5. **Hand Sonnet an execution package it can build from without re-deciding anything.**

## 🚫 LIMITATIONS (stay in your lane)
- **Do NOT write implementation code, n8n workflows, or scaffolding.** You plan and stress-test only. If you catch yourself building, stop.
- **Do NOT rubber-stamp.** A review that finds nothing critical is a failed review — dig until you find the real failure modes, or explicitly justify why a suspected one is actually fine.
- **Do NOT re-open decisions without cause.** The owner already chose n8n / adapter / Trello / Upload-Post. Challenge them only if you find hard evidence they're wrong — and if so, say so loudly with the evidence.
- **Do NOT invent facts.** Every API/pricing/ToS claim you make or amend must be verified live and cited, or explicitly flagged "unverified."

---

## 🔬 STRESS-TEST METHODOLOGY — attack across ALL these dimensions
For each, list concrete failure scenarios (`fails when → consequence → fix`), not vague worries.

1. **Assumptions audit (do this first).** Extract every load-bearing assumption in the plan into a table: `assumption | why it matters | status (verified/unverified/FALSE) | evidence`. Everything downstream hangs on this.
2. **External-dependency reality (VERIFY LIVE — use WebSearch/WebFetch).** For each named service confirm it still exists and works as assumed, and re-check current pricing/limits:
   - Clippers: **Vizard, Ssemble, Reap** — public API live? URL→9:16 clips+captions? webhook/poll? current price? MCP server real?
   - Poster: **Upload-Post** — does it genuinely front an audited TikTok client for *public* posts? price? FFmpeg step? Also sanity-check **Postiz** (self-host) and **Ayrshare** as fallbacks.
   - **TikTok** Content Posting API — is the unaudited SELF_ONLY/private/≤5-user restriction still current? **IG** 25/24h? **YouTube** ~6 uploads/day/project? Re-read the official docs.
   - **Twitch** — still no VOD-download API? EventSub `stream.offline` reliability? Helix `Get Videos` delay? yt-dlp/twitch-dlp still working? ToS ≤24h cache still in the Developer Agreement?
   - **Stripe / Trello** — anything about the trial-charge flow or Trello webhooks that's changed?
   - Kill or re-architect anything you can't verify.
3. **Architecture & failure modes.** Are the 6 reality-checks sufficient? Find new ones. Probe: idempotency/concurrency (two VODs at once; webhook + poll both firing), the adapter interfaces (do they actually cover Vizard/Ssemble/Reap's real responses?), the Trello approve→post race, what happens at 10 clients, blast radius of one bad clip, retry storms. Also flag **over-engineering to cut**.
4. **Low-touch claim — pressure-test it.** Walk a full month as the operator. Does self-heal (P-2) + weekly digest (P-3) + dead-man's-switch (P-5) actually deliver ~0 daily touch? Enumerate **every** recurring human task that remains (onboarding, OAuth reconnects, token expiry, client comms, failed-payment chasing, API-drift fixes). Be honest about the true residual workload.
5. **Unit economics & churn (investor hat).** Rebuild the per-client P&L with *verified* tool prices. Is it viable at ≥$750 with 2–5 clients? Real CAC (free spec-clip hours)? Break-even client count? Model **losing 1 of 2 clients**. Does the wedge survive vs $20–50/mo DIY tools and the pay-per-view economy? If the honest answer is "not viable at the owner's scale," **say so plainly** — that's a legitimate finding.
6. **Legal & compliance (lawyer hat).** Twitch ToS on downloading/storing/reposting client VODs; copyright/DMCA exposure on clips containing game footage/music; validity of the indemnification + criminal-liability fix; platform automation ToS (are you allowed to auto-post via these APIs at all?); data-protection/retention; the Stripe trial-charge disclosure. Flag anything that needs a real attorney vs anything defensible as-is.
7. **Security.** Secrets handling, Twitch HMAC + Stripe webhook signature verification, OAuth token storage/rotation, per-client isolation, the yt-dlp/twitch-dlp supply-chain risk (arbitrary-code execution surface), and what a leaked client token exposes.
8. **Sequencing & acceptance criteria.** Are the phases in the right order? Is the MVP thin-slice actually the shortest path to a demonstrable, sellable result? Are the acceptance criteria strong enough to catch the failures you found? Amend them.

**Method bar:** rank every finding **Critical / High / Medium / Low**, each with a concrete failure scenario and a specific fix, and tag it **[fix before build] / [fix during build] / [monitor]**. A finding without a fix is incomplete.

---

## 📦 YOUR THREE OUTPUTS (produce all three as files)
1. **`EchoMedia_StressTest_Findings.md`** — the assumptions-audit table + all ranked findings (with evidence/citations for anything you verified live) + a top-line verdict: *proceed / proceed-with-amendments / reconsider*, with the reasoning.
2. **`EchoMedia_Build_Brief_v2.md`** — the amended build plan: a clear **changelog** at the top (what you added / changed / removed and why), then the full hardened brief incorporating your fixes and cut over-engineering. This is what Sonnet builds from.
3. **`EchoMedia_Sonnet_Execution_Prompt_FINAL.md`** — take the attached draft (`EchoMedia_Sonnet_Execution_Prompt.md`) and finalize it against v2: correct goals/limitations, updated commands/links, and any new pre-build verification gates your review surfaced. This is what the owner pastes into Sonnet.

---

## 🛠️ CLAUDE COMMANDS / TOOLS available to you
- **WebSearch / WebFetch** — your primary weapons for dimension 2/5/6. Verify against official docs; cite URLs.
- **`/deep-research`** — if any single question (e.g., "is auto-posting via these APIs actually ToS-permitted in 2026") needs a fuller multi-source pass, use it.
- **Do not** use build/verify commands (`/run`, `/verify`) — there's nothing to run yet; you're planning.
- Write your three outputs to files with the exact names above.

## 🔗 STARTING LINKS (verify these are still accurate — don't assume)
Clippers: [Vizard](https://docs.vizard.ai/docs/quickstart) · [Ssemble](https://www.ssemble.com/docs) · [Reap](https://docs.reap.video/api-reference/1_introduction) · [Opus Clip (gated)](https://help.opus.pro/api-reference/overview)
Posters: [Upload-Post](https://www.upload-post.com/platforms/tiktok/) · [Postiz](https://postiz.com/) · [Ayrshare pricing](https://www.ayrshare.com/pricing/)
Platform gates: [TikTok Direct-Post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) · [TikTok audit](https://developers.tiktok.com/doc/content-posting-api-get-started) · [IG 25/24h](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/) · [YouTube quota](https://developers.google.com/youtube/v3/determine_quota_cost)
Twitch: [Developer Agreement](https://legal.twitch.com/legal/developer-agreement/) · [Videos API](https://dev.twitch.tv/docs/api/videos/) · [twitch-dlp](https://github.com/DmitryScaletta/twitch-dlp)
Business context: [Forbes — clipping farms](https://www.forbes.com/sites/boazsobrado/2026/02/11/inside-the-clipping-farms-driving-fintechs-marketing-boom/) · [Focus Digital — agency churn](https://focus-digital.co/average-marketing-agency-churn/)

---

## ▶️ START
Begin with the **assumptions audit + live-verification pass** (dimensions 1–2) — post that table before going deep, because a FALSE load-bearing assumption there may collapse whole sections and change what's worth reviewing. Then work through dimensions 3–8, then produce the three output files. Flag anything that should go back to the owner as a decision (e.g., "economics only work at ≥$Y" or "TikTok public posting needs the audit — budget $Z / N weeks").
