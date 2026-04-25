import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { MembersService } from './members.service';
import { UpdateMemberDto, UpdateMemberStatusDto, QueryMembersDto } from './dto/index';
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
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all members' })
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

  @Get('search')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Search members by name or email' })
  search(@Query('query') query: string) {
    return this.membersService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get member by ID' })
  @ApiOkResponse({ description: 'Member details' })
  findOne(@Param('id') id: string) {
    return this.membersService.findOne(id);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create member profile' })
  create(
    @Request() req: any,
    @Body()
    body: {
      email: string;
      fullName: string;
      phoneNumber: string;
      address?: string;
      referrerId?: string;
    },
  ) {
    return this.membersService.create(req.user.id, body);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own member profile' })
  @ApiOkResponse({ description: 'Updated profile' })
  updateMyProfile(@Request() req: any, @Body() dto: UpdateMemberDto) {
    return this.membersService.updateProfile(req.user.id, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update member by ID' })
  updateById(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateMemberDto) {
    return this.membersService.updateById(id, dto, req.user.id);
  }

  @Patch(':id/status')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update member status' })
  @ApiOkResponse({ description: 'Updated status' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMemberStatusDto,
    @Request() req: any,
  ) {
    return this.membersService.updateStatus(id, dto, req.user.id);
  }

  @Post(':id/avatar')
  @ApiOperation({ summary: 'Update member avatar url' })
  updateAvatar(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { avatarUrl: string },
  ) {
    return this.membersService.updateAvatar(id, body.avatarUrl, req.user.id);
  }

  @Post(':id/reset-password')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Send a password reset OTP to a member' })
  resetPassword(@Param('id') id: string, @Request() req: any) {
    return this.membersService.resetPassword(id, req.user.id);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete member record' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.membersService.remove(id, req.user.id);
  }
}
