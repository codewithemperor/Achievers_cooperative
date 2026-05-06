# Auto Deduction Service Report

## How it works

The service is implemented in `apps/api/src/common/services/weekly-deductions.service.ts`.
It stores schedule settings in `SystemConfig`:

- `COOPERATIVE_DEDUCTION_DAY`
- `COOPERATIVE_DEDUCTION_AMOUNT`
- `COOPERATIVE_DEDUCTION_LAST_RUN`

When due, it loads all `Member` rows with `status = ACTIVE` and debits each member wallet by the configured weekly cooperative amount using `WalletService.debitWallet`. The debit creates a `Transaction` with:

- `type = WEEKLY_COOPERATIVE`
- `reference = WEEKLY-{UTC_DAY_STAMP}-{memberId}`
- `editable = false`
- metadata containing `deductionDate`, `memberName`, and trigger source

The debit allows negative balances. If a member does not have enough wallet balance, the transaction is left `PENDING`, the wallet can go negative, and `pendingBalance` records the outstanding amount.

Separately, every wallet credit calls `WalletService.settleOutstandingObligations`. That settlement flow attempts to apply available wallet balance to due package payments, active loan repayments, and pending savings transactions.

## When it runs

The schedule is day-based, using UTC day names. The default day is `MONDAY` and the default amount is `1000`.

Previously there was no fixed clock time because the middleware called `runIfDue()` during normal API requests. This has been replaced with a real cron endpoint: `/api/v1/cron/weekly-deductions`.

## How often it runs

At most once per UTC day. The service writes the UTC start-of-day timestamp into `COOPERATIVE_DEDUCTION_LAST_RUN` and skips later attempts with `already-ran-today`.

## What triggers it

Render Cron should trigger `/api/v1/cron/weekly-deductions` with `x-cron-secret`. Admins can also trigger `/api/v1/config/actions/weekly-deductions/run`.

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

## Payment Coverage

- Weekly savings/payment check: the scheduled job itself only creates `WEEKLY_COOPERATIVE` deductions.
- Loan due dates: handled by wallet settlement logic after wallet credits, using active loan statuses `DISBURSED`, `IN_PROGRESS`, and `OVERDUE`.
- Package due dates: handled by wallet settlement logic after wallet credits, using active package statuses `APPROVED`, `DISBURSED`, and `IN_PROGRESS`.
- Overdue repayments: loan overdue status is updated by loan listing logic; package due detection uses `nextDueAt` and accrued penalties.
- Active loans only: settlement only targets active loans with remaining balance.
- Active packages only: settlement only targets active package subscriptions with remaining/penalty balances.
- No due payments: the scheduled job records/skips based on day/amount/last-run; settlement returns no settlements when nothing is due or no wallet balance is available.
- Insufficient wallet balance: scheduled deductions may create pending transactions and negative wallet balance; normal settlement only spends available positive wallet balance.
- Failure: status/error are recorded in `SystemConfig` under `COOPERATIVE_DEDUCTION_LAST_STATUS` and `COOPERATIVE_DEDUCTION_LAST_ERROR`.

## Risks and edge cases

- The run uses UTC day names, which may not match the cooperative's local business day.
- Because it is request-triggered, deductions do not run until someone hits the API on the scheduled day.
- The middleware waits for the deduction check before calling `next()`, so the first request on deduction day can be slow.
- In-memory `runInFlight` only protects one Node process. Multiple deployed instances can still race.
- `LAST_RUN_KEY` is written after the loop. If the process crashes midway, some members may be processed and the run can continue later because each member reference is unique.
- The service silently suppresses middleware errors, so failed auto deductions may not be visible to API callers.

## Bugs and improvements

- The Settings page was showing `--` because `COOPERATIVE_DEDUCTION_LAST_RUN` defaults to an empty string until the first successful run, and the UI only displayed `updatedAt` when `value` was truthy. This made a valid default row look missing.
- The previous settings payload did not expose an enabled/disabled flag, last run status, or last error.
- Failed lazy runs were swallowed by middleware without a persisted failure status.
- Fixed now: defaults include `COOPERATIVE_DEDUCTION_ENABLED`, `COOPERATIVE_DEDUCTION_LAST_STATUS`, and `COOPERATIVE_DEDUCTION_LAST_ERROR`.
- Fixed now: Settings always shows `updatedAt`, shows `Never` for an empty last-run value, and exposes enabled/status/error fields.
- Fixed now: the deduction service records statuses such as `SUCCESS`, `DISABLED`, `WAITING_FOR_SCHEDULED_DAY`, `ALREADY_RAN_TODAY`, and `FAILED`.
- Fixed now: admins can run the service from Settings with either normal schedule validation or force mode.
- Still recommended: replace lazy middleware triggering with a real scheduled job or platform cron.
- Store and evaluate the schedule in the cooperative's configured timezone.
- Use a database-level run lock or transactional advisory lock to protect multi-instance deployments.
- Move the middleware `next()` call before the deduction work, or run the job out of band, to keep normal API requests fast.
- Add admin-visible run history and failed-run alerts.
- Add tests for idempotency, negative-balance handling, and crash recovery.
