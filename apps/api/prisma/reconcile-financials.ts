// @ts-nocheck
import { prisma } from "../prisma";

type BalanceSummary = {
  physicalTreasuryCash: number;
  memberWalletLiability: number;
  associationAvailableBalance: number;
  totalIncome: number;
  totalExpense: number;
};

const APPLY = process.argv.includes("--apply");
const DRY_RUN = process.argv.includes("--dry-run") || !APPLY;

const ASSOCIATION_INCOME_TYPES = new Set([
  "SAVINGS",
  "LOAN_REPAYMENT",
  "PACKAGE_SUBSCRIPTION",
  "PACKAGE_PENALTY",
  "MEMBERSHIP_CHARGE",
  "MEMBERSHIP_FEE",
  "WEEKLY_COOPERATIVE",
  "INVESTMENT",
  "INVESTMENT_DEPOSIT",
]);

const ASSOCIATION_TO_WALLET_TYPES = new Set([
  "ADMIN_REFUND",
  "INVESTMENT_RETURN",
  "INVESTMENT_CANCELLATION_REFUND",
]);

function money(value: unknown) {
  return Number(value ?? 0);
}

function normalize(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isOpeningTransaction(tx: any) {
  const reference = String(tx.reference ?? "");
  const category = String(tx.category ?? "");
  const description = String(tx.description ?? "");
  return (
    reference.startsWith("OPENING-") ||
    category.toLowerCase().startsWith("opening") ||
    description.toLowerCase().startsWith("opening")
  );
}

function isDifferent(a: number, b: number) {
  return Math.abs(a - b) >= 0.01;
}

function addBalance(balance: BalanceSummary, delta: Partial<BalanceSummary>) {
  balance.physicalTreasuryCash += delta.physicalTreasuryCash ?? 0;
  balance.memberWalletLiability += delta.memberWalletLiability ?? 0;
  balance.associationAvailableBalance += delta.associationAvailableBalance ?? 0;
  balance.totalIncome += delta.totalIncome ?? 0;
  balance.totalExpense += delta.totalExpense ?? 0;
}

function lineDirectionForDelta(account: string, delta: number) {
  if (account === "PHYSICAL_TREASURY_CASH") {
    return delta >= 0 ? "DEBIT" : "CREDIT";
  }
  return delta >= 0 ? "CREDIT" : "DEBIT";
}

function reconciliationReference() {
  const now = new Date();
  const compact = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `RECONCILIATION-${compact}`;
}

function describeTx(tx: any) {
  const resolvedAmount = resolvedTransactionAmount(tx);
  const mismatch =
    tx.__ledgerAmount !== null &&
    tx.__ledgerAmount !== undefined &&
    isDifferent(money(tx.amount), tx.__ledgerAmount);
  const amountNote = mismatch
    ? `${resolvedAmount.toLocaleString()} ledger, tx=${money(tx.amount).toLocaleString()}`
    : resolvedAmount.toLocaleString();
  return `${tx.type} ${tx.reference ?? tx.id} ${amountNote} ${tx.description ?? ""}`.trim();
}

function buildLedgerByTransactionId(ledgerEntries: any[]) {
  return new Map(
    ledgerEntries
      .filter((entry) => entry.sourceId)
      .map((entry) => [entry.sourceId, entry]),
  );
}

function ledgerLineAmount(entry: any, candidates: Array<{ account: string; direction: string }>) {
  if (!entry) return null;
  for (const candidate of candidates) {
    const line = (entry.lines ?? []).find(
      (item: any) => item.account === candidate.account && item.direction === candidate.direction,
    );
    if (line) return money(line.amount);
  }
  return null;
}

function ledgerAmountForTransaction(tx: any, ledgerEntry: any) {
  if (!ledgerEntry) return null;

  if (["FUNDING", "WALLET_FUNDING"].includes(tx.type)) {
    return ledgerLineAmount(ledgerEntry, [
      { account: "PHYSICAL_TREASURY_CASH", direction: "DEBIT" },
      { account: "MEMBER_WALLET_LIABILITY", direction: "CREDIT" },
    ]);
  }

  if (tx.type === "WALLET_WITHDRAWAL") {
    return ledgerLineAmount(ledgerEntry, [
      { account: "PHYSICAL_TREASURY_CASH", direction: "CREDIT" },
      { account: "MEMBER_WALLET_LIABILITY", direction: "DEBIT" },
    ]);
  }

  if (tx.type === "LOAN_DISBURSEMENT") {
    return ledgerLineAmount(ledgerEntry, [
      { account: "ASSOCIATION_AVAILABLE", direction: "DEBIT" },
      { account: "PHYSICAL_TREASURY_CASH", direction: "CREDIT" },
    ]);
  }

  if (ASSOCIATION_INCOME_TYPES.has(tx.type)) {
    return ledgerLineAmount(ledgerEntry, [
      { account: "ASSOCIATION_AVAILABLE", direction: "CREDIT" },
      { account: "MEMBER_WALLET_LIABILITY", direction: "DEBIT" },
      { account: "PHYSICAL_TREASURY_CASH", direction: "DEBIT" },
    ]);
  }

  if (ASSOCIATION_TO_WALLET_TYPES.has(tx.type)) {
    return ledgerLineAmount(ledgerEntry, [
      { account: "ASSOCIATION_AVAILABLE", direction: "DEBIT" },
      { account: "MEMBER_WALLET_LIABILITY", direction: "CREDIT" },
    ]);
  }

  return null;
}

function resolveTransactionAmount(tx: any, ledgerByTransactionId: Map<string, any>) {
  const ledgerEntry = ledgerByTransactionId.get(tx.id) ?? null;
  const ledgerAmount = ledgerAmountForTransaction(tx, ledgerEntry);
  tx.__ledgerEntry = ledgerEntry;
  tx.__ledgerAmount = ledgerAmount;
  tx.__resolvedAmount = ledgerAmount ?? money(tx.amount);
  tx.__amountSource = ledgerAmount === null || ledgerAmount === undefined ? "transaction" : "ledger";
  tx.__amountMismatch =
    ledgerAmount !== null &&
    ledgerAmount !== undefined &&
    isDifferent(money(tx.amount), ledgerAmount);
  return tx.__resolvedAmount;
}

function resolvedTransactionAmount(tx: any) {
  return money(tx.__resolvedAmount ?? tx.amount);
}

function ledgerSignedDelta(line: any) {
  const amount = money(line.amount);
  if (line.account === "PHYSICAL_TREASURY_CASH") {
    return line.direction === "DEBIT" ? amount : -amount;
  }
  return line.direction === "CREDIT" ? amount : -amount;
}

function applyLedgerBalanceLines(balance: BalanceSummary, entry: any) {
  const delta: Partial<BalanceSummary> = {};
  for (const line of entry?.lines ?? []) {
    const signedAmount = ledgerSignedDelta(line);
    if (line.account === "PHYSICAL_TREASURY_CASH") {
      delta.physicalTreasuryCash = (delta.physicalTreasuryCash ?? 0) + signedAmount;
    }
    if (line.account === "MEMBER_WALLET_LIABILITY") {
      delta.memberWalletLiability = (delta.memberWalletLiability ?? 0) + signedAmount;
    }
    if (line.account === "ASSOCIATION_AVAILABLE") {
      delta.associationAvailableBalance = (delta.associationAvailableBalance ?? 0) + signedAmount;
    }
  }
  addBalance(balance, delta);
}

function addTransactionFlowTotals(balance: BalanceSummary, tx: any, amount: number) {
  if (tx.type === "LOAN_DISBURSEMENT" || ASSOCIATION_TO_WALLET_TYPES.has(tx.type)) {
    addBalance(balance, { totalExpense: amount });
    return;
  }

  if (ASSOCIATION_INCOME_TYPES.has(tx.type)) {
    addBalance(balance, { totalIncome: amount });
  }
}

function mapTransactionToLoan(tx: any, loansById: Map<string, any>, loansByMemberId: Map<string, any[]>) {
  const metadata = (tx.metadata ?? {}) as Record<string, any>;
  const metadataLoanId = String(metadata.loanId ?? "");
  if (metadataLoanId && loansById.has(metadataLoanId)) {
    return { loan: loansById.get(metadataLoanId), method: "metadata.loanId" };
  }

  const text = normalize(`${tx.reference ?? ""} ${tx.description ?? ""}`);
  for (const loan of loansById.values()) {
    if (text.includes(normalize(loan.id))) {
      return { loan, method: "reference/description loan id" };
    }
  }

  const metadataMemberId = String(metadata.memberId ?? "");
  const walletMemberId = tx.wallet?.memberId ?? tx.wallet?.member?.id ?? "";
  const candidateMemberId = metadataMemberId || walletMemberId;
  const candidates = candidateMemberId ? loansByMemberId.get(candidateMemberId) ?? [] : [];

  if (candidates.length === 1) {
    return { loan: candidates[0], method: metadataMemberId ? "metadata.memberId single loan" : "wallet member single loan" };
  }

  const purposeMatches = candidates.filter((loan) => text.includes(normalize(loan.purpose)));
  if (purposeMatches.length === 1) {
    return { loan: purposeMatches[0], method: "description purpose" };
  }

  return { loan: null, method: "unmapped" };
}

async function loadData() {
  const [loans, transactions, cooperativeWallet, cooperativeEntries, ledgerEntries] = await Promise.all([
    prisma.loanApplication.findMany({
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            membershipNumber: true,
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: { status: "APPROVED" },
      include: {
        wallet: {
          include: {
            member: {
              select: {
                id: true,
                fullName: true,
                membershipNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cooperativeWallet.findFirst(),
    prisma.cooperativeEntry.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.financialLedgerEntry.findMany({
      where: { sourceType: "Transaction" },
      include: {
        lines: {
          include: {
            member: {
              select: {
                fullName: true,
                membershipNumber: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return { loans, transactions, cooperativeWallet, cooperativeEntries, ledgerEntries };
}

function buildLoanReconciliation(loans: any[], transactions: any[], ledgerEntries: any[]) {
  const loansById = new Map(loans.map((loan) => [loan.id, loan]));
  const loansByMemberId = new Map<string, any[]>();
  const ledgerByTransactionId = buildLedgerByTransactionId(ledgerEntries);
  const states = new Map<string, any>();
  const unmappedLoanTransactions: any[] = [];
  const transactionAmountCorrections = new Map<string, any>();

  for (const loan of loans) {
    const rows = loansByMemberId.get(loan.memberId) ?? [];
    rows.push(loan);
    loansByMemberId.set(loan.memberId, rows);
    states.set(loan.id, {
      loan,
      openingDisbursement: 0,
      laterDisbursement: 0,
      openingRepayment: 0,
      laterRepayment: 0,
      transactions: [],
      mappingMethods: new Set<string>(),
    });
  }

  for (const tx of transactions.filter((item) => ["LOAN_DISBURSEMENT", "LOAN_REPAYMENT"].includes(item.type))) {
    const mapped = mapTransactionToLoan(tx, loansById, loansByMemberId);
    if (!mapped.loan) {
      unmappedLoanTransactions.push(tx);
      continue;
    }

    const state = states.get(mapped.loan.id);
    const amount = resolveTransactionAmount(tx, ledgerByTransactionId);
    const opening = isOpeningTransaction(tx);
    state.transactions.push(tx);
    state.mappingMethods.add(mapped.method);
    if (!opening && tx.__amountMismatch) {
      transactionAmountCorrections.set(tx.id, {
        transactionId: tx.id,
        reference: tx.reference,
        type: tx.type,
        previousAmount: money(tx.amount),
        correctedAmount: amount,
        ledgerEntryId: tx.__ledgerEntry?.id,
        metadata: tx.metadata,
        memberName: mapped.loan.member.fullName,
        loanId: mapped.loan.id,
      });
    }

    if (tx.type === "LOAN_DISBURSEMENT") {
      if (opening) state.openingDisbursement += amount;
      else state.laterDisbursement += amount;
    }

    if (tx.type === "LOAN_REPAYMENT") {
      if (opening) state.openingRepayment += amount;
      else state.laterRepayment += amount;
    }
  }

  const loanReports = [];
  for (const state of states.values()) {
    const loan = state.loan;
    const hasAnyLoanTransaction = state.transactions.length > 0;
    if (!hasAnyLoanTransaction && money(loan.disbursedAmount) > 0) {
      unmappedLoanTransactions.push({
        id: `missing-disbursement-${loan.id}`,
        type: "LOAN_DISBURSEMENT",
        amount: loan.disbursedAmount,
        reference: null,
        description: `Existing disbursed loan has no approved loan disbursement transaction: ${loan.member.fullName}`,
        loanId: loan.id,
      });
      continue;
    }

    const calculatedDisbursed = state.openingDisbursement + state.laterDisbursement;
    const calculatedPaid = state.openingRepayment + state.laterRepayment;
    const calculatedRemaining = Math.max(calculatedDisbursed - calculatedPaid, 0);
    const currentAmount = money(loan.amount);
    const calculatedAmount = Math.max(currentAmount, calculatedDisbursed);
    const calculatedStatus =
      calculatedDisbursed <= 0
        ? loan.status
        : calculatedRemaining <= 0
          ? "COMPLETED"
          : loan.status === "OVERDUE"
            ? "OVERDUE"
            : "IN_PROGRESS";

    const current = {
      amount: currentAmount,
      disbursedAmount: money(loan.disbursedAmount),
      paid: Math.max(money(loan.disbursedAmount) - money(loan.remainingBalance), 0),
      remainingBalance: money(loan.remainingBalance),
      status: loan.status,
    };

    const calculated = {
      amount: calculatedAmount,
      disbursedAmount: calculatedDisbursed,
      paid: calculatedPaid,
      remainingBalance: calculatedRemaining,
      status: calculatedStatus,
    };

    const changed =
      isDifferent(current.amount, calculated.amount) ||
      isDifferent(current.disbursedAmount, calculated.disbursedAmount) ||
      isDifferent(current.remainingBalance, calculated.remainingBalance) ||
      current.status !== calculated.status;

    if (hasAnyLoanTransaction || changed) {
      loanReports.push({
        loan,
        current,
        calculated,
        changed,
        transactionCount: state.transactions.length,
        mappingMethods: Array.from(state.mappingMethods),
        transactions: state.transactions,
      });
    }
  }

  return { loanReports, unmappedLoanTransactions, transactionAmountCorrections: Array.from(transactionAmountCorrections.values()) };
}

function buildTreasuryReconciliation(transactions: any[], cooperativeEntries: any[], ledgerEntries: any[]) {
  const balance: BalanceSummary = {
    physicalTreasuryCash: 0,
    memberWalletLiability: 0,
    associationAvailableBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
  };
  const unhandledTreasuryTransactions: any[] = [];
  const ledgerByTransactionId = buildLedgerByTransactionId(ledgerEntries);
  const transactionAmountCorrections = new Map<string, any>();

  for (const tx of transactions) {
    const amount = resolveTransactionAmount(tx, ledgerByTransactionId);
    const opening = isOpeningTransaction(tx);
    if (!opening && tx.__amountMismatch) {
      transactionAmountCorrections.set(tx.id, {
        transactionId: tx.id,
        reference: tx.reference,
        type: tx.type,
        previousAmount: money(tx.amount),
        correctedAmount: amount,
        ledgerEntryId: tx.__ledgerEntry?.id,
        metadata: tx.metadata,
        description: tx.description,
      });
    }

    if (tx.__ledgerEntry && !opening) {
      applyLedgerBalanceLines(balance, tx.__ledgerEntry);
      addTransactionFlowTotals(balance, tx, amount);
      continue;
    }

    if (["FUNDING", "WALLET_FUNDING"].includes(tx.type)) {
      addBalance(balance, {
        physicalTreasuryCash: amount,
        memberWalletLiability: amount,
      });
      continue;
    }

    if (tx.type === "WALLET_WITHDRAWAL") {
      addBalance(balance, {
        physicalTreasuryCash: -amount,
        memberWalletLiability: -amount,
      });
      continue;
    }

    if (tx.type === "LOAN_DISBURSEMENT") {
      addBalance(balance, {
        physicalTreasuryCash: -amount,
        associationAvailableBalance: -amount,
        totalExpense: amount,
      });
      continue;
    }

    if (ASSOCIATION_INCOME_TYPES.has(tx.type)) {
      addBalance(
        balance,
        opening
          ? {
              physicalTreasuryCash: amount,
              associationAvailableBalance: amount,
              totalIncome: amount,
            }
          : {
              memberWalletLiability: -amount,
              associationAvailableBalance: amount,
              totalIncome: amount,
            },
      );
      continue;
    }

    if (ASSOCIATION_TO_WALLET_TYPES.has(tx.type)) {
      addBalance(balance, {
        memberWalletLiability: amount,
        associationAvailableBalance: -amount,
        totalExpense: amount,
      });
      continue;
    }

    unhandledTreasuryTransactions.push(tx);
  }

  for (const entry of cooperativeEntries) {
    const amount = money(entry.amount);
    if (entry.type === "INCOME") {
      addBalance(balance, {
        physicalTreasuryCash: amount,
        associationAvailableBalance: amount,
        totalIncome: amount,
      });
    } else if (entry.type === "EXPENSE") {
      addBalance(balance, {
        physicalTreasuryCash: -amount,
        associationAvailableBalance: -amount,
        totalExpense: amount,
      });
    }
  }

  return {
    balance,
    unhandledTreasuryTransactions,
    transactionAmountCorrections: Array.from(transactionAmountCorrections.values()),
  };
}

function buildLoanRepaymentAudit(loanReports: any[], ledgerEntries: any[]) {
  const ledgerByTransactionId = new Map(
    ledgerEntries
      .filter((entry) => entry.sourceId)
      .map((entry) => [entry.sourceId, entry]),
  );
  const auditedTransactionIds = new Set<string>();
  const repayments = [];

  for (const report of loanReports) {
    for (const tx of report.transactions.filter((item) => item.type === "LOAN_REPAYMENT")) {
      auditedTransactionIds.add(tx.id);
      repayments.push({
        loan: report.loan,
        tx,
        ledger: ledgerByTransactionId.get(tx.id) ?? null,
        opening: isOpeningTransaction(tx),
      });
    }
  }

  const ledgerOnlyLoanRepayments = ledgerEntries.filter((entry) => {
    const text = normalize(`${entry.description ?? ""} ${entry.reference ?? ""}`);
    return text.includes("loanrepayment") && (!entry.sourceId || !auditedTransactionIds.has(entry.sourceId));
  });

  return { repayments, ledgerOnlyLoanRepayments };
}

function describeLedger(entry: any) {
  const lines = (entry.lines ?? [])
    .map((line) => `${line.direction} ${line.account} ${money(line.amount).toLocaleString()}${line.member ? ` (${line.member.fullName})` : ""}`)
    .join(" | ");
  return `${entry.reference ?? entry.id} sourceId=${entry.sourceId ?? "--"} ${entry.description ?? ""} ${lines}`.trim();
}

function printReport(input: {
  loanReports: any[];
  unmappedLoanTransactions: any[];
  loanRepaymentAudit: ReturnType<typeof buildLoanRepaymentAudit>;
  currentBalance: BalanceSummary;
  calculatedBalance: BalanceSummary;
  unhandledTreasuryTransactions: any[];
  transactionAmountCorrections: any[];
}) {
  const changedLoans = input.loanReports.filter((item) => item.changed);
  const repaymentTotal = input.loanRepaymentAudit.repayments.reduce((sum, item) => sum + resolvedTransactionAmount(item.tx), 0);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "APPLY"}`);
  console.log(`Loan records reviewed: ${input.loanReports.length}`);
  console.log(`Loan records needing correction: ${changedLoans.length}`);
  console.log(`Approved loan repayments audited: ${input.loanRepaymentAudit.repayments.length} (${repaymentTotal.toLocaleString()})`);
  console.log(`Transaction amount mismatches found: ${input.transactionAmountCorrections.length}`);

  console.log("");
  console.log("Loan balance audit:");
  for (const report of input.loanReports) {
    const openingRepayments = report.transactions
      .filter((tx) => tx.type === "LOAN_REPAYMENT" && isOpeningTransaction(tx))
      .reduce((sum, tx) => sum + resolvedTransactionAmount(tx), 0);
    const laterRepayments = report.transactions
      .filter((tx) => tx.type === "LOAN_REPAYMENT" && !isOpeningTransaction(tx))
      .reduce((sum, tx) => sum + resolvedTransactionAmount(tx), 0);
    console.log(
      `- ${report.loan.member.fullName} (${report.loan.member.membershipNumber}) | loan=${report.calculated.disbursedAmount.toLocaleString()} | opening paid=${openingRepayments.toLocaleString()} | later paid=${laterRepayments.toLocaleString()} | final balance=${report.calculated.remainingBalance.toLocaleString()} | status=${report.calculated.status}${report.changed ? " | CORRECTION" : ""}`,
    );
  }

  for (const report of changedLoans) {
    console.log("");
    console.log(`${report.loan.member.fullName} (${report.loan.member.membershipNumber})`);
    console.log(`Loan: ${report.loan.purpose} | ${report.loan.id}`);
    console.log(
      `Current: amount=${report.current.amount.toLocaleString()}, disbursed=${report.current.disbursedAmount.toLocaleString()}, paid=${report.current.paid.toLocaleString()}, remaining=${report.current.remainingBalance.toLocaleString()}, status=${report.current.status}`,
    );
    console.log(
      `Calculated: amount=${report.calculated.amount.toLocaleString()}, disbursed=${report.calculated.disbursedAmount.toLocaleString()}, paid=${report.calculated.paid.toLocaleString()}, remaining=${report.calculated.remainingBalance.toLocaleString()}, status=${report.calculated.status}`,
    );
    console.log(`Transactions used (${report.transactionCount}):`);
    for (const tx of report.transactions) {
      console.log(`- ${describeTx(tx)}`);
    }
  }

  console.log("");
  console.log("Approved loan repayment audit:");
  if (!input.loanRepaymentAudit.repayments.length) {
    console.log("- No approved loan repayments found.");
  }
  for (const item of input.loanRepaymentAudit.repayments) {
    const transactionAmount = money(item.tx.amount);
    const ledgerAmount = item.tx.__ledgerAmount;
    const resolvedAmount = resolvedTransactionAmount(item.tx);
    const amountSummary =
      ledgerAmount !== null && ledgerAmount !== undefined
        ? isDifferent(transactionAmount, ledgerAmount)
          ? `${resolvedAmount.toLocaleString()} | tx=${transactionAmount.toLocaleString()} | MISMATCH`
          : resolvedAmount.toLocaleString()
        : `${transactionAmount.toLocaleString()} | ledger missing`;
    console.log(
      `- ${item.loan.member.fullName} (${item.loan.member.membershipNumber}) | ${item.opening ? "opening" : "later"} | ${amountSummary} | ${item.tx.reference ?? item.tx.id} | ledger=${item.ledger ? "yes" : "missing"}`,
    );
  }

  if (input.transactionAmountCorrections.length) {
    console.log("");
    console.log("Transaction amounts that will be repaired from ledger truth:");
    for (const item of input.transactionAmountCorrections) {
      console.log(
        `- ${item.type} ${item.reference ?? item.transactionId} | tx=${item.previousAmount.toLocaleString()} | ledger=${item.correctedAmount.toLocaleString()}${item.memberName ? ` | ${item.memberName}` : ""}`,
      );
    }
  }

  if (input.loanRepaymentAudit.ledgerOnlyLoanRepayments.length) {
    console.log("");
    console.log("Ledger loan repayments not used by loan reconciliation:");
    for (const entry of input.loanRepaymentAudit.ledgerOnlyLoanRepayments) {
      console.log(`- ${describeLedger(entry)}`);
    }
  }

  if (input.unmappedLoanTransactions.length) {
    console.log("");
    console.log("Unmapped loan transactions / unsafe loan records:");
    for (const tx of input.unmappedLoanTransactions) {
      console.log(`- ${describeTx(tx)}`);
    }
  }

  if (input.unhandledTreasuryTransactions.length) {
    console.log("");
    console.log("Unhandled treasury transaction types:");
    for (const tx of input.unhandledTreasuryTransactions) {
      console.log(`- ${describeTx(tx)}`);
    }
  }

  console.log("");
  console.log("Treasury balances:");
  for (const key of Object.keys(input.calculatedBalance) as Array<keyof BalanceSummary>) {
    console.log(
      `${key}: current=${input.currentBalance[key].toLocaleString()} calculated=${input.calculatedBalance[key].toLocaleString()}`,
    );
  }
}

async function applyCorrections(input: {
  loanReports: any[];
  currentBalance: BalanceSummary;
  calculatedBalance: BalanceSummary;
  cooperativeWalletId?: string;
  transactionAmountCorrections: any[];
}) {
  const changedLoans = input.loanReports.filter((item) => item.changed);
  const balanceChanged = (Object.keys(input.calculatedBalance) as Array<keyof BalanceSummary>).some((key) =>
    isDifferent(input.currentBalance[key], input.calculatedBalance[key]),
  );
  const transactionAmountCorrections = input.transactionAmountCorrections.filter((item) =>
    isDifferent(item.previousAmount, item.correctedAmount),
  );

  if (!changedLoans.length && !balanceChanged && !transactionAmountCorrections.length) {
    console.log("No corrections required.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const correction of transactionAmountCorrections) {
      await tx.transaction.update({
        where: { id: correction.transactionId },
        data: {
          amount: correction.correctedAmount,
          metadata: {
            ...(correction.metadata && typeof correction.metadata === "object" && !Array.isArray(correction.metadata)
              ? correction.metadata
              : {}),
            reconciliationAmountRepair: {
              previousAmount: correction.previousAmount,
              correctedAmount: correction.correctedAmount,
              ledgerEntryId: correction.ledgerEntryId,
              repairedAt: new Date().toISOString(),
            },
          },
        } as any,
      });
    }

    for (const report of changedLoans) {
      await tx.loanApplication.update({
        where: { id: report.loan.id },
        data: {
          amount: report.calculated.amount,
          disbursedAmount: report.calculated.disbursedAmount,
          remainingBalance: report.calculated.remainingBalance,
          status: report.calculated.status,
          nextRepaymentAt: report.calculated.status === "COMPLETED" ? null : report.loan.nextRepaymentAt,
        } as any,
      });
    }

    const wallet =
      input.cooperativeWalletId
        ? await tx.cooperativeWallet.update({
            where: { id: input.cooperativeWalletId },
            data: {
              balance: input.calculatedBalance.associationAvailableBalance,
              physicalTreasuryCash: input.calculatedBalance.physicalTreasuryCash,
              memberWalletLiability: input.calculatedBalance.memberWalletLiability,
              associationAvailableBalance: input.calculatedBalance.associationAvailableBalance,
              totalIncome: input.calculatedBalance.totalIncome,
              totalExpense: input.calculatedBalance.totalExpense,
            },
          })
        : await tx.cooperativeWallet.create({
            data: {
              balance: input.calculatedBalance.associationAvailableBalance,
              physicalTreasuryCash: input.calculatedBalance.physicalTreasuryCash,
              memberWalletLiability: input.calculatedBalance.memberWalletLiability,
              associationAvailableBalance: input.calculatedBalance.associationAvailableBalance,
              totalIncome: input.calculatedBalance.totalIncome,
              totalExpense: input.calculatedBalance.totalExpense,
            },
          });

    const balanceLines = [
      {
        account: "PHYSICAL_TREASURY_CASH",
        delta: input.calculatedBalance.physicalTreasuryCash - input.currentBalance.physicalTreasuryCash,
      },
      {
        account: "MEMBER_WALLET_LIABILITY",
        delta: input.calculatedBalance.memberWalletLiability - input.currentBalance.memberWalletLiability,
      },
      {
        account: "ASSOCIATION_AVAILABLE",
        delta: input.calculatedBalance.associationAvailableBalance - input.currentBalance.associationAvailableBalance,
      },
    ].filter((line) => isDifferent(line.delta, 0));

    await tx.financialLedgerEntry.create({
      data: {
        reference: reconciliationReference(),
        sourceType: "FinancialReconciliation",
        sourceId: wallet.id,
        description: "Financial reconciliation correction",
        metadata: {
          previousBalance: input.currentBalance,
          correctedBalance: input.calculatedBalance,
          correctedLoans: changedLoans.map((report) => ({
            loanId: report.loan.id,
            memberId: report.loan.memberId,
            memberName: report.loan.member.fullName,
            previous: report.current,
            corrected: report.calculated,
          })),
          correctedTransactionAmounts: transactionAmountCorrections,
        },
        lines: {
          create: balanceLines.map((line) => ({
            account: line.account,
            direction: lineDirectionForDelta(line.account, line.delta),
            amount: Math.abs(line.delta),
          })),
        },
      },
    });
  });

  console.log(
    `Applied corrections for ${changedLoans.length} loan(s), ${transactionAmountCorrections.length} transaction amount(s).`,
  );
}

async function main() {
  const { loans, transactions, cooperativeWallet, cooperativeEntries, ledgerEntries } = await loadData();
  const {
    loanReports,
    unmappedLoanTransactions,
    transactionAmountCorrections: loanTransactionAmountCorrections,
  } = buildLoanReconciliation(loans, transactions, ledgerEntries);
  const {
    balance: calculatedBalance,
    unhandledTreasuryTransactions,
    transactionAmountCorrections: treasuryTransactionAmountCorrections,
  } = buildTreasuryReconciliation(transactions, cooperativeEntries, ledgerEntries);
  const transactionAmountCorrections = Array.from(
    new Map(
      [...loanTransactionAmountCorrections, ...treasuryTransactionAmountCorrections].map((item) => [
        item.transactionId,
        item,
      ]),
    ).values(),
  );
  const loanRepaymentAudit = buildLoanRepaymentAudit(loanReports, ledgerEntries);
  const currentBalance: BalanceSummary = {
    physicalTreasuryCash: money(cooperativeWallet?.physicalTreasuryCash),
    memberWalletLiability: money(cooperativeWallet?.memberWalletLiability),
    associationAvailableBalance: money(cooperativeWallet?.associationAvailableBalance ?? cooperativeWallet?.balance),
    totalIncome: money(cooperativeWallet?.totalIncome),
    totalExpense: money(cooperativeWallet?.totalExpense),
  };

  printReport({
    loanReports,
    unmappedLoanTransactions,
    loanRepaymentAudit,
    currentBalance,
    calculatedBalance,
    unhandledTreasuryTransactions,
    transactionAmountCorrections,
  });

  if (APPLY) {
    if (unmappedLoanTransactions.length || unhandledTreasuryTransactions.length || loanRepaymentAudit.ledgerOnlyLoanRepayments.length) {
      console.error("Apply aborted. Resolve unmapped/unsupported transactions first.");
      process.exitCode = 1;
      return;
    }

    await applyCorrections({
      loanReports,
      currentBalance,
      calculatedBalance,
      cooperativeWalletId: cooperativeWallet?.id,
      transactionAmountCorrections,
    });
  } else {
    console.log("");
    console.log("Dry run only. Run with --apply to write corrections.");
  }
}

main()
  .catch((error) => {
    console.error("Financial reconciliation failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
