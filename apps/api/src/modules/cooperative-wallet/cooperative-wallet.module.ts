import { Module } from '@nestjs/common';
import { CooperativeWalletController } from './cooperative-wallet.controller';
import { CooperativeWalletService } from './cooperative-wallet.service';

@Module({
  controllers: [CooperativeWalletController],
  providers: [CooperativeWalletService],
  exports: [CooperativeWalletService],
})
export class CooperativeWalletModule {}
