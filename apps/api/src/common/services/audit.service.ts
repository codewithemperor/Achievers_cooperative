import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.auditEvent.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata: metadata as any,
      },
    });
  }

  async getEntityHistory(entityType: string, entityId: string) {
    return this.prisma.auditEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          select: { id: true, email: true, role: true },
        },
      },
    });
  }

  async getLogs(options?: {
    actorId?: string;
    entityType?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    const { actorId, entityType, action, limit = 50, offset = 0 } = options ?? {};

    const where: Record<string, unknown> = {};
    if (actorId) where.actorId = actorId;
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;

    const [items, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actor: {
            select: { id: true, email: true, role: true },
          },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return { items, total, limit, offset };
  }
}
