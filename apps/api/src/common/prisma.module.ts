import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditService } from './services/audit.service';
import { WalletService } from './services/wallet.service';
import { NotificationService } from './services/notification.service';
import { MembershipChargeService } from './services/membership-charge.service';
import { MailService } from './services/mail.service';
import { WeeklyDeductionsService } from './services/weekly-deductions.service';
import { CloudinaryService } from './services/cloudinary.service';

@Global()
@Module({
  providers: [
    PrismaService,
    AuditService,
    WalletService,
    NotificationService,
    MembershipChargeService,
    MailService,
    WeeklyDeductionsService,
    CloudinaryService,
  ],
  exports: [
    PrismaService,
    AuditService,
    WalletService,
    NotificationService,
    MembershipChargeService,
    MailService,
    WeeklyDeductionsService,
    CloudinaryService,
  ],
})
export class PrismaModule {}
