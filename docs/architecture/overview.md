# Architecture Overview

## Apps

- `apps/landing`: public acquisition and trust-building site
- `apps/member-pwa`: installable member-facing product
- `apps/admin-web`: administrative operations portal
- `apps/api`: NestJS backend and Prisma schema

## Shared packages

- `packages/ui`: HeroUI-based wrappers and cooperative design primitives
- `packages/types`: domain contracts shared across apps
- `packages/api-client`: placeholder for generated client from OpenAPI
- `packages/utils`: shared helpers and formatting utilities
- `packages/config`: shared TypeScript config presets

## Integration model

- All product apps consume the NestJS backend through versioned endpoints under `/api/v1`.
- The member app is the only PWA in v1.
- The admin app remains a standard web app optimized for desktop workflows.
- The landing site is deliberately separate from authenticated products so content strategy and product velocity can evolve independently.
