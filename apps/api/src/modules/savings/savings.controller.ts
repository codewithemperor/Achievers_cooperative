import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { SavingsService } from './savings.service';
import { ContributeSavingsDto, RequestSavingsWithdrawalDto } from './dto/index';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('savings')
@ApiBearerAuth()
@Controller('savings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my savings accounts' })
  @ApiOkResponse({ description: 'Savings accounts' })
  getMySavings(@Request() req: any) {
    return this.savingsService.getMySavings(req.user.id);
  }

  @Post('contribute')
  @ApiOperation({ summary: 'Contribute to savings' })
  @ApiOkResponse({ description: 'Contribution processed' })
  contribute(@Request() req: any, @Body() dto: ContributeSavingsDto) {
    return this.savingsService.contribute(req.user.id, dto);
  }

  @Get('withdrawals/me')
  @ApiOperation({ summary: 'Get my savings withdrawal requests' })
  getMyWithdrawals(@Request() req: any) {
    return this.savingsService.getMyWithdrawalRequests(req.user.id);
  }

  @Post('withdrawals/request')
  @ApiOperation({ summary: 'Request a savings withdrawal' })
  requestWithdrawal(@Request() req: any, @Body() dto: RequestSavingsWithdrawalDto) {
    return this.savingsService.requestWithdrawal(req.user.id, dto);
  }

  @Get('transactions')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List savings transactions' })
  listTransactions() {
    return this.savingsService.listTransactions();
  }

  @Get('withdrawals')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List savings withdrawal requests' })
  listWithdrawals() {
    return this.savingsService.listWithdrawalRequests();
  }

  @Patch('withdrawals/:id/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve a savings withdrawal request' })
  approveWithdrawal(@Param('id') id: string, @Request() req: any) {
    return this.savingsService.approveWithdrawal(id, req.user.id);
  }

  @Patch('withdrawals/:id/reject')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject a savings withdrawal request' })
  rejectWithdrawal(@Param('id') id: string, @Request() req: any, @Body() body?: { reason?: string }) {
    return this.savingsService.rejectWithdrawal(id, req.user.id, body?.reason);
  }
}
