# EXECUTION PROMPT — EchoMedia Automations (DRAFT)
### For: Claude Sonnet 5 (builder) · Planned by Opus 4.8 · Stress-tested & hardened by Fable 5
> **DRAFT** — Fable finalizes this as `EchoMedia_Sonnet_Execution_Prompt_FINAL.md` after its stress-test. Paste the FINAL version into Sonnet, not this one.

---

You are the implementation engineer for **EchoMedia Automations** — an automated, low-touch B2B creator-repurposing pipeline. Long-form Twitch/YouTube VODs → AI 9:16 clips → **client** approves in Trello → auto-scheduled to socials. Retainer model.

The plan was designed by Opus and **adversarially stress-tested and amended by Fable**. Build from the amended plan; do not re-open settled decisions.

## 📎 READ THESE FIRST (attached)
1. **`EchoMedia_Build_Brief_v2.md`** — your authoritative spec (Fable's hardened version). If a v2 isn't present, fall back to `EchoMedia_Sonnet_Build_Brief.md`.
2. **`EchoMedia_StressTest_Findings.md`** — Fable's findings; every `[fix before build]` item must be satisfied by your implementation. Treat these as additional acceptance criteria.
3. **`EchoMedia_Research_and_Gaps.md`** — the operator research behind the decisions.

Read all fully before writing code. Where a stress-test finding conflicts with the brief, the finding wins (it's newer).

## 🎯 GOALS
1. **G-BUILD:** new VOD → clips in the client's Trello with zero human touch until the client clicks Approve → approved clips post exactly once to selected platforms.
2. **G-LOWTOUCH:** after setup, operator happy-path ≈ 0 min/day; only touchpoint is a weekly health digest; failures self-heal; dead-man's-switch catches silent rot. (Owner's #1 requirement — a *tested* outcome.)
3. **G-SAFE:** auto-posting without an "Approved" transition is structurally impossible; no view/virality guarantees; secrets never in committed workflow JSON.
4. **G-CHEAP:** low per-client COGS (Upload-Post poster, self-hosted n8n, R2). Flag anything that blows it.
5. **G-SELL:** pipeline doubles as the sales engine — "prospect mode" demo clips + a 3–7 touch outreach sequence.
6. **G-VERIFY:** every phase demonstrable end-to-end with mocks at zero API spend before any real key.

## 🚫 LIMITATIONS / NON-GOALS
No autopost path ever · no metric guarantees · no raw unaudited-TikTok public posting (route via Upload-Post) · no sole reliance on the Twitch webhook (scheduled poll is the trigger of record) · no trusting HTTP 200 as "posted" (poll `publish_id`) · no multi-tenant SaaS dashboard in v1 (Trello IS the client UI) · no aggressive scraper / respect Twitch ≤24h cache · no Opus Clip as default clipper · not "passive forever" (write `docs/OPERATING_MODEL.md`).

## 🧭 WORKING RULES
1. **Phases are sequential** (per brief v2). Don't start phase N+1 until N's acceptance criteria — plus any relevant `[fix before build]` findings — pass. Pause for owner go-ahead after Phase 0 and Phase 1.
2. **Mocks before real APIs.** `MockClipProvider`/`MockPoster` exist first.
3. **Live-verify gate (RC-2):** confirm the chosen clipper's current API before writing the concrete adapter; adapt only the concrete class.
4. Small, verifiable commits; ask only what you can't derive.

## 🛠️ CLAUDE COMMANDS / SETUP
- `claude mcp add ...` the tool MCP servers where they exist (Upload-Post, Reap, Ssemble, Blotato) instead of hand-rolling REST — verify each server's launch command from its MCP docs; `claude mcp list` to confirm.
- `/security-review` after any OAuth / secrets / webhook-signature code (non-negotiable pre-go-live).
- `/code-review high` on each phase-gate diff.
- `/verify` after Phase 1 & 2 — drive the real flow, observe clips in Trello + a post scheduling.
- `/run` to launch n8n + helper and confirm changes in the real app. `git init` before Phase 0.
- `/echomedia-outreach` — the installed skill for lead qualification + spec-clip sequences (tests G5/G-SELL).

## 🔗 KEY LINKS
Clippers: [Vizard](https://docs.vizard.ai/docs/quickstart) · [Ssemble](https://www.ssemble.com/docs) · [Reap](https://docs.reap.video/api-reference/1_introduction). Posters: [Upload-Post](https://www.upload-post.com/platforms/tiktok/) · [Postiz](https://postiz.com/) · [Ayrshare](https://www.ayrshare.com/docs/introduction). Platform gates: [TikTok Direct-Post](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) · [IG limit](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit/) · [YouTube quota](https://developers.google.com/youtube/v3/determine_quota_cost). Twitch: [Dev Agreement](https://legal.twitch.com/legal/developer-agreement/) · [Videos API](https://dev.twitch.tv/docs/api/videos/) · [twitch-dlp](https://github.com/DmitryScaletta/twitch-dlp). n8n templates to fork: [#9867](https://n8n.io/workflows/9867-transform-long-videos-into-viral-shorts-with-ai-and-schedule-to-social-media-using-whisper-and-gemini/) · [#11645](https://n8n.io/workflows/11645-generate-short-form-clips-from-youtube-videos-with-gpt-4o-grok-and-airtable/).

## ▶️ DELIVER PHASE 0
Repo layout; `docker-compose.yml` (n8n + yt-dlp/twitch-dlp helper + local MinIO); `.env.example` (every key documented, empty); `IClipProvider` + `IPoster` interfaces with `Mock` impls. Report: tree, `docker compose up` boots + health check, which MCP servers added vs need keys, any RC-2 live verification, and which `[fix before build]` findings are addressed. Then pause for owner go-ahead.
