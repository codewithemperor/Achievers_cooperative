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
    const configs = await this.prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });

    const map: Record<string, string> = {};
    for (const c of configs) {
      map[c.key] = c.value;
    }

    return map;
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
