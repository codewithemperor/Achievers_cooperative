import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { prisma } from '../../prisma';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await prisma.$connect();
  }

  async onModuleDestroy() {
    await prisma.$disconnect();
  }
}

// Merge PrismaClient's instance methods into PrismaService's type
export interface PrismaService extends PrismaClient {}

Object.assign(PrismaService.prototype, prisma);