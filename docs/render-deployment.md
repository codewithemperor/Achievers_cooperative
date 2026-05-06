# Render Deployment Procedure

## Services

Create separate Render services for:

- API: Render Web Service from `apps/api`
- Admin/landing frontend: Render Web Service or Static Site from `apps/landing`
- Member frontend: Render Web Service or Static Site from `apps/member`
- Cron job: Render Cron Job that calls the API cron endpoint

Render runs a build command, optional pre-deploy command, and start command for web services. Render's default web service port is `10000`, or you can set `PORT`.

## API

Root directory:

```bash
apps/api
```

Build command:

```bash
npm install --production=false && npm run build
```

Pre-deploy command:

```bash
npx prisma migrate deploy --schema=./prisma/schema.prisma
```

Start command:

```bash
npm run start
```

Required environment variables:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
PAYSTACK_SECRET_KEY=...
CRON_SECRET=generate-a-long-random-value
NODE_ENV=production
PORT=10000
```

If you do not have migrations yet, create them locally first:

```bash
cd apps/api
npx prisma migrate dev --name add_withdrawals_investment_cancellations
```

## Admin Frontend

Root directory:

```bash
apps/landing
```

Build command:

```bash
npm install --production=false && npm run build
```

Start command:

```bash
npm run start
```

Environment variables:

```bash
NEXT_PUBLIC_API_URL=https://your-api.onrender.com/api/v1
NODE_ENV=production
```

## Member Frontend

Root directory:

```bash
apps/member
```

Build command:

```bash
npm install --production=false && npm run build
```

Start command:

```bash
npm run start
```

Environment variables:

```bash
NEXT_PUBLIC_API_URL=https://your-api.onrender.com/api/v1
NODE_ENV=production
```

## Cron Job

Render Cron Jobs run commands on a UTC schedule. The command must exit after it finishes.

Create a Render Cron Job with this command:

```bash
curl -fsS -H "x-cron-secret: $CRON_SECRET" "https://your-api.onrender.com/api/v1/cron/weekly-deductions"
```

Suggested schedule:

```bash
0 6 * * MON
```

This checks every Monday at 06:00 UTC. The app still validates the configured deduction day, amount, enabled flag, and last-run stamp.

Cron job environment variables:

```bash
CRON_SECRET=same-value-used-by-api
```

## Local Testing

Start the API locally, then call:

```bash
curl -fsS -H "x-cron-secret: your-secret" "http://localhost:5000/api/v1/cron/weekly-deductions?force=true"
```

Manual admin action:

```bash
POST /api/v1/config/actions/weekly-deductions/run
Authorization: Bearer <admin-token>
Content-Type: application/json

{"force":true}
```

## Verification

After deployment:

- Open `/api/v1/health`.
- Open admin Settings and confirm deduction rows exist.
- Trigger the cron job manually from Render.
- Confirm `COOPERATIVE_DEDUCTION_LAST_STATUS` changes.
- Confirm `COOPERATIVE_DEDUCTION_LAST_RUN` is set after a successful run.
- Check Render service logs for cron HTTP status and API logs.

## Troubleshooting

- Build fails: verify Node/Bun version and install command.
- Prisma errors: ensure `DATABASE_URL` exists at build/pre-deploy/runtime.
- Tables missing: run `prisma migrate deploy` in the pre-deploy command.
- Cron returns 401: `CRON_SECRET` does not match between cron job and API.
- Cron returns 404: redeploy the API and confirm the route is `/api/v1/cron/weekly-deductions`.
- Frontend cannot reach API: check `NEXT_PUBLIC_API_URL` and CORS settings.
