import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { RegisterDto, LoginDto } from './dto/index';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: 'MEMBER',
        member: {
          create: {
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            membershipNumber: `ACH-${Date.now().toString(36).toUpperCase()}`,
          },
        },
      },
      include: { member: true },
    });

    const token = this.signToken(user.id, user.email, user.role);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        member: user.member
          ? {
              id: user.member.id,
              fullName: user.member.fullName,
              membershipNumber: user.member.membershipNumber,
              status: user.member.status,
            }
          : null,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { member: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.signToken(user.id, user.email, user.role);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        member: user.member
          ? {
              id: user.member.id,
              fullName: user.member.fullName,
              membershipNumber: user.member.membershipNumber,
              status: user.member.status,
            }
          : null,
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      member: user.member
        ? {
            id: user.member.id,
            fullName: user.member.fullName,
            phoneNumber: user.member.phoneNumber,
            membershipNumber: user.member.membershipNumber,
            status: user.member.status,
            joinedAt: user.member.joinedAt,
          }
        : null,
    };
  }

  async activate(email: string, tempActivationCode: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { member: true },
    });

    if (!user || !user.member) {
      throw new UnauthorizedException('Invalid activation request');
    }

    if (!user.tempActivationCodeHash || !user.tempCodeExpiry) {
      throw new BadRequestException('No activation code is available');
    }

    if (user.tempCodeExpiry.getTime() < Date.now()) {
      throw new BadRequestException('Activation code has expired');
    }

    const valid = await bcrypt.compare(tempActivationCode, user.tempActivationCodeHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid activation code');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tempActivationCodeHash: null,
        tempCodeExpiry: null,
      },
    });

    await this.prisma.member.update({
      where: { userId: user.id },
      data: { status: 'ACTIVE' },
    });

    return { success: true };
  }

  async refresh(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      token: this.signToken(user.id, user.email, user.role),
    };
  }

  async logout(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { success: true };
  }

  private signToken(sub: string, email: string, role: string) {
    return this.jwt.sign({ sub, email, role });
  }
}
