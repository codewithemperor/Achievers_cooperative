import { Controller, Get, Post, Param, Body, Query, UseGuards, Request, Patch } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { InvestmentsService } from './investments.service';
import { SubscribeInvestmentDto, QueryInvestmentsDto } from './dto/index';
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
