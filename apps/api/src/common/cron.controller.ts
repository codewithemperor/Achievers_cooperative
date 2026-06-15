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

  @Post('daily-deductions/weekly')
  runWeeklyDeductionsPost(
    @Headers('x-cron-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('expose') expose?: string,
  ) {
    this.assertCronSecret(headerSecret, querySecret);
    return this.weeklyDeductions.runWeeklyCron({ exposeDebt: this.shouldExposeDebt(expose) });
  }

  @Get('daily-deductions/weekly')
  runWeeklyDeductionsGet(
    @Headers('x-cron-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('expose') expose?: string,
  ) {
    this.assertCronSecret(headerSecret, querySecret);
    return this.weeklyDeductions.runWeeklyCron({ exposeDebt: this.shouldExposeDebt(expose) });
  }

  @Post('daily-loan-repayments')
  runDailyLoanRepaymentsPost(
    @Headers('x-cron-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('expose') expose?: string,
  ) {
    this.assertCronSecret(headerSecret, querySecret);
    return this.weeklyDeductions.runLoanRepaymentsCron({ exposeDebt: this.shouldExposeDebt(expose) });
  }

  @Get('daily-loan-repayments')
  runDailyLoanRepaymentsGet(
    @Headers('x-cron-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('expose') expose?: string,
  ) {
    this.assertCronSecret(headerSecret, querySecret);
    return this.weeklyDeductions.runLoanRepaymentsCron({ exposeDebt: this.shouldExposeDebt(expose) });
  }

  @Post('daily-package-repayments')
  runDailyPackageRepaymentsPost(
    @Headers('x-cron-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('expose') expose?: string,
  ) {
    this.assertCronSecret(headerSecret, querySecret);
    return this.weeklyDeductions.runPackageRepaymentsCron({ exposeDebt: this.shouldExposeDebt(expose) });
  }

  @Get('daily-package-repayments')
  runDailyPackageRepaymentsGet(
    @Headers('x-cron-secret') headerSecret?: string,
    @Query('secret') querySecret?: string,
    @Query('expose') expose?: string,
  ) {
    this.assertCronSecret(headerSecret, querySecret);
    return this.weeklyDeductions.runPackageRepaymentsCron({ exposeDebt: this.shouldExposeDebt(expose) });
  }

  private shouldExposeDebt(expose?: string) {
    return expose !== 'false';
  }

  private assertCronSecret(headerSecret?: string, querySecret?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected || (headerSecret !== expected && querySecret !== expected)) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }
}
