import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { UpdateMemberDto, UpdateMemberStatusDto, QueryMembersDto } from './dto';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(query: QueryMembersDto) {
    const { status, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { membershipNumber: { contains: search, mode: 'insensitive' } },
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
          wallet: { select: { availableBalance: true, currency: true } },
        },
      }),
      this.prisma.member.count({ where }),
    ]);

    return {
      items: items.map((m) => ({
        ...m,
        wallet: m.wallet
          ? { availableBalance: Number(m.wallet.availableBalance), currency: m.wallet.currency }
          : null,
      })),
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
              { user: { email: { contains: query, mode: 'insensitive' } } },
            ],
          }
        : undefined,
      take: 10,
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
        email: item.user.email,
      })),
    };
  }

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true } },
        wallet: { select: { id: true, availableBalance: true, pendingBalance: true, currency: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        loanApplications: { orderBy: { submittedAt: 'desc' } },
        investments: {
          include: { product: true },
          orderBy: { maturityDate: 'desc' },
        },
      },
    });

    if (!member) throw new NotFoundException('Member not found');

    return {
      ...member,
      wallet: member.wallet
        ? {
            availableBalance: Number(member.wallet.availableBalance),
            pendingBalance: Number(member.wallet.pendingBalance),
            currency: member.wallet.currency,
            transactions: await this.prisma.transaction.findMany({
              where: { walletId: member.wallet.id },
              orderBy: { createdAt: 'desc' },
              take: 20,
            }).then((transactions) =>
              transactions.map((transaction) => ({
                ...transaction,
                amount: Number(transaction.amount),
              })),
            ),
          }
        : null,
      payments: member.payments.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        netCreditAmount: payment.netCreditAmount ? Number(payment.netCreditAmount) : null,
      })),
      loanApplications: member.loanApplications.map((l) => ({
        ...l,
        amount: Number(l.amount),
      })),
      investments: member.investments.map((i) => ({
        ...i,
        principal: Number(i.principal),
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

    if (!member) throw new NotFoundException('Member profile not found');

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

  async create(
    actorId: string,
    body: { email: string; fullName: string; phoneNumber: string; address?: string },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const tempCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const tempActivationCodeHash = await bcrypt.hash(tempCode, 10);
    const passwordHash = await bcrypt.hash(`TEMP-${tempCode}`, 10);
    const membershipCount = await this.prisma.member.count();
    const membershipNumber = `ACH-${String(membershipCount + 1).padStart(6, '0')}`;

    const created = await this.prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        role: 'MEMBER',
        tempActivationCodeHash,
        tempCodeExpiry: new Date(Date.now() + 72 * 60 * 60 * 1000),
        member: {
          create: {
            fullName: body.fullName,
            phoneNumber: body.phoneNumber,
            address: body.address,
            membershipNumber,
            status: 'PENDING',
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

    await this.audit.log(actorId, 'CREATE_MEMBER', 'Member', created.member!.id, {
      email: body.email,
      membershipNumber,
    });

    return {
      userId: created.id,
      memberId: created.member?.id,
      email: created.email,
      membershipNumber,
      activationCode: tempCode,
    };
  }

  async updateProfile(userId: string, dto: UpdateMemberDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member not found');

    const updated = await this.prisma.member.update({
      where: { id: member.id },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.phoneNumber && { phoneNumber: dto.phoneNumber }),
      },
    });

    await this.audit.log(userId, 'UPDATE_PROFILE', 'Member', member.id, { dto });

    return updated;
  }

  async updateById(id: string, dto: UpdateMemberDto, actorId: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');

    const updated = await this.prisma.member.update({
      where: { id },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.phoneNumber && { phoneNumber: dto.phoneNumber }),
      },
    });

    await this.audit.log(actorId, 'UPDATE_MEMBER', 'Member', id, dto as Record<string, unknown>);

    return updated;
  }

  async updateStatus(id: string, dto: UpdateMemberStatusDto, actorId: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');

    const updated = await this.prisma.member.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.audit.log(actorId, 'UPDATE_MEMBER_STATUS', 'Member', id, {
      status: dto.status,
    });

    return updated;
  }

  async updateAvatar(id: string, avatarUrl: string, actorId: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');

    const updated = await this.prisma.member.update({
      where: { id },
      data: { avatarUrl },
    });

    await this.audit.log(actorId, 'UPDATE_MEMBER_AVATAR', 'Member', id, { avatarUrl });
    return updated;
  }

  async remove(id: string, actorId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.$transaction([
      this.prisma.member.delete({ where: { id } }),
      this.prisma.user.delete({ where: { id: member.userId } }),
    ]);

    await this.audit.log(actorId, 'DELETE_MEMBER', 'Member', id);
    return { success: true };
  }
}
