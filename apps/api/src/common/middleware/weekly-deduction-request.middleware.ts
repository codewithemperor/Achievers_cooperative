import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { WeeklyDeductionsService } from '../services/weekly-deductions.service';

@Injectable()
export class WeeklyDeductionRequestMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WeeklyDeductionRequestMiddleware.name);

  constructor(private readonly weeklyDeductions: WeeklyDeductionsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (
      req.path.includes('/api/docs') ||
      req.path.includes('/health') ||
      req.path.includes('/cron/weekly-deductions')
    ) {
      next();
      return;
    }

    void this.weeklyDeductions
      .runIfDue()
      .catch((error) =>
        this.logger.error(
          error?.message || 'Lazy weekly deduction check failed',
          error?.stack,
        ),
      );

    next();
  }
}
