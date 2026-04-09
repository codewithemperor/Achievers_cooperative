# Local Setup Runbook

## Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL database for `apps/api`

## First run

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Notes

- The current scaffold is dependency-ready but may require `pnpm install` before any app can run.
- Add stable local credentials and seed data before end-to-end testing.
