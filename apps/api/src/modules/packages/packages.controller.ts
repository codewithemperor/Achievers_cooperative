import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PackagesService } from './packages.service';

@ApiTags('packages')
@ApiBearerAuth()
@Controller('packages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  @ApiOperation({ summary: 'List packages' })
  findAll(@Request() req: any) {
    return this.packagesService.findAll(req.user.id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create package' })
  create(@Request() req: any, @Body() body: any) {
    return this.packagesService.create(req.user.id, body);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update package' })
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.packagesService.update(id, req.user.id, body);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete package' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.packagesService.delete(id, req.user.id);
  }

  @Get('subscriptions')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List package subscriptions' })
  subscriptions() {
    return this.packagesService.listSubscriptions();
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Subscribe to a package' })
  subscribe(@Request() req: any, @Body() body: { packageId: string; memberId?: string; disbursementBankAccountId?: string }) {
    return this.packagesService.subscribe(req.user.id, body);
  }

  @Get('subscriptions/:id')
  @ApiOperation({ summary: 'Get package subscription detail' })
  subscriptionDetail(@Param('id') id: string, @Request() req: any) {
    return this.packagesService.getSubscription(id, req.user.id);
  }

  @Post('subscriptions/:id/approve')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Approve a package subscription' })
  approveSubscription(@Param('id') id: string, @Request() req: any) {
    return this.packagesService.updateSubscriptionStatus(id, req.user.id, 'approve');
  }

  @Post('subscriptions/:id/reject')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject a package subscription' })
  rejectSubscription(@Param('id') id: string, @Request() req: any, @Body() body?: { reason?: string }) {
    return this.packagesService.rejectSubscription(id, req.user.id, body?.reason);
  }

  @Post('subscriptions/:id/disburse')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Disburse a package subscription' })
  disburseSubscription(@Param('id') id: string, @Request() req: any) {
    return this.packagesService.updateSubscriptionStatus(id, req.user.id, 'disburse');
  }

  @Post('subscriptions/:id/mark-in-progress')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Mark a package subscription as in progress' })
  markSubscriptionInProgress(@Param('id') id: string, @Request() req: any) {
    return this.packagesService.updateSubscriptionStatus(id, req.user.id, 'mark-in-progress');
  }

  @Post('subscriptions/:id/complete')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Complete a package subscription' })
  completeSubscription(@Param('id') id: string, @Request() req: any) {
    return this.packagesService.updateSubscriptionStatus(id, req.user.id, 'complete');
  }

  @Post('subscriptions/:id/allocate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Allocate wallet funds to a package subscription' })
  allocateSubscription(@Param('id') id: string, @Request() req: any, @Body() body: { amount: number }) {
    return this.packagesService.makeManualAllocation(id, req.user.id, body.amount);
  }

  @Post('subscriptions/:id/pay')
  @Roles('MEMBER')
  @ApiOperation({ summary: 'Pay a package subscription from member wallet' })
  paySubscription(@Param('id') id: string, @Request() req: any, @Body() body: { amount: number }) {
    return this.packagesService.payFromMemberWallet(id, req.user.id, body.amount);
  }

  @Get('my-subscriptions')
  @ApiOperation({ summary: 'List authenticated member package subscriptions' })
  mySubscriptions(@Request() req: any) {
    return this.packagesService.getMySubscriptions(req.user.id);
  }

  @Get('defaulters')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List package defaulters' })
  defaulters() {
    return this.packagesService.defaulters();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get package detail with subscriptions and defaulters' })
  findOne(@Param('id') id: string) {
    return this.packagesService.findOne(id);
  }
}
