# Agent Working Agreement

This repo is optimized for AI-assisted development. Follow these rules to keep changes predictable and easy to hand off.

## Repo map

- `apps/landing`: trust-first public experience
- `apps/member-pwa`: member workflows and installable experience
- `apps/admin-web`: cooperative operations workflows
- `apps/api`: backend modules, OpenAPI, Prisma schema
- `packages/ui`: shared components and theme tokens
- `packages/types`: shared business contracts
- `packages/api-client`: generated or generated-like API surface
- `docs/*`: source-of-truth architecture and product notes

## Development expectations

- Treat `apps/api` OpenAPI output as the API source of truth.
- Prefer adding or updating shared components in `packages/ui` before duplicating presentation logic inside apps.
- Keep domain language aligned with the proposal: members, wallets, savings, loans, investments, audit, notifications.
- Preserve the split between member-facing and admin-facing concerns.
- Write docs whenever you introduce a new module boundary or architectural decision.

## Handoff checklist

- Update affected docs under `docs/`
- Keep routes and module names explicit
- Avoid hidden build steps
- Use stable test users and seeded data for repeatable verification
