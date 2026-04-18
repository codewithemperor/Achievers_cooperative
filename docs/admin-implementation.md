# Admin Implementation Notes

Date: 2026-04-17

## Summary

The admin experience defined in the cooperative technical specification now has a primary implementation path under `apps/landing/src/app/admin` instead of relying on the separate `apps/admin-web` app.

## What Was Added

- Protected admin routing under `apps/landing/src/app/admin/(protected)`
- Admin login flow at `apps/landing/src/app/admin/auth/login/page.tsx`
- Session persistence utilities in `apps/landing/src/lib/session.ts`
- Central API client in `apps/landing/src/lib/api.ts`
- Reusable admin UI primitives in `apps/landing/src/components/ui`
- Landing-aware admin chrome isolation via `src/components/layout/AppChrome.tsx`

## Backend Coverage Added

- `config` route alias on top of the existing system-config module
- Cooperative wallet summary and entries endpoints
- Payments review and approval endpoints
- Packages, subscriptions, and defaulters endpoints
- Prisma models to support payments, packages, and cooperative wallet tracking

## Local Follow-Up

Because package installation and verification commands were intentionally deferred, run the normal local flow after pulling these changes into your environment:

1. Install dependencies for the workspace.
2. Regenerate Prisma client after the schema changes.
3. Run your migration workflow for the updated Prisma schema.
4. Seed the database again.
5. Run typecheck/build for `apps/api` and `apps/landing`.

## Important Note

`apps/admin-web` still exists in the repository and may contain active user edits. The landing-admin implementation was added without overwriting that work so the repo can transition safely.
