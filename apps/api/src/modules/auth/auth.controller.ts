import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/index';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new member' })
  @ApiCreatedResponse({ description: 'User registered successfully' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiOkResponse({ description: 'Returns JWT token and user info' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('activate')
  @ApiOperation({ summary: 'Activate a pending member account' })
  @ApiOkResponse({ description: 'Member activated successfully' })
  async activate(
    @Body() body: { email: string; tempActivationCode: string; newPassword: string },
  ) {
    return this.authService.activate(body.email, body.tempActivationCode, body.newPassword);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh JWT token' })
  @ApiOkResponse({ description: 'Returns a new token' })
  async refresh(@Request() req: any) {
    return this.authService.refresh(req.user.id);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current user' })
  @ApiOkResponse({ description: 'Logout acknowledged' })
  async logout(@Request() req: any) {
    return this.authService.logout(req.user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiOkResponse({ description: 'Returns current user profile' })
  async getMe(@Request() req: any) {
    return this.authService.getMe(req.user.id);
  }
}
