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
const WEEKLY_DUES_START_DATE = new Date(Date.UTC(2026, 4, 17));

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
    const [cycles, payments] = await Promise.all([
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

    await this.ensureCyclesForAll(today, settings);
    const activeMembers = await this.prisma.member.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true, membershipNumber: true },
    });

    let processedCount = 0;
    let totalSettled = 0;
    for (const member of activeMembers) {
      const outstanding = await this.getDueOutstandingForMember(member.id, today);
      if (outstanding <= 0) continue;

      const reference = `WEEKLY-${runStamp}-${member.id}`;
      const existing = await this.prisma.transaction.findUnique({ where: { reference } });
      if (existing) continue;

      const amountToDebit = Math.min(settings.amount, outstanding);
      const result = await this.walletService.debitWallet(member.id, amountToDebit, 'WEEKLY_COOPERATIVE', reference, {
        allowNegative: true,
        category: 'weekly cooperative',
        description: `Weekly cooperative deduction for ${runStamp.slice(0, 10)}`,
        editable: false,
        lockReason: 'Weekly cooperative deductions are generated automatically by the system.',
        metadata: {
          deductionDate: runStamp,
          memberName: member.fullName,
          membershipNumber: member.membershipNumber,
          trigger: options?.trigger ?? 'ADMIN',
        },
      });
      const outstandingAmount = toNumber((result.transaction.metadata as any)?.outstandingAmount);
      const settledAmount = Math.max(amountToDebit - outstandingAmount, 0);
      if (settledAmount > 0) {
        await this.allocatePayment(member.id, settledAmount, {
          transactionId: result.transaction.id,
          mode: 'AUTO',
          metadata: { reference, runStamp },
        });
      }
      processedCount += 1;
      totalSettled += settledAmount;
    }

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
      trigger: options?.trigger ?? 'ADMIN',
    });

    return {
      alreadyProcessed: false,
      processedCount,
      totalSettled,
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
      | { skipped: true; reason: string; day?: string; error?: string };

    if (actualDay === expectedDay) {
      try {
        weekly = await this.run(actorId, { force: options?.force, trigger: options?.trigger ?? 'CRON' });
      } catch (error: any) {
        weekly = {
          skipped: true,
          reason: 'weekly-deduction-failed',
          day: expectedDay,
          error: error?.message || 'Unknown weekly deduction error',
        };
      }
    } else {
      weekly = {
        skipped: true,
        reason: 'not-weekly-deduction-day',
        day: expectedDay,
      };
    }

    const dueObligations = await this.runDueObligations();

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
    const actor = await this.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });

    if (!actor?.id) {
      await this.recordStatus('FAILED_NO_ADMIN_ACTOR', 'No SUPER_ADMIN user exists for cron audit attribution.');
      return { skipped: true, reason: 'no-admin-actor' };
    }

    try {
      return await this.runDaily(actor.id, { force, trigger: 'CRON' });
    } catch (error: any) {
      await this.recordStatus('FAILED', error?.message || 'Unknown daily cron deduction error');
      throw error;
    }
  }

  private async runDueObligations() {
    const now = new Date();
    const [duePackages, dueLoans] = await Promise.all([
      this.prisma.packageSubscription.findMany({
        where: {
          member: { status: 'ACTIVE' },
          status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'] },
          nextDueAt: { lte: now },
          OR: [{ amountRemaining: { gt: 0 } }, { penaltyAccrued: { gt: 0 } }],
        },
        select: { memberId: true },
        distinct: ['memberId'],
      }),
      this.prisma.loanApplication.findMany({
        where: {
          member: { status: 'ACTIVE' },
          status: { in: ['DISBURSED', 'IN_PROGRESS', 'OVERDUE'] },
          remainingBalance: { gt: 0 },
          nextRepaymentAt: { lte: now },
        },
        select: { memberId: true },
        distinct: ['memberId'],
      } as any),
    ]);
    const dueMemberIds = Array.from(
      new Set([...duePackages, ...dueLoans].map((item) => item.memberId)),
    );

    let processedMembers = 0;
    let settlementCount = 0;
    let totalSettled = 0;

    for (const memberId of dueMemberIds) {
      const settlements = await this.walletService.settleOutstandingObligations(memberId);
      if (!settlements.length) {
        continue;
      }

      processedMembers += 1;
      settlementCount += settlements.length;
      totalSettled += settlements.reduce((sum, item) => sum + item.amount, 0);
    }

    return {
      checkedMembers: dueMemberIds.length,
      duePackageMembers: duePackages.length,
      dueLoanMembers: dueLoans.length,
      processedMembers,
      settlementCount,
      totalSettled,
    };
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

    return this.prisma.$transaction(async (tx) => {
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
        let cycle = await (tx as any).weeklyDeductionCycle.findFirst({
          where: {
            memberId,
            status: { in: OPEN_STATUSES },
          },
          orderBy: { dueDate: 'asc' },
        });

        if (!cycle) {
          cycle = await this.createNextCycle(tx, member, settings);
        }

        const cycleAmount = toNumber(cycle.amount);
        const currentPaid = toNumber(cycle.amountPaid);
        const openAmount = Math.max(cycleAmount - currentPaid, 0);
        const allocationAmount = Math.min(openAmount, remaining);
        const nextPaid = currentPaid + allocationAmount;
        const nextStatus = statusForCycle(cycle.dueDate, cycleAmount, nextPaid, input.paidAt ?? new Date());

        await (tx as any).weeklyDeductionAllocation.create({
          data: {
            paymentId: payment.id,
            cycleId: cycle.id,
            amount: allocationAmount,
          },
        });
        await (tx as any).weeklyDeductionCycle.update({
          where: { id: cycle.id },
          data: {
            amountPaid: nextPaid,
            status: nextStatus,
          },
        });

        remaining -= allocationAmount;
      }

      return payment;
    });
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
      select: { id: true, joinedAt: true },
    });
    const resolvedSettings = settings ?? (await this.getSettings());
    for (const member of members) {
      await this.ensureCyclesForMember(member, throughDate, resolvedSettings);
    }
  }

  private async ensureCyclesForMember(
    member: { id: string; joinedAt: Date },
    throughDate = new Date(),
    settings?: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>,
  ) {
    const resolvedSettings = settings ?? (await this.getSettings());
    if (!resolvedSettings.amount || resolvedSettings.amount <= 0) return;

    const startDate = this.firstDueOnOrAfter(this.cycleStartDate(member.joinedAt), resolvedSettings.day);
    const endDate = startOfIsoDay(throughDate);
    if (startDate.getTime() > endDate.getTime()) return;

    const data = [];
    for (let dueDate = startDate; dueDate.getTime() <= endDate.getTime(); dueDate = addDays(dueDate, 7)) {
      data.push({
        memberId: member.id,
        dueDate,
        amount: resolvedSettings.amount,
        status: 'OUTSTANDING',
      });
    }

    if (data.length) {
      await (this.prisma as any).weeklyDeductionCycle.createMany({
        data,
        skipDuplicates: true,
      });
    }
  }

  private async createNextCycle(client: any, member: { id: string; joinedAt: Date }, settings: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>) {
    const lastCycle = await (client as any).weeklyDeductionCycle.findFirst({
      where: { memberId: member.id },
      orderBy: { dueDate: 'desc' },
    });
    const dueDate = lastCycle ? addDays(lastCycle.dueDate, 7) : this.firstDueOnOrAfter(this.cycleStartDate(member.joinedAt), settings.day);
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

  private nextDueAfterLastCycle(member: { id: string; joinedAt: Date }, cycles: any[], settings: Awaited<ReturnType<WeeklyDeductionsService['getSettings']>>) {
    const last = cycles[cycles.length - 1];
    if (last) return addDays(last.dueDate, 7);
    return this.firstDueOnOrAfter(this.cycleStartDate(member.joinedAt), settings.day);
  }

  private cycleStartDate(joinedAt: Date) {
    return startOfIsoDay(WEEKLY_DUES_START_DATE);
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
