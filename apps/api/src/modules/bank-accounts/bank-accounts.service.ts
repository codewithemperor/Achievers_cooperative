import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { CreateBankAccountDto, UpdateBankAccountDto, VerifyBankAccountDto } from './dto/index';

interface PaystackBank {
  name: string;
  code: string;
  active?: boolean;
  country?: string;
  currency?: string;
  type?: string;
}

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async getBanks() {
    const secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      throw new BadRequestException('Paystack secret key is not configured.');
    }

    try {
      const response = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=100', {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });

      const body = (await response.json()) as {
        message?: string;
        data?: PaystackBank[];
      };

      if (!response.ok) {
        throw new BadRequestException(body.message || 'Unable to load bank list from Paystack.');
      }

      return (body.data ?? [])
        .filter((bank) => bank.code && bank.name && bank.active !== false)
        .map((bank) => ({
          name: bank.name,
          code: bank.code,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Unable to reach Paystack bank list right now. Please try again later.');
    }
  }

  async verifyAccountNumber(dto: VerifyBankAccountDto): Promise<{ accountName: string; accountNumber: string }> {
    const secretKey = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      throw new BadRequestException('Paystack secret key is not configured.');
    }

    try {
      const url = `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(dto.accountNumber)}&bank_code=${encodeURIComponent(dto.bankCode)}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      });

      if (!response.ok) {
        const body = (await response.json()) as Record<string, unknown>;
        throw new BadRequestException(
          (body?.message as string) || `Could not verify account number. Please check the details and try again.`,
        );
      }

      const data = (await response.json()) as { data?: { account_name?: string } };
      if (!data.data || !data.data.account_name) {
        throw new BadRequestException('Account verification failed. No account name returned.');
      }

      return {
        accountName: data.data.account_name,
        accountNumber: dto.accountNumber,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Unable to reach the account verification service. Please try again later.');
    }
  }

  async findAll(userId: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const accounts = await this.prisma.bankAccount.findMany({
      where: { memberId: member.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return accounts;
  }

  async create(userId: string, dto: CreateBankAccountDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const banks = await this.getBanks();
    const bank = banks.find((item) => item.code === dto.bankCode);
    const bankName = dto.bankName || bank?.name;
    if (!bankName) {
      throw new BadRequestException('Bank name could not be determined. Please provide a valid bank code.');
    }

    // Check for duplicate account number
    const existing = await this.prisma.bankAccount.findUnique({
      where: {
        memberId_accountNumber: {
          memberId: member.id,
          accountNumber: dto.accountNumber,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(`This account number (${dto.accountNumber}) has already been added.`);
    }

    // If this is set as default, unset any existing default
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { memberId: member.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const account = await this.prisma.bankAccount.create({
      data: {
        memberId: member.id,
        bankName,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
        isDefault: dto.isDefault ?? false,
        verifiedAt: new Date(),
      },
    });

    await this.audit.log(userId, 'ADD_BANK_ACCOUNT', 'BankAccount', account.id, {
      bankName,
      accountNumber: dto.accountNumber,
    });

    return account;
  }

  async update(userId: string, id: string, dto: UpdateBankAccountDto) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Bank account not found');
    if (account.memberId !== member.id) throw new ForbiddenException('You do not own this bank account');

    // If account number changed, re-verify
    if (dto.accountNumber && dto.accountNumber !== account.accountNumber) {
      // Check duplicate
      const duplicate = await this.prisma.bankAccount.findUnique({
        where: {
          memberId_accountNumber: {
            memberId: member.id,
            accountNumber: dto.accountNumber,
          },
        },
      });
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(`This account number (${dto.accountNumber}) has already been added.`);
      }
    }

    // If set as default, unset others
    if (dto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { memberId: member.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    let bankName = dto.bankName;
    if (dto.bankCode) {
      const banks = await this.getBanks();
      const bank = banks.find((item) => item.code === dto.bankCode);
      bankName = bankName || bank?.name;
    }

    const updated = await this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.accountNumber !== undefined && { accountNumber: dto.accountNumber }),
        ...(dto.accountName !== undefined && { accountName: dto.accountName }),
        ...(bankName && { bankName }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...((dto.accountNumber !== undefined || dto.accountName !== undefined || dto.bankCode !== undefined) && {
          verifiedAt: new Date(),
        }),
      },
    });

    await this.audit.log(userId, 'UPDATE_BANK_ACCOUNT', 'BankAccount', id, { changes: dto });

    return updated;
  }

  async remove(userId: string, id: string) {
    const member = await this.prisma.member.findUnique({ where: { userId } });
    if (!member) throw new NotFoundException('Member profile not found');

    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('Bank account not found');
    if (account.memberId !== member.id) throw new ForbiddenException('You do not own this bank account');

    await this.prisma.bankAccount.delete({ where: { id } });

    await this.audit.log(userId, 'DELETE_BANK_ACCOUNT', 'BankAccount', id, {
      bankName: account.bankName,
      accountNumber: account.accountNumber,
    });

    return { message: `Bank account (${account.bankName} - ${account.accountNumber}) has been removed successfully.` };
  }
}
