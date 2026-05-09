import { BadRequestException, Injectable } from '@nestjs/common';
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

function startOfIsoDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
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
      day: day?.value ?? 'MONDAY',
      amount: Number(amount?.value ?? 0),
      enabled: (enabled?.value ?? 'true') === 'true',
      lastRun: lastRun?.value ?? '',
      lastStatus: lastStatus?.value ?? 'NEVER_RUN',
      lastError: lastError?.value ?? '',
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

    const activeMembers = await this.prisma.member.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true },
    });

    let processedCount = 0;
    for (const member of activeMembers) {
      const reference = `WEEKLY-${runStamp}-${member.id}`;
      const existing = await this.prisma.transaction.findUnique({ where: { reference } });
      if (existing) {
        continue;
      }

      await this.walletService.debitWallet(member.id, settings.amount, 'WEEKLY_COOPERATIVE', reference, {
        allowNegative: true,
        category: 'weekly cooperative',
        description: `Weekly cooperative deduction for ${runStamp.slice(0, 10)}`,
        editable: false,
        lockReason: 'Weekly cooperative deductions are generated automatically by the system.',
        metadata: {
          deductionDate: runStamp,
          memberName: member.fullName,
          trigger: options?.trigger ?? 'ADMIN',
        },
      });

      processedCount += 1;
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
      trigger: options?.trigger ?? 'ADMIN',
    });

    return {
      alreadyProcessed: false,
      processedCount,
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
    const activeMembers = await this.prisma.member.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
      orderBy: { joinedAt: 'asc' },
    });

    let processedMembers = 0;
    let settlementCount = 0;
    let totalSettled = 0;

    for (const member of activeMembers) {
      const settlements = await this.walletService.settleOutstandingObligations(member.id);
      if (!settlements.length) {
        continue;
      }

      processedMembers += 1;
      settlementCount += settlements.length;
      totalSettled += settlements.reduce((sum, item) => sum + item.amount, 0);
    }

    return {
      checkedMembers: activeMembers.length,
      processedMembers,
      settlementCount,
      totalSettled,
    };
  }

  private async ensureDefaults() {
    await Promise.all(
      [
        [DEDUCTION_DAY_KEY, 'MONDAY'],
        [DEDUCTION_AMOUNT_KEY, '1000'],
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
