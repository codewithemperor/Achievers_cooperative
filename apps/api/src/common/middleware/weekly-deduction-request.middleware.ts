import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { WeeklyDeductionsService } from '../services/weekly-deductions.service';

@Injectable()
export class WeeklyDeductionRequestMiddleware implements NestMiddleware {
  constructor(private readonly weeklyDeductions: WeeklyDeductionsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (!req.path.startsWith('/api/v1') || req.path.includes('/api/docs')) {
      next();
      return;
    }

    void this.weeklyDeductions
      .runIfDue()
      .catch(() => undefined)
      .finally(() => next());
  }
}
