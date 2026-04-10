import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MembershipChargeService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig() {
    let config = await this.prisma.systemConfig.findUnique({
      where: { key: 'MEMBERSHIP_CHARGE_RATE' },
    });

    if (!config) {
      config = await this.prisma.systemConfig.create({
        data: { key: 'MEMBERSHIP_CHARGE_RATE', value: '0.02' },
      });
    }

    return Number(config.value);
  }

  async calculateCharge(amount: number): Promise<number> {
    const rate = await this.getConfig();
    return Math.round(amount * rate * 100) / 100;
  }

  async applyCharge(amount: number): Promise<{ charge: number; netAmount: number }> {
    const charge = await this.calculateCharge(amount);
    const netAmount = Math.round((amount - charge) * 100) / 100;
    return { charge, netAmount };
  }
}
