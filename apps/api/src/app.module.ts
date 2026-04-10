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
import { HealthController } from './common/health.controller';

@Module({
  controllers: [HealthController],
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
  ],
})
export class AppModule {}
