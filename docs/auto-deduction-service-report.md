# Auto Deduction Services

This document separates the two automatic money movements in the system:

- Weekly cooperative deductions: a scheduled cooperative charge against every active member.
- Automatic settlement: wallet-credit logic that applies available money to outstanding obligations.

## Weekly Cooperative Deduction

The weekly deduction service lives in `apps/api/src/common/services/weekly-deductions.service.ts`.

It reads these `SystemConfig` keys:

- `COOPERATIVE_DEDUCTION_ENABLED`
- `COOPERATIVE_DEDUCTION_DAY`
- `COOPERATIVE_DEDUCTION_AMOUNT`
- `COOPERATIVE_DEDUCTION_LAST_RUN`
- `COOPERATIVE_DEDUCTION_LAST_STATUS`
- `COOPERATIVE_DEDUCTION_LAST_ERROR`
- `COOPERATIVE_DEDUCTION_LAST_CHECKED_AT`

Default behavior:

- Enabled by default.
- Scheduled day defaults to `MONDAY`.
- Deduction amount defaults to `1000`.
- Day matching uses UTC weekday names.
- The service can run at most once per UTC day unless called with force mode.

When the service runs, it loads all members with `status = ACTIVE`, creates or loads each member wallet, and debits the configured amount using `WalletService.debitWallet`.

Each generated transaction uses:

- `type = WEEKLY_COOPERATIVE`
- `status = APPROVED` when the wallet had enough balance
- `status = PENDING` when the debit makes the wallet negative
- `editable = false`
- `reference = WEEKLY-{UTC_DAY_STAMP}-{memberId}`
- `lockReason = Weekly cooperative deductions are generated automatically by the system.`

Insufficient balance is allowed for this specific deduction. The wallet can go negative, and `pendingBalance` records the outstanding amount.

## What Triggers Weekly Deduction

There are three supported triggers:

- Cron endpoint: `GET /api/v1/cron/weekly-deductions` or `POST /api/v1/cron/weekly-deductions`
- Admin action: `POST /api/v1/config/actions/weekly-deductions/run`
- Lazy request middleware: `WeeklyDeductionRequestMiddleware`

The cron endpoint requires `x-cron-secret` or `?secret=` matching `CRON_SECRET`.

Admin can run the service in two modes:

- Run if due: only deducts when today matches `COOPERATIVE_DEDUCTION_DAY`.
- Force run: bypasses the weekday check, while still relying on daily run tracking and per-member references for duplicate protection.

## Automatic Settlement

Automatic settlement is different from weekly deduction. It does not run on a weekly schedule.

It is triggered after wallet credits, inside `WalletService.creditWallet`, through `settleOutstandingObligations(memberId)`.

Settlement order:

1. Pending weekly cooperative deductions.
2. Due package penalties and repayments.
3. Active loan repayments.
4. Pending savings contributions.

Settlement only spends positive available wallet balance. It does not force a negative balance for loans, packages, or savings.

Generated automatic settlement transactions use categories/descriptions such as:

- `automatic loan repayment`
- `automatic package repayment`
- `automatic package penalty settlement`
- `automatic savings contribution`

These transactions include metadata such as `autoSettled: true` and the target loan, package subscription, or savings account id.

## Package Timing

Packages are currently configured with weekly repayment frequency in `apps/api/src/modules/packages/packages.service.ts`.

Due package repayment is calculated from the package/subscription schedule. Automatic settlement checks what is due when money enters the member wallet; it does not independently wake up every week to collect package repayments from an empty wallet.

## Loan Timing

Loans are settled from available wallet funds after credits. Active loan statuses include:

- `DISBURSED`
- `IN_PROGRESS`
- `OVERDUE`

The settlement flow applies available balance to loans with remaining balance. It does not create a scheduled negative debit for loans.

## Savings Timing

Savings settlement applies available wallet funds to pending savings contributions. Like loans and packages, it runs after wallet credits and does not create a weekly negative debit by itself.

## Important Distinction

Only the cooperative weekly deduction is a scheduled auto-deduct service that can push wallets negative.

Loans, packages, and savings are automatic settlements. They apply money when a member wallet has available funds, usually after a funding/payment credit is approved.

## Operational Notes

- Render Cron should call `/api/v1/cron/weekly-deductions` with the cron secret.
- The admin Settings page can run the weekly deduction manually.
- Last run status and errors are stored in `SystemConfig`.
- `COOPERATIVE_DEDUCTION_LAST_CHECKED_AT` records the latest schedule check.
- `COOPERATIVE_DEDUCTION_LAST_RUN` records the last successful deduction day.

## Known Risks

- Schedule evaluation uses UTC, which may differ from the cooperative's local business day.
- The in-memory `runInFlight` guard only protects one API process.
- A multi-instance deployment can still race without a database-level lock.
- If a process crashes mid-run, already-created member references prevent exact duplicate member charges, but the run may need review.
- Admin-visible run history would make operations clearer than storing only the latest status/error.

