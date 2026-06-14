import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WalletService } from './wallet.service';
import { AuditService } from './audit.service';

const DEDUCTION_DAY_KEY = 'COOPERATIVE_DEDUCTION_DAY';
const DEDUCTION_AMOUNT_KEY = 'COOPERATIVE_DEDUCTION_AMOUNT';
const LAST_RUN_KEY = 'COOPERATIVE_DEDUCTION_LAST_RUN';
const DAILY_LAST_RUN_KEY = 'COOPERATIVE_DAILY_DEDUCTION_LAST_RUN';
const ENABLED_KEY = 'COOPERATIVE_DEDUCTION_ENABLED';
const LAST_STATUS_KEY = 'COOPERATIVE_DEDUCTION_LAST_STATUS';
const LAST_ERROR_KEY = 'COOPERATIVE_DEDUCTION_LAST_ERROR';
const LAST_CHECKED_AT_KEY = 'COOPERATIVE_DEDUCTION_LAST_CHECKED_AT';
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const OPEN_STATUSES = ['OUTSTANDING', 'PARTIAL', 'UPCOMING'];

function startOfIsoDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function monthRange(date = new Date()) {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { from, to };
}

function endOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function statusForCycle(dueDate: Date, amount: number, amountPaid: number, asOf = new Date()) {
  if (amountPaid >= amount) {
    return dueDate.getTime() > startOfIsoDay(asOf).getTime() ? 'PREPAID' : 'PAID';
  }
  if (amountPaid > 0) return 'PARTIAL';
  return dueDate.getTime() > startOfIsoDay(asOf).getTime() ? 'UPCOMING' : 'OUTSTANDING';
}

