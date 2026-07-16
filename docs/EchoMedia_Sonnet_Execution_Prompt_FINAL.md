# EXECUTION PROMPT — EchoMedia Automations (FINAL)
### For: Claude Sonnet 5 (builder) · Planned by Opus 4.8 · Stress-tested & amended by Fable 5 · 2026-07-16
*(Paste this into a fresh Sonnet session and attach the three files below. This supersedes the draft execution prompt.)*

---

You are the implementation engineer for **EchoMedia Automations** — an automated, low-touch B2B creator-repurposing pipeline. Long-form Twitch/YouTube VODs → AI 9:16 clips → **client** approves in Trello → auto-scheduled to socials. Retainer model.

The plan was designed by Opus and **adversarially red-teamed by Fable**, which verified the load-bearing vendor claims live and amended the plan. Build from the amended plan. **Do not re-open settled decisions.**

## 📎 READ IN THIS ORDER (attached)
1. **`EchoMedia_Build_Brief_v2.md`** — the amendment layer. **Where v2 speaks, v2 wins.**
2. **`EchoMedia_Sonnet_Build_Brief.md`** — the v1 base spec (contracts, phases, appendices). Valid wherever v2 is silent.
3. **`EchoMedia_StressTest_Findings.md`** — the red-team findings. Every **[fix before build]** item (C1, C2, H2, H4 + the amended acceptance criteria) is a binding requirement, not advice.

## 🎯 GOALS
1. **G-BUILD:** new VOD → clips in the client's Trello with zero human touch until the client approves → each approved clip posts exactly once to its platforms.
2. **G-LOWTOUCH:** operator happy-path ≈ 0 min/day; weekly digest is the only scheduled touchpoint; failures self-heal; approval nudges (P-6) keep the *client* moving without the operator.
3. **G-SAFE:** posting without a **verified** client approval is structurally impossible — that now means webhook **signature verification + card-state re-fetch** (C2), not just list-transition events. No view/virality guarantees anywhere. Secrets never in committed JSON.
4. **G-CHEAP:** per-client COGS holds ONLY via **ingest budgets** (RC-7). The scheduler enforcing `ingestBudgetMinutes` is an economics feature, not a nice-to-have.
5. **G-SELL:** prospect mode (demo clips from a public VOD, no onboarding) + 3–7 touch outreach sequences.
6. **G-VERIFY:** every phase demonstrable end-to-end with mocks at zero API spend before any real key.

## 🚫 LIMITATIONS / NON-GOALS
- **No autopost path, ever.** No posting on an unverified Trello event (C2).
- **No open-ended ingestion** — every submit checks the client's remaining ingest budget first (C1/RC-7).
- **No raw TikTok integration** — TikTok goes via Upload-Post (verified: they front an approved TikTok client). No sole reliance on the Twitch webhook — the scheduled poll is the trigger of record, and both routes pass the `processed_vod_ids` idempotency gate (H2).
- **No trusting HTTP 200 as "posted"** — poll `publish_id`.
- **No raw-VOD hoarding** — delete local immediately after upload/submit; R2 lifecycle deletes raw ≤72h post-clip (H4).
- **v1 scope cuts (do NOT build):** Ssemble/Reap concrete adapters (interface + Vizard + Mock only) · follower-delta analytics in the client report · Postiz deployment (document only) · Blotato · multi-tenant dashboard (Trello IS the client UI).
- **Not "passive forever"** — `docs/OPERATING_MODEL.md` must include the honest residual-workload table (findings §4, ≈1.5–3 h/month).

## 🧭 WORKING RULES
1. **Phases are sequential** per v1 §5 + v2's added acceptance criteria. Don't start phase N+1 until N passes. **Pause for owner go-ahead after Phase 0 and Phase 1.**
2. **Mocks first.** `MockClipProvider`/`MockPoster` before any concrete adapter.
3. **Live-verify gate (RC-2):** before writing `VizardClipProvider`, confirm Vizard's current API (auth, submit payload incl. remote/YouTube URL sources, poll/webhook, response shape) against [docs.vizard.ai](https://docs.vizard.ai/docs/quickstart). Adapt only the concrete class. Respect Creator-tier rate limits (3/min, 20/hr) in the polling logic.
4. Small, verifiable commits; `git init` before Phase 0. Ask only what you can't derive.

## 🛠️ CLAUDE COMMANDS
- `/security-review` — mandatory after: Trello signature verification, Twitch HMAC, Stripe webhook sig, token/secret handling, the yt-dlp helper (checks array-arg exec, non-root, pinned versions — M3).
- `/code-review high` on each phase-gate diff · `/verify` after Phases 1–2 (drive the real flow: forged-approval rejection test included) · `/run` to launch n8n + helper.
- `claude mcp add` the Upload-Post MCP **only if** its server proves stable in 10 minutes of testing; otherwise plain REST (v2 made MCP optional).
- `/echomedia-outreach` — installed skill for lead qualification + spec-clip sequences (G-SELL testing).

## 🔗 KEY LINKS (verified 2026-07-16)
[Vizard API](https://docs.vizard.ai/docs/quickstart) · [Vizard pricing/credits](https://vizard.ai/pricing) · [Upload-Post TikTok](https://www.upload-post.com/platforms/tiktok/) · [Upload-Post limits](https://docs.upload-post.com/guides/limit-of-uploads/) · [Trello webhooks + signature](https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/) · [TikTok Direct-Post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) · [IG 25/24h](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/) · [YouTube quota](https://developers.google.com/youtube/v3/determine_quota_cost) · [Twitch Dev Agreement](https://legal.twitch.com/legal/developer-agreement/) · [Helix Videos](https://dev.twitch.tv/docs/api/videos/) · [twitch-dlp](https://github.com/DmitryScaletta/twitch-dlp) · n8n templates to fork: [#9867](https://n8n.io/workflows/9867-transform-long-videos-into-viral-shorts-with-ai-and-schedule-to-social-media-using-whisper-and-gemini/) · [#11645](https://n8n.io/workflows/11645-generate-short-form-clips-from-youtube-videos-with-gpt-4o-grok-and-airtable/)

## ⚠️ PRE-BUILD GATES (status as of 2026-07-16)
1. Upload-Post agency-use confirmation (findings A3): **email sent to info@upload-post.com — awaiting reply.** Not build-blocking (mocks first; Upload-Post keys only needed at Phase 1's real-poster swap). If the answer is negative, the `IPoster` adapter swaps to Ayrshare — flag the COGS change to the owner.
2. Tier numbers: **✅ APPROVED by owner** — Growth $750/mo = 10h ingested + 15 clips · Omnipresent $1,100/mo = 25h ingested + 30 clips. Hard-code these as the tier defaults.
3. Client record schema gains: `ingestBudgetMinutes`, `streamsPerWeekToIngest`, `processedVodIds` — extend v1 §4.5 accordingly.

## ▶️ DELIVER PHASE 0 NOW
Per v1 §5 Phase 0 with v2 scope cuts: repo layout; `docker-compose.yml` (n8n + hardened yt-dlp/twitch-dlp helper + local MinIO); `.env.example` (keys per v1 §4.1 **minus** Ssemble/Reap/Postiz/Ayrshare-as-default, i.e. `CLIP_PROVIDER=vizard|mock`, `POSTER_DRIVER=uploadpost|mock`); `IClipProvider` + `IPoster` interfaces with Mock impls. Report: tree · `docker compose up` boots + helper health · RC-2 live verification result · which pre-build gates remain open. **Then pause for owner go-ahead.**
