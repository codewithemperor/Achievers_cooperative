import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto, UpdateBankAccountDto, VerifyBankAccountDto } from './dto/index';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('bank-accounts')
@ApiBearerAuth()
@Controller('bank-accounts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Get('banks')
  @ApiOperation({ summary: 'Get list of supported Nigerian banks' })
  getBanks() {
    return this.bankAccountsService.getBanks();
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify an account number via Paystack' })
  @ApiOkResponse({ description: 'Account name returned' })
  async verify(@Body() dto: VerifyBankAccountDto) {
    return this.bankAccountsService.verifyAccountNumber(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List authenticated member bank accounts' })
  @ApiOkResponse({ description: 'List of bank accounts' })
  findAll(@Request() req: any) {
    return this.bankAccountsService.findAll(req.user.id);
  }

  @Get('member/:memberId')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List bank accounts for a member' })
  findByMemberId(@Param('memberId') memberId: string) {
    return this.bankAccountsService.findByMemberId(memberId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a bank account' })
  @ApiOkResponse({ description: 'Bank account created' })
  create(@Request() req: any, @Body() dto: CreateBankAccountDto) {
    return this.bankAccountsService.create(req.user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a bank account' })
  @ApiOkResponse({ description: 'Bank account updated' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateBankAccountDto) {
    return this.bankAccountsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a bank account' })
  @ApiOkResponse({ description: 'Bank account removed' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.bankAccountsService.remove(req.user.id, id);
  }
}
