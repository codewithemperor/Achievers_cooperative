# API Contract Strategy

- NestJS generates the OpenAPI document.
- `packages/api-client` will be replaced with generated code after the first stable backend contract export.
- Frontend apps should prefer generated clients or explicit shared query wrappers over handwritten endpoint strings.
- DTO ownership stays in `apps/api`; shared business types stay in `packages/types` when they are domain-level rather than transport-specific.
