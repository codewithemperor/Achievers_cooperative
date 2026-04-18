import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './services/audit.service';
import { WalletService } from './services/wallet.service';
import { NotificationService } from './services/notification.service';
import { MembershipChargeService } from './services/membership-charge.service';

@Global()
@Module({
  providers: [
    PrismaService,
    AuditService,
    WalletService,
    NotificationService,
    MembershipChargeService,
  ],
  exports: [
    PrismaService,
    AuditService,
    WalletService,
    NotificationService,
    MembershipChargeService,
  ],
})
export class PrismaModule {}
