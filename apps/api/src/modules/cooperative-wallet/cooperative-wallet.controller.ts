import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CooperativeWalletService } from './cooperative-wallet.service';

@ApiTags('cooperative-wallet')
@ApiBearerAuth()
@Controller('wallet/cooperative')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR')
export class CooperativeWalletController {
  constructor(private readonly cooperativeWalletService: CooperativeWalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get cooperative wallet summary' })
  getSummary() {
    return this.cooperativeWalletService.getSummary();
  }

  @Get('entries')
  @ApiOperation({ summary: 'List cooperative wallet entries' })
  getEntries() {
    return this.cooperativeWalletService.getEntries();
  }

  @Post('entries')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create cooperative wallet entry' })
  createEntry(
    @Request() req: any,
    @Body()
    body: {
      type: 'INCOME' | 'EXPENSE';
      amount: number;
      category: string;
      description: string;
      reference?: string;
    },
  ) {
    return this.cooperativeWalletService.createEntry(req.user.id, body);
  }
}
