# EchoMedia BUILD BRIEF v2 — Hardened Amendments
### Fable 5 red-team amendments to `EchoMedia_Sonnet_Build_Brief.md` (v1) · 2026-07-16
> **How to read this:** this document **amends v1**. Where v2 speaks, v2 wins. Where v2 is silent, v1 stands unchanged. Findings referenced (C1, H2…) are in `EchoMedia_StressTest_Findings.md`.

---

## CHANGELOG (what changed and why)

| # | Change | Type | Driven by |
|---|---|---|---|
| 1 | **Ingest-hours caps per tier** — tiers redefined by hours ingested, not just clip count; scheduler enforces a per-client monthly ingest-minutes budget | ADDED | C1 (Vizard credits = 1/min uploaded; full-VOD ingestion 5× over plan budget) |
| 2 | **Trello webhook signature verification + card-state re-fetch before ANY post** | ADDED (Phase 1 acceptance) | C2 (forged-approval attack) |
| 3 | **Approval-nudge automation + approval-inaction contract clause** | ADDED | C3 (client-approval bottleneck = real churn engine) |
| 4 | **Intake idempotency (`processed_vod_ids`)** — webhook+poll race must not double-ingest | ADDED (Phase 2 acceptance) | H2 |
| 5 | **Raw-VOD retention cut to ≤72h post-clip; disk-watermark + queued downloads; delete local immediately** | CHANGED (was 30-day example) | H4 (Twitch ≤24h cache ToS) + H1 (VPS disk) |
| 6 | **Direct-URL ingest preferred; YouTube-Live clients skip the download leg entirely** (Vizard ingests YouTube URLs natively) | ADDED | H1 / A8 — also a strategic beachhead note |
| 7 | **v1 scope CUTS:** Ssemble/Reap concrete adapters (keep interface; Vizard+Mock only) · follower-delta analytics in the client report (v1 = delivered/approved/posted counts only) · Postiz demoted to documented option · Blotato dropped | REMOVED | M5 (over-engineering) |
| 8 | **Digest heartbeat (external uptime ping), weekly Approved-list reconciliation sweep, Upload-Post profile-disconnect surfacing, n8n nightly backup** | ADDED (Phase 3) | L2 / M4 / H5 / L1 |
| 9 | **Stripe trial compliance** — enable trial-ending reminder emails; cancellation one-click | ADDED (Phase 3) | M2 |
| 10 | **Helper hardening** — pinned yt-dlp/twitch-dlp, exec array-args (no shell interpolation), non-root container | ADDED (Phase 2) | M3 |
| 11 | **Pre-build action for the OWNER (not Sonnet):** email Upload-Post to confirm agency/client-account use on the $24 tier; log answer in repo | ADDED | A3 (unverified) |
| 12 | **Pricing floor restated as ≥$750** with the rebuilt P&L; UNIT_ECONOMICS.md must model clipper cost as f(ingest hours) | CHANGED | C1 + investor verdict |

Verified live 2026-07-16: Upload-Post audited-TikTok claim ✅, pricing ($16–24/mo, 5 profiles, TikTok 15 posts/day/account) ✅, Vizard credits (600/mo Creator) ✅, Trello HMAC-SHA1 signature + 30-day/1,000-failure disable policy ✅. Citations in the findings file.

---

## AMENDED SECTIONS (full replacement text)

### AMENDMENT TO §0.5 — Operating model (adds P-6)
- **P-6 · Approval nudges are part of the product.** When clips sit in `Staged` >48h, the CLIENT gets an automated reminder (email or Trello notification), escalating once at day 5. The weekly digest's "0 approvals in 7 days" flag is a **churn-risk alarm requiring operator outreach** — a legitimate, rare human task; document it in `OPERATING_MODEL.md`. Rationale: the design moves the critical-path task to the least reliable actor; unnudged, the service *looks* dead while running perfectly (C3).

### AMENDMENT TO §1 — Reality-checks (RC-6 extended; RC-7 added)
**RC-6 (extended):** in addition to platform caps and `publish_id` polling, the poster leg must verify the Trello card's **actual current state via the Trello REST API** before scheduling any post — never act on the webhook payload alone — and must verify the `X-Trello-Webhook` HMAC-SHA1 signature (base64 of body+callbackURL, signed with the app secret) on every callback. A request failing either check is logged and dropped. **This is Phase 1 acceptance, not polish** (C2).

**RC-7 — Clipper credits are the dominant variable cost; ingest is budgeted, never open-ended (C1).**
Vizard bills ~1 credit per minute *uploaded*. A 12h/week streamer = ~3,100 min/mo vs ~600 on the Creator plan. Therefore:
1. Every client record carries `ingestBudgetMinutes` (tier-derived). The intake workflow checks remaining budget **before** download/submit; if insufficient, the VOD is skipped with a client-visible `Budget reached` note (Trello card in an `Info` list), not silently dropped.
2. Config per client: `streamsPerWeekToIngest` and optional `trimToLastHours` to spend budget on the freshest material.
3. Tier definitions (owner-approved defaults, adjust with real data): **Growth $750/mo = 10h ingested + 15 clips**; **Omnipresent $1,100/mo = 25h ingested + 30 clips**. Contract caps BOTH (Appendix A §E amendment below).

