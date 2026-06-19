# 6529 SwarmOps

## ELI5

6529 SwarmOps helps anyone in a 6529 wave keep noisy conversations from losing the plot.

The problem is that important decisions, open questions, follow-ups, and facts get buried inside fast wave conversations. SwarmOps is an optimized wave summarizer: it catches you up on what changed since the last reviewed summary, what happened, what was decided, what is still open, who owns follow-up, and what needs checking.

Agents do the first pass. Humans stay in charge. The system keeps source drops, review notes, human scores, costs, votes, and outcomes so people can see which agents are actually useful.

6529 Agent Arena is the evaluation layer inside SwarmOps. It can compare two agents on the same wave and update the leaderboard, but battles are infrastructure. The user-facing product is the wave assistant: summarize the wave, show what changed, identify open questions, suggest follow-ups, and keep sources attached.

The simplest launch is this loop:

1. Search for a 6529 wave by name or enter its ID.
2. Generate a clear catch-up summary.
3. Review changes since the previous summary, decisions, open questions, follow-ups, checks, and section-level source warnings.
4. Keep it private, share it with collaborators, or post a public recap back to the wave.
5. Track useful follow-ups in the review queue, see when the same task comes up again, assign an owner, and record who claimed the work.

Battles, public agent submissions, wallet identity, and extra categories stay behind feature gates until the summary loop works well in public.

The broader SwarmOps path adds reviewed wave summaries, follow-up tracking, outcome evidence, assignments, specialist agents, a 6529 bot profile for mentions and DMs, project workspaces, a Chrome extension inside the 6529 app, and eventually safe external agent intake.


## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Prisma + Postgres
- OpenAI, Anthropic, and Google provider adapters
- 6529 API integration

## Environment

Copy `.env.example` to `.env` and fill in production values:

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="..."
SIMPLE_LAUNCH_MODE="true"

6529_API_BASE_URL="https://api.6529.io"
6529_MOCK_MODE="false"
6529_BOT_WALLET_ADDRESS="0x..."
6529_BOT_PRIVATE_KEY="..."
6529_BOT_HANDLE="AgentArena"

OPENAI_API_KEY="..."
ANTHROPIC_API_KEY="..."
GOOGLE_API_KEY="..."
AI_PROVIDER_TIMEOUT_MS="45000"
AI_PROVIDER_RETRIES="1"
MAX_BATTLE_ESTIMATED_COST_USD="1"
WAVE_BRIEF_PROVIDER="openai"
WAVE_BRIEF_MODEL=""
MAX_WAVE_BRIEF_ESTIMATED_COST_USD="0.25"
WAVE_BRIEF_RATE_LIMIT_PER_HOUR="10"
SELF_TEST_ENABLED="false"
SELF_TEST_RATE_LIMIT_PER_HOUR="5"
PUBLIC_AGENT_SUBMISSIONS_ENABLED="false"
EXTERNAL_AGENT_ENDPOINT_SUBMISSIONS_ENABLED="false"
AGENT_SUBMISSION_RATE_LIMIT_PER_DAY="3"

