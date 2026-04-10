import { Controller, Get, Post, Param, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { QueryTransactionsDto } from './dto';
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'List all transactions (admin/auditor)' })
  @ApiOkResponse({ description: 'Paginated transactions' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(@Query() query: QueryTransactionsDto) {
    return this.transactionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  @ApiOkResponse({ description: 'Transaction details' })
  findOne(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Post(':id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Approve a transaction (admin)' })
  @ApiOkResponse({ description: 'Transaction approved' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  approve(@Param('id') id: string, @Request() req: any) {
    return this.transactionsService.approve(id, req.user.id);
  }

  @Post(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Reject a transaction (admin)' })
  @ApiOkResponse({ description: 'Transaction rejected' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  reject(@Param('id') id: string, @Request() req: any) {
    return this.transactionsService.reject(id, req.user.id);
  }
}