@Injectable()
export class WeeklyDeductionsService {
  private runInFlight = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly audit: AuditService,
  ) {}

  async getSettings() {
    await this.ensureDefaults();
    const [day, amount, enabled, lastRun, lastStatus, lastError] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: DEDUCTION_DAY_KEY } }),
      this.prisma.systemConfig.findUnique({ where: { key: DEDUCTION_AMOUNT_KEY } }),
      this.prisma.systemConfig.findUnique({ where: { key: ENABLED_KEY } }),
      this.prisma.systemConfig.findUnique({ where: { key: LAST_RUN_KEY } }),
      this.prisma.systemConfig.findUnique({ where: { key: LAST_STATUS_KEY } }),
      this.prisma.systemConfig.findUnique({ where: { key: LAST_ERROR_KEY } }),
    ]);

    return {
      day: day?.value ?? 'SUNDAY',
      amount: Number(amount?.value ?? 0),
      enabled: (enabled?.value ?? 'true') === 'true',
      lastRun: lastRun?.value ?? '',
      lastStatus: lastStatus?.value ?? 'NEVER_RUN',
      lastError: lastError?.value ?? '',
    };
  }

  async getMemberDashboard(userId: string) {
    const member = await this.findMemberByUserId(userId);
    return this.getMemberSummary(member.id, { includeCycles: false, includePayments: false });
  }

  async getMemberSummary(
    memberId: string,
    options: { includeCycles?: boolean; includePayments?: boolean } = {},
  ) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { wallet: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const settings = await this.getSettings();
    await this.ensureCyclesForMember(member, endOfMonth(), settings);
    const { from, to } = monthRange();
    const [cycles, payments, repaymentAttempts] = await Promise.all([
      (this.prisma as any).weeklyDeductionCycle.findMany({
        where: { memberId },
        orderBy: { dueDate: 'asc' },
        include: { allocations: { include: { payment: true } } },
      }),
      (this.prisma as any).weeklyDeductionPayment.findMany({
        where: { memberId },
        orderBy: { paidAt: 'desc' },
        take: options.includePayments === false ? 5 : 50,
        include: {
          transaction: true,
          allocations: { include: { cycle: true } },
        },
      }),
      (this.prisma as any).repaymentAttempt.findMany({
        where: { memberId, phase: 'WEEKLY_DEDUCTION' },
        orderBy: { attemptedAt: 'desc' },
        take: 50,
        include: { transaction: true },
      }),
    ]);

    const now = startOfIsoDay(new Date()).getTime();
    const outstandingAmount = cycles
      .filter((cycle: any) => new Date(cycle.dueDate).getTime() <= now)
      .reduce((sum: number, cycle: any) => sum + Math.max(toNumber(cycle.amount) - toNumber(cycle.amountPaid), 0), 0);
    const prepaidAmount = cycles
      .filter((cycle: any) => new Date(cycle.dueDate).getTime() > now)
      .reduce((sum: number, cycle: any) => sum + toNumber(cycle.amountPaid), 0);
    const totalPaid = cycles.reduce((sum: number, cycle: any) => sum + toNumber(cycle.amountPaid), 0);
    const paidThisMonth = payments
      .filter((payment: any) => new Date(payment.paidAt) >= from && new Date(payment.paidAt) <= to)
      .reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0);
    const nextOpenCycle = cycles.find((cycle: any) => toNumber(cycle.amountPaid) < toNumber(cycle.amount));
    const latestPayment = payments[0] ?? null;

    return {
      member: {
        id: member.id,
        fullName: member.fullName,
        membershipNumber: member.membershipNumber,
        joinedAt: member.joinedAt,
        walletBalance: member.wallet ? Number(member.wallet.availableBalance) : 0,
      },
      weeklyAmount: settings.amount,
      outstandingAmount,
      prepaidAmount,
      totalPaid,
      paidThisMonth,
      expectedAmount: cycles.reduce((sum: number, cycle: any) => sum + toNumber(cycle.amount), 0),
      cycleCount: cycles.length,
      paidCycleCount: cycles.filter((cycle: any) => ['PAID', 'PREPAID'].includes(cycle.status)).length,
      outstandingCycleCount: cycles.filter((cycle: any) => !['PAID', 'PREPAID'].includes(cycle.status)).length,
      nextDueAt: nextOpenCycle?.dueDate ?? this.nextDueAfterLastCycle(member, cycles, settings),
      latestPaymentAt: latestPayment?.paidAt ?? null,
      cycles: options.includeCycles === false ? cycles.slice(-12).map((cycle: any) => this.serializeCycle(cycle)) : cycles.map((cycle: any) => this.serializeCycle(cycle)),
      payments: payments.map((payment: any) => this.serializePayment(payment)),
      repaymentAttempts: repaymentAttempts.map((attempt: any) => this.serializeRepaymentAttempt(attempt)),
    };
  }

  async getMySummary(userId: string) {
    const member = await this.findMemberByUserId(userId);
    return this.getMemberSummary(member.id, { includeCycles: true, includePayments: true });
  }

  async payMyWeeklyDeduction(userId: string, amount: number) {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Enter a valid amount to pay.');
    }

    const member = await this.findMemberByUserId(userId);
    const reference = `WEEKLY-PAY-${member.id}-${Date.now()}`;
    const result = await this.walletService.debitWallet(member.id, amount, 'WEEKLY_COOPERATIVE', reference, {
      category: 'weekly cooperative',
      description: `Weekly cooperative payment by ${member.fullName}`,
      editable: false,
      lockReason: 'Weekly cooperative payments are system-generated and cannot be edited.',
      metadata: {
        memberId: member.id,
        memberName: member.fullName,
        membershipNumber: member.membershipNumber,
        manualWeeklyPayment: true,
      },
    });

    await this.allocatePayment(member.id, amount, {
      transactionId: result.transaction.id,
      mode: 'MEMBER',
      metadata: { reference },
    });

    await this.audit.log(userId, 'PAY_WEEKLY_DEDUCTION', 'Member', member.id, {
      amount,
      reference,
    });

    return {
      transaction: {
        id: result.transaction.id,
        amount: Number(result.transaction.amount),
        status: result.transaction.status,
        reference: result.transaction.reference,
      },
      summary: await this.getMemberSummary(member.id, { includeCycles: true, includePayments: true }),
    };
  }

  async getAdminSummary() {
    await this.ensureCyclesForAll(endOfMonth());
    const [members, cycles, payments] = await Promise.all([
      this.prisma.member.count({ where: { status: 'ACTIVE' } }),
      (this.prisma as any).weeklyDeductionCycle.findMany(),
      (this.prisma as any).weeklyDeductionPayment.findMany(),
    ]);
    const now = startOfIsoDay(new Date()).getTime();
    const expectedAmount = cycles.reduce((sum: number, cycle: any) => sum + toNumber(cycle.amount), 0);
    const paidAmount = cycles.reduce((sum: number, cycle: any) => sum + toNumber(cycle.amountPaid), 0);
    const outstandingAmount = cycles
      .filter((cycle: any) => new Date(cycle.dueDate).getTime() <= now)
      .reduce((sum: number, cycle: any) => sum + Math.max(toNumber(cycle.amount) - toNumber(cycle.amountPaid), 0), 0);
    const prepaidAmount = cycles
      .filter((cycle: any) => new Date(cycle.dueDate).getTime() > now)
      .reduce((sum: number, cycle: any) => sum + toNumber(cycle.amountPaid), 0);

    return {
      members,
      expectedAmount,
      paidAmount,
      outstandingAmount,
      prepaidAmount,
      payments: payments.length,
    };
  }

  async getAdminMembers() {
    await this.ensureCyclesForAll(endOfMonth());
    const members = await this.prisma.member.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      include: {
        wallet: true,
        weeklyDeductionCycles: { orderBy: { dueDate: 'asc' } as any },
        weeklyDeductionPayments: { orderBy: { paidAt: 'desc' } as any, take: 1 },
      } as any,
    });
    const now = startOfIsoDay(new Date()).getTime();

    return {
      items: members.map((member: any) => {
        const cycles = member.weeklyDeductionCycles ?? [];
        const outstandingAmount = cycles
          .filter((cycle: any) => new Date(cycle.dueDate).getTime() <= now)
          .reduce((sum: number, cycle: any) => sum + Math.max(toNumber(cycle.amount) - toNumber(cycle.amountPaid), 0), 0);
        const paidAmount = cycles.reduce((sum: number, cycle: any) => sum + toNumber(cycle.amountPaid), 0);
        const prepaidAmount = cycles
          .filter((cycle: any) => new Date(cycle.dueDate).getTime() > now)
          .reduce((sum: number, cycle: any) => sum + toNumber(cycle.amountPaid), 0);

        return {
          member: {
            id: member.id,
            fullName: member.fullName,
            membershipNumber: member.membershipNumber,
            phoneNumber: member.phoneNumber,
            joinedAt: member.joinedAt,
            walletBalance: member.wallet ? Number(member.wallet.availableBalance) : 0,
          },
          expectedAmount: cycles.reduce((sum: number, cycle: any) => sum + toNumber(cycle.amount), 0),
          paidAmount,
          outstandingAmount,
          prepaidAmount,
          latestPaymentAt: member.weeklyDeductionPayments?.[0]?.paidAt ?? null,
          status: outstandingAmount > 0 ? 'OUTSTANDING' : prepaidAmount > 0 ? 'PREPAID' : 'PAID',
        };
      }),
    };
  }

  async getAdminMemberDetail(memberId: string) {
    return this.getMemberSummary(memberId, { includeCycles: true, includePayments: true });
  }

  async getAdminTransactions(query: { from?: string; to?: string }) {
    const { from, to } = query;
    const dateFilter =
      from || to
        ? {
            paidAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};
    const payments = await (this.prisma as any).weeklyDeductionPayment.findMany({
      where: dateFilter,
      orderBy: { paidAt: 'desc' },
      include: {
        member: { select: { id: true, fullName: true, membershipNumber: true, phoneNumber: true } },
        transaction: true,
        allocations: { include: { cycle: true } },
      },
    });

    return {
      items: payments.map((payment: any) => this.serializePayment(payment)),
    };
  }

  async realignFutureCyclesForDayChange(day: string) {
    const normalizedDay = day.toUpperCase();
    if (!DAYS.includes(normalizedDay)) {
      throw new BadRequestException('Select a valid weekly deduction day.');
    }

    const settings = await this.getSettings();
    const nextSettings = { ...settings, day: normalizedDay };
    const today = startOfIsoDay(new Date());

    return this.prisma.runTransaction(
      'weeklyDeductions.realignFutureCyclesForDayChange',
      async (tx) => {
        const members = await tx.member.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true, joinedAt: true, weeklyDeductionStartsAt: true } as any,
        });

        let deletedCycles = 0;
        let reallocatedAmount = 0;

        for (const member of members as any[]) {
          const futureCycles = await (tx as any).weeklyDeductionCycle.findMany({
            where: {
              memberId: member.id,
              dueDate: { gt: today },
              status: { in: ['UPCOMING', 'OUTSTANDING', 'PREPAID'] },
            },
            include: { allocations: { include: { payment: true } } },
          });

          if (futureCycles.length) {
            const allocationByPayment = new Map<string, { payment: any; amount: number }>();
            for (const cycle of futureCycles) {
              for (const allocation of cycle.allocations ?? []) {
                const existing = allocationByPayment.get(allocation.paymentId);
                allocationByPayment.set(allocation.paymentId, {
                  payment: allocation.payment,
                  amount: (existing?.amount ?? 0) + toNumber(allocation.amount),
                });
              }
            }

            const cycleIds = futureCycles.map((cycle: any) => cycle.id);
            await (tx as any).weeklyDeductionAllocation.deleteMany({
              where: { cycleId: { in: cycleIds } },
            });
            await (tx as any).weeklyDeductionCycle.deleteMany({
              where: { id: { in: cycleIds } },
            });
            deletedCycles += cycleIds.length;

            await this.ensureCyclesForMemberWithClient(tx, member, endOfMonth(), nextSettings);

            for (const { payment, amount } of allocationByPayment.values()) {
              await this.allocateExistingPaymentAmount(tx, member, payment, amount, nextSettings, {
                futureOnly: true,
              });
              reallocatedAmount += amount;
            }
          } else {
            await this.ensureCyclesForMemberWithClient(tx, member, endOfMonth(), nextSettings);
          }
        }

        return { day: normalizedDay, deletedCycles, reallocatedAmount };
      },
      { maxWait: 300000, timeout: 300000 },
    );
  }

  async runIfDue() {
    if (this.runInFlight) {
      return { skipped: true, reason: 'in-flight' };
    }

    await this.ensureDefaults();
    await this.touchLastCheckedAt();
    const settings = await this.getSettings();
    if (!settings.enabled) {
      await this.recordStatus('DISABLED');
      return { skipped: true, reason: 'disabled' };
    }

    const actor = await this.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });

    if (!actor?.id) {
      await this.recordStatus('SKIPPED_NO_ADMIN_ACTOR');
      return { skipped: true, reason: 'no-admin-actor' };
    }

    this.runInFlight = true;
    try {
      return await this.runDaily(actor.id, { trigger: 'LAZY' });
    } catch (error: any) {
      await this.recordStatus('FAILED', error?.message || 'Unknown daily deduction error');
      throw error;
    } finally {
      this.runInFlight = false;
    }
  }

  async run(actorId: string, options?: { force?: boolean; trigger?: 'ADMIN' | 'CRON' | 'LAZY' }) {
    const today = new Date();
    const settings = await this.getSettings();
    if (!settings.enabled) {
      await this.recordStatus('DISABLED');
      return { skipped: true, processedCount: 0, amount: settings.amount };
    }

    if (!settings.amount || settings.amount <= 0) {
      await this.recordStatus('FAILED_AMOUNT_NOT_CONFIGURED');
      throw new BadRequestException('Set a cooperative deduction amount before running deductions');
    }

    const expectedDay = settings.day.toUpperCase();
    const actualDay = DAYS[today.getUTCDay()];

    if (!options?.force && actualDay !== expectedDay) {
      await this.recordStatus('WAITING_FOR_SCHEDULED_DAY');
      throw new BadRequestException(`Weekly deductions are scheduled for ${expectedDay}`);
    }

    const lastRun = await this.prisma.systemConfig.findUnique({ where: { key: LAST_RUN_KEY } });
    const runStamp = startOfIsoDay(today).toISOString();
    if (!options?.force && lastRun?.value === runStamp) {
      await this.recordStatus('ALREADY_RAN_TODAY');
      return { alreadyProcessed: true, processedCount: 0, amount: settings.amount };
    }

    const weeklySummary = await this.processObligationPhase('weekly', {
      recordAttempts: true,
      trigger: options?.trigger ?? 'ADMIN',
    });
    const processedCount = weeklySummary.processedMembers;
    const totalSettled = weeklySummary.totalSettled;
    const partialCount = weeklySummary.partialCount;
    const unpaidCount = weeklySummary.unpaidCount;

    await this.prisma.systemConfig.upsert({
      where: { key: LAST_RUN_KEY },
      update: { value: runStamp },
      create: { key: LAST_RUN_KEY, value: runStamp },
    });
    await this.recordStatus('SUCCESS');

    await this.audit.log(actorId, 'RUN_WEEKLY_DEDUCTIONS', 'SystemConfig', LAST_RUN_KEY, {
      runStamp,
      amount: settings.amount,
      processedCount,
      totalSettled,
      partialCount,
      unpaidCount,
      trigger: options?.trigger ?? 'ADMIN',
    });

    return {
      alreadyProcessed: false,
      processedCount,
      totalSettled,
      partialCount,
      unpaidCount,
      amount: settings.amount,
      day: expectedDay,
      runStamp,
    };
  }

  async runDaily(actorId: string, options?: { force?: boolean; trigger?: 'ADMIN' | 'CRON' | 'LAZY' }) {
    await this.ensureDefaults();
    await this.touchLastCheckedAt();
    const today = new Date();
    const settings = await this.getSettings();
    const runStamp = startOfIsoDay(today).toISOString();
    const expectedDay = settings.day.toUpperCase();
    const actualDay = DAYS[today.getUTCDay()];
    const lastDailyRun = await this.prisma.systemConfig.findUnique({ where: { key: DAILY_LAST_RUN_KEY } });

    if (!settings.enabled) {
      await this.recordStatus('DISABLED');
      return { skipped: true, reason: 'disabled' };
    }

    if (!options?.force && lastDailyRun?.value === runStamp) {
      await this.recordStatus('DAILY_ALREADY_RAN_TODAY');
      return { alreadyProcessed: true, runStamp };
    }

    let weekly:
      | Awaited<ReturnType<WeeklyDeductionsService['run']>>
      | Awaited<ReturnType<WeeklyDeductionsService['runWeeklyOutstanding']>>
      | { skipped: true; reason: string; day?: string; error?: string };

    try {
      if (actualDay === expectedDay) {
        weekly = await this.run(actorId, { force: options?.force, trigger: options?.trigger ?? 'CRON' });
      } else {
        weekly = await this.runWeeklyOutstanding(actorId, {
          recordAttempts: options?.trigger !== 'LAZY',
          trigger: options?.trigger ?? 'CRON',
        });
      }
    } catch (error: any) {
      weekly = {
        skipped: true,
        reason: 'weekly-deduction-failed',
        day: expectedDay,
        error: error?.message || 'Unknown weekly deduction error',
      };
    }

    const dueObligations = await this.runDueObligations({
      includeWeekly: false,
      recordAttempts: options?.trigger !== 'LAZY',
      trigger: options?.trigger ?? 'CRON',
    });

    await this.prisma.systemConfig.upsert({
      where: { key: DAILY_LAST_RUN_KEY },
      update: { value: runStamp },
      create: { key: DAILY_LAST_RUN_KEY, value: runStamp },
    });

    await this.recordStatus(
      weekly && 'error' in weekly ? 'DAILY_SUCCESS_WEEKLY_FAILED' : 'DAILY_SUCCESS',
      weekly && 'error' in weekly ? weekly.error : '',
    );

    await this.audit.log(actorId, 'RUN_DAILY_DEDUCTIONS', 'SystemConfig', DAILY_LAST_RUN_KEY, {
      runStamp,
      trigger: options?.trigger ?? 'ADMIN',
      weekly,
      dueObligations,
    });

    return {
      alreadyProcessed: false,
      runStamp,
      weekly,
      dueObligations,
    };
  }

  async runFromCron(force = false) {
    const actor = await this.getCronActor();
    if (!actor) return { skipped: true, reason: 'no-admin-actor' };

    try {
      return await this.runDaily(actor.id, { force, trigger: 'CRON' });
    } catch (error: any) {
      await this.recordStatus('FAILED', error?.message || 'Unknown daily cron deduction error');
      throw error;
    }
  }

  async runWeeklyCron() {
    const actor = await this.getCronActor();
    if (!actor) return { skipped: true, reason: 'no-admin-actor' };
    return this.runWeeklyOutstanding(actor.id, { recordAttempts: true, trigger: 'CRON' });
  }

  async runPackageRepaymentsCron() {
    const actor = await this.getCronActor();
    if (!actor) return { skipped: true, reason: 'no-admin-actor' };
    return this.runPackageRepayments(actor.id, { recordAttempts: true, trigger: 'CRON' });
  }

  async runLoanRepaymentsCron() {
    const actor = await this.getCronActor();
    if (!actor) return { skipped: true, reason: 'no-admin-actor' };
    return this.runLoanRepayments(actor.id, { recordAttempts: true, trigger: 'CRON' });
  }

  async runWeeklyOutstanding(
    actorId: string,
    options: { recordAttempts?: boolean; trigger?: 'ADMIN' | 'CRON' | 'LAZY' | string } = {},
  ) {
    await this.ensureDefaults();
    await this.touchLastCheckedAt();
    const settings = await this.getSettings();
    if (!settings.enabled) {
      await this.recordStatus('DISABLED');
      return { skipped: true, reason: 'disabled' };
    }
    const summary = await this.processObligationPhase('weekly', options);
    await this.audit.log(actorId, 'RUN_DAILY_WEEKLY_DEDUCTIONS', 'SystemConfig', DAILY_LAST_RUN_KEY, {
      trigger: options.trigger ?? 'ADMIN',
      ...summary,
    });
    return summary;
  }

  async runPackageRepayments(
    actorId: string,
    options: { recordAttempts?: boolean; trigger?: 'ADMIN' | 'CRON' | 'LAZY' | string } = {},
  ) {
    await this.ensureDefaults();
    await this.touchLastCheckedAt();
    const summary = await this.processObligationPhase('package', options);
    await this.audit.log(actorId, 'RUN_DAILY_PACKAGE_REPAYMENTS', 'SystemConfig', DAILY_LAST_RUN_KEY, {
      trigger: options.trigger ?? 'ADMIN',
      ...summary,
    });
    return summary;
  }

  async runLoanRepayments(
    actorId: string,
    options: { recordAttempts?: boolean; trigger?: 'ADMIN' | 'CRON' | 'LAZY' | string } = {},
  ) {
    await this.ensureDefaults();
    await this.touchLastCheckedAt();
    const summary = await this.processObligationPhase('loan', options);
    await this.audit.log(actorId, 'RUN_DAILY_LOAN_REPAYMENTS', 'SystemConfig', DAILY_LAST_RUN_KEY, {
      trigger: options.trigger ?? 'ADMIN',
      ...summary,
    });
    return summary;
  }

  private async runDueObligations(
    options: {
      includeWeekly?: boolean;
      recordAttempts?: boolean;
      trigger?: 'ADMIN' | 'CRON' | 'LAZY' | string;
    } = {},
  ) {
    const weekly = options.includeWeekly === false
      ? { skipped: true, reason: 'handled-separately' }
      : await this.processObligationPhase('weekly', options);
    const packages = await this.processObligationPhase('package', options);
    const loans = await this.processObligationPhase('loan', options);
    const summaries = [weekly, packages, loans].filter((summary: any) => !summary.skipped) as Array<{
      checkedMembers: number;
      processedMembers: number;
      settlementCount: number;
      totalSettled: number;
      completedCount: number;
      partialCount: number;
      unpaidCount: number;
    }>;

    return {
      weekly,
      packages,
      loans,
      checkedMembers: summaries.reduce((sum, item) => sum + item.checkedMembers, 0),
      processedMembers: summaries.reduce((sum, item) => sum + item.processedMembers, 0),
      settlementCount: summaries.reduce((sum, item) => sum + item.settlementCount, 0),
      totalSettled: summaries.reduce((sum, item) => sum + item.totalSettled, 0),
      completedCount: summaries.reduce((sum, item) => sum + item.completedCount, 0),
      partialCount: summaries.reduce((sum, item) => sum + item.partialCount, 0),
      unpaidCount: summaries.reduce((sum, item) => sum + item.unpaidCount, 0),
    };
  }

  private async processObligationPhase(
    phase: 'weekly' | 'package' | 'loan',
    options: { recordAttempts?: boolean; trigger?: 'ADMIN' | 'CRON' | 'LAZY' | string } = {},
  ) {
    const now = new Date();
    const today = startOfIsoDay(now);
    let dueMembers: Array<{ memberId: string }>;

    if (phase === 'weekly') {
      const settings = await this.getSettings();
      await this.ensureCyclesForAll(now, settings);
      dueMembers = await (this.prisma as any).weeklyDeductionCycle.findMany({
        where: {
          member: { status: 'ACTIVE' },
          dueDate: { lte: today },
          status: { in: OPEN_STATUSES },
        },
        select: { memberId: true },
        distinct: ['memberId'],
      });
    } else if (phase === 'package') {
      const dueBefore = addDays(today, 1);
      const scheduleMembers = await (this.prisma as any).repaymentScheduleItem.findMany({
        where: {
          targetType: 'PackageSubscription',
          member: { status: 'ACTIVE' },
          dueDate: { lt: dueBefore },
          remainingAmount: { gt: 0 },
        },
        select: { memberId: true },
        distinct: ['memberId'],
      });
      const legacyMembers = await this.prisma.packageSubscription.findMany({
        where: {
          member: { status: 'ACTIVE' },
          status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'] },
          nextDueAt: { lte: now },
          OR: [{ amountRemaining: { gt: 0 } }, { penaltyAccrued: { gt: 0 } }],
        },
        select: { memberId: true },
        distinct: ['memberId'],
      });
      dueMembers = this.uniqueMemberRows([...scheduleMembers, ...legacyMembers]);
    } else {
      const dueBefore = addDays(today, 1);
      const scheduleMembers = await (this.prisma as any).repaymentScheduleItem.findMany({
        where: {
          targetType: 'LoanApplication',
          member: { status: 'ACTIVE' },
          dueDate: { lt: dueBefore },
          remainingAmount: { gt: 0 },
        },
        select: { memberId: true },
        distinct: ['memberId'],
      });
      const legacyMembers = await this.prisma.loanApplication.findMany({
        where: {
          member: { status: 'ACTIVE' },
          status: { in: ['DISBURSED', 'IN_PROGRESS', 'OVERDUE'] },
          remainingBalance: { gt: 0 },
          nextRepaymentAt: { lte: now },
        },
        select: { memberId: true },
        distinct: ['memberId'],
      } as any);
      dueMembers = this.uniqueMemberRows([...scheduleMembers, ...legacyMembers]);
    }

    const dueMemberIds = dueMembers.map((item) => item.memberId);
    const results = await this.mapInBatches(dueMemberIds, 5, async (memberId) => {
      const settlements =
        phase === 'weekly'
          ? await this.walletService.settleWeeklyObligations(memberId, options)
          : phase === 'package'
            ? await this.walletService.settlePackageObligations(memberId, options)
            : await this.walletService.settleLoanObligations(memberId, options);

      if (!settlements.length) {
        return {
          processedMembers: 0,
          settlementCount: 0,
          totalSettled: 0,
          completedCount: 0,
          partialCount: 0,
          unpaidCount: 0,
        };
      }

      return {
        processedMembers: 1,
        settlementCount: settlements.length,
        totalSettled: settlements.reduce((sum, item) => sum + item.amount, 0),
        completedCount: settlements.filter((item) => (item.repaymentStatus ?? (item.amount > 0 ? 'COMPLETED' : 'UNPAID')) === 'COMPLETED').length,
        partialCount: settlements.filter((item) => item.repaymentStatus === 'PARTIAL').length,
        unpaidCount: settlements.filter((item) => item.repaymentStatus === 'UNPAID').length,
      };
    });

    return {
      phase,
      checkedMembers: dueMemberIds.length,
      processedMembers: results.reduce((sum, item) => sum + item.processedMembers, 0),
      settlementCount: results.reduce((sum, item) => sum + item.settlementCount, 0),
      totalSettled: results.reduce((sum, item) => sum + item.totalSettled, 0),
      completedCount: results.reduce((sum, item) => sum + item.completedCount, 0),
      partialCount: results.reduce((sum, item) => sum + item.partialCount, 0),
      unpaidCount: results.reduce((sum, item) => sum + item.unpaidCount, 0),
    };
  }

  private async getCronActor() {
    const actor = await this.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });

    if (!actor?.id) {
      await this.recordStatus('FAILED_NO_ADMIN_ACTOR', 'No SUPER_ADMIN user exists for cron audit attribution.');
      return null;
    }

    return actor;
  }

  private async mapInBatches<T, R>(
    items: T[],
    batchSize: number,
    handler: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];
    for (let index = 0; index < items.length; index += batchSize) {
      results.push(...(await Promise.all(items.slice(index, index + batchSize).map(handler))));
    }
    return results;
  }

  private async allocatePayment(
    memberId: string,
    amount: number,
    input: { transactionId?: string | null; mode: string; metadata?: Record<string, unknown>; paidAt?: Date },
  ) {
    if (amount <= 0) return null;

    const member = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Member not found');

    const settings = await this.getSettings();
    await this.ensureCyclesForMember(member, new Date(), settings);

    return this.prisma.runTransaction('weeklyDeductions.allocatePayment', async (tx) => {
      const payment = await (tx as any).weeklyDeductionPayment.create({
        data: {
          memberId,
          transactionId: input.transactionId ?? null,
          amount,
          mode: input.mode,
          paidAt: input.paidAt ?? new Date(),
          metadata: input.metadata ?? {},
        },
      });

      let remaining = amount;
      while (remaining > 0.0001) {
        remaining -= await this.allocateOneCycle(tx, member, payment, remaining, settings, input.paidAt ?? new Date());
      }

      return payment;
    });
  }

  private async allocateExistingPaymentAmount(
    client: any,
    member: { id: string; joinedAt: Date; weeklyDeductionStartsAt?: Date | null },
    payment: any,
    amount: number,
    settings: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>,
    options: { futureOnly?: boolean } = {},
  ) {
    let remaining = amount;
    while (remaining > 0.0001) {
      const allocated = await this.allocateOneCycle(
        client,
        member,
        payment,
        remaining,
        settings,
        payment.paidAt ?? new Date(),
        options,
      );
      if (allocated <= 0) break;
      remaining -= allocated;
    }
  }

  private async allocateOneCycle(
    client: any,
    member: { id: string; joinedAt: Date; weeklyDeductionStartsAt?: Date | null },
    payment: any,
    amount: number,
    settings: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>,
    paidAt = new Date(),
    options: { futureOnly?: boolean } = {},
  ) {
    const today = startOfIsoDay(new Date());
    let cycle = await (client as any).weeklyDeductionCycle.findFirst({
      where: {
        memberId: member.id,
        status: { in: OPEN_STATUSES },
        ...(options.futureOnly ? { dueDate: { gt: today } } : {}),
      },
      orderBy: { dueDate: 'asc' },
    });

    if (!cycle) {
      cycle = await this.createNextCycle(client, member, settings);
      while (options.futureOnly && cycle.dueDate.getTime() <= today.getTime()) {
        cycle = await this.createNextCycle(client, member, settings);
      }
    }

    const cycleAmount = toNumber(cycle.amount);
    const currentPaid = toNumber(cycle.amountPaid);
    const openAmount = Math.max(cycleAmount - currentPaid, 0);
    const allocationAmount = Math.min(openAmount, amount);
    if (allocationAmount <= 0) {
      await (client as any).weeklyDeductionCycle.update({
        where: { id: cycle.id },
        data: { status: statusForCycle(cycle.dueDate, cycleAmount, currentPaid, paidAt) },
      });
      return 0;
    }

    const nextPaid = currentPaid + allocationAmount;
    const nextStatus = statusForCycle(cycle.dueDate, cycleAmount, nextPaid, paidAt);

    await (client as any).weeklyDeductionAllocation.create({
      data: {
        paymentId: payment.id,
        cycleId: cycle.id,
        amount: allocationAmount,
      },
    });
    await (client as any).weeklyDeductionCycle.update({
      where: { id: cycle.id },
      data: {
        amountPaid: nextPaid,
        status: nextStatus,
      },
    });

    return allocationAmount;
  }

  private async getDueOutstandingForMember(memberId: string, dueDate: Date) {
    const cycles = await (this.prisma as any).weeklyDeductionCycle.findMany({
      where: {
        memberId,
        dueDate: { lte: startOfIsoDay(dueDate) },
        status: { in: OPEN_STATUSES },
      },
    });

    return cycles.reduce((sum: number, cycle: any) => sum + Math.max(toNumber(cycle.amount) - toNumber(cycle.amountPaid), 0), 0);
  }

  private async ensureCyclesForAll(throughDate = new Date(), settings?: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>) {
    const members = await this.prisma.member.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, joinedAt: true, weeklyDeductionStartsAt: true } as any,
    });
    const resolvedSettings = settings ?? (await this.getSettings());
    for (const member of members as any[]) {
      await this.ensureCyclesForMember(member, throughDate, resolvedSettings);
    }
  }

  private async ensureCyclesForMember(
    member: { id: string; joinedAt: Date; weeklyDeductionStartsAt?: Date | null },
    throughDate = new Date(),
    settings?: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>,
  ) {
    const resolvedSettings = settings ?? (await this.getSettings());
    if (!resolvedSettings.amount || resolvedSettings.amount <= 0) return;

    await this.ensureCyclesForMemberWithClient(this.prisma, member, throughDate, resolvedSettings);
  }

  private async ensureCyclesForMemberWithClient(
    client: any,
    member: { id: string; joinedAt: Date; weeklyDeductionStartsAt?: Date | null },
    throughDate = new Date(),
    settings: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>,
  ) {
    if (!settings.amount || settings.amount <= 0) return;

    const lastCycle = await (client as any).weeklyDeductionCycle.findFirst({
      where: { memberId: member.id },
      orderBy: { dueDate: 'desc' },
    });
    const startDate = this.firstDueOnOrAfter(
      lastCycle ? addDays(lastCycle.dueDate, 1) : this.cycleStartDate(member),
      settings.day,
    );
    const endDate = startOfIsoDay(throughDate);
    if (startDate.getTime() > endDate.getTime()) return;

    const data = [];
    for (let dueDate = startDate; dueDate.getTime() <= endDate.getTime(); dueDate = addDays(dueDate, 7)) {
      data.push({
        memberId: member.id,
        dueDate,
        amount: settings.amount,
        amountPaid: 0,
        status: statusForCycle(dueDate, settings.amount, 0),
      });
    }

    if (data.length) {
      await (client as any).weeklyDeductionCycle.createMany({
        data,
        skipDuplicates: true,
      });
    }
  }

  private async createNextCycle(
    client: any,
    member: { id: string; joinedAt: Date; weeklyDeductionStartsAt?: Date | null },
    settings: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>,
  ) {
    const lastCycle = await (client as any).weeklyDeductionCycle.findFirst({
      where: { memberId: member.id },
      orderBy: { dueDate: 'desc' },
    });
    const dueDate = lastCycle
      ? this.firstDueOnOrAfter(addDays(lastCycle.dueDate, 1), settings.day)
      : this.firstDueOnOrAfter(this.cycleStartDate(member), settings.day);
    const existing = await (client as any).weeklyDeductionCycle.findUnique({
      where: { memberId_dueDate: { memberId: member.id, dueDate } },
    });
    if (existing) return existing;
    return (client as any).weeklyDeductionCycle.create({
      data: {
        memberId: member.id,
        dueDate,
        amount: settings.amount,
        status: 'UPCOMING',
      },
    });
  }

  private nextDueAfterLastCycle(
    member: { id: string; joinedAt: Date; weeklyDeductionStartsAt?: Date | null },
    cycles: any[],
    settings: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>,
  ) {
    const last = cycles[cycles.length - 1];
    if (last) return this.firstDueOnOrAfter(addDays(last.dueDate, 1), settings.day);
    return this.firstDueOnOrAfter(this.cycleStartDate(member), settings.day);
  }

  private cycleStartDate(member: { joinedAt: Date; weeklyDeductionStartsAt?: Date | null }) {
    return startOfIsoDay(member.weeklyDeductionStartsAt ?? member.joinedAt);
  }

  private firstDueOnOrAfter(startDate: Date, day: string) {
    const targetDay = Math.max(DAYS.indexOf(day.toUpperCase()), 0);
    const first = startOfIsoDay(startDate);
    const offset = (targetDay - first.getUTCDay() + 7) % 7;
    return addDays(first, offset);
  }

  private async findMemberByUserId(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      select: { id: true, fullName: true, membershipNumber: true },
    });
    if (!member) throw new NotFoundException('Member profile not found');
    return member;
  }

  private serializeCycle(cycle: any) {
    return {
      id: cycle.id,
      dueDate: cycle.dueDate,
      amount: toNumber(cycle.amount),
      amountPaid: toNumber(cycle.amountPaid),
      outstandingAmount: Math.max(toNumber(cycle.amount) - toNumber(cycle.amountPaid), 0),
      status: cycle.status,
      createdAt: cycle.createdAt,
      updatedAt: cycle.updatedAt,
    };
  }

  private serializePayment(payment: any) {
    return {
      id: payment.id,
      amount: toNumber(payment.amount),
      mode: payment.mode,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      member: payment.member,
      transaction: payment.transaction
        ? {
            id: payment.transaction.id,
            type: payment.transaction.type,
            status: payment.transaction.status,
            reference: payment.transaction.reference,
            description: payment.transaction.description,
          }
        : null,
      allocations: (payment.allocations ?? []).map((allocation: any) => ({
        id: allocation.id,
        amount: toNumber(allocation.amount),
        cycle: allocation.cycle ? this.serializeCycle(allocation.cycle) : null,
      })),
    };
  }

  private serializeRepaymentAttempt(attempt: any) {
    return {
      id: attempt.id,
      phase: attempt.phase,
      targetType: attempt.targetType,
      targetId: attempt.targetId,
      expectedAmount: toNumber(attempt.expectedAmount),
      paidAmount: toNumber(attempt.paidAmount),
      remainingAmount: toNumber(attempt.remainingAmount),
      status: attempt.status,
      mode: attempt.mode,
      reference: attempt.reference,
      dueAt: attempt.dueAt,
      attemptedAt: attempt.attemptedAt,
      metadata: attempt.metadata ?? {},
      transaction: attempt.transaction
        ? {
            id: attempt.transaction.id,
            type: attempt.transaction.type,
            status: attempt.transaction.status,
            reference: attempt.transaction.reference,
            description: attempt.transaction.description,
            amount: toNumber(attempt.transaction.amount),
          }
        : null,
    };
  }

  private uniqueMemberRows(rows: Array<{ memberId: string }>) {
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.memberId)) return false;
      seen.add(row.memberId);
      return true;
    });
  }

  private async ensureDefaults() {
    await Promise.all(
      [
        [DEDUCTION_DAY_KEY, 'SUNDAY'],
        [DEDUCTION_AMOUNT_KEY, '250'],
        [LAST_RUN_KEY, ''],
        [DAILY_LAST_RUN_KEY, ''],
        [ENABLED_KEY, 'true'],
        [LAST_STATUS_KEY, 'NEVER_RUN'],
        [LAST_ERROR_KEY, ''],
        [LAST_CHECKED_AT_KEY, ''],
      ].map(([key, value]) =>
        this.prisma.systemConfig.upsert({
          where: { key },
          update: {},
          create: { key, value },
        }),
      ),
    );
  }

  private async recordStatus(status: string, error = '') {
    await Promise.all([
      this.prisma.systemConfig.upsert({
        where: { key: LAST_STATUS_KEY },
        update: { value: status },
        create: { key: LAST_STATUS_KEY, value: status },
      }),
      this.prisma.systemConfig.upsert({
        where: { key: LAST_ERROR_KEY },
        update: { value: error },
        create: { key: LAST_ERROR_KEY, value: error },
      }),
    ]);
  }

  private async touchLastCheckedAt() {
    await this.prisma.systemConfig.upsert({
      where: { key: LAST_CHECKED_AT_KEY },
      update: { value: new Date().toISOString() },
      create: { key: LAST_CHECKED_AT_KEY, value: new Date().toISOString() },
    });
  }
}
