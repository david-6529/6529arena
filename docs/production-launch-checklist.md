# Production Launch Checklist

This checklist moves the current simple launch from local development to a real production pilot.

## Launch Goal

Launch the Wave Summary Arena in simple mode:

- one public leaderboard
- Wave Summarization only
- admin-run battles
- internal agents only
- 6529 posting after human review
- manual vote import
- no public submissions
- no external endpoint agents
- no wallet-gated voting
- no payments

## User-Owned Inputs

These cannot be supplied by code:

- production domain
- Vercel project or equivalent host
- Neon/Supabase Postgres database
- production `DATABASE_URL`
- long random `ADMIN_API_KEY`
- long random `CRON_SECRET`
- long random `RATE_LIMIT_SALT`
- at least one provider key, preferably `OPENAI_API_KEY` first
- dedicated 6529 bot wallet address
- dedicated 6529 bot private key in the host secret store
- one real 6529 wave ID where test posts are acceptable

Optional for launch:

- `SENTRY_DSN`
- `POSTHOG_PROJECT_API_KEY`
- `POSTHOG_HOST`

Do not provide private keys in chat, issues, docs, or commits.

## Production Environment

Required values:

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="https://..."
SIMPLE_LAUNCH_MODE="true"
6529_API_BASE_URL="https://api.6529.io"
6529_MOCK_MODE="false"
6529_BOT_WALLET_ADDRESS="0x..."
6529_BOT_PRIVATE_KEY="..."
6529_BOT_HANDLE="AgentArena"
OPENAI_API_KEY="..."
ADMIN_API_KEY="..."
CRON_SECRET="..."
RATE_LIMIT_SALT="..."
MAX_BATTLE_ESTIMATED_COST_USD="1"
WAVE_BRIEF_PROVIDER="openai"
WAVE_BRIEF_MODEL=""
PUBLIC_AGENT_SUBMISSIONS_ENABLED="false"
EXTERNAL_AGENT_ENDPOINT_SUBMISSIONS_ENABLED="false"
SELF_TEST_ENABLED="false"
SEED_DEMO_DATA="false"
```

Optional provider keys can be added later:

```bash
ANTHROPIC_API_KEY="..."
GOOGLE_API_KEY="..."
```

If Anthropic or Google keys are missing, deactivate those agents or keep early battles to agents backed by configured providers.

## Deployment Steps

1. Create production Postgres.
2. Create app host project.
3. Add production environment variables.
4. Deploy `main`.
5. Run migrations:

```bash
npx prisma migrate deploy
```

6. Seed internal agents:

```bash
npm run db:seed
```

7. Open `/admin/login`.
8. Sign in with `ADMIN_API_KEY`.
9. Open `/admin/readiness`.
10. Confirm launch blockers are green.

## First Production Smoke Test

Use a real test wave where posting is acceptable.

1. Open `/admin`.
2. Click Check 6529 Auth.
3. Enter the test wave ID.
4. Preview context.
5. Create a battle as "Test run only".
6. Select two agents with configured provider keys.
7. Queue Run.
8. Process one job or wait for cron.
9. Open the battle page.
10. Confirm Option A and Option B render.
11. Preview the 6529 post.
12. Post only if the preview is correct.
13. Import manual A/B votes from the test wave.
14. Close the battle.
15. Confirm test battles do not affect the official leaderboard.
16. Open `/admin/briefs`.
17. Generate a test wave brief from the same wave.
18. Save an edit, approve the brief, preview the 6529 post, and post only if acceptable.
19. Open `/admin/tasks` and confirm suggested tasks appear for brief action items.
20. Confirm, edit, complete, and reject at least one test task.
21. Create one manual task and delete or reject it after the smoke test.
22. Add outcome evidence to one completed test task and confirm it renders on the task card.

## First Official Battle

Only run an official battle after the smoke test succeeds.

1. Create an official battle.
2. Run two configured agents.
3. Inspect outputs and citations.
4. Preview the 6529 post.
5. Post the battle link.
6. Let voting run.
7. Import votes.
8. Close battle.
9. Confirm leaderboard updates.
10. Export leaderboard and battle CSVs for records.

## First Week Operating Cadence

Daily:

- check `/admin/readiness`
- review Recent Events
- inspect failed jobs
- review model costs
- run one or two test battles before important official battles
- review suggested wave tasks and reject low-quality suggestions

After every official battle:

- record whether outputs were useful
- note prompt or agent issues
- confirm source drops were accurate
- confirm vote import was clean
- check leaderboard movement

End of week:

- export CSVs
- review cost per battle
- review latency and failure rates
- decide whether to adjust prompts or deactivate weak agents
- review wave brief source warnings and edit drafts before posting

## Launch Blockers

Do not launch publicly if:

- `ADMIN_API_KEY` is missing
- `RATE_LIMIT_SALT` is missing
- `CRON_SECRET` is missing
- database migrations are not applied
- no AI provider key is configured
- bot wallet auth check fails
- `6529_MOCK_MODE=true`
- posting preview is malformed
- test battle close does not work
- test wave brief generation, approval, and preview do not work
- suggested task review does not work
- cost cap is missing or too high

## Next Product Milestone

Wave Brief Drafts and the first Wave Tasks board are now the Wave Chief Of Staff foundation. After 10 real battles and several test briefs, improve the feature with:

- brief quality scoring
- task merge history and change tracking across brief cycles
- side-by-side brief battles between specialist agents
- role-specific agents for risk, decisions, tasks, and source checking

This is the shortest path from Agent Arena to SwarmOps.
