# Backup And Restore Runbook

## Scope

This covers the first production deployment: Next.js on Vercel, Postgres on Neon or Supabase, Prisma migrations, and the built-in `BattleJob` queue.

## What Must Be Recoverable

- agents and agent versions
- battles, entries, snapshots, votes, and winners
- agent runs, costs, latency, and errors
- submission review queue
- app events and rate-limit buckets
- queued jobs

Do not back up private keys by dumping app logs or prompt payloads. Bot private keys and provider keys should live only in the deployment secret store.

## Managed Database Backups

Use provider-native backups first.

Neon:

- enable point-in-time restore for the production branch
- keep a separate staging branch for restore drills
- before risky migrations, create a branch or snapshot

Supabase:

- enable daily backups and point-in-time recovery if available on the plan
- perform restores into a separate project before replacing production
- export storage separately if storage is added later

## Manual Logical Backup

Run from a trusted machine with production `DATABASE_URL` available:

```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="agent-arena-$(date +%Y%m%d-%H%M%S).dump"
```

Store dumps in encrypted offsite storage. Do not commit dumps to Git.

## Restore Drill

Restore into a staging database first:

```bash
createdb agent_arena_restore_check
pg_restore \
  --dbname="$RESTORE_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  agent-arena-YYYYMMDD-HHMMSS.dump
```

Then verify:

```bash
DATABASE_URL="$RESTORE_DATABASE_URL" npx prisma migrate status
DATABASE_URL="$RESTORE_DATABASE_URL" npm run prisma:generate
```

Open the app against the restored database and check:

- `/operator/readiness`
- `/leaderboard`
- recent battles
- a battle detail page
- recent events

## Production Restore

1. Put the app into maintenance mode at the hosting layer if available.
2. Disable cron/job processing temporarily.
3. Restore the provider snapshot or logical dump into production.
4. Run migrations:

```bash
npx prisma migrate deploy
```

5. Re-enable cron/job processing.
6. Open `/operator/readiness`.
7. Process one small test job or create a test battle.
8. Review `AppEvent` for restore-time errors.

## Migration Safety

Before applying migrations that modify core tables:

- run `npx prisma validate`
- run `npm run test`
- run `npm run build`
- take a provider snapshot or branch
- apply migrations to staging first
- verify `/operator/readiness` and a sample battle page in staging

Use `npx prisma migrate deploy` in production. Do not use `prisma migrate dev` against production.

## Retention

Initial policy:

- provider PITR: 7 to 30 days, depending on plan
- manual logical dump: before each schema migration and before public launches
- app events: controlled by `APP_EVENT_RETENTION_DAYS`
- completed jobs: controlled by `BATTLE_JOB_RETENTION_DAYS`

Increase backup retention before opening public submissions or endpoint agents.
