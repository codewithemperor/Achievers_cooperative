import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WeeklyDeductionsService } from '../../common/services/weekly-deductions.service';
import { PayWeeklyDeductionDto } from './dto';

@ApiTags('weekly-deductions')
@ApiBearerAuth()
@Controller('weekly-deductions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeeklyDeductionsController {
  constructor(private readonly weeklyDeductions: WeeklyDeductionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my weekly deduction summary' })
  getMe(@Request() req: any) {
    return this.weeklyDeductions.getMySummary(req.user.id);
  }

  @Post('me/pay')
  @ApiOperation({ summary: 'Pay weekly association deduction from wallet' })
  payMe(@Request() req: any, @Body() dto: PayWeeklyDeductionDto) {
    return this.weeklyDeductions.payMyWeeklyDeduction(req.user.id, Number(dto.amount));
  }

  @Get('admin/summary')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get admin weekly deduction summary' })
  getAdminSummary() {
    return this.weeklyDeductions.getAdminSummary();
  }

  @Get('admin/members')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List weekly deduction member balances' })
  getAdminMembers() {
    return this.weeklyDeductions.getAdminMembers();
  }

  @Get('admin/members/:memberId')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get weekly deduction detail for one member' })
  getAdminMemberDetail(@Param('memberId') memberId: string) {
    return this.weeklyDeductions.getAdminMemberDetail(memberId);
  }

  @Get('admin/transactions')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List weekly deduction payments' })
  getAdminTransactions(@Query('from') from?: string, @Query('to') to?: string) {
    return this.weeklyDeductions.getAdminTransactions({ from, to });
  }
}
