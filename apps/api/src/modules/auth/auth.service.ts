import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NON_ACTIVE_MEMBER_STATUSES, isValidNigerianPhoneNumber } from '../../common/member.constants';
import { ChangePasswordDto, RegisterDto, LoginDto } from './dto/index';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    if (!isValidNigerianPhoneNumber(dto.phoneNumber)) {
      throw new BadRequestException('Phone number must be 11 digits and start with 0');
    }

    const passwordHash = await bcrypt.hash(dto.phoneNumber, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: 'MEMBER',
        member: {
          create: {
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            address: dto.address ?? dto.homeAddress,
            homeAddress: dto.homeAddress,
            stateOfOrigin: dto.stateOfOrigin,
            dateOfBirth: new Date(dto.dateOfBirth),
            occupation: dto.occupation,
            maritalStatus: dto.maritalStatus as any,
            identificationNumber: dto.identificationNumber,
            identificationPicture: dto.identificationPicture,
            identificationType: dto.identificationType as any,
            referrerId: dto.referrerId,
            membershipNumber: `ACH-${Date.now().toString(36).toUpperCase()}`,
            status: 'ACTIVE',
            wallet: {
              create: {},
            },
          },
        },
      },
      include: { member: true },
    });

    await this.audit.log(user.id, 'SELF_REGISTER_MEMBER', 'Member', user.member!.id, {
      email: dto.email,
      phoneNumber: dto.phoneNumber,
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

    if (user.member?.status && NON_ACTIVE_MEMBER_STATUSES.has(user.member.status as any)) {
      throw new UnauthorizedException('Your account is not active. Please contact your cooperative administrator.');
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
            homeAddress: user.member.homeAddress,
            stateOfOrigin: user.member.stateOfOrigin,
            dateOfBirth: user.member.dateOfBirth,
            occupation: user.member.occupation,
            maritalStatus: user.member.maritalStatus,
            identificationNumber: user.member.identificationNumber,
            identificationPicture: user.member.identificationPicture,
            identificationType: user.member.identificationType,
            avatarUrl: user.member.avatarUrl,
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

    await this.prisma.member.update({ where: { userId: user.id }, data: { status: 'ACTIVE' } });

    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { member: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, tempActivationCodeHash: null, tempCodeExpiry: null },
    });

    await this.audit.log(userId, 'CHANGE_PASSWORD', 'User', userId, {
      memberId: user.member?.id,
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
