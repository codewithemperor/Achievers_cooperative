import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseArrayPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { MembersService } from './members.service';
import { UpdateMemberDto, UpdateMemberStatusDto, QueryMembersDto } from './dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('members')
@ApiBearerAuth()
@Controller('members')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR')
  @ApiOperation({ summary: 'List all members (admin only)' })
  @ApiOkResponse({ description: 'Paginated member list' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  findAll(@Query() query: QueryMembersDto) {
    return this.membersService.findAll(query);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user member profile' })
  @ApiOkResponse({ description: 'Member profile' })
  getMyProfile(@Request() req: any) {
    return this.membersService.findByUserId(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get member by ID' })
  @ApiOkResponse({ description: 'Member details' })
  findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own member profile' })
  @ApiOkResponse({ description: 'Updated profile' })
  updateMyProfile(@Request() req: any, @Body() dto: UpdateMemberDto) {
    return this.membersService.updateProfile(req.user.id, dto);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update member status (admin only)' })
  @ApiOkResponse({ description: 'Updated status' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMemberStatusDto,
    @Request() req: any,
  ) {
    return this.membersService.updateStatus(id, dto, req.user.id);
  }
}
