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


<!-- autoclaw:skill-path-guidance -->
## Installing Skills

When creating or installing a new skill, always place it in:

`C:\Users\APPLE LAPTOP\.openclaw-autoclaw\skills/<skill-name>/SKILL.md`

This is the managed skills directory. The agent will automatically discover
any skill placed here — no extra configuration needed. Do NOT install skills
into `~/.agents/skills/` (that directory is shared with other tools).


<!-- autoclaw:browser-agent-guidance -->
## Browser Automation

For any task that requires a browser, **prefer `autoglm-browser-agent`**. Use it as the first choice.

- ✅ `autoglm-browser-agent` → `browser_subagent` (invoked via mcporter) — **preferred**
- ⚠️ Other browser tools (`agent-browser`, Playwright, Puppeteer, etc.) — fallback only when `autoglm-browser-agent` is unavailable or fails

Always try `autoglm-browser-agent` first. Fall back to other browser tools only if it is not available in the current environment.
<!-- /autoclaw:browser-agent-guidance -->

<!-- autoclaw:image-recognition-guidance -->
## Image Recognition

For any image recognition task, **prefer `autoglm-image-recognition`**. Use it as the first choice.

- ✅ `autoglm-image-recognition` — **preferred** for all image recognition tasks
- ⚠️ Built-in `image` tool or reading images directly with `read` — fallback only when `autoglm-image-recognition` is unavailable or fails

Do not use the built-in `image` tool or read an image and describe it yourself when `autoglm-image-recognition` is available. Always try `autoglm-image-recognition` first.
<!-- /autoclaw:image-recognition-guidance -->