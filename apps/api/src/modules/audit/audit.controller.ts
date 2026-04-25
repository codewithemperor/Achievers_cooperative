import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { AuditModuleService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditModuleService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiOkResponse({ description: 'Paginated audit logs' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getLogs(
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.auditService.getLogs({
      actorId,
      entityType,
      action,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('entity/:type/:id')
  @ApiOperation({ summary: 'Get entity audit history' })
  @ApiOkResponse({ description: 'Entity history' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getEntityHistory(@Param('type') type: string, @Param('id') id: string) {
    return this.auditService.getEntityHistory(type, id);
  }
}
