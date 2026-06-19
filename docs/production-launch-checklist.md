# Production Launch Checklist

This checklist moves the current simple launch from local development to a real production pilot.

## Launch Goal

Launch the Wave Summary Assistant in simple mode:

- Wave Summarization only
- operator-run wave check-ins
- previous-summary lineage and changes-since-last-summary output
- review, human score, section-level source check, preview, and optional 6529 post
- task review queue for follow-ups
- assigned owner and claimed-by tracking for accepted tasks
- repeated open task tracking with seen count and last-seen summary metadata
- evaluation battles kept behind `SIMPLE_LAUNCH_MODE=false`
- leaderboard data kept available for summary-agent evaluation
- internal agents only
- 6529 posting after human review
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
- at least one non-empty provider key, preferably `OPENAI_API_KEY` first, matching the configured `WAVE_BRIEF_PROVIDER`
- dedicated 6529 bot wallet address
- dedicated 6529 bot private key in the host secret store
- real 6529 profile for the dedicated bot wallet, using `testing12345` for the first smoke-test account if available
- one real 6529 wave ID where test posts are acceptable

Optional for launch:

- `SENTRY_DSN`
- `POSTHOG_PROJECT_API_KEY`
- `POSTHOG_HOST`

Do not provide private keys in chat, issues, docs, or commits.

For a throwaway smoke-test wallet, run:

```bash
npm run smoke:wallet
```

The command writes `.env.6529-smoke.local` with owner-only permissions and prints only the public wallet address. The file is ignored by git and is not loaded automatically by Next.js. Use those generated 6529 bot values in `.env.local` for local live tests or in the host secret store for production. Creating the 6529 profile, requested username `testing12345`, a normal test wave, and test comments still happens inside 6529 until a normal profile/wave creation API is confirmed.

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
MAX_WAVE_BRIEF_ESTIMATED_COST_USD="0.25"
WAVE_BRIEF_RATE_LIMIT_PER_HOUR="10"
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

7. Open `/operator/login`.
8. Sign in with `ADMIN_API_KEY`.
9. Open `/operator/readiness`.
10. Confirm launch blockers are green.

## First Production Smoke Test

Use a real test wave where posting is acceptable.

1. Confirm the dedicated bot wallet can log into 6529 and owns or can use the requested smoke username `testing12345`.
2. Create a real test wave in 6529 where bot posts are acceptable.
3. Add at least 10 comments that include decisions, open questions, follow-ups, sourceable facts, and one repeated follow-up.
4. Open `/`.
5. Confirm the homepage starts with the wave search/paste box and the Preview/Generate actions.
6. Open `/operator`.
7. Confirm The Doom Signal Console shows Production Readiness, Recent Check-ins with source-gate status, Check-in Quality Rollups, Check-in Cost Rollups, Outcome Rollups, Wave Rollups, Workflow Rollups, Owner Rollups, and Follow-Up Queue.
8. Open `/operator/readiness`.
9. Confirm launch blockers are green.
10. Open `/`.
11. Search for the test wave by name or enter the test wave ID.
12. Preview context and confirm the source waves, searched message count, collected drop count, sample drops, estimated input tokens, and estimated model cost look right before generation.
13. Generate a test wave check-in.
14. Confirm the quality badge and notes match the generated check-in.
15. Confirm missing-source warnings show the exact check-in section when a cited drop is not in stored context.
16. Add a human score and score note.
17. Save an edit, confirm marking checked is blocked while final content cites missing source drops, confirm check/preview/post are blocked while title or content has unsaved changes, mark the check-in checked after the saved final-content source gate passes, confirm later title or content edits move a checked check-in back to draft until rechecked, preview the 6529 post, and post only if the final content source check passes.
18. Generate a second test check-in for the same wave and confirm it links to the previous checked check-in.
19. Confirm the second check-in includes a "What changed since last check-in" section.
20. Generate one parent/subwave check-in and confirm the review card shows source-wave links, labels, and drop counts.
21. Open `/operator/tasks` and confirm suggested tasks appear for check-in action items.
22. Generate or seed a repeated open action item and confirm its seen count and last-seen check-in metadata update instead of creating a duplicate.
23. Confirm, assign, claim, complete, and reject at least one test task.
24. Create one manual task and delete or reject it after the smoke test.
25. Add outcome evidence and a 1-5 outcome score to one completed test task and confirm both render on the task card.
26. Confirm Wave Rollups show wave load, repeated-open count, proof count, score count, average score, and weak outcome count.
27. Pick a standard workflow label on one task and confirm Workflow Rollups show workflow load, repeated-open count, proof count, score count, average score, and weak outcome count.
28. Confirm Owner Rollups show the task owner load, proof count, score count, average score, and weak outcome count.
29. Confirm Recent Events records check-in, task, posting, and posting failure activity when a post fails.

