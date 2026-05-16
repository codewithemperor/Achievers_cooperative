import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { WeeklyDeductionsService } from '../../common/services/weekly-deductions.service';

@Injectable()
export class SystemConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly weeklyDeductions: WeeklyDeductionsService,
  ) {}

  async getAll() {
    await Promise.all(
      [
        ['MEMBERSHIP_FEE_AMOUNT', '20000'],
        ['COOPERATIVE_DEDUCTION_DAY', 'MONDAY'],
        ['COOPERATIVE_DEDUCTION_AMOUNT', '250'],
        ['COOPERATIVE_DEDUCTION_ENABLED', 'true'],
        ['MEMBERSHIP_CHARGE_RATE', '0'],
        ['MEMBER_TERMS_HTML', '<p>Welcome to Achievers Cooperative.</p>'],
        ['COOPERATIVE_DEDUCTION_LAST_RUN', ''],
        ['COOPERATIVE_DAILY_DEDUCTION_LAST_RUN', ''],
        ['COOPERATIVE_DEDUCTION_LAST_STATUS', 'NEVER_RUN'],
        ['COOPERATIVE_DEDUCTION_LAST_ERROR', ''],
        ['COOPERATIVE_DEDUCTION_LAST_CHECKED_AT', ''],
        ['BANK_ACCOUNT_NAME', 'Achievers Cooperative Society'],
        ['BANK_ACCOUNT_NUMBER', '0123456789'],
        ['BANK_NAME', 'Community Trust Bank'],
      ].map(([key, value]) =>
        this.prisma.systemConfig.upsert({
          where: { key },
          update: {},
          create: { key, value },
        }),
      ),
    );

    return this.prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async update(key: string, value: string, actorId: string) {
    const config = await this.prisma.systemConfig.findUnique({ where: { key } });

    if (config) {
      const updated = await this.prisma.systemConfig.update({
        where: { key },
        data: { value },
      });

      await this.audit.log(actorId, 'UPDATE_SYSTEM_CONFIG', 'SystemConfig', key, {
        oldValue: config.value,
        newValue: value,
      });

      return updated;
    }

    const created = await this.prisma.systemConfig.create({
      data: { key, value },
    });

    await this.audit.log(actorId, 'CREATE_SYSTEM_CONFIG', 'SystemConfig', key, {
      value,
    });

    return created;
  }

  async runWeeklyDeductions(actorId: string, force = false) {
    try {
      return await this.weeklyDeductions.runDaily(actorId, { force, trigger: 'ADMIN' });
    } catch (error: any) {
      await Promise.all([
        this.prisma.systemConfig.upsert({
          where: { key: 'COOPERATIVE_DEDUCTION_LAST_STATUS' },
          update: { value: 'FAILED' },
          create: { key: 'COOPERATIVE_DEDUCTION_LAST_STATUS', value: 'FAILED' },
        }),
        this.prisma.systemConfig.upsert({
          where: { key: 'COOPERATIVE_DEDUCTION_LAST_ERROR' },
          update: { value: error?.message || 'Unknown weekly deduction error' },
          create: {
            key: 'COOPERATIVE_DEDUCTION_LAST_ERROR',
            value: error?.message || 'Unknown weekly deduction error',
          },
        }),
      ]);
      throw error;
    }
  }
}
