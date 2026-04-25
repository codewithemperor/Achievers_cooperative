import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './services/audit.service';
import { WalletService } from './services/wallet.service';
import { NotificationService } from './services/notification.service';
import { MembershipChargeService } from './services/membership-charge.service';
import { MailService } from './services/mail.service';

@Global()
@Module({
  providers: [
    PrismaService,
    AuditService,
    WalletService,
    NotificationService,
    MembershipChargeService,
    MailService,
  ],
  exports: [
    PrismaService,
    AuditService,
    WalletService,
    NotificationService,
    MembershipChargeService,
    MailService,
  ],
})
export class PrismaModule {}
