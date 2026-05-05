# Auto Deduction Service Report

## How it works

The service is implemented in `apps/api/src/common/services/weekly-deductions.service.ts`.
It stores schedule settings in `SystemConfig`:

- `COOPERATIVE_DEDUCTION_DAY`
- `COOPERATIVE_DEDUCTION_AMOUNT`
- `COOPERATIVE_DEDUCTION_LAST_RUN`

When due, it loads all `Member` rows with `status = ACTIVE` and debits each member wallet by the configured amount using `WalletService.debitWallet`. The debit creates a `Transaction` with:

- `type = WEEKLY_COOPERATIVE`
- `reference = WEEKLY-{UTC_DAY_STAMP}-{memberId}`
- `editable = false`
- metadata containing `deductionDate`, `memberName`, and trigger source

The debit allows negative balances. If a member does not have enough wallet balance, the transaction is left `PENDING`, the wallet can go negative, and `pendingBalance` records the outstanding amount.

## When it runs

The schedule is day-based, using UTC day names. The default day is `MONDAY` and the default amount is `1000`.

There is no fixed clock time. It runs on the first API request received on the configured UTC day, because the middleware calls `runIfDue()` during request handling.

## How often it runs

At most once per UTC day. The service writes the UTC start-of-day timestamp into `COOPERATIVE_DEDUCTION_LAST_RUN` and skips later attempts with `already-ran-today`.

## What triggers it

`apps/api/src/common/middleware/weekly-deduction-request.middleware.ts` triggers it for API requests whose path starts with `/api/v1`, excluding API docs. The trigger is lazy/request-driven, not a real cron job.

Admins can also trigger the service through system configuration/admin flows that call `WeeklyDeductionsService.run`.

## Users and accounts affected

Only members with `Member.status = ACTIVE` are affected.

Each affected member's `Wallet` is debited. If a wallet does not exist, `WalletService.getMemberWallet` creates one before debiting.

## Database reads and writes

Reads:

- `SystemConfig` for deduction day, amount, and last run
- `User` to find a `SUPER_ADMIN` actor for lazy runs
- `Member` for active members
- `Wallet` for each member wallet
- `Transaction` to check the per-member weekly reference

Writes:

- `SystemConfig` updates `COOPERATIVE_DEDUCTION_LAST_RUN`
- `Wallet` decrements `availableBalance` and updates `pendingBalance`
- `Transaction` creates `WEEKLY_COOPERATIVE` rows
- `AuditEvent` records `RUN_WEEKLY_DEDUCTIONS`

## Risks and edge cases

- The run uses UTC day names, which may not match the cooperative's local business day.
- Because it is request-triggered, deductions do not run until someone hits the API on the scheduled day.
- The middleware waits for the deduction check before calling `next()`, so the first request on deduction day can be slow.
- In-memory `runInFlight` only protects one Node process. Multiple deployed instances can still race.
- `LAST_RUN_KEY` is written after the loop. If the process crashes midway, some members may be processed and the run can continue later because each member reference is unique.
- The service silently suppresses middleware errors, so failed auto deductions may not be visible to API callers.

## Bugs and improvements

- Replace lazy middleware triggering with a real scheduled job or platform cron.
- Store and evaluate the schedule in the cooperative's configured timezone.
- Use a database-level run lock or transactional advisory lock to protect multi-instance deployments.
- Move the middleware `next()` call before the deduction work, or run the job out of band, to keep normal API requests fast.
- Add admin-visible run history and failed-run alerts.
- Add tests for idempotency, negative-balance handling, and crash recovery.
