# API Notes

- OpenAPI emitted from NestJS is the source of truth for frontend consumption.
- Keep domains separated by module: auth, members, wallets, transactions, savings, loans, investments, notifications, audit, reports, system-config.
- Prefer DTOs and controllers that reflect cooperative language directly.
