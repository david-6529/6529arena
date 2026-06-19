# 6529 SwarmOps Roadmap

## Product Decision

Build toward **6529 SwarmOps**: a wave-native assistant that helps anyone in a 6529 wave catch up, understand what happened, and turn confusion into clear next steps.

The product should not lead with battles or REP. The front door is a 6529 wave summarizer: what happened, what was decided, what is open, who owns follow-up, and what needs checking.

The current 6529 Agent Arena remains useful as the evaluation layer. It can compare two agents on the same wave:

1. Pick a wave.
2. Run two summarizer agents.
3. Post an anonymous A/B battle.
4. Collect votes.
5. Close the battle.
6. Update the leaderboard.

Keep this capability, but do not make it the main product story. Battles answer an internal routing question: which agent produced the most useful output for this task? Reputation becomes important later when the system accepts third-party agents or routes paid work.

## North Star

Every serious 6529-native project should be able to run a lightweight agent swarm around its wave:

- ingest wave context
- preserve source-linked memory
- produce catch-up summaries and decision notes
- extract tasks
- identify risks
- draft posts
- route work to specialist agents
- require human approval for risky actions
- record cost, latency, edits, votes, and outcomes
- rank agents by task-specific usefulness

The long-term product is not a generic chatbot and not a public leaderboard. It is coordination infrastructure for wave-native companies, projects, grants, curation groups, and governance groups.

## Guiding Principles

- **Human approval stays central.** Agents propose, humans decide.
- **Reputation is task-specific.** A good summarizer is not automatically a good risk reviewer or grant evaluator.
- **Permissions are the safety boundary.** Reputation helps routing, but agents should not receive secrets, private keys, broad memory, or direct posting powers.
- **Public data first.** External agents should start with public wave context only.
- **No black-box lock-in.** Keep logs exportable, source-linked, and auditable.
- **Cost must be visible.** Track token usage, estimated cost, latency, and failure rate for every run.

## Phases

### Phase 0: Production Wave Summary Arena

Goal: launch the simplest useful wave assistant while keeping battles as operator-only evaluation infrastructure.

What ships:

- Wave Summarization only
- internal prompt-config agents only
- operator-created wave summaries
- searchable wave picker backed by 6529 name search and saved-summary history, with separate wave ID entry as the fallback
- optional related-wave context for parent/subwave workspaces such as PR firehose, digest, and team-chat flows
- review, source-check, score, preview, and optional post flow
- pre-run estimated cost cap for wave summaries
- provider-key preflight before wave summary generation
- operator generation rate limit for wave summaries
- suggested follow-ups into `/operator/tasks`
- battle pages, manual vote import, and leaderboard available as evaluation tools
- CSV exports and event logs
- simple-mode CSV exports for leaderboard, summary metadata with source-gate counts, and task metadata
- no public submissions
- no external endpoints
- no wallet-gated voting
- no payments

Success criteria:

- summaries are faster than rereading the wave
- source checks catch missing citations before sharing
- approved posts render correctly back into 6529
- costs stay within cap
- review scoring saves and is visible
- people trust the operator workflow

### Phase 1: Wave Guidance And Follow-Ups

Goal: move from "what happened?" to "what should happen next?"

The first operator-only version is now Wave Summary Drafts:

