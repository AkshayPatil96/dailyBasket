import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';

export const UPLOAD_FOLDERS = ['categories', 'products'] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 82;

// CloudFront's /assets/* behavior is the only path routed to this bucket's origin —
// every object we write must live under this prefix or the CDN 404s it.
const KEY_PREFIX = 'assets';

// Never reconcile-delete anything written in the last day — a category/product
// form can be uploaded-but-not-yet-submitted for a while, and that upload must not
// look like an orphan just because nothing references it *yet*.
const ORPHAN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 1 day

const S3_LIST_PAGE_SIZE = 1000;

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly s3: S3Client;
  private readonly bucket?: string;
  private readonly region: string;
  private readonly cloudfrontUrl?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.region = this.configService.getOrThrow<string>('aws.region');
    this.bucket = this.configService.get<string>('aws.s3Bucket');
    this.cloudfrontUrl = this.configService
      .get<string>('aws.cloudfrontUrl')
      ?.replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    const accessKeyId = this.configService.get<string>('aws.accessKeyId');
    const secretAccessKey = this.configService.get<string>(
      'aws.secretAccessKey',
    );

    this.s3 = new S3Client({
      region: this.region,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  async uploadImage(buffer: Buffer, folder: UploadFolder): Promise<string> {
    if (!this.bucket) {
      throw new ServiceUnavailableException(
        'Image storage is not configured (AWS_S3_BUCKET missing)',
      );
    }

    // Normalize every upload to a bounded, compressed webp before it ever reaches S3 —
    // caps storage/egress cost and strips EXIF regardless of what the client sent.
    const processed = await sharp(buffer)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const key = `${KEY_PREFIX}/${folder}/${randomUUID()}.webp`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: processed,
        ContentType: 'image/webp',
      }),
    );

    const host =
      this.cloudfrontUrl ?? `${this.bucket}.s3.${this.region}.amazonaws.com`;
    return `https://${host}/${key}`;
  }

  /**
   * Best-effort — a stale S3 object is far cheaper than blocking a category/product
   * update or delete over a storage-cleanup failure, so this never throws.
   */
  async deleteImage(url: string): Promise<void> {
    if (!this.bucket) return;

    const key = this.extractOwnedKey(url);
    if (!key) return;

    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to delete S3 object "${key}": ${(error as Error).message}`,
      );
    }
  }

  /** Only deletes objects this service could have written — never touches an unrelated URL. */
  private extractOwnedKey(url: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    const ownHosts = [
      this.cloudfrontUrl,
      `${this.bucket}.s3.${this.region}.amazonaws.com`,
    ].filter(Boolean);
    if (!ownHosts.includes(parsed.hostname)) return null;

    const key = parsed.pathname.replace(/^\//, '');
    return key.startsWith(`${KEY_PREFIX}/`) ? key : null;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runScheduledReconciliation(): Promise<void> {
    if (!this.bucket) return;
    const { scanned, deleted } = await this.reconcileOrphans();
    if (deleted > 0) {
      this.logger.log(
        `Scheduled reconciliation: scanned ${scanned}, deleted ${deleted} orphaned upload(s)`,
      );
    }
  }

  /**
   * Closes the "uploaded but never saved" gap: an image dropped into a create/edit
   * form gets written to S3 immediately, but if the form is closed without submitting
   * (or the image is swapped again before saving), no DB row ever references it — the
   * per-entity delete-on-remove/replace logic in Categories/Products can only
   * clean up images that WERE saved. This walks every object under the upload prefix
   * and deletes whichever ones no DB row references, past the grace period.
   */
  async reconcileOrphans(): Promise<{ scanned: number; deleted: number }> {
    if (!this.bucket) return { scanned: 0, deleted: 0 };

    const referencedKeys = await this.collectReferencedKeys();
    const cutoff = new Date(Date.now() - ORPHAN_GRACE_PERIOD_MS);

    let scanned = 0;
    let deleted = 0;
    let continuationToken: string | undefined;

    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${KEY_PREFIX}/`,
          MaxKeys: S3_LIST_PAGE_SIZE,
          ContinuationToken: continuationToken,
        }),
      );

      const objects = page.Contents ?? [];
      scanned += objects.length;

      const orphanKeys = objects
        .filter(
          (object) =>
            object.Key &&
            object.LastModified &&
            object.LastModified < cutoff &&
            !referencedKeys.has(object.Key),
        )
        .map((object) => object.Key as string);

      if (orphanKeys.length > 0) {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: orphanKeys.map((Key) => ({ Key })) },
          }),
        );
        deleted += orphanKeys.length;
        this.logger.log(`Deleted orphaned upload(s): ${orphanKeys.join(', ')}`);
      }

      continuationToken = page.NextContinuationToken;
    } while (continuationToken);

    return { scanned, deleted };
  }

  /**
   * Every place an S3-hosted image URL can be stored, across every domain module.
   * Add the new source here whenever a new entity gets an ImageUploadField —
   * otherwise its images look orphaned to this job and get deleted.
   */
  private async collectReferencedKeys(): Promise<Set<string>> {
    const [categories, productImages] = await Promise.all([
      this.prisma.category.findMany({
        where: { imageUrl: { not: null } },
        select: { imageUrl: true },
      }),
      this.prisma.productImage.findMany({ select: { url: true } }),
    ]);

    const urls = [
      ...categories.map((category) => category.imageUrl),
      ...productImages.map((image) => image.url),
    ].filter((url): url is string => Boolean(url));

    const keys = new Set<string>();
    for (const url of urls) {
      const key = this.extractOwnedKey(url);
      if (key) keys.add(key);
    }
    return keys;
  }
}
