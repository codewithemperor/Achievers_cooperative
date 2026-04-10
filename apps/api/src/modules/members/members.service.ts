import { Injectable, NotFoundException } from '@nestjs/common';
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

  async findOne(id: string) {
    const member = await this.prisma.member.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, role: true } },
        wallet: { select: { availableBalance: true, pendingBalance: true, currency: true } },
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
          }
        : null,
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
}
