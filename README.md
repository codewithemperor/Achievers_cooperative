# Achievers Cooperative

Achievers Cooperative is a Turborepo monorepo for a cooperative management platform built around four applications:

- `apps/landing`: public marketing and acquisition site
- `apps/member-pwa`: member-facing progressive web app
- `apps/admin-web`: administrative operations portal
- `apps/api`: NestJS backend and Prisma data layer

## Workspace packages

- `packages/ui`: HeroUI-based design system wrappers and shared presentation components
- `packages/types`: domain contracts and shared TypeScript models
- `packages/api-client`: generated API client placeholder and shared API surface
- `packages/config`: shared TypeScript, lint, formatting, and environment guidance
- `packages/utils`: cross-app utility functions

## Getting started

1. Install dependencies:

```bash
pnpm install
```

2. Start the focused app you want:

```bash
pnpm dev:landing
pnpm dev:member
pnpm dev:admin
pnpm dev:api
```

3. Run the whole workspace in parallel:

```bash
pnpm dev
```

## Architecture defaults

- Next.js App Router for all web-facing apps
- HeroUI + Tailwind CSS for UI
- NestJS + Prisma + PostgreSQL for backend systems
- OpenAPI generated from NestJS as the single API contract source
- Internal AI tooling only in v1; no member-facing chatbot by default

## MVP focus

The MVP follows the proposal priorities:

- authentication
- member profiles and status management
- wallet funding and receipt upload
- transaction history
- loan application and review
- lightweight administrative dashboard

See [docs/architecture/overview.md](/C:/Users/YUSUF/Desktop/Repository/Repository/Achievers_cooperative/docs/architecture/overview.md) and [docs/product/mvp-scope.md](/C:/Users/YUSUF/Desktop/Repository/Repository/Achievers_cooperative/docs/product/mvp-scope.md) for implementation detail.
