import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

type TransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    console.log('[PrismaService] Connecting to database...');
    await this.$connect();
    console.log('[PrismaService] Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async runTransaction<T>(
    label: string,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {},
  ) {
    const startedAt = Date.now();

    try {
      return await this.$transaction(callback, {
        maxWait: 15000,
        timeout: 60000,
        ...options,
      });
    } finally {
      const duration = Date.now() - startedAt;
      const message = `Transaction "${label}" completed in ${duration}ms`;

      if (duration >= 3000) {
        this.logger.error(message);
      } else if (duration >= 1000) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    }
  }
}
