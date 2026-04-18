import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { SystemConfigService } from './system-config.service';
import { UpdateConfigDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('system-config')
@ApiBearerAuth()
@Controller(['system-config', 'config'])
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get all system configuration' })
  @ApiOkResponse({ description: 'Configuration key-value map' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  getAll() {
    return this.systemConfigService.getAll();
  }

  @Patch(':key')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update a system config value (admin)' })
  @ApiOkResponse({ description: 'Config updated' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @Request() req: any,
  ) {
    return this.systemConfigService.update(key, dto.value, req.user.id);
  }
}
