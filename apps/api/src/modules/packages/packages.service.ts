import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { WalletService } from '../../common/services/wallet.service';
import { normalizeMoney } from '../../common/utils/money';

const PACKAGE_ACTIVE_STATUSES = ['PENDING', 'APPROVED', 'DISBURSED', 'IN_PROGRESS'] as const;
const PACKAGE_PAYABLE_STATUSES = ['APPROVED', 'DISBURSED', 'IN_PROGRESS'] as const;

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly walletService: WalletService,
  ) {}

  async findAll(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const items = await this.prisma.package.findMany({
      where: user?.role === 'SUPER_ADMIN' ? undefined : { isActive: true },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
        subscriptions: {
          select: {
            status: true,
          },
        },
      } as any,
      orderBy: { createdAt: 'desc' },
    } as any);

    return {
      items: items.map((item) => ({
        ...item,
        totalAmount: Number(item.totalAmount),
        penaltyValue: Number(item.penaltyValue),
        subscriberCount: (item as any)._count?.subscriptions ?? 0,
        pendingRequestCount: ((item as any).subscriptions ?? []).filter((subscription: any) => subscription.status === 'PENDING')
          .length,
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
            disbursementBankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
      } as any,
    } as any);

    if (!item) {
      throw new NotFoundException('Package not found');
    }

    const subscriptions = (item as any).subscriptions.map((subscription: any) => this.serializeSubscription(subscription));
    const subscriptionIds = subscriptions.map((subscription: any) => subscription.id);
    const transactions = subscriptionIds.length
      ? await this.prisma.transaction.findMany({
          where: {
            type: { in: ['PACKAGE_SUBSCRIPTION', 'PACKAGE_PENALTY'] as any },
            OR: subscriptionIds.map((subscriptionId: string) => ({
              metadata: { path: ['subscriptionId'], equals: subscriptionId },
            })),
          },
          orderBy: { createdAt: 'desc' },
          include: {
            wallet: {
              include: {
                member: { select: { id: true, fullName: true, membershipNumber: true } },
              },
            },
          },
        })
      : [];

    return {
      ...item,
      totalAmount: Number(item.totalAmount),
      penaltyValue: Number(item.penaltyValue),
      subscriptions,
      transactions: transactions.map((transaction) => ({
        ...transaction,
        amount: Number(transaction.amount),
      })),
      defaulters: subscriptions.filter(
        (subscription: any) =>
          subscription.penaltyAccrued > 0 ||
          (subscription.nextDueAt ? new Date(subscription.nextDueAt) < new Date() : false),
      ),
    };
  }

  async create(actorId: string, body: {
    name: string;
    totalAmount: number;
    durationMonths?: number;
    startDate?: string;
    endDate?: string;
    penaltyType: string;
    penaltyValue: number;
    penaltyFrequency: string;
    addAllMembers?: boolean;
  }) {
    const { addAllMembers, ...packageBody } = body;
    packageBody.totalAmount = normalizeMoney(packageBody.totalAmount);
    packageBody.penaltyValue = normalizeMoney(packageBody.penaltyValue);
    this.validatePackagePayload(packageBody);
    const schedule = this.resolvePackageSchedule(packageBody.startDate, packageBody.endDate, packageBody.durationMonths);
    const created = await this.prisma.package.create({
      data: {
        ...packageBody,
        totalAmount: packageBody.totalAmount,
        penaltyValue: packageBody.penaltyValue,
        durationMonths: schedule.durationMonths,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        repaymentFrequency: 'WEEKLY',
      } as any,
    });

    const autoSubscriberCount = addAllMembers ? await this.addAllActiveMembersToPackage(created) : 0;

    await this.audit.log(actorId, 'CREATE_PACKAGE', 'Package', created.id, {
      ...packageBody,
      addAllMembers: Boolean(addAllMembers),
      autoSubscriberCount,
    });

    return {
      ...created,
      totalAmount: Number(created.totalAmount),
      penaltyValue: Number(created.penaltyValue),
      autoSubscriberCount,
    };
  }

  async update(id: string, actorId: string, body: Partial<{
    name: string;
    totalAmount: number;
    durationMonths: number;
    startDate: string;
    endDate: string;
    penaltyType: string;
    penaltyValue: number;
    penaltyFrequency: string;
    isActive: boolean;
    addAllMembers?: boolean;
  }>) {
    const { addAllMembers, ...packageBody } = body;
    if (packageBody.totalAmount !== undefined) packageBody.totalAmount = normalizeMoney(packageBody.totalAmount);
    if (packageBody.penaltyValue !== undefined) packageBody.penaltyValue = normalizeMoney(packageBody.penaltyValue);
    const existing = await this.prisma.package.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Package not found');
    }

    this.validatePackagePayload({
      totalAmount: packageBody.totalAmount ?? Number(existing.totalAmount),
      penaltyValue: packageBody.penaltyValue ?? Number(existing.penaltyValue),
      startDate: packageBody.startDate ?? ((existing as any).startDate ? new Date((existing as any).startDate).toISOString() : undefined),
      endDate: packageBody.endDate ?? ((existing as any).endDate ? new Date((existing as any).endDate).toISOString() : undefined),
    });

    const schedule =
      packageBody.startDate || packageBody.endDate || packageBody.durationMonths
        ? this.resolvePackageSchedule(
            packageBody.startDate ?? ((existing as any).startDate ? new Date((existing as any).startDate).toISOString() : undefined),
            packageBody.endDate ?? ((existing as any).endDate ? new Date((existing as any).endDate).toISOString() : undefined),
            packageBody.durationMonths ?? (existing as any).durationMonths,
          )
        : null;

    const updated = await this.prisma.package.update({
      where: { id },
      data: {
        ...packageBody,
        ...(schedule
          ? {
              durationMonths: schedule.durationMonths,
              startDate: schedule.startDate,
              endDate: schedule.endDate,
              repaymentFrequency: 'WEEKLY',
            }
          : {}),
      } as any,
    });

    if (packageBody.totalAmount !== undefined || schedule) {
      await this.rebuildSchedulesForPackage(updated.id);
    }

    const autoSubscriberCount = addAllMembers ? await this.addAllActiveMembersToPackage(updated) : 0;

    await this.audit.log(actorId, 'UPDATE_PACKAGE', 'Package', id, {
      ...packageBody,
      addAllMembers: Boolean(addAllMembers),
      autoSubscriberCount,
    });

    return {
      ...updated,
      totalAmount: Number(updated.totalAmount),
      penaltyValue: Number(updated.penaltyValue),
      autoSubscriberCount,
    };
  }

  async delete(id: string, actorId: string) {
    const existing = await this.prisma.package.findUnique({
      where: { id },
      include: {
        subscriptions: {
          select: { id: true },
        },
      },
    } as any);

    if (!existing) {
      throw new NotFoundException('Package not found');
    }

    if ((existing as any).subscriptions.length > 0) {
      throw new BadRequestException('This package already has subscribers and cannot be deleted.');
    }

    await this.prisma.package.delete({ where: { id } });
    await this.audit.log(actorId, 'DELETE_PACKAGE', 'Package', id, {});
    return { success: true };
  }

  async listSubscriptions() {
    const items = await this.prisma.packageSubscription.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        member: { select: { id: true, fullName: true, membershipNumber: true } },
        package: { select: { id: true, name: true, totalAmount: true, durationMonths: true, penaltyValue: true, penaltyType: true } },
        disbursementBankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
      } as any,
    } as any);

    return {
      items: items.map((item) => this.serializeSubscription(item)),
    };
  }

  async getSubscription(id: string, actorId?: string) {
    const actor = actorId
      ? await this.prisma.user.findUnique({ where: { id: actorId } })
      : null;
    const subscription = await this.prisma.packageSubscription.findUnique({
      where: { id },
      include: {
        member: {
          include: {
            wallet: true,
          },
        },
        package: true,
        disbursementBankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
      } as any,
    } as any);

    if (!subscription) {
      throw new NotFoundException('Package subscription not found');
    }

    if (actor?.role === 'MEMBER') {
      const actorMember = await this.prisma.member.findUnique({
        where: { userId: actorId },
        select: { id: true },
      });
      if (!actorMember || actorMember.id !== subscription.memberId) {
        throw new BadRequestException('You can only view your own package subscription.');
      }
    }

    const relatedTransactions = (subscription as any).member.wallet
      ? await this.prisma.transaction.findMany({
          where: {
            walletId: (subscription as any).member.wallet.id,
            OR: [
              { metadata: { path: ['subscriptionId'], equals: subscription.id } },
              { reference: `PACKAGE-SUB-${subscription.id}` },
            ],
          },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const repaymentAttempts = await (this.prisma as any).repaymentAttempt.findMany({
      where: {
        targetType: 'PackageSubscription',
        targetId: subscription.id,
      },
      orderBy: { attemptedAt: 'desc' },
      include: { transaction: true },
    });

    const activityLog = await this.prisma.auditEvent.findMany({
      where: {
        entityType: 'PackageSubscription',
        entityId: subscription.id,
        action: {
          notIn: ['VIEW_PACKAGE_SUBSCRIPTION'],
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalAmount = Number((subscription as any).package.totalAmount);
    const amountPaid = Number(subscription.amountPaid);
    const progress = totalAmount > 0 ? Math.min((amountPaid / totalAmount) * 100, 100) : 0;
    const timeline = this.buildTimeline(subscription, relatedTransactions);
    let paymentSchedule = this.buildPaymentSchedule(subscription, totalAmount, amountPaid);
    if (['APPROVED', 'DISBURSED', 'IN_PROGRESS', 'COMPLETED'].includes(subscription.status)) {
      const persistedSchedule = await this.walletService.ensurePackageRepaymentSchedule(subscription.id);
      if (persistedSchedule.length) {
        paymentSchedule = persistedSchedule.map((item: any) => this.walletService.serializeRepaymentScheduleItem(item));
      }
    }

    return {
      ...this.serializeSubscription(subscription),
      progress,
      member: {
        ...(subscription as any).member,
        wallet: (subscription as any).member.wallet
          ? {
              ...((subscription as any).member.wallet),
              availableBalance: Number((subscription as any).member.wallet.availableBalance),
              pendingBalance: Number((subscription as any).member.wallet.pendingBalance),
            }
          : null,
      },
      timeline,
      paymentSchedule,
      relatedTransactions: relatedTransactions.map((item) => ({
        ...item,
        amount: Number(item.amount),
      })),
      repaymentAttempts: repaymentAttempts.map((attempt: any) => this.serializeRepaymentAttempt(attempt)),
      activityLog,
    };
  }

  async subscribe(userId: string, body: { packageId: string; memberId?: string; disbursementBankAccountId?: string }) {
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
    if (!selectedPackage.isActive) {
      throw new BadRequestException('This package is currently inactive');
    }
    this.assertPackageCanAcceptSubscriptions(selectedPackage);

    let disbursementBankAccountId: string | null = null;
    if (body.disbursementBankAccountId) {
      const bankAccount = await this.prisma.bankAccount.findUnique({ where: { id: body.disbursementBankAccountId } });
      if (!bankAccount || bankAccount.memberId !== memberId) {
        throw new BadRequestException('Invalid bank account selected.');
      }
      disbursementBankAccountId = body.disbursementBankAccountId;
    }

    const duplicate = await this.prisma.packageSubscription.findFirst({
      where: {
        memberId,
        packageId: body.packageId,
        status: { in: [...PACKAGE_ACTIVE_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (duplicate) {
      throw new BadRequestException('You already have an active subscription for this package.');
    }

    const created = await this.prisma.packageSubscription.create({
      data: {
        packageId: body.packageId,
        memberId,
        amountRemaining: normalizeMoney(selectedPackage.totalAmount),
        status: 'PENDING',
        nextDueAt: null,
        disbursementBankAccountId,
      },
      include: {
        member: { select: { fullName: true, membershipNumber: true } },
        package: { select: { id: true, name: true, totalAmount: true, durationMonths: true, penaltyValue: true, penaltyType: true } },
        disbursementBankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
      } as any,
    } as any);

    await this.audit.log(userId, 'SUBSCRIBE_PACKAGE', 'PackageSubscription', created.id, {
      packageId: body.packageId,
      memberId,
      disbursementBankAccountId,
    });

    return this.serializeSubscription(created);
  }

  async updateSubscriptionStatus(id: string, actorId: string, action: 'approve' | 'disburse' | 'mark-in-progress' | 'complete') {
    return this.applySubscriptionStatusChange(id, actorId, action);
  }

  async rejectSubscription(id: string, actorId: string, reason?: string) {
    return this.applySubscriptionStatusChange(id, actorId, 'reject', reason);
  }

  async makeManualAllocation(id: string, actorId: string, amount: number) {
    amount = normalizeMoney(amount);
    const subscription = await this.prisma.packageSubscription.findUnique({ where: { id } });
    if (!subscription) {
      throw new NotFoundException('Package subscription not found');
    }

    if (!PACKAGE_PAYABLE_STATUSES.includes(subscription.status as any)) {
      throw new BadRequestException('Package repayment can only be processed for active subscriptions.');
    }

    const result = await this.walletService.applyPackagePayment(subscription.memberId, subscription.id, amount, 'ADMIN');
    await this.audit.log(actorId, 'ADMIN_ALLOCATE_PACKAGE_PAYMENT', 'PackageSubscription', id, { amount });

    return {
      ...result,
      subscription: await this.getSubscription(id),
    };
  }

  private async applySubscriptionStatusChange(
    id: string,
    actorId: string,
    action: 'approve' | 'disburse' | 'mark-in-progress' | 'complete' | 'reject',
    reason?: string,
  ) {
    const subscription = await this.prisma.packageSubscription.findUnique({
      where: { id },
      include: {
        package: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Package subscription not found');
    }

    this.assertValidSubscriptionTransition(subscription.status, action);

    const approvalTimestamp = new Date();
    const data =
      action === 'approve'
        ? {
            status: 'APPROVED' as const,
            approvedAt: approvalTimestamp,
            nextDueAt: this.getInitialPackageDueDate({
              ...subscription,
              approvedAt: approvalTimestamp,
            } as any),
          }
        : action === 'reject'
          ? { status: 'REJECTED' as const, rejectedAt: new Date(), nextDueAt: null }
        : action === 'disburse'
          ? { status: 'DISBURSED' as const, disbursedAt: new Date() }
          : action === 'mark-in-progress'
            ? { status: 'IN_PROGRESS' as const }
            : { status: 'COMPLETED' as const, completedAt: new Date(), amountRemaining: 0, nextDueAt: null };

    const updated = await this.prisma.packageSubscription.update({
      where: { id },
      data: data as any,
      include: {
        member: { select: { id: true, fullName: true, membershipNumber: true } },
        package: true,
        disbursementBankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
      } as any,
    } as any);

    if (['approve', 'complete'].includes(action)) {
      await this.walletService.rebuildPackageRepaymentSchedule(updated.id);
    } else if (action === 'reject') {
      await (this.prisma as any).repaymentScheduleItem.deleteMany({
        where: { targetType: 'PackageSubscription', targetId: updated.id },
      });
    }

    await this.audit.log(actorId, `PACKAGE_SUBSCRIPTION_${action.toUpperCase().replace('-', '_')}`, 'PackageSubscription', id, {
      ...(reason ? { reason } : {}),
    });

    return this.serializeSubscription(updated);
  }

  async payFromMemberWallet(id: string, userId: string, amount: number) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    const subscription = await this.prisma.packageSubscription.findUnique({
      where: { id },
    });

    if (!subscription || subscription.memberId !== member.id) {
      throw new NotFoundException('Package subscription not found');
    }

    if (!PACKAGE_PAYABLE_STATUSES.includes(subscription.status as any)) {
      throw new BadRequestException('This package subscription is not active for payment.');
    }

    const result = await this.walletService.applyPackagePayment(member.id, subscription.id, amount, 'MEMBER');
    await this.audit.log(userId, 'MEMBER_PACKAGE_PAYMENT', 'PackageSubscription', id, { amount });

    return {
      ...result,
      subscription: await this.getSubscription(id, userId),
    };
  }

  async getMySubscriptions(userId: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    const items = await this.prisma.packageSubscription.findMany({
      where: { memberId: member.id },
      include: {
        package: true,
        disbursementBankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
      } as any,
      orderBy: { updatedAt: 'desc' },
    } as any);

    return {
      items: items.map((item) => this.serializeSubscription(item)),
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
        package: { select: { id: true, name: true, totalAmount: true, durationMonths: true, penaltyValue: true, penaltyType: true } },
        disbursementBankAccount: { select: { id: true, bankName: true, accountNumber: true, accountName: true } },
      } as any,
      orderBy: { updatedAt: 'desc' },
    } as any);

    return {
      items: items.map((item) => this.serializeSubscription(item)),
    };
  }

  private async addAllActiveMembersToPackage(selectedPackage: {
    id: string;
    name: string;
    totalAmount: any;
    durationMonths: number;
    startDate?: Date | null;
    endDate?: Date | null;
    repaymentFrequency?: string | null;
    createdAt: Date;
  }) {
    this.assertPackageCanAcceptSubscriptions(selectedPackage);

    const approvalTimestamp = new Date();
    const nextDueAt = this.getInitialPackageDueDate({
      ...selectedPackage,
      approvedAt: approvalTimestamp,
    });

    return this.prisma.runTransaction(
      'packages.addAllActiveMembersToPackage',
      async (tx) => {
        const members = await tx.member.findMany({
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            fullName: true,
            membershipNumber: true,
            wallet: { select: { id: true } },
          },
        });

        if (!members.length) {
          return 0;
        }

        const existingSubscriptions = await (tx as any).packageSubscription.findMany({
          where: {
            packageId: selectedPackage.id,
            memberId: { in: members.map((member) => member.id) },
          },
          select: { memberId: true },
        });
        const existingMemberIds = new Set(existingSubscriptions.map((subscription: any) => subscription.memberId));
        const eligibleMembers = members.filter((member) => !existingMemberIds.has(member.id));
        const createdSubscriptions = [];

        for (const member of eligibleMembers) {
          const subscription = await (tx as any).packageSubscription.create({
            data: {
              packageId: selectedPackage.id,
              memberId: member.id,
              amountRemaining: selectedPackage.totalAmount,
              status: 'APPROVED',
              approvedAt: approvalTimestamp,
              nextDueAt,
              disbursementBankAccountId: null,
            },
          });
          await this.walletService.rebuildPackageRepaymentSchedule(subscription.id, tx);
          createdSubscriptions.push({ ...subscription, member });
        }

        return createdSubscriptions.length;
      },
      { maxWait: 30000, timeout: 120000 },
    );
  }

  private async rebuildSchedulesForPackage(packageId: string) {
    const subscriptions = await this.prisma.packageSubscription.findMany({
      where: {
        packageId,
        status: { in: ['APPROVED', 'DISBURSED', 'IN_PROGRESS', 'COMPLETED'] },
      } as any,
      select: { id: true },
    });

    for (const subscription of subscriptions) {
      await this.walletService.rebuildPackageRepaymentSchedule(subscription.id);
    }
  }

  private serializeSubscription(item: any) {
    const packageData = item.package
      ? {
          ...item.package,
          totalAmount: Number(item.package.totalAmount),
          penaltyValue: Number(item.package.penaltyValue ?? 0),
        }
      : undefined;

    return {
      ...item,
      amountPaid: Number(item.amountPaid),
      amountRemaining: Number(item.amountRemaining),
      penaltyAccrued: Number(item.penaltyAccrued),
      subscribedAmount: packageData ? Number(packageData.totalAmount) : Number(item.amountPaid) + Number(item.amountRemaining),
      status: item.status === 'ACTIVE' ? 'IN_PROGRESS' : item.status,
      package: packageData,
      totalAmount: packageData ? Number(packageData.totalAmount) : undefined,
    };
  }

  private serializeRepaymentAttempt(attempt: any) {
    return {
      id: attempt.id,
      phase: attempt.phase,
      targetType: attempt.targetType,
      targetId: attempt.targetId,
      expectedAmount: Number(attempt.expectedAmount),
      paidAmount: Number(attempt.paidAmount),
      remainingAmount: Number(attempt.remainingAmount),
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
            amount: Number(attempt.transaction.amount),
          }
        : null,
    };
  }

  private assertValidSubscriptionTransition(
    currentStatus: string,
    action: 'approve' | 'disburse' | 'mark-in-progress' | 'complete' | 'reject',
  ) {
    const transitions: Record<typeof action, string[]> = {
      approve: ['PENDING'],
      reject: ['PENDING'],
      disburse: ['APPROVED'],
      'mark-in-progress': ['APPROVED', 'DISBURSED'],
      complete: ['APPROVED', 'DISBURSED', 'IN_PROGRESS'],
    };

    if (!transitions[action].includes(currentStatus)) {
      throw new BadRequestException(`Cannot ${action.replace('-', ' ')} a subscription with status ${currentStatus}.`);
    }
  }

  private validatePackagePayload(body: {
    totalAmount?: number;
    penaltyValue?: number;
    startDate?: string;
    endDate?: string;
  }) {
    if (body.totalAmount !== undefined && (!Number.isFinite(body.totalAmount) || body.totalAmount <= 0)) {
      throw new BadRequestException('Package total amount must be greater than zero.');
    }

    if (body.penaltyValue !== undefined && (!Number.isFinite(body.penaltyValue) || body.penaltyValue < 0)) {
      throw new BadRequestException('Penalty value must be zero or greater.');
    }

    if (body.startDate && Number.isNaN(new Date(body.startDate).getTime())) {
      throw new BadRequestException('Start date is invalid.');
    }

    if (body.endDate && Number.isNaN(new Date(body.endDate).getTime())) {
      throw new BadRequestException('End date is invalid.');
    }
  }

  private assertPackageCanAcceptSubscriptions(pkg: { endDate?: Date | string | null }) {
    if (!this.isPackageExpired(pkg)) {
      return;
    }

    throw new BadRequestException('This package has expired and can no longer accept subscriptions.');
  }

  private isPackageExpired(pkg: { endDate?: Date | string | null }) {
    if (!pkg.endDate) {
      return false;
    }

    const endDate = new Date(pkg.endDate);
    if (Number.isNaN(endDate.getTime())) {
      return false;
    }

    endDate.setHours(23, 59, 59, 999);
    return endDate.getTime() < Date.now();
  }

  private resolvePackageSchedule(startDate?: string, endDate?: string, fallbackDurationMonths?: number) {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start && end && end >= start) {
      const durationMonths = Math.max(this.fullMonthsBetween(start, end) || 1, 1);
      return {
        startDate: start,
        endDate: end,
        durationMonths,
      };
    }

    return {
      startDate: start,
      endDate: end,
      durationMonths: fallbackDurationMonths ?? 1,
    };
  }

  private getInitialPackageDueDate(pkg: any) {
    const anchor = this.getPackageScheduleAnchor(pkg);
    if (anchor) {
      return anchor;
    }

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek;
  }

  private fullMonthsBetween(start: Date, end: Date) {
    if (end <= start) {
      return 0;
    }

    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    if (end.getDate() < start.getDate()) {
      months -= 1;
    }

    return Math.max(months, 0);
  }

  private buildTimeline(subscription: any, relatedTransactions: Array<{ type: string; status: string; createdAt: Date; amount: any; reference?: string | null }>) {
    const timeline = [
      { label: 'Pending', date: subscription.createdAt, status: 'COMPLETED' },
      {
        label: 'Approved',
        date: subscription.approvedAt ?? null,
        status: subscription.approvedAt ? 'COMPLETED' : subscription.status === 'PENDING' ? 'CURRENT' : 'UPCOMING',
      },
      {
        label: 'Disbursed',
        date: subscription.disbursedAt ?? null,
        status: subscription.disbursedAt ? 'COMPLETED' : ['APPROVED'].includes(subscription.status) ? 'CURRENT' : 'UPCOMING',
      },
      {
        label: 'In Progress',
        date: subscription.disbursedAt ?? subscription.approvedAt ?? subscription.createdAt,
        status: subscription.status === 'IN_PROGRESS' ? 'CURRENT' : ['COMPLETED'].includes(subscription.status) ? 'COMPLETED' : 'UPCOMING',
      },
      {
        label: 'Completed',
        date: subscription.completedAt ?? null,
        status: subscription.status === 'COMPLETED' ? 'COMPLETED' : 'UPCOMING',
      },
    ].filter((item) => item.date);

    const payments = relatedTransactions.map((item) => ({
      label: item.type === 'PACKAGE_PENALTY' ? 'Penalty paid' : 'Package payment posted',
      date: item.createdAt,
      status: item.status === 'APPROVED' ? 'SUCCESSFUL' : item.status,
      amount: Number(item.amount),
      reference: item.reference,
    }));

    return [...timeline, ...payments];
  }

  private buildPaymentSchedule(subscription: any, totalAmount: number, amountPaid: number) {
    const durationMonths = Math.max(Number(subscription.package?.durationMonths ?? 1), 1);
    const repaymentFrequency = String(subscription.package?.repaymentFrequency ?? 'WEEKLY').toUpperCase();
    const installmentCount = repaymentFrequency === 'MONTHLY' ? durationMonths : Math.max(durationMonths * 4, 1);
    const installmentAmount = normalizeMoney(totalAmount / installmentCount);
    const anchor = this.getPackageScheduleAnchor(subscription) ?? subscription.createdAt ?? new Date();
    let remainingPaid = amountPaid;

    return Array.from({ length: installmentCount }).map((_, index) => {
      const dueDate = new Date(anchor);
      if (repaymentFrequency === 'MONTHLY') {
        dueDate.setMonth(dueDate.getMonth() + index + 1);
      } else {
        dueDate.setDate(dueDate.getDate() + (index + 1) * 7);
      }

      const paidForInstallment = remainingPaid >= installmentAmount;
      const paidAmount = normalizeMoney(Math.min(Math.max(remainingPaid, 0), installmentAmount));
      if (paidForInstallment) {
        remainingPaid = normalizeMoney(remainingPaid - installmentAmount);
      } else {
        remainingPaid = 0;
      }

      return {
        installment: index + 1,
        dueDate,
        amount: installmentAmount,
        expectedAmount: installmentAmount,
        paidAmount,
        remainingAmount: normalizeMoney(Math.max(installmentAmount - paidAmount, 0)),
        status: paidForInstallment ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING',
      };
    });
  }

  private getPackageScheduleAnchor(subscriptionOrPackage: {
    startDate?: Date | null;
    approvedAt?: Date | null;
    disbursedAt?: Date | null;
    createdAt?: Date;
    package?: { startDate?: Date | null };
  }) {
    const packageStartDate = subscriptionOrPackage.package?.startDate ?? subscriptionOrPackage.startDate ?? null;
    const approvalAnchor = subscriptionOrPackage.disbursedAt ?? subscriptionOrPackage.approvedAt ?? subscriptionOrPackage.createdAt ?? null;

    return packageStartDate ?? approvalAnchor ?? null;
  }
}
