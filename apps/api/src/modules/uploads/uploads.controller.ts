import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  UploadsService,
  UPLOAD_FOLDERS,
  type UploadFolder,
} from './uploads.service';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              'Only JPEG, PNG, or WebP images are allowed',
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('type') type: string | undefined,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    if (!type || !UPLOAD_FOLDERS.includes(type as UploadFolder)) {
      throw new BadRequestException(
        `type must be one of: ${UPLOAD_FOLDERS.join(', ')}`,
      );
    }

    const url = await this.uploadsService.uploadImage(
      file.buffer,
      type as UploadFolder,
    );
    return { url };
  }

  /** Manual trigger for the daily orphan-cleanup cron — useful to verify/run on demand. */
  @Post('reconcile')
  @HttpCode(200)
  async reconcile(): Promise<{ scanned: number; deleted: number }> {
    return this.uploadsService.reconcileOrphans();
  }
}
