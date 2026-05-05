import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { InvestmentsService } from './investments.service';
import { QueryInvestmentsDto, RejectInvestmentCancellationDto, RequestInvestmentCancellationDto, SubscribeInvestmentDto } from './dto/index';
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

  @Post('products')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create investment product' })
  createProduct(@Request() req: any, @Body() body: any) {
    return this.investmentsService.createProduct(req.user.id, body);
  }

  @Patch('products/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update investment product' })
  updateProduct(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.investmentsService.updateProduct(id, req.user.id, body);
  }

  @Delete('products/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete investment product' })
  deleteProduct(@Param('id') id: string, @Request() req: any) {
    return this.investmentsService.deleteProduct(id, req.user.id);
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to an investment product' })
  @ApiOkResponse({ description: 'Subscription created' })
  subscribe(@Request() req: any, @Body() dto: SubscribeInvestmentDto) {
    return this.investmentsService.subscribe(req.user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create investment subscription' })
  create(@Request() req: any, @Body() dto: SubscribeInvestmentDto) {
    return this.investmentsService.subscribe(req.user.id, dto);
  }

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List investment subscriptions' })
  listAll(@Query() query: QueryInvestmentsDto) {
    return this.investmentsService.getAllInvestments(query);
  }

  @Get('products/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get investment product detail with subscribers and defaulters' })
  getProduct(@Param('id') id: string) {
    return this.investmentsService.getProduct(id);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my investment subscriptions' })
  @ApiOkResponse({ description: 'My investments' })
  getMyInvestments(@Request() req: any, @Query() query: QueryInvestmentsDto) {
    return this.investmentsService.getMyInvestments(req.user.id, query);
  }

  @Get('my/:id')
  @ApiOperation({ summary: 'Get my investment detail' })
  getMyInvestment(@Request() req: any, @Param('id') id: string) {
    return this.investmentsService.getMyInvestment(req.user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Request investment cancellation' })
  requestCancellation(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RequestInvestmentCancellationDto,
  ) {
    return this.investmentsService.requestCancellation(req.user.id, id, dto.reason);
  }

  @Get('cancellations')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List investment cancellation requests' })
  listCancellationRequests() {
    return this.investmentsService.listCancellationRequests();
  }

  @Patch('cancellations/:id/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve investment cancellation' })
  approveCancellation(@Param('id') id: string, @Request() req: any) {
    return this.investmentsService.approveCancellation(id, req.user.id);
  }

  @Patch('cancellations/:id/reject')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject investment cancellation' })
  rejectCancellation(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: RejectInvestmentCancellationDto,
  ) {
    return this.investmentsService.rejectCancellation(id, req.user.id, dto?.reason);
  }

  @Post('subscribe/:id/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve an investment subscription' })
  @ApiOkResponse({ description: 'Subscription approved' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  approveSubscription(@Param('id') id: string, @Request() req: any) {
    return this.investmentsService.approveSubscription(id, req.user.id);
  }

  @Patch(':id/withdraw')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Withdraw matured investment' })
  withdraw(@Param('id') id: string, @Request() req: any) {
    return this.investmentsService.withdraw(id, req.user.id);
  }
}
