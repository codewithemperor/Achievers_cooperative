import { Body, Controller, Get, Inject, Patch, Post, Query, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { AdminWalletSpendDto, FundWalletDto, RequestWalletWithdrawalDto } from './dto/index';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller(['wallets', 'wallet'])
@UseGuards(JwtAuthGuard, RolesGuard)
export class WalletsController {
  constructor(@Inject(WalletsService) private readonly walletsService: WalletsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current wallet balance' })
  @ApiOkResponse({ description: 'Wallet balance info' })
  getMyWallet(@Request() req: any) {
    return this.walletsService.getMyWallet(req.user.id);
  }

  @Post('fund')
  @ApiOperation({ summary: 'Fund wallet' })
  @ApiOkResponse({ description: 'Wallet funded successfully' })
  fund(@Request() req: any, @Body() dto: FundWalletDto) {
    return this.walletsService.fund(req.user.id, dto);
  }

  @Post('admin-spend')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Allocate member wallet balance to a supported obligation' })
  adminSpend(@Request() req: any, @Body() dto: AdminWalletSpendDto) {
    return this.walletsService.adminSpend(req.user.id, dto);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiOkResponse({ description: 'Transaction list' })
  getTransactions(
    @Request() req: any,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.walletsService.getTransactions(req.user.id, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      type,
      from,
      to,
    });
  }

  @Get('withdrawals/me')
  @ApiOperation({ summary: 'Get my wallet withdrawal requests' })
  getMyWithdrawals(@Request() req: any) {
    return this.walletsService.getMyWithdrawalRequests(req.user.id);
  }

  @Post('withdrawals/request')
  @ApiOperation({ summary: 'Request wallet withdrawal' })
  requestWithdrawal(@Request() req: any, @Body() dto: RequestWalletWithdrawalDto) {
    return this.walletsService.requestWithdrawal(req.user.id, dto);
  }

  @Get('withdrawals')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List wallet withdrawal requests' })
  listWithdrawals() {
    return this.walletsService.listWithdrawalRequests();
  }

  @Patch('withdrawals/:id/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve wallet withdrawal request' })
  approveWithdrawal(@Param('id') id: string, @Request() req: any) {
    return this.walletsService.approveWithdrawal(id, req.user.id);
  }

  @Patch('withdrawals/:id/reject')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject wallet withdrawal request' })
  rejectWithdrawal(@Param('id') id: string, @Request() req: any, @Body() body?: { reason?: string }) {
    return this.walletsService.rejectWithdrawal(id, req.user.id, body?.reason);
  }

  @Patch('withdrawals/:id/disburse')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Disburse approved wallet withdrawal' })
  disburseWithdrawal(@Param('id') id: string, @Request() req: any) {
    return this.walletsService.disburseWithdrawal(id, req.user.id);
  }

  @Get(':memberId')
  @ApiOperation({ summary: 'Get member wallet by member ID' })
  @ApiOkResponse({ description: 'Wallet balance and transactions' })
  getMemberWallet(@Param('memberId') memberId: string) {
    return this.walletsService.getMemberWalletByMemberId(memberId);
  }
}
