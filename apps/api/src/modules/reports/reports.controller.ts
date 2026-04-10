import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get platform summary report' })
  @ApiOkResponse({ description: 'Summary stats' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getSummary() {
    return this.reportsService.getSummary();
  }

  @Get('members')
  @ApiOperation({ summary: 'Get member report' })
  @ApiOkResponse({ description: 'Member details report' })
  getMemberReport() {
    return this.reportsService.getMemberReport();
  }

  @Get('loans')
  @ApiOperation({ summary: 'Get loan report' })
  @ApiOkResponse({ description: 'Loan report' })
  getLoanReport() {
    return this.reportsService.getLoanReport();
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get transaction report' })
  @ApiOkResponse({ description: 'Transaction report' })
  getTransactionReport(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.reportsService.getTransactionReport({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
