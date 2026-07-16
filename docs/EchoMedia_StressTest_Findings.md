# EchoMedia — Adversarial Stress-Test Findings
### Reviewer: Fable 5 (red-team: SRE / investor / lawyer) · 2026-07-16
### Verdict: **PROCEED-WITH-AMENDMENTS** — 3 Critical findings, all fixable before build; economics survive only with ingest caps + ≥$750 pricing

---

## 0. TOP-LINE VERDICT & REASONING

The architecture is sound (adapter pattern, client-approves, event-driven posting, mocks-first). But the plan as written contains **one false economic assumption that invalidates the COGS model for the exact ICP it targets**, **one exploitable security hole in the legal spine of the business**, and **one operational blind spot that will be the actual cause of churn**. All three are fixable on paper before Sonnet writes a line — hence proceed-with-amendments, not reconsider. The economics remain viable **only** with per-tier ingest caps and ≥$750 pricing; at the owner's stated 2-client scale this is a ~$1,200–1,350/mo semi-passive side asset with 50% single-client concentration risk, not an income. That was already flagged; nothing found here improves it.

---

## 1. ASSUMPTIONS AUDIT (load-bearing claims, verified live 2026-07-16)

| # | Assumption | Why it matters | Status | Evidence |
|---|---|---|---|---|
| A1 | Upload-Post fronts an **audited TikTok client** → public posting without our own TikTok audit | Entire RC-4 mitigation; TikTok is a headline platform | ✅ **VERIFIED** | Vendor states: "Upload-Post operates an approved TikTok Content Posting API integration… without submitting your own app for TikTok's audited-client review" — [upload-post.com/platforms/tiktok](https://www.upload-post.com/platforms/tiktok/). TikTok needs a **paid plan** (not Free). |
| A2 | Upload-Post pricing ≈ $16/mo | COGS model | ✅ **VERIFIED (revised)** | ~$16/mo annual entry; **$24/mo = unlimited posts, 5 profiles**; $50/mo = 25 profiles + whitelabel; TikTok capped **15 posts/24h per account** (ample: we post ≤1–2/day/client) — [docs](https://docs.upload-post.com/guides/limit-of-uploads/), [review](https://bestpick.guide/social-media-tools/upload-post-review/). Profiles model = one profile per client → agency-shaped. Per-client poster COGS at 5 clients ≈ **$5–10**. |
| A3 | Upload-Post explicitly permits agency/reseller use for client accounts | Legal/ToS safety of the posting leg | ⚠️ **UNVERIFIED** | Platform page silent on agency restrictions. Profiles model implies it; whitelabel tier strongly implies it. **Action: email vendor to confirm before onboarding client #1.** |
| A4 | Clipper cost ≈ $35/client/mo (plan §8.1) | The whole $60 COGS / high-margin story | ❌ **FALSE for the stated ICP** | Vizard: **1 credit = 1 min uploaded; Creator plan ≈ 600 credits/mo** (7,200/yr), API on paid plans, rate limit 3/min & 20/hr — [vizard.ai/pricing](https://vizard.ai/pricing). ICP streams 12+ h/wk ≈ **3,100 min/mo = 5× the Creator allowance.** Feeding full VODs blows the clipper budget to an estimated $100–200+/client/mo. **See C1.** |
| A5 | Trello webhook fires on card move; signature verifiable; webhooks robust | Approve→post trigger + its security | ✅ **VERIFIED (with teeth)** | `X-Trello-Webhook` header = base64 HMAC-SHA1 of (body + callbackURL) signed with the app secret — [Trello webhooks docs](https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/). **If unverified, anyone who learns the callback URL can forge an "Approved" event → see C2.** Auto-disable is tolerant (30 days AND 1,000+ consecutive failures before disable; one success resets) — brief's fear of fragile webhooks was overstated; a weekly reconciliation sweep still wise (M4). |
| A6 | TikTok unaudited = SELF_ONLY/private/≤5 users; IG 25/24h; YT ~6 uploads/day/project | RC-4/RC-6 platform gates | ✅ VERIFIED <24h ago against official docs (TikTok Direct-Post, Meta `content_publishing_limit`, YT quota docs) by the Opus research pass; unchanged. Note: routing via Upload-Post makes the YT/IG limits **their** problem per connected account, but the per-account platform caps still bind (IG 25/24h per account). |
| A7 | No Twitch VOD-download API; EventSub `stream.offline` can lag (~20h report); yt-dlp Twitch extractor breaks periodically; Dev Agreement allows ≤24h cache only | RC-1/RC-5 intake design; legal exposure | ✅ VERIFIED <24h ago (official Twitch docs + Dev Agreement + forum + yt-dlp issue tracker). **But the brief's own 30-day raw-VOD retention example contradicts the ≤24h cache clause → see H4.** |
| A8 | Vizard accepts remote URLs incl. YouTube directly | Enables zero-download ingest for YouTube-Live clients | ✅ VERIFIED (Vizard submit ref: remote URL, YouTube, Drive, Vimeo, StreamYard). **Twitch VODs still require download** — no Twitch source support. Exploit this: see H1 fix. |
| A9 | Client approves promptly, so posting cadence holds | The service visibly "works"; retention | ⚠️ **UNTESTED & OPTIMISTIC** — the plan's own research says creators are time-poor; the design moves the critical-path task to the least reliable actor. **See C3.** |
| A10 | ≥$750/mo price clears the market floor | Unit economics | ✅ Consistent with operator research ($750–1,500 entry). Unchanged. |

---

## 2. FINDINGS (ranked)

### 🔴 C1 — The clipper credit model breaks COGS for the target ICP · **[fix before build]**
**Fails when:** a Growth client streams the ICP-typical 12 h/week. Full-VOD ingestion needs ~3,100 Vizard credits/mo vs ~600 on Creator (~5×). Clipper COGS becomes $100–200+/client, gross margin at $750 falls toward ~60–70% *before* anything else, and the "under $60 software COGS" promise in the plan is fiction.
**Fix (three parts, all contractual/architectural, no code yet):**
1. **Tiers are defined by INGESTED HOURS first, clip count second.** e.g. Growth $750 = up to **10 h ingested/mo** + 15 clips; Omnipresent $1,100+ = up to **25 h** + 30 clips. Contract caps both; overage = per-hour fee or skip.
2. **Selective ingestion in the pipeline:** per client, ingest N streams/week (config), and/or trim VODs to the most recent X hours before submit. The scheduler must track a per-client monthly ingest-minutes budget and stop (client-visible "budget reached" state) rather than overspend.
3. **UNIT_ECONOMICS.md must model clipper cost as a function of ingest hours**, not a flat $35.
**Evidence:** [vizard.ai/pricing](https://vizard.ai/pricing) (1 credit = 1 min; ~600/mo Creator).

### 🔴 C2 — Forged Trello "Approved" event → auto-posting unapproved content · **[fix before build]**
**Fails when:** anyone who discovers the n8n webhook callback URL (guessable, leaked logs, referer) POSTs a crafted Trello event payload claiming card X moved to Approved. WF-5 schedules a public post the client never approved — the exact catastrophe the whole Review Gateway exists to prevent, and it voids the indemnification logic (client didn't approve).
**Fix (must be in Phase 1 acceptance criteria):** (a) verify the `X-Trello-Webhook` HMAC-SHA1 signature on every callback; (b) **never trust the event payload** — re-fetch the card via the Trello REST API and confirm it is genuinely in the Approved list before posting; (c) keep the idempotency `postedAt` guard. Signature docs: [Trello webhooks](https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/).

### 🔴 C3 — The client-approval bottleneck is the real dead-man risk (and churn engine) · **[fix during build + contract]**
**Fails when:** a busy streamer ignores Trello for 2 weeks. Pipeline is green, digest is green (clips ARE being delivered), yet nothing posts → the client perceives "I'm paying $750 and nothing happens" → churn; or disputes the charge. P-5's dead-man switch watches *clip flow*, not *approval flow* — it will not fire.
**Fix:** (1) **automated approval nudges**: client email/notification when clips sit in Staged >48h, escalating once at 5 days; (2) digest already flags 0-approvals-in-7-days — **treat that flag as a churn-risk alarm requiring operator outreach** (this is a legitimate, rare human task; document it in OPERATING_MODEL.md); (3) **contract clause (add to Appendix A §E):** unapproved clips count toward the monthly deliverable quota; no refunds/credits for client-side approval inaction; (4) onboarding sets the expectation: "approve twice a week, 5 minutes."

### 🟠 H1 — VOD size vs a $5–20 VPS: disk and bandwidth will fail first · **[fix before build (design) / during build (code)]**
**Fails when:** a 6-hour 1080p60 Twitch VOD (~10–20 GB) downloads onto a VPS with 25–50 GB disk while a second client's VOD arrives → disk full → every workflow on the box fails at once (n8n shares the disk).
**Fix:** stream-to-R2 (no full local copy where possible); enforce a disk-watermark check before download; process one download at a time per box (queue); **delete local + raw R2 copy immediately after the clip job completes** (also fixes H4); and **prefer direct-URL ingest — Vizard accepts YouTube URLs natively (A8), so YouTube-Live clients need NO download leg at all.** Strategic note to owner: **YouTube-Live streamers are the lower-friction beachhead ICP** — zero download infra, no Twitch ToS gray zone.

### 🟠 H2 — Webhook + poll double-intake burns real money · **[fix before build]**
**Fails when:** RC-5's scheduled poll and a late-arriving EventSub webhook both detect the same VOD → two clip jobs → double credit burn (C1 makes this expensive) + duplicate Trello cards confusing the client.
**Fix:** intake idempotency — a `processed_vod_ids` set per client (keyed on Twitch/YouTube video ID) checked-and-set atomically before any download/submit. Must be in Phase 2 acceptance criteria (simulate webhook+poll race).

### 🟠 H3 — Upload-Post platform-concentration + agency-ToS gap · **[monitor + one action]**
**Fails when:** Upload-Post (a small vendor) dies, reprices, loses its TikTok audit status, or forbids agency use on cheap tiers → the entire posting leg halts for all clients simultaneously.
**Mitigation already in plan:** `IPoster` adapter + Ayrshare fallback ($149/mo — tolerable at 5+ clients, painful at 2). **New action:** email Upload-Post support to confirm client-account/agency usage is permitted on the Basic/$24 tier before onboarding client #1 (A3). Log the answer in the repo.

### 🟠 H4 — Raw-VOD retention (30-day example) contradicts Twitch's ≤24h cache clause · **[fix before build]**
**Fails when:** a dispute or Twitch enforcement action finds the agency warehousing 30 days of VODs downloaded from Twitch infrastructure. The client's written license (Appendix A §A.2) is the defensible basis for *processing*, but long storage of Twitch-sourced files is needless exposure and needless R2 cost.
**Fix:** legal Appendix A §D.2 default becomes: **raw VODs deleted within 72h of clip-job completion** (finished clips retained 90 days). Storage lifecycle rule enforces it. Keep the client-ownership warranty as the processing basis.

### 🟠 H5 — OAuth/profile reconnects are the biggest *recurring* human task, and they're client-side · **[fix during build]**
**Fails when:** a client changes their TikTok password / revokes the app → Upload-Post profile disconnects → posts silently fail for that platform.
**Fix:** digest must surface disconnected profiles per client (poll Upload-Post profile status); auto-email the client a self-service reconnect link; only escalate to operator if unresolved >7 days. Honest accounting goes in OPERATING_MODEL.md (see §4 below).

### 🟡 M1 — DMCA/music in VODs → clips muted or struck downstream. Contract warranty covers liability (client warrants rights) but not the *operational* mess. Digest should surface platform copyright flags where the poster API exposes them. **[monitor]**
### 🟡 M2 — Stripe trial compliance: card-network trial rules + FTC click-to-cancel require pre-charge reminder and one-click cancel. Enable Stripe's built-in trial-ending emails; cancellation ≤ as hard as signup. **[fix during build]**
### 🟡 M3 — yt-dlp/twitch-dlp supply chain + command injection: pinned versions; exec with array args (never shell-interpolated URLs/titles); non-root container; egress-limited. **[fix during build]**
### 🟡 M4 — Trello webhook auto-disable is tolerant (30 days AND 1,000+ consecutive failures — verified) but a weekly reconciliation sweep of the Approved list catches anything missed for any reason. Cheap insurance. **[fix during build]**
### 🟡 M5 — OVER-ENGINEERING TO CUT (v1): ❶ drop **Ssemble/Reap concrete adapters** (keep the interface; build Vizard + Mock only — the adapter already quarantines swap risk); ❷ drop **follower-delta analytics** from the client growth report (needs extra OAuth scopes + fragile scraping; v1 report = clips delivered/approved/posted only); ❸ demote **Postiz self-host** to a documented option (running a second self-hosted service contradicts low-touch); ❹ drop the Blotato MCP mention (not in the chosen stack).
### ⚪ L1 — n8n has no backup story: nightly export of workflows+credentials DB to R2. **[fix during build]**
### ⚪ L2 — Who watches the watcher: if the digest cron dies, silence looks like health. Fix: digest asserts its own heartbeat (e.g., a dead-simple external uptime ping like healthchecks.io free tier; absence alerts). **[fix during build]**

---

## 3. INVESTOR VERDICT (rebuilt P&L, verified prices)

Per-client, Growth tier **$750/mo with a 10h ingest cap** (post-C1):
| Item | $/mo |
|---|---|
| Clipper (Vizard Creator-tier credits, 10h=600 min) | ~$29 |
| Poster (Upload-Post $24÷5 profiles) | ~$5 |
| n8n VPS + R2 (amortized) | ~$8 |
| Stripe (~2.9%+$0.30) | ~$22 |
| **Per-client contribution** | **~$686 (≈91% gross, ~80–85% net after maintenance hours)** |

- **The margin story survives — but ONLY because of the ingest cap.** Uncapped, contribution drops to ~$550–600 and keeps falling with client stream hours (perverse: your best clients cost you most).
- **At 2 clients:** ~$1,350–1,400/mo net; losing one = −50%. Fine as a side asset; not income. **Break-even on infrastructure: 1 client.** CAC (20–60 free hours/client) paid back in ~1 month *if* they stay ≥6 months — churn research says 6–18 months, so expected LTV ≈ $4,500–13,500/client. Acceptable.
- **Wedge check:** vs $20–50/mo DIY tools the wedge is "fully managed + on-brand + you only click Approve." That is real but thin — C3's nudge system is therefore not a nicety, it IS the product working.

## 4. LOW-TOUCH MONTH WALK (honest residual workload, 2–5 clients)
Weekly digest review 10 min · approval-nudge escalations ~1×/mo (15 min) · profile reconnect escalation ~1×/mo (10 min) · failed-payment follow-up rare (Stripe dunning) · API-drift fix ~1×/quarter (1–3 h) · onboarding 30 min/new client. **Total ≈ 1.5–3 h/month steady-state.** The "0 min/day happy path" claim is fair; "passive" is not. OPERATING_MODEL.md must state this table.

## 5. LEGAL SUMMARY (lawyer hat)
Defensible as-is: civil-only indemnification (criminal fix already made); no-metric-guarantees; LoL cap; client-owns-content warranty as the processing basis. **Needs amendment:** H4 retention (≤72h raw); C3 approval-inaction clause; M2 trial disclosures. **Needs a real attorney before client #1 signs:** the service agreement as a whole (already flagged in the brief — keep that flag), and A3 (Upload-Post agency ToS) needs a vendor answer, not a lawyer.

## 6. SEQUENCING AMENDMENTS
Phase order stands (thin-slice-first confirmed correct). Acceptance-criteria additions: **Phase 1** += Trello signature verification + card-state re-fetch (C2). **Phase 2** += intake dedupe race test (H2) + disk-watermark + delete-after-clip (H1/H4) + ingest-budget enforcement (C1). **Phase 3** += approval nudges (C3), reconciliation sweep (M4), digest heartbeat (L2), profile-disconnect surfacing (H5). **Phase 4** unchanged + client reconnect-flow doc.

---
*All fixes are incorporated in `EchoMedia_Build_Brief_v2.md`. Sources cited inline; A3 remains the single open verification (vendor email).*