- wave summary
- previous-summary lineage
- changes since the last reviewed summary
- open questions
- decisions needed
- action items
- risks and objections
- source drops
- source-wave labels when a summary spans multiple related waves
- suggested next post
- pre-generation context preview with source waves, drop counts, and sample drops
- edit, save-before-approve, source-gated approve, reject, preview, and post workflow
- rejected-summary content lock so bad drafts remain auditable and revisions start from a new summary
- 6529 post failure events with wave and brief context
- DB-backed posting claim to prevent duplicate 6529 posts for one approved summary
- posting-state content lock while a 6529 post is in flight
- citation/source validation against stored context drops, including section-level missing-source warnings
- visible final-content source validation that blocks approval and 6529 posting when cited drops are outside stored context
- approved-summary content edits automatically return the summary to draft until it is re-approved
- suggested task extraction into `/operator/tasks`
- repeated open task tracking with seen count and last-seen summary metadata
- per-summary and per-task change history from audit events
- append-only task comments for follow-up notes and handoffs
- human 1-5 outcome scoring and score notes for completed follow-ups
- operator outcome rollups for completed, evidence-linked, scored, unscored, average scored, strong, weak, and score-distribution follow-ups
- operator wave rollups for open load, repeated open work, completed work, proof, scored completions, average score, and weak outcomes
- operator workflow labels and workflow rollups for open load, repeated open work, completed work, proof, scored completions, average score, and weak outcomes
- operator owner rollups for open load, completed work, proof, scored completions, average score, and weak outcomes
- operator summary review rollups for generated, reviewed, reviewed-scored, unscored reviewed, posted, and average reviewed scores
- operator summary cost rollups for cost, latency, and token volume
- operator recent-summary source-gate status before review or posting
- operator source-wave rollups on summary review cards when drafts use related waves
- deterministic summary quality checks for operator review
- human 1-5 quality scoring and score notes

Next improvements should focus on connecting live 6529 mention ingestion to the summary-draft route, agent-assist history, workflow templates/defaults, and side-by-side specialist summary comparisons.

### Phase 1A: 6529 Bot Commands

Goal: let people request the same reviewed summary workflow from inside 6529 without making the bot an unsafe autoposter.

The safe first version:

- dedicated 6529 bot profile and wallet
- inbound mention and DM ingestion for allowlisted waves or workspaces
- command parser for "summarize this wave", "catch me up since last check-in", and "what is open?"
- identity mapping from 6529 handle or wallet to a SwarmOps workspace user
- wallet sign-in for normal users, mapping 6529 hot-wallet identity to roles without requesting private keys
- per-user, per-wave, and per-workspace rate limits
- summary draft creation through the same cost cap, provider-key check, source gate, and audit log as `/operator/briefs`
- default response is a private draft link or DM; public posting still requires an approved operator action
- idempotency by wave, trigger drop, command text, and requester

Current status: `/api/bot/mention` creates reviewed Wave Summary Drafts, skips public autoposting, rate-limits bot generation separately from operator generation, and dedupes repeated events by `waveId` plus trigger drop. Live 6529 mention ingestion, DM commands, allowlists, and requester identity mapping are still ahead.

DMs should support a broader "catch me up across my tracked waves" command only after tracked-wave ingestion exists. Until then, DMs can trigger one-wave summaries by explicit wave ID or selected wave.

Do not enable unrestricted public replies from mentions. A bot tag should create a draft or a private response first; posting back to the wave requires authority for that wave.

Success criteria:

- people use summaries even when no battle is being run
- every claim links back to source drops
- summary output is faster to review than reading the whole wave
- repeat summaries show what changed since the last reviewed summary

### Phase 2: Specialist Swarm

Goal: split work across specialist agents.

Initial roles:

- Summarizer
- Decision Note Agent
- Task Extractor
- Risk/Objection Agent
- Source Checker
- Proposal Drafter
- Coordinator

The coordinator assembles outputs into one reviewed wave summary. The arena evaluates agents within each role.

Success criteria:

- role-specific outputs are visibly better than one general agent
- coordinator output preserves source links
- leaderboard supports role/category scoring

### Phase 3: Action Board

Goal: convert wave conversation into trackable work.

The first operator-only action board now exists:

- extracted tasks
- manual tasks
- basic duplicate suppression for open suggested tasks
- repeat mention tracking across summary cycles
- source drop references
- agent-suggested owner
- human-assigned owner
- claimed-by and claimed-at tracking
- last-seen summary and seen count
- status
- human reviewer
- outcome evidence links
- human outcome score and score notes

Next additions:

- agent-assist history
- workflow templates and project-specific workflow defaults
- richer task change history filters

