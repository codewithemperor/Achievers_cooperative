import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash } from 'crypto';

const DEFAULT_SCOPE = 'general';
type UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

function normalizeScope(scope?: string) {
  switch ((scope || DEFAULT_SCOPE).toLowerCase()) {
    case 'member-id':
    case 'member-avatar':
    case 'payment-receipt':
      return scope!.toLowerCase();
    default:
      return DEFAULT_SCOPE;
  }
}

@Injectable()
export class CloudinaryService {
  async uploadImage(file: UploadFile, scope?: string) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException('Cloudinary environment variables are not configured');
    }

    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }

    const folder = `achievers-cooperative/${normalizeScope(scope)}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const formData = new FormData();
    formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('folder', folder);
    formData.append('signature', signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as any;
    if (!response.ok || !payload?.secure_url) {
      throw new BadRequestException(payload?.error?.message || 'Cloudinary upload failed');
    }

    return {
      url: payload.secure_url as string,
      publicId: payload.public_id as string,
      width: payload.width as number | undefined,
      height: payload.height as number | undefined,
      format: payload.format as string | undefined,
    };
  }
}
