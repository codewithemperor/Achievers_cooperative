# Auto Deduction Service

## What It Currently Does

The only real scheduled auto-deduction service currently implemented is the weekly cooperative deduction.

It does not automatically wake up to collect loan repayments, package repayments, overdue repayments, or savings contributions by due date. Those are handled by wallet settlement logic when money enters a member wallet.

## Weekly Cooperative Deduction

Service file:

`apps/api/src/common/services/weekly-deductions.service.ts`

The service reads these `SystemConfig` keys:

- `COOPERATIVE_DEDUCTION_ENABLED`
- `COOPERATIVE_DEDUCTION_DAY`
- `COOPERATIVE_DEDUCTION_AMOUNT`
- `COOPERATIVE_DEDUCTION_LAST_RUN`
- `COOPERATIVE_DEDUCTION_LAST_STATUS`
- `COOPERATIVE_DEDUCTION_LAST_ERROR`
- `COOPERATIVE_DEDUCTION_LAST_CHECKED_AT`

Defaults are created automatically if missing:

- Enabled: `true`
- Day: `MONDAY`
- Amount: `1000`
- Last status: `NEVER_RUN`

The scheduled-day check uses UTC day names.

## What Triggers It

The service can be triggered by:

- Admin manual run: `POST /api/v1/config/actions/weekly-deductions/run`
- Cron endpoint: `GET /api/v1/cron/weekly-deductions`
- Cron endpoint: `POST /api/v1/cron/weekly-deductions`
- Legacy lazy middleware: `WeeklyDeductionRequestMiddleware`

For production, the cron endpoint is the preferred trigger. The lazy middleware should not be relied on because it only runs when traffic reaches the API.

## Who It Affects

It selects members where:

`Member.status = ACTIVE`

Every active member receives one weekly cooperative deduction for the run date.

## Records It Creates

For each active member, it creates a `Transaction` with:

- `type = WEEKLY_COOPERATIVE`
- `reference = WEEKLY-{UTC_DAY_STAMP}-{memberId}`
- `category = weekly cooperative`
- `editable = false`
- `metadata.deductionDate = runStamp`
- `metadata.trigger = ADMIN | CRON | LAZY`

The reference is unique per member per UTC run day. That is the main duplicate-protection mechanism.

## Insufficient Wallet Balance

Weekly cooperative deduction passes `allowNegative: true` into `WalletService.debitWallet`.

That means:

- If the member has enough wallet balance, the deduction is approved immediately.
- If the member does not have enough wallet balance, the wallet can go negative.
- The shortage is tracked through wallet pending balance.

This behavior is only for weekly cooperative deduction. Loan, package, and savings settlements do not force wallets negative.

## Loan, Package, And Savings Behavior

Loans, packages, and savings are not scheduled auto-deductions today.

They are automatic settlements triggered by wallet-credit flows in `WalletService.creditWallet`.

When wallet money becomes available, the service attempts to settle:

1. Pending weekly cooperative deductions.
2. Due package penalties and repayments.
3. Active loan repayments.
4. Pending savings contributions.

This means due loans/packages are not collected by an independent cron job. They are settled when the member wallet receives available funds.

## Tables Read

- `SystemConfig`
- `User`
- `Member`
- `Wallet`
- `Transaction`
- Package, loan, and savings tables are read by settlement logic after wallet credits, not by the weekly deduction scheduler itself.

## Tables Written

- `SystemConfig`
- `Wallet`
- `Transaction`
- `AuditEvent`
- Package, loan, and savings records may be updated by wallet settlement flows after credits.

## Failure And Status Tracking

The service writes status into:

- `COOPERATIVE_DEDUCTION_LAST_STATUS`
- `COOPERATIVE_DEDUCTION_LAST_ERROR`
- `COOPERATIVE_DEDUCTION_LAST_CHECKED_AT`
- `COOPERATIVE_DEDUCTION_LAST_RUN`

Common statuses include:

- `SUCCESS`
- `DISABLED`
- `WAITING_FOR_SCHEDULED_DAY`
- `ALREADY_RAN_TODAY`
- `FAILED`
- `FAILED_NO_ADMIN_ACTOR`
- `FAILED_AMOUNT_NOT_CONFIGURED`

## Main Risks

- The schedule uses UTC, which may differ from Nigeria local business time.
- The in-memory `runInFlight` lock only protects one running API process.
- Multiple deployed API instances can still race. Unique transaction references reduce duplicate member charges, but there is no database-level job lock yet.
- The legacy lazy middleware can create confusion because it depends on incoming traffic.
- There is no full run-history table yet, only latest status/config keys.

## Recommended Next Improvement

Add an `AutoDeductionRun` table to record every run, including start time, finish time, trigger, processed count, skipped count, failed count, and error details. This would make admin debugging much clearer than relying only on the latest `SystemConfig` values.
