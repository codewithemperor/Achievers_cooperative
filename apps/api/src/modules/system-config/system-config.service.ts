import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class SystemConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getAll() {
    await Promise.all(
      [
        ['MEMBERSHIP_FEE_AMOUNT', '1000'],
        ['COOPERATIVE_DEDUCTION_DAY', 'MONDAY'],
        ['COOPERATIVE_DEDUCTION_AMOUNT', '1000'],
        ['MEMBER_TERMS_HTML', '<p>Welcome to Achievers Cooperative.</p>'],
        ['COOPERATIVE_DEDUCTION_LAST_RUN', ''],
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
}
