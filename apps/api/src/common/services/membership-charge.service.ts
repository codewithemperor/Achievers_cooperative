import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { normalizeMoney } from '../utils/money';

@Injectable()
export class MembershipChargeService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig() {
    let config = await this.prisma.systemConfig.findUnique({
      where: { key: 'MEMBERSHIP_CHARGE_RATE' },
    });

    if (!config) {
      config = await this.prisma.systemConfig.create({
        data: { key: 'MEMBERSHIP_CHARGE_RATE', value: '0' },
      });
    }

    return Number(config.value);
  }

  async calculateCharge(amount: number): Promise<number> {
    const rate = await this.getConfig();
    return normalizeMoney(normalizeMoney(amount) * rate);
  }

  async applyCharge(amount: number): Promise<{ charge: number; netAmount: number }> {
    amount = normalizeMoney(amount);
    const charge = await this.calculateCharge(amount);
    const netAmount = normalizeMoney(amount - charge);
    return { charge, netAmount };
  }
}
