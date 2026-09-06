import { Injectable } from '@nestjs/common';
import type { Product } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PRODUCT_CARD_INCLUDE } from '../products/products.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  // Full product cards for the /account/favorites page. Deliberately not
  // filtered by product status — an unavailable favorite still shows (with
  // "Out of stock", same as anywhere else PRODUCT_CARD_INCLUDE is used,
  // since its variants include is ACTIVE-only) rather than silently
  // vanishing from the list.
  async list(userId: string): Promise<Product[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { product: { include: PRODUCT_CARD_INCLUDE } },
    });
    return favorites.map((favorite) => favorite.product);
  }

  // Lightweight — for heart-icon state on product cards/detail pages
  // without pulling full product data just to check membership.
  async listIds(userId: string): Promise<string[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      select: { productId: true },
    });
    return favorites.map((favorite) => favorite.productId);
  }

  async add(userId: string, productId: string): Promise<void> {
    await this.prisma.favorite.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, productId } });
  }
}