ADMIN_API_KEY="long-random-secret"
ADMIN_LOGIN_RATE_LIMIT_PER_HOUR="10"
CRON_SECRET="long-random-worker-secret"
RATE_LIMIT_SALT="another-long-random-secret"
VOTE_RATE_LIMIT_PER_HOUR="30"
IDENTITY_CHALLENGE_RATE_LIMIT_PER_HOUR="20"
JOB_LOCK_TIMEOUT_MS="600000"
BATTLE_JOB_RETENTION_DAYS="14"
APP_EVENT_RETENTION_DAYS="30"
POSTHOG_PROJECT_API_KEY=""
POSTHOG_HOST="https://app.posthog.com"
OBSERVABILITY_CAPTURE_APP_EVENTS="false"
SENTRY_DSN=""
```

Do not deploy without `ADMIN_API_KEY`. Operator pages redirect to `/operator/login` when this is set, and protected API routes accept the login session cookie, `x-admin-api-key`, or `Authorization: Bearer`. When `ADMIN_API_KEY` is not set locally, operator pages are open and show `Open dev access` instead of a sign-out button.

## Operator vs 6529 Wave Admin

SwarmOps keeps the `/admin` API namespace and `ADMIN_API_KEY` env var as technical names, but the product role is an operator: the person who reviews AI output before it becomes shared or actionable. The primary UI path is `/operator`; `/admin` remains a compatibility path for now.

The operator does not always need to be the 6529 wave admin. Anyone should eventually be able to use SwarmOps privately to catch up. Posting a recap back to a wave, assigning public follow-ups, or running anything that spends money should require an approved operator for that workspace, and posting back to a 6529 wave should require either the wave admin, the wave creator, or someone they explicitly delegate.

Never paste private keys into chat, tickets, or commit history. Put the 6529 bot key only in `.env` locally and in the deployment provider's encrypted secret store.

For a throwaway local smoke-test wallet, run:

```bash
npm run smoke:wallet
```

This creates `.env.6529-smoke.local`, writes the private key there with owner-only file permissions, and prints only the public wallet address. The file is ignored by git and is not loaded automatically by Next.js. Use the generated `6529_BOT_WALLET_ADDRESS` and `6529_BOT_PRIVATE_KEY` values in `.env.local` or your deployment secret store when you are ready to test live 6529 auth/posting. Creating the 6529 profile, requested smoke username `testing12345`, and test wave still happens inside 6529 until a normal profile/wave creation API is confirmed.

Set `RATE_LIMIT_SALT` in production so stored rate-limit keys are not reversible from request metadata.
Optional telemetry is disabled until configured. Set `SENTRY_DSN` for server exception reporting. Set `POSTHOG_PROJECT_API_KEY` and `POSTHOG_HOST` for server exceptions; set `OBSERVABILITY_CAPTURE_APP_EVENTS=true` only if you also want app events mirrored into PostHog.

## Simple Launch Mode

The default launch posture is intentionally narrow:

```bash
SIMPLE_LAUNCH_MODE="true"
```

In this mode the production workflow stays intentionally narrow:

- public homepage presents the SwarmOps draft site
- public nav shows Problem, Use Cases, Safety, and Operator
- leaderboard is locked to Wave Summarization
- `/operator` opens the summary-first SwarmOps Operator Console
- operator-only Wave Summary Drafts are available at `/operator/briefs`
- operator-only Wave Tasks are available at `/operator/tasks`, including seen counts for repeated open follow-ups
- the manual battle runner is hidden behind `SIMPLE_LAUNCH_MODE=false`
- public submissions, wallet identity, and self-test pages are parked behind explanatory screens

The code for broader features remains in place. Set `SIMPLE_LAUNCH_MODE=false` when you want to expose the full product surface again.

## Local Setup

```bash
npm install
npm run prisma:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

For a richer local demo leaderboard with seeded battles, votes, and runs:

```bash
SEED_DEMO_DATA=true npm run db:seed
```

## Production Checklist

Detailed setup: [docs/production-runbook.md](docs/production-runbook.md).
Production launch checklist: [docs/production-launch-checklist.md](docs/production-launch-checklist.md).
SwarmOps roadmap: [docs/swarmops-roadmap.md](docs/swarmops-roadmap.md).
Agent security model: [docs/agent-safety-model.md](docs/agent-safety-model.md).
Backup and restore: [docs/backup-restore-runbook.md](docs/backup-restore-runbook.md).
Non-Vercel deploy notes: [docs/non-vercel-deploy.md](docs/non-vercel-deploy.md).
API route reference: [docs/api-routes.md](docs/api-routes.md).

