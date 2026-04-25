import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { SavingsService } from './savings.service';
import { ContributeSavingsDto } from './dto/index';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('savings')
@ApiBearerAuth()
@Controller('savings')
@UseGuards(JwtAuthGuard)
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my savings accounts' })
  @ApiOkResponse({ description: 'Savings accounts' })
  getMySavings(@Request() req: any) {
    return this.savingsService.getMySavings(req.user.id);
  }

  @Post('contribute')
  @ApiOperation({ summary: 'Contribute to savings' })
  @ApiOkResponse({ description: 'Contribution processed' })
  contribute(@Request() req: any, @Body() dto: ContributeSavingsDto) {
    return this.savingsService.contribute(req.user.id, dto);
  }
}
