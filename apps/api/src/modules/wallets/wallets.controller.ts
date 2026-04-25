import { Controller, Get, Post, Body, Query, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { FundWalletDto } from './dto/index';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller(['wallets', 'wallet'])
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

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

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiOkResponse({ description: 'Transaction list' })
  getTransactions(
    @Request() req: any,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.walletsService.getTransactions(req.user.id, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':memberId')
  @ApiOperation({ summary: 'Get member wallet by member ID' })
  @ApiOkResponse({ description: 'Wallet balance and transactions' })
  getMemberWallet(@Param('memberId') memberId: string) {
    return this.walletsService.getMemberWalletByMemberId(memberId);
  }
}