- Database is migrated and seeded with the five internal agents.
- `ADMIN_API_KEY` is set.
- `CRON_SECRET` is set.
- `RATE_LIMIT_SALT` is set.
- At least one AI provider key is set, and the key for `WAVE_BRIEF_PROVIDER` is non-empty.
- Dedicated 6529 bot wallet address and private key are set in env or the host secret store.
- The dedicated 6529 bot wallet has a real 6529 profile for live posting tests.
- `NEXT_PUBLIC_APP_URL` points at the deployed site.
- `SIMPLE_LAUNCH_MODE` is left as `true` for the first launch.
- `MAX_WAVE_BRIEF_ESTIMATED_COST_USD` is set to a conservative per-summary cap.
- `WAVE_BRIEF_RATE_LIMIT_PER_HOUR` is set to a conservative positive integer operator generation limit.
- `/operator` shows Production Readiness as ready.
- A real wave summary can be generated, reviewed, scored, approved after the saved final-content source gate passes, previewed, and optionally posted.
- Recent summary cards on `/operator` show whether the saved final-content source gate is clear or blocked.
- Summary and task cards show their own change history from the audit log.
- Task cards support append-only comments for follow-up notes and handoffs.
- Completed follow-ups can be scored 1-5 with outcome score notes.
- `/operator` shows summary review rollups for generated, reviewed, reviewed-scored, unscored reviewed, posted, and average reviewed scores.
- `/operator` shows summary cost rollups for costed summaries, total/average/max cost, average latency, and total tokens.
- `/operator` shows outcome rollups for completed, evidence-linked, scored, unscored, average scored, strong, weak, and score-distribution follow-ups.
- `/operator` shows wave rollups for open load, repeated open work, completed work, proof, scored completions, and weak outcomes.
- `/operator` uses standard workflow templates for tasks and shows workflow rollups for grants, governance, product/build, art curation, community support, and meme creation.
- `/operator` shows owner rollups for open load, completed work, proof, scored completions, and weak outcomes.
- Recent Events on `/operator` records summary, task, posting, posting failure, and API error activity.
- API errors return an `errorId`; use it to find matching `api.route_error` rows in Recent Events and server logs.
- CSV exports on `/operator` include leaderboard, wave summary metadata with source-gate counts, and wave task metadata in simple mode. Battle, vote, and run exports return when evaluation tools are enabled.

## End State User Journeys

### Visitor learns what SwarmOps does

1. Open `/`.
2. See the product value prop: busy waves lose shared state, and SwarmOps turns them into reviewed summaries for anyone in the wave.
3. Use the primary actions to inspect the problem, sample stories, and operator summary drafts.
4. Understand that unfinished modules are stubbed while the operator workflow becomes production ready.

Successful end state: the visitor understands that SwarmOps helps anyone in a wave catch up, create reviewed summaries, and verify facts before sharing or acting.

### Community member compares agents

1. Open `/leaderboard`.
2. Pick a category such as Wave Summarization, Decision Briefs, or Art Curation.
3. Compare the low, medium, and high cost winners for that category.
4. Use table tooltips to understand sample size, quality, routing score, value, cost, win rate, latency, and last active.
5. Open an agent profile for ownership, trust badges, model details, and recent competitions.

Successful end state: the member can choose the best agent for a cost target and understand why that agent is ranked there.

### Voter judges a battle

1. Open a battle page from a 6529 post or `/operator/battles`.
2. Read the request prompt and compare Option A against Option B.
3. Vote for the more useful output while identities are hidden.
4. After close, review the revealed agent names, winner, votes, cost, latency, and source drops.

Successful end state: the voter can judge output quality without being biased by agent identity.

### Builder submits an agent

1. Open `/identity` and link a wallet if owner verification is needed.
2. Open `/self-test` to try approved prompt-config agents against sample context.
3. Open `/submit`.
4. Submit name, category, owner wallet or handle, provider, model, cost cap, public description, and system prompt.
5. Wait for operator review before the agent enters official battles.

Successful end state: the builder submits a constrained prompt-config agent without exposing private keys, personal memory, or arbitrary production endpoints.

### Operator runs a manual battle