### AMENDMENT TO §3/§4 — Intake & storage
- **Intake idempotency (H2):** an atomic check-and-set `processed_vod_ids` per client (keyed on platform video ID) guards the entry of the pipeline. Webhook and poll both route through it; the Phase 2 acceptance test simulates the race (webhook fires during an in-flight poll-triggered job → exactly one clip job).
- **Download hygiene (H1):** downloads are queued (one at a time per box); a disk-watermark check (e.g., refuse below 15 GB free) precedes any download; local files are deleted the moment the R2 upload (or direct submit) completes.
- **Retention (H4):** raw VODs deleted from R2 **within 72h of clip-job completion** (lifecycle rule). Finished clips retained 90 days. Legal Appendix A §D.2 uses these numbers.
- **Direct-URL ingest (A8):** if the client's platform is YouTube-Live, submit the YouTube VOD URL straight to Vizard — **no download, no storage, no yt-dlp**. The download leg exists only for Twitch clients. *(Owner note: YouTube-Live streamers are the lower-friction beachhead — zero download infra, no Twitch ToS gray zone.)*

### AMENDMENT TO §4.2 — Clipper scope (M5 cut)
Implement `IClipProvider` + **`VizardClipProvider` + `MockClipProvider` only**. Do NOT build Ssemble/Reap concrete adapters in v1 — the interface already quarantines swap risk; build a second adapter only when a real need arises. `CLIP_PROVIDER` env values: `vizard|mock`.

### AMENDMENT TO §4.3 — Poster scope (M5 cut)
`IPoster` + **`UploadPostPoster` + `MockPoster`** only. Postiz = documented option in `docs/` (do not deploy); Ayrshare = documented premium fallback; Blotato dropped. `POSTER_DRIVER`: `uploadpost|mock`.

### AMENDMENT TO §5 — Phase acceptance criteria (additions)
- **Phase 1 adds:** Trello callback with an invalid/absent signature is rejected; a forged "Approved" event payload (valid-looking but card actually in `Staged`) does NOT post — proven by test.
- **Phase 2 adds:** the webhook+poll race yields exactly one clip job; disk-watermark refusal path works; raw VOD deleted ≤72h post-completion (lifecycle rule shown); ingest-budget exhaustion produces the `Budget reached` card and no submit; helper runs non-root with pinned yt-dlp/twitch-dlp and array-arg exec.
- **Phase 3 adds:** a `Staged >48h` clip triggers a client nudge (test with a seeded stale card); weekly reconciliation sweep catches a manually-moved Approved card that missed its webhook; digest emits a heartbeat ping (absence detectable via healthchecks.io or equivalent); Upload-Post profile disconnect appears in the digest; Stripe trial-ending reminder email fires in test mode; n8n nightly backup lands in R2.
- **Phase 4 adds:** client reconnect-flow one-pager (what the client clicks when a platform disconnects).

### AMENDMENT TO §7 / APPENDIX A — Legal
- **§D.2 retention:** raw VODs ≤72h post-processing; finished clips 90 days; deletion on termination within 14 days of written request.
- **§E addition (approval inaction, C3):** clips staged for review count toward the monthly deliverable quota upon staging; the Agency is not in breach, and no refunds/credits accrue, where clips remain unpublished due to the Client's failure to review/approve; the approval SLA expectation (e.g., twice weekly) is set at onboarding.
- Unchanged and reaffirmed: civil-only indemnification; no-metric guarantees; LoL cap; attorney-review disclaimer.

### AMENDMENT TO §8 — Unit economics (verified numbers)
Model per-client contribution at Growth $750 / 10h cap: clipper ~$29 (Vizard Creator credits) + poster ~$5 (Upload-Post $24÷5 profiles) + infra ~$8 + Stripe ~$22 → **~$686 contribution (~91% gross)**. State plainly: (a) the margin exists **only because of the ingest cap** — uncapped, contribution decays with client stream-hours; (b) at 2 clients net ≈ $1,350–1,400/mo with 50% single-client concentration risk; (c) CAC ≈ 20–60 free hours/client, payback ~1 month, LTV $4.5–13.5k at 6–18-month churn. `UNIT_ECONOMICS.md` models clipper cost as a function of ingest hours.

### AMENDMENT TO §11 — Gap-fixes
- G7 (client growth report) **v1 scope = clips delivered/approved/posted only** — no follower-delta analytics (extra OAuth surface; M5 cut). Revisit post-v1.
- G-accelerators: remove Blotato; MCP wiring optional (`Upload-Post` MCP if stable), REST fine.

### NEW §12 — Owner pre-build checklist (not Sonnet's job)
1. Email Upload-Post: confirm agency/client-account posting on the $24 tier (A3). Log the reply in `docs/VENDOR_CONFIRMATIONS.md`.
2. Approve the tier definitions in RC-7 (or set your own numbers).
3. Confirm pricing at ≥$750 entry (C1/A10) — the build assumes it.

---
*End of v2. Everything in v1 not amended above stands. Sonnet: v2 + findings `[fix before build]` items are binding acceptance criteria.*
