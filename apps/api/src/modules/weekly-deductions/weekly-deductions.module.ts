import { Module } from '@nestjs/common';
import { WeeklyDeductionsController } from './weekly-deductions.controller';

@Module({
  controllers: [WeeklyDeductionsController],
})
export class WeeklyDeductionsModule {}
