import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationService } from '../../common/services/notification.service';
import { WeeklyDeductionsService } from '../../common/services/weekly-deductions.service';
import { WalletService } from '../../common/services/wallet.service';
import { maskPhoneNumber, isValidNigerianPhoneNumber } from '../../common/member.constants';
import { CreateMemberDto, UpdateMemberDto, UpdateMemberStatusDto, QueryMembersDto } from './dto/index';
import { normalizePagination } from '../../common/pagination';

const MEMBERSHIP_FEE_CONFIG_KEY = 'MEMBERSHIP_FEE_AMOUNT';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly weeklyDeductions: WeeklyDeductionsService,
    private readonly walletService: WalletService,
  ) {}

  async findAll(query: QueryMembersDto) {
    const { status, search } = query;
    const { page, limit, skip } = normalizePagination(query);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { membershipNumber: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: { joinedAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, role: true } },
          wallet: { select: { id: true, availableBalance: true, pendingBalance: true, currency: true } },
          referrer: { select: { id: true, fullName: true, membershipNumber: true } },
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    return {
      items: items.map((member) => this.serializeMemberListItem(member)),
      total,
      page,
      limit,
    };
  }

  async search(query?: string) {
    const items = await this.prisma.member.findMany({
      where: query
        ? {
            OR: [
              { fullName: { contains: query, mode: 'insensitive' } },
              { membershipNumber: { contains: query, mode: 'insensitive' } },
              { phoneNumber: { contains: query, mode: 'insensitive' } },
              { user: { email: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      take: 50,
      orderBy: { joinedAt: 'desc' },
      include: {
        user: { select: { email: true } },
      },
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        membershipNumber: item.membershipNumber,
        phoneNumber: item.phoneNumber,
        email: item.user.email,
      })),
    };
  }

  async listGuarantorOptions(userId: string) {
    const currentMember = await this.prisma.member.findUnique({
      where: { userId },
      select: { id: true },
    });

    const items = await this.prisma.member.findMany({
      where: {
        status: 'ACTIVE',
        ...(currentMember?.id ? { id: { not: currentMember.id } } : {}),
      },
      take: 50,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        membershipNumber: true,
        phoneNumber: true,
      },
    });

    return { items };
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true } },
        wallet: { select: { id: true, availableBalance: true, pendingBalance: true, currency: true } },
        referrer: { select: { id: true, fullName: true, membershipNumber: true } },
        savingsAccounts: true,
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        loanApplications: {
          orderBy: { submittedAt: 'desc' },
          include: {
            guarantorOne: { select: { id: true, fullName: true, membershipNumber: true } },
            guarantorTwo: { select: { id: true, fullName: true, membershipNumber: true } },
          },
        },
        investments: {
          include: { product: true },
          orderBy: { maturityDate: 'desc' },
        },
        packageSubscriptions: {
          include: { package: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const transactions = member.wallet
      ? await this.prisma.transaction.findMany({
          where: { walletId: member.wallet.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [];

    return {
      ...member,
      wallet: member.wallet
        ? {
            availableBalance: Number(member.wallet.availableBalance),
            pendingBalance: Number(member.wallet.pendingBalance),
            currency: member.wallet.currency,
            transactions: transactions.map((transaction) => ({
              ...transaction,
              amount: Number(transaction.amount),
            })),
          }
        : null,
      payments: member.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        netCreditAmount: payment.netCreditAmount ? Number(payment.netCreditAmount) : null,
      })),
      loanApplications: member.loanApplications.map((loan) => ({
        ...loan,
        amount: Number(loan.amount),
        remainingBalance: Number(loan.remainingBalance),
      })),
      investments: member.investments.map((investment) => ({
        ...investment,
        principal: Number(investment.principal),
      })),
      savingsAccounts: member.savingsAccounts.map((account) => ({
        ...account,
        balance: Number(account.balance),
      })),
      packageSubscriptions: member.packageSubscriptions.map((subscription) => ({
        ...subscription,
        amountPaid: Number(subscription.amountPaid),
        amountRemaining: Number(subscription.amountRemaining),
        penaltyAccrued: Number(subscription.penaltyAccrued),
        package: {
          ...subscription.package,
          totalAmount: Number(subscription.package.totalAmount),
          penaltyValue: Number(subscription.package.penaltyValue),
        },
      })),
    };
  }

  async findByUserId(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, role: true } },
        wallet: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member profile not found');
    }

    return {
      ...member,
      wallet: member.wallet
        ? {
            ...member.wallet,
            availableBalance: Number(member.wallet.availableBalance),
            pendingBalance: Number(member.wallet.pendingBalance),
          }
        : null,
    };
  }

  async getDashboard(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { userId },
      include: {
        user: { select: { email: true } },
        wallet: true,
        investments: { include: { product: true }, take: 5, orderBy: { maturityDate: 'desc' } },
        loanApplications: {
          take: 5,
          orderBy: { submittedAt: 'desc' },
          include: {
            activities: {
              where: { type: 'AMOUNT_INCREASE' },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        packageSubscriptions: { include: { package: true }, take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!member || !member.wallet) {
      throw new NotFoundException('Member dashboard not found');
    }

    const [recentTransactions, pendingPayments, transactionCount, savingsTotal, termsConfig, bankName, bankAccountName, bankAccountNumber] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { walletId: member.wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.payment.findMany({
        where: {
          memberId: member.id,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.transaction.count({ where: { walletId: member.wallet.id } }),
      this.prisma.savingsAccount.aggregate({
        where: { memberId: member.id },
        _sum: { balance: true },
      }),
      this.prisma.systemConfig.findUnique({ where: { key: 'MEMBER_TERMS_HTML' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'BANK_NAME' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'BANK_ACCOUNT_NAME' } }),
      this.prisma.systemConfig.findUnique({ where: { key: 'BANK_ACCOUNT_NUMBER' } }),
    ]);

    const activeLoan = member.loanApplications.find((loan) =>
      ['APPROVED', 'DISBURSED', 'IN_PROGRESS', 'OVERDUE'].includes(loan.status),
    );
    const activePackage = member.packageSubscriptions.find((subscription) =>
      ['APPROVED', 'DISBURSED', 'IN_PROGRESS'].includes(subscription.status),
    );
    const pendingPackagesTotal = member.packageSubscriptions
      .filter((subscription) => subscription.status === 'PENDING')
      .reduce((sum, subscription) => sum + Number(subscription.package.totalAmount), 0);
    const pendingLoansTotal = member.loanApplications
      .filter((loan) => loan.status === 'PENDING')
      .reduce((sum, loan) => sum + Number(loan.amount), 0);
    const activeLoanAmount = activeLoan ? Number(activeLoan.amount) : 0;
    const activeLoanExplicitDisbursed = activeLoan ? Number((activeLoan as any).disbursedAmount ?? 0) : 0;
    const activeLoanFirstIncreasePreviousAmount =
      activeLoan && Array.isArray((activeLoan as any).activities) && (activeLoan as any).activities.length
        ? Number((activeLoan as any).activities[0].previousAmount ?? 0)
        : 0;
    const activeLoanDisbursed =
      activeLoan && activeLoanExplicitDisbursed > 0
        ? activeLoanExplicitDisbursed
        : activeLoan && activeLoanFirstIncreasePreviousAmount > 0 && ['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(activeLoan.status)
          ? activeLoanFirstIncreasePreviousAmount
          : activeLoan && ['DISBURSED', 'IN_PROGRESS', 'OVERDUE', 'COMPLETED'].includes(activeLoan.status)
            ? activeLoanAmount
            : 0;
    const cooperativeAccounts = [
      {
        bankName: bankName?.value ?? '',
        accountName: bankAccountName?.value ?? '',
        accountNumber: bankAccountNumber?.value ?? '',
      },
    ].filter((account) => account.bankName || account.accountName || account.accountNumber);

    const mergedActivity = [
      ...recentTransactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        amount: Number(transaction.amount),
        status: transaction.status,
        createdAt: transaction.createdAt,
        description: transaction.description,
        reference: transaction.reference,
      })),
      ...pendingPayments.map((payment) => ({
        id: `payment-${payment.id}`,
        type: 'WALLET_FUNDING_REQUEST',
        amount: Number(payment.amount),
        status: payment.status,
        createdAt: payment.createdAt,
        description: 'Wallet funding request submitted for approval',
        reference: null,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    return {
      profile: {
        id: member.id,
        fullName: member.fullName,
        membershipNumber: member.membershipNumber,
        phoneNumber: member.phoneNumber,
        email: member.user.email,
        avatarUrl: member.avatarUrl,
        status: member.status,
        joinedAt: member.joinedAt,
      },
      wallet: {
        availableBalance: Number(member.wallet.availableBalance),
        pendingBalance: Number(member.wallet.pendingBalance),
        totalFunded: Number(member.wallet.totalFunded),
        currency: member.wallet.currency,
      },
      summary: {
        totalSavings: Number(savingsTotal._sum.balance ?? 0),
        totalInvestments: member.investments
          .filter((item) => item.status === 'APPROVED')
          .reduce((sum, item) => sum + Number(item.principal), 0),
        transactionCount,
        pendingPaymentsTotal: pendingPayments.reduce((sum, item) => sum + Number(item.amount), 0),
        pendingPaymentsCount: pendingPayments.length,
        pendingPackagesTotal,
        pendingLoansTotal,
        activeLoan: activeLoan
          ? {
              id: activeLoan.id,
              amount: activeLoanAmount,
              approvedAmount: activeLoanAmount,
              disbursedAmount: activeLoanDisbursed,
              remainingToDisburse: Math.max(activeLoanAmount - activeLoanDisbursed, 0),
              amountPaidSoFar: Math.max(activeLoanDisbursed - Number(activeLoan.remainingBalance), 0),
              remainingBalance: Number(activeLoan.remainingBalance),
              status: activeLoan.status,
            }
          : null,
        activePackage: activePackage
          ? {
              id: activePackage.id,
              packageId: activePackage.packageId,
              packageName: activePackage.package.name,
              subscribedAmount: Number(activePackage.package.totalAmount),
              amountPaid: Number(activePackage.amountPaid),
              amountRemaining: Number(activePackage.amountRemaining),
              status: activePackage.status,
            }
          : null,
      },
      recentTransactions: mergedActivity,
      cooperativeAccount: {
        bankName: bankName?.value ?? '',
        accountName: bankAccountName?.value ?? '',
        accountNumber: bankAccountNumber?.value ?? '',
      },
      cooperativeAccounts,
      termsHtml: termsConfig?.value ?? '<p>Terms and conditions will be published here by your administrator.</p>',
    };
  }

  async create(actorId: string, dto: CreateMemberDto) {
    if (!isValidNigerianPhoneNumber(dto.phoneNumber)) {
      throw new BadRequestException('Phone number must be 11 digits and start with 0');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    if (dto.referrerId) {
      const referrer = await this.prisma.member.findUnique({ where: { id: dto.referrerId } });
      if (!referrer) {
        throw new NotFoundException('Selected referrer does not exist');
      }
    }

    const passwordHash = await bcrypt.hash(dto.phoneNumber, 12);
    const membershipCount = await this.prisma.member.count();
    const membershipNumber = `ACH-${String(membershipCount + 1).padStart(6, '0')}`;

    const created = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: 'MEMBER',
        tempActivationCodeHash: null,
        tempCodeExpiry: null,
        member: {
          create: {
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            address: dto.address ?? dto.homeAddress,
            homeAddress: dto.homeAddress,
            stateOfOrigin: dto.stateOfOrigin,
            dateOfBirth: new Date(dto.dateOfBirth),
            occupation: dto.occupation,
            maritalStatus: dto.maritalStatus,
            identificationNumber: dto.identificationNumber,
            identificationPicture: dto.identificationPicture,
            identificationType: dto.identificationType,
            referrerId: dto.referrerId,
            membershipNumber,
            status: dto.status ?? 'ACTIVE',
            wallet: {
              create: {},
            },
          },
        },
      },
      include: {
        member: true,
      },
    });

    await this.applyMembershipFee(created.member!.id, actorId, created.member!.fullName);

    await this.audit.log(actorId, 'CREATE_MEMBER', 'Member', created.member!.id, {
      email: dto.email,
      membershipNumber,
      defaultPassword: 'PHONE_NUMBER',
    });

    return {
      userId: created.id,
      memberId: created.member?.id,
      email: created.email,
      membershipNumber,
      defaultPasswordHint: created.member ? maskPhoneNumber(created.member.phoneNumber) : null,
    };
  }

  async resetPassword(id: string, actorId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    if (!isValidNigerianPhoneNumber(member.phoneNumber)) {
      throw new BadRequestException('Member phone number is invalid. Update the phone number before resetting password.');
    }

    const passwordHash = await bcrypt.hash(member.phoneNumber, 12);

    await this.prisma.user.update({
      where: { id: member.userId },
      data: {
        passwordHash,
        tempActivationCodeHash: null,
        tempCodeExpiry: null,
      },
    });

    await this.notifications.notifyMember(
      member.userId,
      'Password reset by admin',
      `Your password has been reset to your phone number ending in ${member.phoneNumber.slice(-4)}.`,
    );

    await this.audit.log(actorId, 'RESET_MEMBER_PASSWORD', 'Member', id, {
      resetToPhoneNumber: true,
    });

    return {
      success: true,
      resetTo: member.phoneNumber,
      maskedResetTo: maskPhoneNumber(member.phoneNumber),
    };
  }

  async updateProfile(userId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const data = this.buildMemberUpdateData(dto);
    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data,
    });

    await this.audit.log(userId, 'UPDATE_PROFILE', 'Member', member.id, { dto });

    return updated;
  }

  async updateById(id: string, dto: UpdateMemberDto, actorId: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const data = this.buildMemberUpdateData(dto);
    const updated = await this.prisma.member.update({
      where: { id },
      data,
    });

    await this.audit.log(actorId, 'UPDATE_MEMBER', 'Member', id, dto as Record<string, unknown>);

    return updated;
  }

  async updateStatus(id: string, dto: UpdateMemberStatusDto, actorId: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit.log(actorId, 'UPDATE_MEMBER_STATUS', 'Member', id, {
      previousStatus: member.status,
      status: dto.status,
    });

    return updated;
  }

  async updateAvatar(id: string, avatarUrl: string, actorId: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { avatarUrl },
    });

    await this.audit.log(actorId, 'UPDATE_MEMBER_AVATAR', 'Member', id, { avatarUrl });
    return updated;
  }

  async remove(id: string, actorId: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });

    await this.audit.log(actorId, 'WITHDRAW_MEMBER', 'Member', id);
    return { success: true, member: updated };
  }

  async runWeeklyDeductions(actorId: string, force = false) {
    return this.weeklyDeductions.run(actorId, { force, trigger: 'ADMIN' });
  }

  private serializeMemberListItem(member: any) {
    return {
      ...member,
      wallet: member.wallet
        ? {
            availableBalance: Number(member.wallet.availableBalance),
            pendingBalance: Number(member.wallet.pendingBalance),
            currency: member.wallet.currency,
          }
        : null,
      referrer: member.referrer,
    };
  }

  private buildMemberUpdateData(dto: UpdateMemberDto) {
    if (dto.phoneNumber && !isValidNigerianPhoneNumber(dto.phoneNumber)) {
      throw new BadRequestException('Phone number must be 11 digits and start with 0');
    }

    return {
      ...(dto.fullName && { fullName: dto.fullName }),
      ...(dto.phoneNumber && { phoneNumber: dto.phoneNumber }),
      ...(dto.address && { address: dto.address }),
      ...(dto.homeAddress && { homeAddress: dto.homeAddress, address: dto.address ?? dto.homeAddress }),
      ...(dto.stateOfOrigin && { stateOfOrigin: dto.stateOfOrigin }),
      ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
      ...(dto.occupation && { occupation: dto.occupation }),
      ...(dto.maritalStatus && { maritalStatus: dto.maritalStatus }),
      ...(dto.identificationNumber && { identificationNumber: dto.identificationNumber }),
      ...(dto.identificationPicture && { identificationPicture: dto.identificationPicture }),
      ...(dto.identificationType && { identificationType: dto.identificationType }),
      ...(dto.referrerId !== undefined && { referrerId: dto.referrerId || null }),
      ...(dto.status && { status: dto.status }),
      ...(dto.avatarUrl && { avatarUrl: dto.avatarUrl }),
    };
  }

  private async applyMembershipFee(memberId: string, actorId: string, fullName: string) {
    const config = await this.prisma.systemConfig.findUnique({ where: { key: MEMBERSHIP_FEE_CONFIG_KEY } });
    const membershipFeeAmount = Number(config?.value ?? 0);
    if (membershipFeeAmount <= 0) {
      return;
    }

    const reference = `MEMBERSHIP-${memberId}`;
    const existing = await this.prisma.transaction.findUnique({ where: { reference } });
    if (existing) {
      return;
    }

    const wallet = await this.walletService.getMemberWallet(memberId);
    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: membershipFeeAmount },
          pendingBalance: membershipFeeAmount,
        },
      }),
      this.prisma.transaction.create({
        data: {
          walletId: wallet.id,
          type: 'MEMBERSHIP_FEE',
          amount: membershipFeeAmount,
          status: 'PENDING',
          reference,
          category: 'membership fee',
          description: 'Automatic membership fee created during registration',
          editable: false,
          lockReason: 'Membership fee transactions are generated automatically when a member is registered.',
          metadata: {
            outstandingAmount: membershipFeeAmount,
          } as any,
        },
      }),
      this.prisma.cooperativeWallet.upsert({
        where: { id: (await this.ensureCooperativeWallet()).id },
        update: {
          balance: { increment: membershipFeeAmount },
          totalIncome: { increment: membershipFeeAmount },
        },
        create: {
          balance: membershipFeeAmount,
          totalIncome: membershipFeeAmount,
        },
      }),
    ]);

    const cooperativeWallet = await this.ensureCooperativeWallet();
    await this.prisma.cooperativeEntry.create({
      data: {
        walletId: cooperativeWallet.id,
        type: 'INCOME',
        amount: membershipFeeAmount,
        category: 'membership fee',
        description: `Membership fee recorded for ${fullName}`,
        reference,
        createdById: actorId,
      },
    });
  }

  private async ensureCooperativeWallet() {
    const existing = await this.prisma.cooperativeWallet.findFirst();
    if (existing) {
      return existing;
    }

    return this.prisma.cooperativeWallet.create({ data: {} });
  }
}