This is feature-gated evaluation infrastructure. Set `SIMPLE_LAUNCH_MODE=false` before using it.

1. Open `/operator`.
2. Confirm Production Readiness checks.
3. Enter a wave ID, category, request prompt, and optional context window.
4. Preview context. By default the app uses the last 24 hours and searches up to 500 messages.
5. Create the battle to snapshot source drops.
6. Select two different agents, queue the run, and process one job locally or through cron.
7. Open the battle page to inspect Option A and Option B.
8. Preview the 6529 post, post it to the wave, import or collect votes, and close the battle.

Successful end state: the operator creates an auditable battle from real 6529 context and records the result for leaderboard scoring.

### Operator reviews a wave summary

1. Open `/operator/briefs`.
2. Search for a 6529 wave by name or enter a wave ID, then set an optional context window.
3. Generate a review-ready wave summary with changes since the last reviewed summary, decisions, open questions, follow-ups, checks, suggested post, and source citations.
4. Edit the draft, add reviewer notes, score it 1-5, and approve or reject it.
5. Review missing-source warnings by section, then preview the 6529 post body.
6. Post the approved summary back into the wave only if a public recap is useful.
7. Open `/operator/tasks` to review suggested action items generated from the summary, including repeated open tasks that were seen again.

Successful end state: the reviewer gets an auditable wave summary and a follow-up queue without changing the public MVP.

### Operator reviews wave tasks

1. Open `/operator/tasks`.
2. Filter to open tasks.
3. Confirm useful suggested tasks, assign owners separately from agent-suggested owners, or reject bad suggestions.
4. Move active work through confirmed, in progress, and completed states.
5. Mark who claimed the work when a person or agent takes it on.
6. Create manual tasks when useful work did not come from a summary.
7. Add comments for follow-up notes and handoffs without overwriting reviewer notes.
8. Add outcome drop IDs, evidence URLs, and outcome summaries when work is completed.
9. Score the completed outcome 1-5 and record why.
10. Keep source drop IDs attached for auditability.

Successful end state: agent-suggested work becomes a human-reviewed queue with clear ownership, repeat-mention history, claim history, and evidence for completed work.

### Operator reviews submissions

1. Open `/operator/submissions`.
2. Filter by status, category, and provider.
3. Reject unsafe or incomplete submissions.
4. Approve prompt-config submissions that include a cost cap and supported category.
5. Open `/operator/agents` to inspect active agents, deactivate risky agents, and review version history.

Successful end state: only reviewed, constrained agents can enter official routing.

### Safety reviewer checks the trust model

1. Open `/safety`.
2. Review least privilege, tool proxy, prompt-injection assumptions, audit logging, rate limits, and trust tiers.
3. Confirm that external agents produce proposals while the platform controls posting, deletion, messaging, spending, and credentials.

Successful end state: the reviewer understands that reputation routes work, while permissions remain the security boundary.

## Wallet Linking

Injected-wallet linking is available at `/identity` for MetaMask and other EIP-1193 wallets. WalletConnect QR support should be added before broad mobile wallet support, public voting weight, or REP-gated participation. Identity linking is not required for the first private admin/bot loop.

Use wallet linking for:

- mapping builders to 6529 identities
- proving agent ownership
- applying minimum REP or allowlist rules
- weighting or deduplicating external-site votes
- showing pseudonymous trust signals on agent profiles

Inputs needed before implementation:

- WalletConnect project ID
- required owner eligibility rules, such as allowlist only, minimum REP, or minimum account age
- whether one wallet can own multiple agents
- whether external votes require wallet signature, 6529 handle match, or both
- production domain for WalletConnect allowlisting

The database already has an `Identity` model and optional owner/voter links so this can be wired without changing the battle schema again.
Agent profiles already show trust badges for prompt-config execution, endpoint-disabled status, and whether owner wallet verification is linked.
The wallet-link flow uses a short-lived server nonce, a signed message, and an HttpOnly identity session cookie. It does not grant spending permissions.

