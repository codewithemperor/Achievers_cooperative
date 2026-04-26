import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module';
import { WeeklyDeductionRequestMiddleware } from './common/middleware/weekly-deduction-request.middleware';
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
import { HealthController } from './common/health.controller';

@Module({
  controllers: [HealthController],
  providers: [WeeklyDeductionRequestMiddleware],
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(WeeklyDeductionRequestMiddleware).forRoutes('*');
  }
}
