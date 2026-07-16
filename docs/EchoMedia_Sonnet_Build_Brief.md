# BUILD BRIEF — EchoMedia Automations Pipeline
### For: Claude Sonnet (implementation model) · Authored by: Opus 4.8 (planning) · Date: 2026-07-15

---

## 0. HOW TO USE THIS DOCUMENT

You are the implementation engineer. Opus has already made every architecture decision and resolved every "A or B" fork in the source business plan. **Do not re-open those decisions.** Your job is to produce production-ready, copy-pasteable code, configs, and documents against the locked spec below.

**Locked decisions (do not change):**
| Decision | Choice | Why (already settled) |
| :-- | :-- | :-- |
| Automation backbone | **n8n, self-hosted (Docker)** | Exportable JSON workflows + JS code-nodes for the hard logic; keeps compute COGS ~$5/client |
| Clipping engine | **Provider-agnostic adapter** | API availability of any single vendor is uncertain; quarantine it behind one interface |
| Reference clipper impl | **Vizard** primary; **Ssemble**/**Reap** secondary | Verified self-serve APIs (URL→clips, webhooks); Ssemble & Reap also ship **MCP servers**. **Opus Clip is gated/closed-beta — do NOT default to it** (research G2) |
| Client Review Gateway | **Trello** | Native webhook fires the instant a card hits "Approved" → event-driven post trigger |
| Storage | **Cloudflare R2** (S3-compatible, zero egress) or S3 | Egress-free is materially cheaper for video; keep S3 API so it's swappable. Respect Twitch's ≤24h-cache ToS unless client grants rights (G12) |
| Scheduler/poster | **Upload-Post** primary; **Postiz** (self-host) alt; **Ayrshare** premium fallback | Upload-Post ~$16/mo **fronts an audited TikTok client** (sidesteps G1) + FFmpeg transcode + MCP. Ayrshare is $149/mo — too costly as default (research G3) |
| Billing | **Stripe** subscription w/ 7-day trial, card upfront | As speced |
| Language for custom code-nodes & the standalone helper | **Node.js (TypeScript)** | One runtime across n8n code-nodes and the VOD helper service |

**Work in phases (Section 5). Do not build Phase 2 before Phase 1's acceptance criteria pass.**

---

## 0.5 OPERATING MODEL — LOW-TOUCH BY DESIGN (overrides the source plan)

The owner's requirement: after setup + a few signed clients, they want **near-zero recurring interaction**. The source plan assumed the *operator* reviews clips daily — that is wrong for this goal. Rebuild around these principles; they take precedence wherever they conflict with the source plan.

- **P-1 · The CLIENT is the sole approver.** The operator NEVER reviews or approves clips on the happy path. Clips are staged straight into the client's Trello board; the client gets the notification and clicks Approve. This also *strengthens* the legal model (Appendix A/B) — the person accepting publication liability is the one physically clicking. Operator daily touch on the happy path = **0 minutes**.
- **P-2 · Failures self-heal, they do not page a human.** No workflow may "alert the operator" as its primary failure path. Order of handling: (1) automatic retry with backoff; (2) if still failing, move the item to a client-visible `Regenerating` state and try an alternate (e.g., fallback clipper via the adapter); (3) only if *terminally* stuck, write it to a dead-letter store — surfaced later in a batched digest, never a real-time interrupt.
- **P-3 · A weekly health digest is the ONLY scheduled human touchpoint.** One automated email to the operator every 7 days: per-client clips delivered/approved/posted, any dead-lettered items, any client with 0 approvals in 7 days (churn signal), any expiring API tokens. If this digest is green, the operator does nothing that week. This is the deliberate replacement for "10 min/day."
- **P-4 · Onboarding is a wizard, not a project.** Adding a client must be a single documented, mostly-automated flow (Section 5, Phase 4) targeting <30 min of operator time — because onboarding is the one task that scales with clients and can't be zero.
- **P-5 · Dead-man's-switch on the whole pipeline.** If no clip has flowed for any active client in `[N]` days (default 10), the health monitor flags it — this is how you catch silent rot (Twitch/clipper/poster API drift) before the client does. Silent death is the #1 failure mode of an unattended pipeline; make it loud on a delay.

**Honest scope note for Sonnet to put in `docs/OPERATING_MODEL.md`:** this design makes the *happy path* zero-touch, but it is "low-touch," not "autonomous forever." External API drift (Twitch EventSub, clipper, Ayrshare/OAuth token expiry) will require operator intervention a few times per quarter. Do not describe the system as fully passive.

---

## 1. SIX REALITY-CHECKS YOU MUST HANDLE (these break naive builds)

The source plan hand-waves things that will fail in production. RC-1→3 are pipeline mechanics; RC-4→6 are platform/legal gates surfaced by operator research (see `EchoMedia_Research_and_Gaps.md`). Design for all six from line one.

### RC-1 — Twitch has no "download the VOD" endpoint
`stream.offline` (EventSub) fires **before** the VOD is transcoded and available. There is **no** official third-party VOD-download API.
**Required handling:**
1. On `stream.offline`, do **not** attempt an immediate download.
2. Enqueue a **deferred job**: poll `GET https://api.twitch.tv/helix/videos?user_id={id}&type=archive&first=1` on a backoff (e.g., 5 min → 10 → 20, cap ~2h).
3. When a VOD with `published_at` after the stream-end timestamp appears and `duration` is stable across two polls, fetch its URL.
4. Download via a **yt-dlp**-based helper (containerised, invoked by the n8n workflow). Treat this as the fragile step — full retry + dead-letter (see RC fallbacks in the stress-test deliverable).
5. Store raw MP4 to R2/S3; pass the object URL forward.
> Note in the code + README: downloading VODs must respect Twitch ToS; the model only processes VODs the **client owns** and has licensed to the agency (see legal Clause 1). Do not build a scraper that pulls arbitrary third-party VODs at scale.

### RC-2 — The clipper API is the one dependency you cannot trust
Build `IClipProvider` (Section 4.2) and implement Vizard first. **Before writing the concrete adapter, verify the live API**: base URL, auth header, the submit-job payload, the status/poll endpoint, and the completed-clip response shape. If Vizard's current API differs from your assumptions, adapt the concrete class **only** — never the interface or the pipeline. Include a `MockClipProvider` that returns fixture clips so the whole pipeline is testable with zero API spend.

### RC-3 — "Approve" must be an event, not a vibe
Trello's `updateCard` webhook fires when a card moves list. The post-scheduler must trigger **only** on `list.name === "Approved"`. Guard against: manual drags back-and-forth (idempotency key per card), and double-posting (write a `postedAt` marker to the card before calling the poster; skip if present).

### RC-4 — TikTok auto-post is GATED until you pass TikTok's audit (research G1) 🔴
An *unaudited* TikTok Content Posting API client can only publish `SELF_ONLY` (private), to *private* accounts, ≤5 users/24h — i.e. "auto-publish public clips" is **structurally impossible** on a raw integration day 1. **Required handling:** default the poster adapter to **Upload-Post**, which fronts an already-audited TikTok client, so public posting works without you running the audit. If a client insists on a direct TikTok integration, gate it behind a documented "TikTok audit required" flag and do not promise public posting until it clears. Ref: TikTok Direct-Post docs.

### RC-5 — EventSub is unreliable; the webhook is an optimization, not the trigger of record (research G4) 🔴
Community reports put `stream.offline` delivery lag as high as ~20h, and it can silently not fire. **Required handling:** run an **independent scheduled poll** of Helix `Get Videos` per active client (e.g. every 30–60 min) as the source of truth for "new VOD exists." The webhook, when it arrives, just *accelerates* the same VOD-ready job. Never let the pipeline depend solely on the webhook firing.

### RC-6 — Posting is rate-limited and async; never trust the HTTP 200 (research G5) 🔴
Platform caps the scheduler MUST encode: **Instagram = 25 API posts / 24h** (Reels + Stories count toward it); **YouTube `videos.insert` = 1600 quota units → ~6 uploads/day per project**; TikTok active-creator caps per audit. Publishing is **asynchronous** — providers/platforms return a `publish_id` with a 200 while the video can still fail during processing. **Required handling:** respect the caps in scheduling logic, space posts 2–5s, exponential backoff+jitter on 429, and **poll the status endpoint by `publish_id`** to confirm the post actually went live before marking the Trello card `Posted`. Also: normalize/transcode each clip to the target platform's spec and **HTTP-200-validate the media URL immediately before publish** (G13).

---

## 2. GUARDRAILS (hard constraints — violating these breaks the business model, not just the code)

- **NEVER auto-post.** No path from clipper → social platform may exist without passing through a human "Approved" transition. This is the legal spine of the company; the code must make auto-posting *structurally impossible*, not merely discouraged.
- **NEVER guarantee views/virality** anywhere in copy, contracts, or dashboards. Sell Time Saved, Omnipresence, Brand Consistency.
- **NEVER hard-code a client's social credentials** in a workflow. Use Ayrshare profile keys / per-client env, referenced by client ID.
- **No cold-spam machinery.** The outreach engine (Section 5, Phase 4) produces *personalized* value-first drafts + free demo clips. Do not build a bulk untargeted sender.
- **Secrets** live in n8n credentials / `.env` / a secrets manager — never in workflow JSON committed to git. Provide `.env.example` with every key documented and empty.

---

## 3. TARGET ARCHITECTURE (corrected)

```
                         ┌─────────────────────────────────────────────┐
                         │  n8n (self-hosted, Docker)                   │
Twitch EventSub          │                                             │
stream.offline  ───────► │  WF-1 Intake: verify sig → enqueue deferred │
  (webhook)              │        VOD-poll job                          │
                         │            │                                 │
   yt-dlp helper ◄───────┼── WF-2 VOD-ready: poll Videos API → download │
   (container)           │        → upload R2/S3 → emit vod_url         │
                         │            │                                 │
  Clipper API  ◄─────────┼── WF-3 Clip: IClipProvider.submit(vod_url)   │
  (adapter)              │        → poll status → collect clips         │
                         │            │                                 │
  Trello API   ◄─────────┼── WF-4 Stage: create card per clip in        │
                         │        "Staged / Pending Review"             │
                         └────────────┼────────────────────────────────┘
                                      │  Trello webhook: card → "Approved"
                         ┌────────────▼────────────────────────────────┐
  Ayrshare API ◄─────────┤  WF-5 Publish: idempotency guard →           │
  (adapter)              │        schedule native post → write report   │
                         └─────────────────────────────────────────────┘

  Stripe ──► WF-6 Billing: trial→active, payment_failed → pause client pipelines
```

Every external dependency that is *uncertain or swappable* (clipper, poster, storage) sits behind a thin adapter. Twitch, Trello, and Stripe are stable enough to call directly (but still wrap their auth in n8n credentials).

---

## 4. CONTRACTS & DATA MODELS (define these first — everything else references them)

### 4.1 Environment variables (`.env.example`)
Produce a fully-documented `.env.example` including at minimum:
`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_EVENTSUB_SECRET`, `CLIP_PROVIDER` (=`vizard|ssemble|reap|mock`), `VIZARD_API_KEY`, `SSEMBLE_API_KEY`, `REAP_API_KEY`, `STORAGE_DRIVER` (=`r2|s3`), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `TRELLO_KEY`, `TRELLO_TOKEN`, `POSTER_DRIVER` (=`uploadpost|postiz|ayrshare|mock`), `UPLOADPOST_API_KEY`, `POSTIZ_API_URL`, `POSTIZ_API_KEY`, `AYRSHARE_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `N8N_ENCRYPTION_KEY`.

### 4.2 Clipper adapter interface (`src/clippers/IClipProvider.ts`)
```typescript
export interface ClipJobRequest {
  sourceVideoUrl: string;
  clientId: string;
  language: 'auto' | string;       // auto-detect per source plan
  maxDurationSec: number;          // default 60
  aspectRatio: '9:16';
  subtitles: { enabled: true; style: 'dynamic' };
  faceTracking: true;
  targetClipCount: number;         // tier-driven: Growth 15/mo, Omnipresent 30/mo
}

export interface RenderedClip {
  externalId: string;
  clientId: string;
  videoUrl: string;                // downloadable/hosted MP4
  thumbnailUrl?: string;
  transcriptDraft: string;
  suggestedCaption: string;
  suggestedHashtags: string[];
  scoreOrRank?: number;            // virality/engagement score if provider gives one
  startSec?: number; endSec?: number;
}

export interface IClipProvider {
  submitJob(req: ClipJobRequest): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<'queued'|'processing'|'done'|'failed'>;
  getClips(jobId: string): Promise<RenderedClip[]>;
}
```
Implement: `VizardClipProvider`, `OpusClipProvider`, `MockClipProvider`. Selected via `CLIP_PROVIDER`.

### 4.3 Poster adapter interface (`src/posters/IPoster.ts`)
`schedulePost({ clientId, platforms: ('tiktok'|'youtube'|'instagram')[], videoUrl, caption, hashtags, scheduleAt }): Promise<{ postId, status }>`. Implement `AyrsharePoster` + `MockPoster`.

### 4.4 Trello board schema (per client, or one board with client label)
- **Lists (columns):** `Incoming` → `Staged / Pending Review` → `Approved` → `Scheduled` → `Posted` → `Rejected`.
- **Card = one clip.** Card name: `[{clientId}] {suggestedCaption[:60]}`. Card description (markdown): embedded video link, transcript draft, suggested caption, hashtags, provider score, source-VOD timestamp range.
- **Custom fields / attachments:** clip MP4 as attachment; `externalId`, `scheduledAt`, `postedAt` as custom fields (these back the idempotency guard in RC-3).
- The webhook watches the board; WF-5 acts only on transitions **into `Approved`**.
- **The board is the CLIENT's, and the client is the approver (P-1).** Onboarding grants the client access; notifications on new `Staged` cards go to the client, not the operator. Add a `Regenerating` list for P-2 self-heal and a `Needs Client Fix` list for items the client rejected.

### 4.5 Client record (single source of truth — a JSON/DB row)
`{ clientId, name, tier: 'growth'|'omnipresent', status: 'trial'|'active'|'paused', twitchUserId, trelloBoardId, ayrshareProfileKey, platforms, stripeCustomerId, stripeSubId, trialEndsAt }`. Every workflow keys off this. A paused client's pipelines must short-circuit (RC billing).

---

## 5. BUILD PHASES (each phase ends with runnable, verified output)

### PHASE 0 — Scaffold & harness (½ day)
- Repo layout: `/infra` (docker-compose for n8n + yt-dlp helper), `/src` (adapters, helper service), `/workflows` (exported n8n JSON), `/legal`, `/outreach`, `/docs`, `.env.example`, `README.md`.
- `docker-compose.yml`: n8n + a small Node yt-dlp helper service + (optional) local MinIO for S3 testing.
- Wire `MockClipProvider` + `MockPoster` so Phases can be tested with **zero API spend**.
- **Acceptance:** `docker compose up` boots n8n; health endpoint of the helper responds.

### PHASE 1 — MVP thin slice, MANUAL trigger (the core loop) ⭐ do this before anything else
Prove `VOD URL → clips → Trello → approve → schedule` end-to-end with mocks, then one real provider.
- WF-3 (Clip) with `IClipProvider` → WF-4 (Stage to Trello) → Trello webhook → WF-5 (Publish via `MockPoster`).
- Trigger WF-3 manually with a hard-coded `vod_url` (skip Twitch + download for now).
- Implement RC-3 idempotency + no-double-post guard.
- **Acceptance:** Manually fire with a sample MP4 URL → 3 mock clips appear as Trello cards in "Staged" → drag one to "Approved" → WF-5 logs a scheduled post exactly once → card moves to "Scheduled". Swap `MockClipProvider`→`VizardClipProvider` (after RC-2 API verification) and re-run for one real clip.

### PHASE 2 — Automated intake (Twitch → VOD → clips)
- WF-1: EventSub `stream.offline` receiver with **HMAC signature verification** (Twitch-Eventsub-Message-Signature); respond to `webhook_callback_verification` challenge; dedupe on `Twitch-Eventsub-Message-Id`.
- WF-2: deferred VOD-ready poller (RC-1) + yt-dlp helper download + R2/S3 upload; hand off to WF-3.
- **Acceptance:** Simulate a `stream.offline` payload → poller waits → (mock a Videos-API response) → helper downloads a test file → clips flow into Trello automatically. Document how to register the EventSub subscription.

### PHASE 3 — Billing, lifecycle, and SELF-HEALING (this is what makes it low-touch)
- WF-6: Stripe webhooks. 7-day trial, card upfront, first charge Day 8; on `invoice.payment_failed` set client `status:paused` (WF-1/-3 short-circuit within 24h per Clause 4); on cancel during trial, never charge.
- **Self-healing failure handling per P-2** (not operator paging): auto-retry w/ backoff → `Regenerating` + adapter fallback provider → terminal dead-letter store. No real-time human interrupt anywhere.
- **WF-7 Health Monitor (per P-3 + P-5):** scheduled weekly. Emits ONE digest email to the operator: per-client delivered/approved/posted counts, dead-lettered items, clients with 0 approvals in 7 days, API tokens expiring soon, and the **dead-man's-switch** (any active client with no clip flow in `[N=10]` days). Green digest ⇒ operator does nothing.
- Structured logging; client-facing weekly report is a nice-to-have, the operator digest is mandatory.
- **Acceptance:** Trial→active works on Stripe test mode; forced `payment_failed` pauses the pipeline; a forced clipper failure retries → falls back → dead-letters **without any human interrupt**; the weekly digest renders with a seeded dead-letter item and a seeded stale-client warning.

### PHASE 4 — Growth engine & docs (the non-pipeline deliverables)
- Lead-scrape **criteria spec** (SullyGnome/TwitchTracker metrics: 30k–150k followers, 200–1500 CCV, ≥3 streams/wk, qualifying niches; **exclude** silent pure-gameplay per plan). Provide the scoring rubric + the fields to extract; do **not** build an aggressive scraper — output a documented, rate-limited approach and the manual/tooling steps.
- Value-first outreach: templated email with dynamic variables (`{streamerName}`, `{specificMoment}`, `{clipLink}`, `{niche}`) + a short generator that fills them from a lead record. One personalized draft per lead, human-reviewed before send.
- **Onboarding automation (P-4), not just an SOP:** a `scripts/onboard-client.ts` (or n8n "New Client" workflow) that, from one filled `client.json`, provisions the Trello board + lists, registers the Twitch EventSub subscription, creates the Ayrshare profile reference, writes the client record, and sets up Stripe. Target: operator fills one form, runs one command, <30 min end-to-end. This is the only task that scales with client count — make it near-zero-touch.
- SOPs (`/docs`): onboarding runbook, `OPERATING_MODEL.md` (the low-touch honesty note from Section 0.5), incident runbook for the few-times-a-quarter API-drift fixes.

---

## 6. THE FIVE ORIGINAL DELIVERABLES → where each lives

| Source "Step" | Delivered as | Phase |
| :-- | :-- | :-- |
| Step 1 — Stress-test & vulnerability audit | `docs/RESILIENCE.md`: the 3 RCs above + **concrete recovery protocol per vulnerability** (webhook timeout, API/rate limits, transcription/render failure) | 3 |
| Step 2 — API pipeline blueprint (JSON) | Real n8n workflow JSON in `/workflows` + the adapter payloads (4.2/4.3) — **not** illustrative pseudo-JSON | 1–2 |
| Step 3 — Full pipeline script | The Node/TS helper service + n8n code-nodes (Twitch poll, download, clipper poll, Trello sync) | 1–2 |
| Step 4 — Legal & governance | `/legal/service-agreement.md` — **with the corrections in Section 7** | any |
| Step 5 — Outreach engine | `/outreach` template + variable-fill generator + scrape criteria spec | 4 |

---

## 7. LEGAL — MANDATORY CORRECTIONS (do not copy the source plan verbatim)

Draft a professional B2B **Service Agreement** (`/legal/service-agreement.md`) with Sections A/B/C as speced, **but fix these** — the source plan is legally naive in ways that could hurt the client:

1. **Delete "criminal liability" transfer.** You cannot contractually assign criminal liability. Replace with: *"Client acts as the publisher and holds sole editorial authority; by approving a clip, Client authorizes publication and agrees to indemnify and hold the Agency harmless against **civil** claims (defamation, IP infringement, FTC/advertising-disclosure, regulatory) arising from approved-and-published content."*
2. **Keep** the IP/licensing clause (client owns VODs, grants edit license, final clip ownership transfers on payment clearing) and the **review-gateway indemnification** (civil, per #1) and the **limitation of liability** (no metric guarantees; not liable for platform bans/shadowbans/DMCA/algorithm changes).
3. **Add** a data-processing / storage clause (where raw VODs are stored, retention, deletion on termination) and a **client-warranty** that the client owns/licenses all source content.
4. **Add a bold disclaimer** at the top: *"This is a template, not legal advice. Have a qualified attorney in your jurisdiction review before use."* — and tell the user the same in your handoff summary.

---

## 8. FINANCIAL REALITY NOTE (put in `docs/UNIT_ECONOMICS.md`, don't silently repeat the plan's 90%)

The plan's "90% margin" is **gross of the things that actually cost money.** Model the *real* per-client contribution: base COGS (~$60) **+ Stripe fees (~2.9%+$0.30) + the cost of free demo clips processed for non-converting leads (CAC) + trial breakage.** Under this build's low-touch model operator labor on the happy path is ~$0 (client self-approves), but you MUST still model **churn fragility** (at 2 clients, losing one = −50% revenue) and **periodic maintenance** (a few operator hours/quarter for API drift). State the honest net margin range, the break-even client count, and a one-line risk note that revenue at low client counts is fragile. Do not print "90%" as net.

---

## 9. WHAT NOT TO BUILD (scope discipline)

- No custom video-editing engine — the clipper adapter is the editing layer.
- No bespoke social-posting integrations per platform — that's the poster adapter's job (Ayrshare handles TikTok/IG/YT auth review).
- No multi-tenant SaaS dashboard in v1 — Trello **is** the client UI. Revisit only after 10 paying clients.
- No autoposting path, ever (Section 2).
- No aggressive/unthrottled scraper.

---

## 10. DEFINITION OF DONE (v1)
1. `docker compose up` → a new client can be onboarded via a documented checklist (Trello board + Ayrshare profile + client record).
2. A real Twitch `stream.offline` results in real clips landing in Trello with **no** human touching the pipeline until the **client** approves.
3. Dragging a card to "Approved" schedules exactly one native post per selected platform.
4. Stripe trial→charge→payment-failure lifecycle all handled.
5. **Low-touch proven:** a forced failure self-heals with no human interrupt (P-2); the weekly health digest fires and is the only scheduled operator touchpoint (P-3/P-5); `onboard-client.ts` provisions a new client in <30 min (P-4).
6. `/legal`, `/docs` (RESILIENCE, UNIT_ECONOMICS, OPERATING_MODEL, onboarding + incident runbooks), and `/outreach` complete.
7. Every adapter has a Mock impl and the pipeline is demonstrable with zero API spend.

---

## APPENDIX A — LEGAL: full clause skeleton (fill the prose, keep the structure)

Produce `/legal/service-agreement.md`. Open with the bold disclaimer (Section 7 #4). Use exactly these clauses; write professional plain-English prose under each. Bracketed `[...]` are variables the user fills at signing.

**Preamble** — Parties (`[Agency Legal Name]` "Agency", `[Client Name]` "Client"), effective date, definition of "Content", "Clip", "Approved", "Portal", "Platform".

**A. Intellectual Property & Licensing**
- A.1 Client warrants it owns or holds all rights/licenses to the source streams, gameplay, music, and likenesses in the Content.
- A.2 Client grants Agency a non-exclusive, worldwide, royalty-free, revocable license to ingest, store, transcode, edit, and segment the Content **solely** to produce Clips.
- A.3 Ownership of a finished Clip transfers to Client upon clearing of the monthly invoice covering the period in which it was produced. Before clearing, Agency retains the Clip and the license.
- A.4 Agency may display finished Clips in its own portfolio/marketing unless Client opts out in writing.

**B. The Review Gateway, Editorial Authority & Indemnification** *(this is the legal core — get it exactly right)*
- B.1 Agency is **contractually prohibited** from publishing any Clip that has not received explicit electronic approval (card moved to "Approved") in the Portal. Client holds sole and final editorial authority.
- B.2 By approving a Clip, Client authorizes its publication and confirms it has reviewed the caption, transcript, and imagery.
- B.3 **Civil indemnification only:** Client shall indemnify, defend, and hold harmless Agency against third-party **civil** claims (defamation, IP/copyright infringement, right-of-publicity, FTC/advertising-disclosure, or regulatory) arising from Content that Client approved and that was subsequently published. *(No criminal-liability language — see Section 7 #1.)*
- B.4 Agency indemnifies Client only for Agency's own gross negligence or willful misconduct (e.g., publishing a non-approved Clip).

**C. Limitation of Liability & No-Guarantee**
- C.1 No guarantee of views, followers, reach, monetization, or algorithmic outcomes.
- C.2 Agency not liable for Platform account actions (suspensions, shadowbans, demonetization, DMCA/copyright strikes) or Platform API/algorithm changes.
- C.3 Aggregate liability capped at fees paid by Client in the preceding `[1–3]` months. No liability for indirect/consequential damages.

**D. Data, Storage & Retention** *(added — source plan omits this)*
- D.1 Where raw VODs and Clips are stored (`[R2/S3 region]`), encryption at rest/in transit.
- D.2 Retention window (`[e.g., raw VODs 30 days, Clips 90 days]`); deletion on termination on written request within `[N]` days.

**E. Payment & Termination**
- E.1 7-day trial, card captured at signup, first charge on Day 8 unless cancelled in-Portal during trial.
- E.2 Billed monthly in advance; `[tier + price]`.
- E.3 On failed payment, all ingestion/processing/posting suspends within 24h until brought current.
- E.4 Either party may terminate with `[N]` days' notice; effect on in-flight Clips and stored data (ties to D.2).

**F. Boilerplate** — governing law `[jurisdiction]`, entire-agreement, severability, e-signature validity (DocuSign/PandaDoc), assignment.

> Deliver as clean markdown ready to paste into PandaDoc/DocuSign. Repeat the "not legal advice — have an attorney review" line at both the top and the signature block.

---

## APPENDIX B — OUTREACH: field-to-sentence mapping (make "personalization" concrete)

Produce `/outreach/`. The whole point of value-first outreach is that each dynamic variable is **provably** sourced from a scraped field, not fabricated. Build the generator so a missing field degrades gracefully (skip the sentence) rather than emitting a placeholder.

**B.1 Lead record schema** (`lead.json`) — the scrape output every draft is built from:
```json
{
  "streamerName": "string",
  "primaryPlatform": "twitch|youtube",
  "channelUrl": "string",
  "followers": 0,
  "avgCCV": 0,
  "streamsPerWeek": 0,
  "primaryNiche": "just_chatting|variety_gaming|educational|vtuber|podcast|reaction",
  "recentVodUrl": "string",
  "recentVodTitle": "string",
  "specificMoment": { "text": "string", "timestampSec": 0 },
  "shortsActivity": "inactive|inconsistent|unstyled|active",
  "contactEmail": "string|null"
}
```

**B.2 Field → sentence mapping** (this is the spec Sonnet codes the generator against):
| Email element | Source field(s) | Rule |
| :-- | :-- | :-- |
| Greeting | `streamerName` | Required. No lead without it. |
| Proof-of-watching line | `specificMoment.text` + `recentVodTitle` | Required for send. If absent → **do not send**, flag for manual review. This line is what makes it not-spam. |
| Gap observation | `shortsActivity`, `primaryPlatform` | Only claim "inactive/inconsistent shorts" if `shortsActivity ∈ {inactive, inconsistent, unstyled}`. Never assert a gap you didn't verify. |
| Demo clips link | generated 3 free clips (Phase-1 pipeline, Mock or real) | Required. The clips ARE the offer. |
| Niche-fit line | `primaryNiche` | Optional; tailors the value prop wording per niche. |
| Trial CTA | static | 7-day risk-free, "handle your next 3 streams". |
| Send channel | `contactEmail` | If null → route to manual DM list, do not auto-email. |

**B.3 Deliverables:**
- `outreach/template.md` — the email with `{{variables}}` and conditional blocks (`{{#if shortsActivity_inactive}}...{{/if}}`).
- `outreach/generate.ts` — fills the template from a `lead.json`, enforces the "required for send" rules in B.2, outputs one draft per lead into `/outreach/drafts/` for **human review before sending**. No auto-send.
- `outreach/scrape-criteria.md` — the qualify/exclude rubric (30k–150k followers, 200–1500 CCV, ≥3 streams/wk, qualifying niches; **exclude** silent pure-gameplay with no facecam/voiceover — the AI needs vocal audio, chat spikes, face-tracking to work). Document a **rate-limited, ToS-respecting** approach to SullyGnome/TwitchTracker; do not build an aggressive scraper.

> Guardrail reminder: one personalized, human-reviewed draft per lead. No bulk untargeted sender (Section 2).

---

## 11. GAP-FIXES FROM OPERATOR RESEARCH (fold into the phases above)

These come from `EchoMedia_Research_and_Gaps.md` — how high-earners actually run this. Each maps to a gap ID.

- **G7 · Client-facing monthly growth report (Phase 3).** Auto-generate per client: clips delivered/approved/posted + follower/view deltas per platform. Research names this the cheapest anti-churn lever — churn is operational + "unclear ROI," not clip quality. This is *client-facing*, distinct from the operator health digest (P-3). Deliver as a scheduled email/PDF.
- **G9 · "Prospect mode" — turn the pipeline into the CAC engine (Phase 4).** A pipeline entry point that runs a **public** VOD (a lead you don't yet have as a client) through the clipper **without onboarding**, outputs **3 demo clips + a filled outreach draft**, and drops them in a `/prospects/{handle}/` folder. The spec clip is the #1 sales primitive and costs 20–60 free editing hrs/client done manually — your automation makes it nearly free. Reuse the clipper adapter; skip Twitch-ownership assumptions (public VOD, clearly the lead's own content).
- **G10 · Outreach is a sequence, not one email (Phase 4 / Appendix B).** The `generate.ts` output must be a **3–7 touch follow-up sequence** (each touch a new angle: the demo clips → a relevant result → a different hook → a soft breakup), spaced 3–7 days, not a single draft. Most replies land on touch 2–3.
- **G11 · Niche priority (Appendix B scrape-criteria).** Rank leads: **podcasts / Just Chatting / finance-crypto-tech commentary / reactions** first (talk-dense, portable audiences, high CPM); keep the **silent-gameplay exclusion**.
- **G6 · Token refresher (Phase 3).** If any direct platform OAuth is used, store `token_expires_at`, background-refresh anything <2h to expiry, surface upcoming expiries in the health digest. (Defaulting the poster to Upload-Post/Ayrshare offloads most of this — prefer that.)
- **G8 · Pricing decision (put in `docs/UNIT_ECONOMICS.md`, flag to owner).** Real managed-retainer floor is ~$750–1,500/mo; the plan's $600–900 is a commodity position. Model both: (a) premium hands-off at **≥$750** (recommended — matches this build's zero-effort-for-the-client design) vs (b) conscious thin-margin volume at $600. Do not hard-code $600 as if it were validated.

### 11.1 BUILD ACCELERATORS — use MCP where it exists
Several vendors ship MCP servers, so you can drive them from n8n/agents without hand-rolling REST: **Ssemble, Reap** (clippers), **Upload-Post, Blotato** (posters). Prefer wiring these via `claude mcp add` (see the Fable prompt's command list) over raw HTTP where an MCP server is available and stable. Fork these proven n8n templates as starting points: [n8n #9867 (Whisper→Gemini→Upload-Post clip+schedule)](https://n8n.io/workflows/9867-transform-long-videos-into-viral-shorts-with-ai-and-schedule-to-social-media-using-whisper-and-gemini/) and [n8n #11645 (clips→Airtable approval board)](https://n8n.io/workflows/11645-generate-short-form-clips-from-youtube-videos-with-gpt-4o-grok-and-airtable/) (swap Airtable→Trello).

---
*End of brief. Builder: start at Phase 0, confirm the RC-2 clipper API details live before writing the concrete adapter, handle RC-4/5/6 platform gates explicitly, and do not advance a phase until its acceptance criteria pass. Research backing: `EchoMedia_Research_and_Gaps.md`.*
