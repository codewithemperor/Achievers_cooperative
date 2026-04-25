import { Controller, Get, Post, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { QueryTransactionsDto } from './dto/index';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all transactions' })
  @ApiOkResponse({ description: 'Paginated transactions' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(@Query() query: QueryTransactionsDto) {
    return this.transactionsService.findAll(query);
  }

  @Get('export')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Export transactions as CSV' })
  async export(@Res() res: any) {
    const csv = await this.transactionsService.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiOkResponse({ description: 'Transaction details' })
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Post(':id/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve a transaction' })
  @ApiOkResponse({ description: 'Transaction approved' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  approve(@Param('id') id: string, @Request() req: any) {
    return this.transactionsService.approve(id, req.user.id);
  }

  @Post(':id/reject')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject a transaction' })
  @ApiOkResponse({ description: 'Transaction rejected' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  reject(@Param('id') id: string, @Request() req: any) {
    return this.transactionsService.reject(id, req.user.id);
  }
}
