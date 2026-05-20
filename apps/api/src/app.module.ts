import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MembersModule } from './modules/members/members.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { LoansModule } from './modules/loans/loans.module';
import { SavingsModule } from './modules/savings/savings.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PackagesModule } from './modules/packages/packages.module';
import { CooperativeWalletModule } from './modules/cooperative-wallet/cooperative-wallet.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { WeeklyDeductionsModule } from './modules/weekly-deductions/weekly-deductions.module';
import { HealthController } from './common/health.controller';
import { CronController } from './common/cron.controller';

@Module({
  controllers: [HealthController, CronController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MembersModule,
    WalletsModule,
    TransactionsModule,
    SavingsModule,
    LoansModule,
    InvestmentsModule,
    NotificationsModule,
    AuditModule,
    ReportsModule,
    SystemConfigModule,
    PaymentsModule,
    PackagesModule,
    CooperativeWalletModule,
    UploadsModule,
    BankAccountsModule,
    WeeklyDeductionsModule,
  ],
})
export class AppModule {}