## Self-Test Sandbox

`/self-test` lets builders run approved internal agents against pasted sample context without creating battles or affecting leaderboard scores.

It is disabled by default. Enable with:

```bash
SELF_TEST_ENABLED="true"
SELF_TEST_RATE_LIMIT_PER_HOUR="5"
```

Self-test runs are stored as `AgentRun` rows with `runType = "self_test"`.
Operators can review recent runs at `/operator/self-tests`. Persistent history is operator-only because pasted test context can contain private wave or builder data.

## Agent Submissions

`/submit` writes to an operator review queue only when:

```bash
PUBLIC_AGENT_SUBMISSIONS_ENABLED="true"
```

Endpoint submissions remain blocked unless:

```bash
EXTERNAL_AGENT_ENDPOINT_SUBMISSIONS_ENABLED="true"
```

Keep endpoint submissions disabled until endpoint signing, request sandboxing, timeout limits, and abuse policy are implemented. Review incoming prompt-config submissions at `/operator/submissions`; approval promotes them into active public agents with version 1.
The review queue supports status, category, and provider filters and defaults to pending submissions.

## Manual Battle Flow

This flow is feature-gated evaluation infrastructure. Set `SIMPLE_LAUNCH_MODE=false` before using it in the UI.

1. Open `/operator`.
2. Enter a 6529 wave ID and request prompt.
3. Optionally set a time window. Without one, the app fetches the last 24 hours and searches at most 500 messages.
4. Click Preview to confirm real wave drops are being normalized correctly.
5. Click Create to snapshot the wave context.
6. Select two agents and click Queue Run.
7. Click Process Jobs locally, or configure a cron/worker to call `/api/admin/jobs/process`.
8. Open the battle page to inspect Option A and Option B.
9. Use Preview Post to inspect the exact 6529 reply body.
10. Click Post to publish the anonymized battle back into 6529.
11. Use `/operator/battles` to import manual A/B vote counts and close the battle.

Use "Test run only" for experiments; test battles are excluded from leaderboard scoring.

The worker endpoint accepts admin auth or `Authorization: Bearer $CRON_SECRET`.
`vercel.json` schedules `/api/admin/jobs/process?limit=2` every five minutes. If you deploy somewhere else, run the same endpoint from that platform's scheduler with the bearer secret.
Each scheduled run also recovers stale job locks, deletes expired rate-limit buckets and wallet challenges, and prunes old completed jobs/events according to the retention env vars.
Use Run Maintenance on `/operator` when you want that cleanup without processing queued battle jobs.

When the battle runner is enabled, use Check 6529 Auth on `/operator` after setting bot wallet env vars. It verifies nonce signing and JWT exchange without posting to a wave.

For offline UI and workflow testing without live 6529 calls, set `6529_MOCK_MODE=true` and use any wave ID. The app will use the local fixture in `src/lib/6529/fixtures/mock-wave-drops.json` and mock post IDs.

## 6529 API Notes

Official docs:

- https://api.6529.io/docs/
- https://6529.io/tools/api

The app normalizes drop responses before prompt construction, including nested `parts`, timestamps in seconds or milliseconds, and common author/profile field variants. Raw response payloads are kept in the snapshot JSON for auditability.

## Commands

```bash
npm run lint
npm run test
npm run test:e2e
npm run build
npm run db:migrate
npm run db:seed
```

For local browser smoke tests against an already-running dev server:

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 npm run test:e2e
```

## CI

GitHub Actions runs the `Verify` job on pushes to `main`, pull requests targeting `main`, and manual dispatch. Set `Verify` as a required status check in GitHub branch protection before allowing merges to `main`.

- `npm ci`
- `npx prisma validate`
- `npm run prisma:generate`
- `npm run lint`
- `npm run lint:no-em-dash`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

CI intentionally uses empty provider and bot secrets. Live 6529/API-provider checks should run from `/operator` after production env vars are configured.
