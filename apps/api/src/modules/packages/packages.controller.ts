import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
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
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'List packages' })
  findAll() {
    return this.packagesService.findAll();
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create package' })
  create(@Request() req: any, @Body() body: any) {
    return this.packagesService.create(req.user.id, body);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update package' })
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.packagesService.update(id, req.user.id, body);
  }

  @Get('subscriptions')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'List package subscriptions' })
  subscriptions() {
    return this.packagesService.listSubscriptions();
  }

  @Post('subscriptions')
  @ApiOperation({ summary: 'Subscribe to a package' })
  subscribe(@Request() req: any, @Body() body: { packageId: string; memberId?: string }) {
    return this.packagesService.subscribe(req.user.id, body);
  }

  @Get('defaulters')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'List package defaulters' })
  defaulters() {
    return this.packagesService.defaulters();
  }
}
