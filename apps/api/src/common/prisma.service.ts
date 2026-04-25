import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    console.log('[PrismaService] Connecting to database...');
    await this.$connect();
    console.log('[PrismaService] Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
