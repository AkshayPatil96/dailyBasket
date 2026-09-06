import { Injectable, Logger } from '@nestjs/common';
import type { Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PRODUCT_CARD_INCLUDE } from '../products/products.service';

const RECENT_LIMIT = 20;

@Injectable()
export class ProductViewsService {
  private readonly logger = new Logger(ProductViewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Fire-and-forget from the product detail page — best-effort, so a bad
  // productId (never happens from real UI, only direct API misuse) just
  // gets logged rather than surfacing an error for a non-critical write.
  async record(userId: string, productId: string): Promise<void> {
    try {
      await this.prisma.productView.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId },
        update: { viewedAt: new Date() },
      });
    } catch (error) {
      this.logger.warn(`Failed to record product view for ${productId}`, error);
    }
  }

  async listRecent(userId: string): Promise<Product[]> {
    const views = await this.prisma.productView.findMany({
      where: { userId },
      orderBy: { viewedAt: 'desc' },
      take: RECENT_LIMIT,
      include: { product: { include: PRODUCT_CARD_INCLUDE } },
    });
    return views.map((view) => view.product);
  }
}
