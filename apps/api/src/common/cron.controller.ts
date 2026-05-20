import { Controller, Get, Headers, Post, Query, UnauthorizedException } from '@nestjs/common';
import { WeeklyDeductionsService } from './services/weekly-deductions.service';

@Controller('cron')
export class CronController {
  constructor(private readonly weeklyDeductions: WeeklyDeductionsService) {}

  @Get('daily-deductions')
  runDailyDeductionsGet(
    @Headers('x-cron-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('force') force?: string,
  ) {
    this.assertCronSecret(headerSecret, querySecret);
    return this.weeklyDeductions.runFromCron(force === 'true');
  }

  @Post('daily-deductions')
  runDailyDeductionsPost(
    @Headers('x-cron-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('force') force?: string,
  ) {
    this.assertCronSecret(headerSecret, querySecret);
    return this.weeklyDeductions.runFromCron(force === 'true');
  }

  private assertCronSecret(headerSecret?: string, querySecret?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected || (headerSecret !== expected && querySecret !== expected)) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }
}
