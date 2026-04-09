# ADR-001: Monorepo Platform

## Status

Accepted

## Decision

Use a `pnpm` + Turborepo monorepo with four apps and shared packages for UI, types, utilities, config, and API client generation.

## Rationale

- Shared contracts reduce drift between landing, member, admin, and API layers.
- Agents can navigate one workspace with explicit package boundaries.
- Future CI, caching, and deployment workflows stay consistent.
