# EchoMedia Automations

Automated, low-touch B2B creator-repurposing pipeline: Twitch/YouTube VOD →
AI 9:16 clips → **client** approves in Trello → auto-scheduled to socials.

**Planning is done. This is Phase 0 of the build** — scaffold + adapter
contracts only. No workflow logic, no real API calls, no legal docs, no
outreach engine yet. See `docs/` for the full spec before touching anything
here; the binding order of authority is:

1. `docs/EchoMedia_Build_Brief_v2.md` — amendment layer, wins where it speaks
2. `docs/EchoMedia_Sonnet_Build_Brief.md` — v1 base spec, valid where v2 is silent
3. `docs/EchoMedia_StressTest_Findings.md` — red-team findings; `[fix before build]` items are binding requirements
4. `docs/EchoMedia_Sonnet_Execution_Prompt_FINAL.md` — the build-order/rules document this repo is following

## What's here (Phase 0)

```
src/
  clippers/IClipProvider.ts    — clipper adapter contract (RC-2)
  clippers/MockClipProvider.ts — fixture impl, zero API spend
  posters/IPoster.ts           — poster adapter contract (RC-6)
  posters/MockPoster.ts        — fixture impl, zero API spend
  helper/server.ts             — download-helper service; /health only so far
  helper/Dockerfile            — hardened base (non-root); NOT yet version-pinned (see file)
  scripts/smoke-test-adapters.ts — proves the mocks satisfy the async contracts
infra/docker-compose.yml       — n8n + helper + local MinIO (dev/test only)
.env.example                   — every key the v1 build actually needs (post v2 scope cuts)
```

## What's explicitly NOT here yet (by design, not oversight)

- No `VizardClipProvider` / `UploadPostPoster` concrete implementations (Phase 1)
- No n8n workflows (Phase 1–2)
- No Twitch intake, Trello signature verification, or Stripe billing (Phase 1–3)
- No `legal/service-agreement.md` or `outreach/` engine (Phase 4)
- Per v2/M5: **no Ssemble/Reap/Postiz/Ayrshare-as-default** — those are cut from v1 scope entirely, not deferred

## Running Phase 0 locally

```bash
npm install
npm run typecheck   # verify the TypeScript compiles clean
npm run smoke        # exercise both mocks through their full async lifecycle
```

Docker was not available in the environment this repo was scaffolded in, so
`docker compose up` has **not** been verified end-to-end here — only the
TypeScript layer has. Before trusting the Phase 0 acceptance criteria as met,
run on a Docker-enabled machine:

```bash
cp .env.example .env   # fill in N8N_ENCRYPTION_KEY at minimum (any random string for local dev)
docker compose -f infra/docker-compose.yml up --build
curl http://localhost:8088/health
```

## Known open items carried into Phase 1+

- **Dockerfile version pins** (yt-dlp/twitch-dlp/streamlink) are unpinned placeholders — must be resolved to verified exact versions before Phase 2 wires real downloads (M3).
- **`docker compose up` is unverified on this machine** — confirm on Docker-enabled hardware before treating Phase 0 as fully closed.
- **Upload-Post agency-use confirmation (finding A3)** — email sent, awaiting vendor reply. Not build-blocking; Phase 1 builds against `MockPoster` regardless.