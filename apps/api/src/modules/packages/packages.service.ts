import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll() {
    const items = await this.prisma.package.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: items.map((item) => ({
        ...item,
        totalAmount: Number(item.totalAmount),
        penaltyValue: Number(item.penaltyValue),
      })),
    };
  }

  async findOne(id: string) {
    const item = await this.prisma.package.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            member: { select: { id: true, fullName: true, membershipNumber: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Package not found');
    }

    const subscriptions = item.subscriptions.map((subscription) => ({
      ...subscription,
      amountPaid: Number(subscription.amountPaid),
      amountRemaining: Number(subscription.amountRemaining),
      penaltyAccrued: Number(subscription.penaltyAccrued),
    }));

    return {
      ...item,
      totalAmount: Number(item.totalAmount),
      penaltyValue: Number(item.penaltyValue),
      subscriptions,
      defaulters: subscriptions.filter(
        (subscription) =>
          subscription.penaltyAccrued > 0 ||
          (subscription.nextDueAt ? subscription.nextDueAt < new Date() : false),
      ),
    };
  }

  async create(actorId: string, body: {
    name: string;
    totalAmount: number;
    durationMonths: number;
    penaltyType: string;
    penaltyValue: number;
    penaltyFrequency: string;
  }) {
    const created = await this.prisma.package.create({
      data: body,
    });

    await this.audit.log(actorId, 'CREATE_PACKAGE', 'Package', created.id, body);

    return {
      ...created,
      totalAmount: Number(created.totalAmount),
      penaltyValue: Number(created.penaltyValue),
    };
  }

  async update(id: string, actorId: string, body: Partial<{
    name: string;
    totalAmount: number;
    durationMonths: number;
    penaltyType: string;
    penaltyValue: number;
    penaltyFrequency: string;
    isActive: boolean;
  }>) {
    const existing = await this.prisma.package.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Package not found');
    }

    const updated = await this.prisma.package.update({
      where: { id },
      data: body,
    });

    await this.audit.log(actorId, 'UPDATE_PACKAGE', 'Package', id, body as Record<string, unknown>);

    return {
      ...updated,
      totalAmount: Number(updated.totalAmount),
      penaltyValue: Number(updated.penaltyValue),
    };
  }

  async listSubscriptions() {
    const items = await this.prisma.packageSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, fullName: true, membershipNumber: true } },
        package: { select: { id: true, name: true } },
      },
    });

    return {
      items: items.map((item) => ({
        ...item,
        amountPaid: Number(item.amountPaid),
        amountRemaining: Number(item.amountRemaining),
        penaltyAccrued: Number(item.penaltyAccrued),
      })),
    };
  }

  async subscribe(userId: string, body: { packageId: string; memberId?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    let memberId = body.memberId;

    if (user?.role === 'MEMBER') {
      const member = await this.prisma.member.findUnique({ where: { userId } });
      memberId = member?.id;
    }

    if (!memberId) {
      throw new BadRequestException('Member is required');
    }

    const selectedPackage = await this.prisma.package.findUnique({ where: { id: body.packageId } });
    if (!selectedPackage) {
      throw new NotFoundException('Package not found');
    }

    const created = await this.prisma.packageSubscription.create({
      data: {
        packageId: body.packageId,
        memberId,
        amountRemaining: selectedPackage.totalAmount,
        nextDueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: {
        member: { select: { fullName: true, membershipNumber: true } },
        package: { select: { name: true } },
      },
    });

    await this.audit.log(userId, 'SUBSCRIBE_PACKAGE', 'PackageSubscription', created.id, {
      packageId: body.packageId,
      memberId,
    });

    return {
      ...created,
      amountPaid: Number(created.amountPaid),
      amountRemaining: Number(created.amountRemaining),
      penaltyAccrued: Number(created.penaltyAccrued),
    };
  }

  async defaulters() {
    const items = await this.prisma.packageSubscription.findMany({
      where: {
        OR: [
          { penaltyAccrued: { gt: 0 } },
          { nextDueAt: { lt: new Date() } },
        ],
      },
      include: {
        member: { select: { fullName: true, membershipNumber: true } },
        package: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      items: items.map((item) => ({
        ...item,
        amountPaid: Number(item.amountPaid),
        amountRemaining: Number(item.amountRemaining),
        penaltyAccrued: Number(item.penaltyAccrued),
      })),
    };
  }
}
