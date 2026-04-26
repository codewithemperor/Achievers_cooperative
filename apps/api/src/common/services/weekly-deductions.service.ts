import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WalletService } from './wallet.service';
import { AuditService } from './audit.service';

const DEDUCTION_DAY_KEY = 'COOPERATIVE_DEDUCTION_DAY';
const DEDUCTION_AMOUNT_KEY = 'COOPERATIVE_DEDUCTION_AMOUNT';
const LAST_RUN_KEY = 'COOPERATIVE_DEDUCTION_LAST_RUN';

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
    const [day, amount] = await Promise.all([
      this.prisma.systemConfig.findUnique({ where: { key: DEDUCTION_DAY_KEY } }),
      this.prisma.systemConfig.findUnique({ where: { key: DEDUCTION_AMOUNT_KEY } }),
    ]);

    return {
      day: day?.value ?? 'MONDAY',
      amount: Number(amount?.value ?? 0),
    };
  }

  async runIfDue() {
    if (this.runInFlight) {
      return { skipped: true, reason: 'in-flight' };
    }

    await this.ensureDefaults();
    const today = new Date();
    const settings = await this.getSettings();
    const expectedDay = settings.day.toUpperCase();
    const actualDay = DAYS[today.getUTCDay()];
    const runStamp = startOfIsoDay(today).toISOString();
    const lastRun = await this.prisma.systemConfig.findUnique({ where: { key: LAST_RUN_KEY } });

    if (!settings.amount || settings.amount <= 0) {
      return { skipped: true, reason: 'amount-not-configured' };
    }

    if (actualDay !== expectedDay) {
      return { skipped: true, reason: 'not-scheduled-day' };
    }

    if (lastRun?.value === runStamp) {
      return { skipped: true, reason: 'already-ran-today' };
    }

    const actor = await this.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });

    if (!actor?.id) {
      return { skipped: true, reason: 'no-admin-actor' };
    }

    this.runInFlight = true;
    try {
      return await this.run(actor.id, { trigger: 'LAZY' });
    } finally {
      this.runInFlight = false;
    }
  }

  async run(actorId: string, options?: { force?: boolean; trigger?: 'ADMIN' | 'CRON' | 'LAZY' }) {
    const today = new Date();
    const settings = await this.getSettings();

    if (!settings.amount || settings.amount <= 0) {
      throw new BadRequestException('Set a cooperative deduction amount before running deductions');
    }

    const expectedDay = settings.day.toUpperCase();
    const actualDay = DAYS[today.getUTCDay()];

    if (!options?.force && actualDay !== expectedDay) {
      throw new BadRequestException(`Weekly deductions are scheduled for ${expectedDay}`);
    }

    const lastRun = await this.prisma.systemConfig.findUnique({ where: { key: LAST_RUN_KEY } });
    const runStamp = startOfIsoDay(today).toISOString();
    if (!options?.force && lastRun?.value === runStamp) {
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

  private async ensureDefaults() {
    await Promise.all(
      [
        [DEDUCTION_DAY_KEY, 'MONDAY'],
        [DEDUCTION_AMOUNT_KEY, '1000'],
        [LAST_RUN_KEY, ''],
      ].map(([key, value]) =>
        this.prisma.systemConfig.upsert({
          where: { key },
          update: {},
          create: { key, value },
        }),
      ),
    );
  }
}
