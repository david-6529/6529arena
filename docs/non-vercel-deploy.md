# Non-Vercel Deployment

Vercel remains the recommended first deployment target. Use this path if you need to run the app on Fly.io, Render, ECS, Railway, Kubernetes, or another container platform.

## Build

```bash
docker build -t 6529-agent-arena .
```

The Docker image uses Next.js standalone output and starts `server.js` on port `3000`.

## Runtime Env

Provide the same production env vars listed in [production-runbook.md](production-runbook.md). At minimum:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_API_KEY`
- `CRON_SECRET`
- `RATE_LIMIT_SALT`
- at least one AI provider key
- `6529_BOT_WALLET_ADDRESS`
- `6529_BOT_PRIVATE_KEY`

Keep `6529_MOCK_MODE=false` in production.

## Migrations And Seed

Run migrations as a release step from CI or a trusted ops machine before starting new app containers:

```bash
npm ci
npx prisma migrate deploy
npm run db:seed
```

Do not run `prisma migrate dev` against production.

## Worker Schedule

Vercel Cron is not available outside Vercel. Configure your platform scheduler to call:

```txt
GET https://your-domain.example/api/admin/jobs/process?limit=2
Authorization: Bearer $CRON_SECRET
```

A five-minute interval is enough for the first production loop. Increase the limit or move to Inngest/Trigger.dev if battle volume grows.

## Health Checks

Use:

```txt
GET /api/health
```

Keep `/operator/readiness` behind operator auth and use it after deploy to confirm database, production URL, cron secret, rate-limit salt, summary cost cap, bot wallet, AI provider, and mock-mode state.
