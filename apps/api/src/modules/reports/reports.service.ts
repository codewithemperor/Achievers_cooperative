import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalMembers,
      activeMembers,
      inactiveMembers,
      totalWalletBalance,
      totalSavings,
      totalLoansDisbursed,
      pendingLoans,
      totalInvestments,
      treasury,
    ] = await Promise.all([
      this.prisma.member.count(),
      this.prisma.member.count({ where: { status: 'ACTIVE' } }),
      this.prisma.member.count({ where: { status: 'INACTIVE' } }),
      this.prisma.wallet.aggregate({ _sum: { availableBalance: true } }),
      this.prisma.savingsAccount.aggregate({ _sum: { balance: true } }),
      this.prisma.loanApplication.aggregate({
        _sum: { amount: true },
        where: { status: 'APPROVED' },
      }),
      this.prisma.loanApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.investmentSubscription.aggregate({
        _sum: { principal: true },
        where: { status: 'APPROVED' },
      }),
      this.prisma.cooperativeWallet.findFirst(),
    ]);

    return {
      members: {
        total: totalMembers,
        active: activeMembers,
        pending: inactiveMembers,
      },
      wallet: {
        totalBalance: Number(totalWalletBalance._sum.availableBalance ?? 0),
      },
      savings: {
        totalBalance: Number(totalSavings._sum.balance ?? 0),
      },
      loans: {
        totalDisbursed: Number(totalLoansDisbursed._sum.amount ?? 0),
        pending: pendingLoans,
      },
      investments: {
        totalPrincipal: Number(totalInvestments._sum.principal ?? 0),
      },
      cooperativeTreasury: {
        balance: Number(treasury?.balance ?? 0),
        totalIncome: Number(treasury?.totalIncome ?? 0),
        totalExpense: Number(treasury?.totalExpense ?? 0),
      },
    };
  }

  async getDashboard() {
    const [summary, membershipGrowth, loanPortfolio, revenue, recentTransactions, pendingPayments, pendingLoans] = await Promise.all([
      this.getSummary(),
      this.getMembershipGrowth(),
      this.getLoanPortfolio(),
      this.getRevenue(),
      this.getCooperativeTransactionReport({ limit: 6 }),
      this.prisma.payment.findMany({
        where: { status: 'PENDING' },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { member: { select: { id: true, fullName: true } } },
      }),
      this.prisma.loanApplication.findMany({
        where: { status: 'PENDING' },
        take: 10,
        orderBy: { submittedAt: 'desc' },
        include: { member: { select: { id: true, fullName: true, membershipNumber: true } } },
      }),
    ]);

    return {
      summary,
      membershipGrowth,
      loanPortfolio,
      revenue,
      recentTransactions,
      pendingPayments: pendingPayments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
      })),
      pendingLoans: pendingLoans.map((loan) => ({
        ...loan,
        amount: Number(loan.amount),
      })),
    };
  }

  async getMemberReport() {
    const members = await this.prisma.member.findMany({
      orderBy: { joinedAt: 'desc' },
      include: {
        user: { select: { email: true, role: true } },
        wallet: { select: { availableBalance: true, currency: true } },
        savingsAccounts: { select: { balance: true } },
        loanApplications: { where: { status: 'APPROVED' }, select: { amount: true } },
      },
    });

    return members.map((m) => ({
      id: m.id,
      fullName: m.fullName,
      membershipNumber: m.membershipNumber,
      status: m.status,
      email: m.user.email,
      joinedAt: m.joinedAt,
      walletBalance: m.wallet ? Number(m.wallet.availableBalance) : 0,
      savingsBalance: m.savingsAccounts.reduce((sum, s) => sum + Number(s.balance), 0),
      totalLoans: m.loanApplications.reduce((sum, l) => sum + Number(l.amount), 0),
    }));
  }

  async getLoanReport() {
    const loans = await this.prisma.loanApplication.findMany({
      orderBy: { submittedAt: 'desc' },
      include: {
        member: {
          select: { fullName: true, membershipNumber: true },
        },
      },
    });

    return loans.map((l) => ({
      id: l.id,
      amount: Number(l.amount),
      tenorMonths: l.tenorMonths,
      purpose: l.purpose,
      status: l.status,
      submittedAt: l.submittedAt,
      memberName: l.member.fullName,
      membershipNumber: l.member.membershipNumber,
    }));
  }

  async getTransactionReport(options?: { limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = options ?? {};

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          wallet: {
            include: {
              member: { select: { fullName: true, membershipNumber: true } },
            },
          },
        },
      }),
      this.prisma.transaction.count(),
    ]);

    return {
      items: items.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        status: t.status,
        reference: t.reference,
        createdAt: t.createdAt,
        memberName: t.wallet.member.fullName,
        membershipNumber: t.wallet.member.membershipNumber,
      })),
      total,
      limit,
      offset,
    };
  }

  async getCooperativeTransactionReport(options?: { limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = options ?? {};

    const wallet = await this.prisma.cooperativeWallet.findFirst();
    if (!wallet) {
      return {
        items: [],
        total: 0,
        limit,
        offset,
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.cooperativeEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.cooperativeEntry.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return {
      items: items.map((entry) => ({
        id: entry.id,
        type: entry.type,
        amount: Number(entry.amount),
        category: entry.category,
        description: entry.description,
        reference: entry.reference,
        createdAt: entry.createdAt,
      })),
      total,
      limit,
      offset,
    };
  }

  async getMembershipGrowth() {
    const members = await this.prisma.member.findMany({
      orderBy: { joinedAt: 'asc' },
      select: { joinedAt: true },
    });

    const buckets = new Map<string, number>();

    for (const member of members) {
      const key = member.joinedAt.toISOString().slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    return Array.from(buckets.entries()).map(([month, count]) => ({ month, count }));
  }

  async getLoanPortfolio() {
    const loans = await this.prisma.loanApplication.groupBy({
      by: ['status'],
      _sum: { amount: true },
      _count: { id: true },
    });

    return loans.map((loan) => ({
      status: loan.status,
      count: loan._count.id,
      totalAmount: Number(loan._sum.amount ?? 0),
    }));
  }

  async getRevenue() {
    const charges = await this.prisma.cooperativeEntry.findMany({
      where: { category: 'MEMBERSHIP_CHARGE' },
      orderBy: { createdAt: 'asc' },
      select: { amount: true, createdAt: true },
    });

    const buckets = new Map<string, number>();

    for (const charge of charges) {
      const key = charge.createdAt.toISOString().slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(charge.amount));
    }

    return Array.from(buckets.entries()).map(([month, total]) => ({ month, total }));
  }
}
