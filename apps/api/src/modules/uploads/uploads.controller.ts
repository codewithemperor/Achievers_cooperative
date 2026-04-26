import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CloudinaryService } from '../../common/services/cloudinary.service';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Post('image')
  @Roles('MEMBER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Upload an image to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  async uploadImage(
    @UploadedFile() file: any,
    @Body('scope') scope?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    return this.cloudinary.uploadImage(file, scope);
  }
}