Tasks can be created by agents but should require human confirmation before becoming official.

Success criteria:

- tasks survive across summary cycles
- users can see what changed since the last summary
- completed tasks link to wave posts or evidence

### Phase 4: 6529 App Extension

Goal: put SwarmOps where people already read waves.

Build a Chrome extension that injects a small SwarmOps bubble or side panel into the 6529 app. The extension should detect the current wave, let the user ask for a summary, and show decisions, open questions, follow-ups, and checks without leaving the 6529 interface.

Start read-only:

- current-wave detection
- authenticated SwarmOps session
- summary request and response panel
- source drop links back into 6529
- private user notes
- no automatic posting
- no wallet actions

Success criteria:

- users can summarize the current wave without copying IDs manually
- the assistant feels like a native helper, not a separate dashboard
- posting remains explicit and human-approved

### Phase 5: Project Workspaces And Memory

Goal: let each 6529-native project customize the same operating structure.

Add:

- project/workspace settings
- wave mapping
- workflow templates
- persistent memory scoped to each project
- approved agent pools
- budget caps
- reviewer roles

Example workflow templates:

- grants
- governance
- product/build
- art curation
- community support
- meme creation

Success criteria:

- one codebase supports multiple project workflows
- memory is exportable
- project admins can configure agent roles without code changes

### Phase 6: External Agent Intake

Goal: let third-party agents contribute without compromising safety.

Start with proposal endpoints only:

- public wave context only
- strict timeout
- max payload size
- declared price
- max output size
- signed response hash
- no direct posting
- no secrets
- no wallet keys
- allowlisted domains
- kill switch per agent, owner, provider, and domain

Cost from external self-hosted agents is treated as quoted price, not verified provider cost. Trusted cost accounting only exists when the platform runs or proxies the model call.

Success criteria:

- external agents can compete in low-risk categories
- unsafe or unreliable agents can be disabled quickly
- operators understand which cost fields are measured vs self-reported

### Phase 7: Payments And Network Operation

Goal: support paid agent work only after agent usefulness is proven.

Preferred order:

1. internal operator budget
2. project credits
3. Stripe or simple fiat billing
4. x402-style HTTP payments for API or agent calls
5. federation with multiple operators

Do not build custom state channels early. They are unnecessary unless the product needs high-frequency repeated settlement between the same parties.

Success criteria:

- projects can cap spend
- agents can quote work before running
- payments are separated from safety-critical permissions
- no agent receives arbitrary spending or withdrawal power

## Architecture Targets

### Current Core

- Next.js App Router UI and API routes
- Prisma/Postgres data model
- internal prompt-config agents
- AI provider adapters
- 6529 wave context snapshots
- battle entries and votes
- admin auth
- job queue
- event logs

### Next Core Additions

- richer task history and outcome links
- `Project` model for workspace configuration
- `AgentRole` or role/category mapping
- role-aware leaderboard scoring
- workspace-level reviewer roles and budget caps

## Trust Model

Use three layers together:

- **Human trust:** owner identity, public history, skin in the game.
- **Cryptographic proof:** signed submissions, prompt/output hashes, tamper-evident logs, payment receipts.
- **Performance reputation:** measured usefulness, votes, edits, cost, latency, and failure rate.

Cryptography can prove who signed something and whether a record changed. It cannot prove an answer was wise, useful, fair, or culturally correct. That is why agent reputation still matters.

## Business Model

The protocol and export formats should feel like public goods. The sustainable company is the hosted operator:

- hosted SwarmOps workspaces
- usage-based agent runs
- workflow templates
- private deployments
- managed memory/indexing
- security reviews
- support and integrations
- future agent marketplace fees

The company should make money by being the best operator of the network, not by trapping the network.

## Immediate Build Direction

The next product step is **Wave Guidance And Follow-Ups**.

Do not start with external agents, payments, or generalized workspaces. First improve summaries, checks, follow-ups, and the review queue until they make 6529 waves easier to understand every day.
