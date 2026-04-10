import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditModuleService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditModuleService],
  exports: [AuditModuleService],
})
export class AuditModule {}