## First Evaluation Battle

Only run an official evaluation battle after the check-in smoke test succeeds.

Set `SIMPLE_LAUNCH_MODE=false` before using the manual battle runner in the UI.

1. Create an official battle when you want results to affect routing data.
2. Run two configured agents.
3. Inspect outputs and citations.
4. Preview the 6529 post.
5. Post the battle link only if public comparison is useful.
6. Let voting run.
7. Import votes.
8. Close battle.
9. Confirm leaderboard updates.
10. Export leaderboard and battle CSVs for records.

## First Week Operating Cadence

Daily:

- check `/operator/readiness`
- review Recent Events
- inspect failed jobs
- review check-in model costs
- review suggested wave tasks and reject low-quality suggestions
- score generated wave check-ins after review

After every official evaluation battle, if evaluation tools are enabled:

- record whether outputs were useful
- note prompt or agent issues
- confirm source drops were accurate
- confirm vote import was clean
- check leaderboard movement

End of week:

- export CSVs
- confirm check-in and task metadata exports include source-gate counts but do not include raw wave drops, prompts, comments, or full model outputs
- review cost per check-in
- review latency and failure rates
- decide whether to adjust prompts or deactivate weak agents
- review wave check-in source warnings and edit drafts before posting
- review human check-in scores and score notes

## Launch Blockers

Do not launch publicly if:

- `NEXT_PUBLIC_APP_URL` is missing, local, or not an `https://` production URL
- `ADMIN_API_KEY` is missing
- `RATE_LIMIT_SALT` is missing
- `CRON_SECRET` is missing
- database migrations are not applied
- no AI provider key is configured, or the configured `WAVE_BRIEF_PROVIDER` has no matching non-empty key
- `MAX_WAVE_BRIEF_ESTIMATED_COST_USD` is missing, disabled, or too high for the pilot
- `WAVE_BRIEF_RATE_LIMIT_PER_HOUR` is missing, disabled, non-integer, or too high for the pilot
- 6529 posting readiness fails
- `6529_MOCK_MODE=true`
- posting preview is malformed
- failed 6529 posts do not create `wave_brief.post_failed` events
- duplicate or concurrent post attempts can create multiple 6529 drops for one check-in
- check-ins can be checked, discarded, or content-edited while a 6529 post is in progress
- check-ins with missing final-content source drops can still be marked checked or posted
- check-ins with unsaved title or content edits can still be previewed or posted
- checked check-ins can still be content-edited without moving back to draft and requiring another check
- discarded check-ins can still be checked, previewed, posted, or content-edited instead of requiring a new check-in
- test wave check-in generation, checking, and preview do not work
- repeat check-ins do not link to the previous checked check-in
- human check-in scoring does not save
- suggested task review does not work
- task assignment or claiming does not save
- repeated open tasks duplicate instead of updating seen count and last-seen metadata
- task comments cannot be added or do not create audit events
- completed task outcome scores do not save or render
- `/operator` check-in quality rollups do not show generated, checked, scored, unscored checked, posted, and average scores
- `/operator` check-in cost rollups do not show costed check-ins, total/average/max cost, average latency, and total tokens
- `/operator` outcome rollups do not show completed, evidence-linked, scored, unscored, average scored, strong, weak, and score-distribution follow-ups
- battle or wave-check-in cost cap is missing or too high

## Next Product Milestone

Wave Check-ins and the first Wave Tasks board are now the Wave Guidance foundation. The public front door sends users to `/`, where wave selection supports 6529 name search, saved check-in history fallback, and wave link/ID entry. After real wave check-in use and several test check-ins, improve the feature with:

- all-history source previews for parent/subwave bundles, with raw feed, digest, and human-coordination waves labeled separately
- evidence coverage in every generated check-in so people can see fetched drops, prompt-window limits, and cap warnings before posting
- 6529 bot mention ingestion in the 6529 app, wired to the implemented mention-to-draft route
- DM commands for "catch me up" after tracked-wave ingestion is running
- richer task change history filters across check-in cycles
- project-specific workflow defaults
- side-by-side check-in battles between specialist agents
- role-specific agents for risk, decisions, tasks, and source checking

This is the shortest path from Agent Arena to Doom Signal.
