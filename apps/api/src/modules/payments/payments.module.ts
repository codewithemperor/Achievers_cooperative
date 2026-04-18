import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CooperativeWalletModule } from '../cooperative-wallet/cooperative-wallet.module';

@Module({
  imports: [CooperativeWalletModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
