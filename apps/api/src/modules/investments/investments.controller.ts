import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { InvestmentsService } from './investments.service';
import { SubscribeInvestmentDto, QueryInvestmentsDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('investments')
@ApiBearerAuth()
@Controller('investments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Get('products')
  @ApiOperation({ summary: 'List active investment products' })
  @ApiOkResponse({ description: 'Investment products' })
  getProducts() {
    return this.investmentsService.getProducts();
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to an investment product' })
  @ApiOkResponse({ description: 'Subscription created' })
  subscribe(@Request() req: any, @Body() dto: SubscribeInvestmentDto) {
    return this.investmentsService.subscribe(req.user.id, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my investment subscriptions' })
  @ApiOkResponse({ description: 'My investments' })
  getMyInvestments(@Request() req: any, @Query() query: QueryInvestmentsDto) {
    return this.investmentsService.getMyInvestments(req.user.id, query);
  }

  @Post('subscribe/:id/approve')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Approve an investment subscription (admin)' })
  @ApiOkResponse({ description: 'Subscription approved' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  approveSubscription(@Param('id') id: string, @Request() req: any) {
    return this.investmentsService.approveSubscription(id, req.user.id);
  }
}
