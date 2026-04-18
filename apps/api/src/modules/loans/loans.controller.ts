import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { ApplyLoanDto, QueryLoansDto, RepayLoanDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post('apply')
  @ApiOperation({ summary: 'Apply for a loan' })
  @ApiOkResponse({ description: 'Loan application created' })
  apply(@Request() req: any, @Body() dto: ApplyLoanDto) {
    return this.loansService.apply(req.user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create loan application' })
  @ApiOkResponse({ description: 'Loan application created' })
  create(@Request() req: any, @Body() dto: ApplyLoanDto) {
    return this.loansService.apply(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List loan applications' })
  @ApiOkResponse({ description: 'Paginated loan applications' })
  findAll(@Request() req: any, @Query() query: QueryLoansDto) {
    return this.loansService.findAll(req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get loan application by ID' })
  @ApiOkResponse({ description: 'Loan details' })
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @Post(':id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Approve a loan (admin)' })
  @ApiOkResponse({ description: 'Loan approved' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  approve(@Param('id') id: string, @Request() req: any) {
    return this.loansService.approve(id, req.user.id);
  }

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Approve a loan (admin)' })
  approvePatch(@Param('id') id: string, @Request() req: any) {
    return this.loansService.approve(id, req.user.id);
  }

  @Post(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Reject a loan (admin)' })
  @ApiOkResponse({ description: 'Loan rejected' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  reject(@Param('id') id: string, @Request() req: any) {
    return this.loansService.reject(id, req.user.id);
  }

  @Patch(':id/reject')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Reject a loan (admin)' })
  rejectPatch(@Param('id') id: string, @Request() req: any) {
    return this.loansService.reject(id, req.user.id);
  }

  @Post(':id/disburse')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Disburse an approved loan (admin)' })
  @ApiOkResponse({ description: 'Loan disbursed' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  disburse(@Param('id') id: string, @Request() req: any) {
    return this.loansService.disburse(id, req.user.id);
  }

  @Patch(':id/disburse')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Disburse an approved loan (admin)' })
  disbursePatch(@Param('id') id: string, @Request() req: any) {
    return this.loansService.disburse(id, req.user.id);
  }

  @Post(':id/repay')
  @ApiOperation({ summary: 'Repay a loan' })
  @ApiOkResponse({ description: 'Repayment processed' })
  repay(@Param('id') id: string, @Request() req: any, @Body() dto: RepayLoanDto) {
    return this.loansService.repay(req.user.id, id, dto);
  }
}
