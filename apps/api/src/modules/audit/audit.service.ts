import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class AuditModuleService {
  constructor(private readonly auditService: AuditService) {}

  async getLogs(options?: {
    actorId?: string;
    entityType?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) {
    return this.auditService.getLogs(options);
  }

  async getEntityHistory(entityType: string, entityId: string) {
    return this.auditService.getEntityHistory(entityType, entityId);
  }
}
