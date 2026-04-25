import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List payment receipts for review' })
  findAll() {
    return this.paymentsService.findAll();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get payment detail' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post()
  @Roles('MEMBER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Upload payment receipt record' })
  create(
    @Request() req: any,
    @Body() body: { amount: number; receiptUrl?: string; memberId?: string },
  ) {
    return this.paymentsService.create(req.user.id, body);
  }

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve payment and credit wallet' })
  approve(@Param('id') id: string, @Request() req: any) {
    return this.paymentsService.approve(id, req.user.id);
  }

  @Patch(':id/reject')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject payment' })
  reject(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { reason?: string },
  ) {
    return this.paymentsService.reject(id, req.user.id, body.reason);
  }
}
