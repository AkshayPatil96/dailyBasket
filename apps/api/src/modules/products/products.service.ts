import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Product,
  ProductImage,
  ProductStatus,
  ProductVariant,
} from '@prisma/client';
import type { Role } from '@grocery-delivery/types';
import { slugify } from '@grocery-delivery/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CategoriesService } from '../categories/categories.service';
import { UploadsService } from '../uploads/uploads.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { ListProductsDto } from './dto/list-products.dto';
import type { CreateVariantDto } from './dto/create-variant.dto';
import type { UpdateVariantDto } from './dto/update-variant.dto';
import type { CreateProductImageDto } from './dto/create-product-image.dto';
import type { AdminListProductsDto } from './dto/admin-list-products.dto';

const DEFAULT_LIMIT = 20;

// `brand` is a plain scalar column, not a relation — it's always included
// alongside the other product fields, no include entry needed for it.
const PRODUCT_CARD_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  images: { where: { isPrimary: true }, take: 1 },
  variants: {
    where: { status: 'ACTIVE' as const },
    orderBy: { price: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.ProductInclude;

const PRODUCT_DETAIL_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: 'asc' as const } },
  variants: {
    where: { status: 'ACTIVE' as const },
    orderBy: { price: 'asc' as const },
  },
} satisfies Prisma.ProductInclude;

// Admin views see every status, not just what's ACTIVE and customer-facing.
// Variants carry their Inventory row too, so the admin edit form can show
// and edit current stock — customer-facing includes deliberately don't.
const PRODUCT_ADMIN_INCLUDE = {
  category: true,
  images: { orderBy: { sortOrder: 'asc' as const } },
  variants: {
    orderBy: { createdAt: 'asc' as const },
    include: { inventory: true },
  },
} satisfies Prisma.ProductInclude;

// Same shape as PRODUCT_CARD_INCLUDE but only surfaces variants that actually
// carry a discount, so variants[0] on a deals result is always the discounted one.
const DEALS_CARD_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
  images: { where: { isPrimary: true }, take: 1 },
  variants: {
    where: { status: 'ACTIVE' as const, compareAtPrice: { not: null } },
    orderBy: { price: 'asc' as const },
    take: 1,
  },
} satisfies Prisma.ProductInclude;

const HOME_SECTION_LIMIT = 8;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

// Only the customer-facing slug lookup (every PDP view) is cached — the id-keyed
// lookup is barely used publicly, and admin reads (adminFindOne/adminList) must
// always be fresh since that's the editing surface. Product detail changes far
// more often than category data (variants, images, status), so a shorter TTL.
const DETAIL_CACHE_PREFIX = 'cache:products:detail:slug:';
const DETAIL_CACHE_TTL_SECONDS = 120;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly uploadsService: UploadsService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateProductDto, requesterRole: Role): Promise<Product> {
    await this.assertCategoryExists(dto.categoryId);

    const slug = await this.generateUniqueSlug(dto.name);

    return this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        brand: dto.brand?.trim() || null,
        name: dto.name,
        slug,
        description: dto.description,
        ingredients: dto.ingredients,
        nutritionalInfo: dto.nutritionalInfo as
          Prisma.InputJsonValue | undefined,
        dietaryInfo: dto.dietaryInfo ?? [],
        countryOfOrigin: dto.countryOfOrigin,
        isFeatured: dto.isFeatured ?? false,
        // Portfolio showcase data — anything a super admin adds is protected
        // from edit/delete the same way the original seed catalog is.
        isSystem: requesterRole === 'SUPER_ADMIN',
      },
    });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    requesterRole: Role,
  ): Promise<Product> {
    await this.assertProductNotProtected(id, requesterRole);

    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        categoryId: dto.categoryId,
        brand: dto.brand !== undefined ? dto.brand.trim() || null : undefined,
        name: dto.name,
        description: dto.description,
        ingredients: dto.ingredients,
        nutritionalInfo: dto.nutritionalInfo as
          Prisma.InputJsonValue | undefined,
        dietaryInfo: dto.dietaryInfo,
        countryOfOrigin: dto.countryOfOrigin,
        status: dto.status,
        isFeatured: dto.isFeatured,
      },
    });
    await this.redis.del(DETAIL_CACHE_PREFIX + updated.slug);
    return updated;
  }

  async findOne(id?: string, slug?: string) {
    if (!id && !slug) {
      throw new BadRequestException('id or slug is required');
    }

    if (slug && !id) {
      const cached = await this.redis.get(DETAIL_CACHE_PREFIX + slug);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      ...(id ? { id } : { slug }),
    };

    const product = await this.prisma.product.findFirst({
      where,
      include: PRODUCT_DETAIL_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (slug && !id) {
      await this.redis.set(
        DETAIL_CACHE_PREFIX + slug,
        JSON.stringify(product),
        'EX',
        DETAIL_CACHE_TTL_SECONDS,
      );
    }
    return product;
  }

  async list(dto: ListProductsDto): Promise<PaginatedResult<unknown>> {
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? DEFAULT_LIMIT;

    const categoryIds = dto.categoryId
      ? await this.categoriesService.descendantIds(dto.categoryId)
      : undefined;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      categoryId: categoryIds ? { in: categoryIds } : undefined,
      ...(dto.brand
        ? { brand: { contains: dto.brand, mode: 'insensitive' as const } }
        : {}),
      ...(dto.search
        ? { name: { contains: dto.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_CARD_INCLUDE,
        orderBy: { [dto.sortBy ?? 'createdAt']: dto.sortOrder ?? 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      offset,
      limit,
      hasMore: offset + items.length < total,
    };
  }

  // ponytail: no real order/activity data exists yet (cart + checkout aren't
  // built), so "popular" is a recency proxy for now — newest active listings
  // first. Swap the orderBy for a real popularity signal once orders flow;
  // callers (the /home endpoint) don't need to change either way.
  async popular(limit = HOME_SECTION_LIMIT) {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      include: PRODUCT_CARD_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Admin-curated merchandising — distinct from `popular()`, which is data-driven. */
  async featured(limit = HOME_SECTION_LIMIT) {
    return this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, isFeatured: true },
      include: PRODUCT_CARD_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Products with at least one active variant discounted below its compareAtPrice. */
  async deals(limit = HOME_SECTION_LIMIT) {
    const candidates = await this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        variants: { some: { status: 'ACTIVE', compareAtPrice: { not: null } } },
      },
      include: DEALS_CARD_INCLUDE,
      take: 50,
    });

    return candidates
      .filter((product) => {
        const variant = product.variants[0];
        return (
          variant?.compareAtPrice != null &&
          Number(variant.compareAtPrice) > Number(variant.price)
        );
      })
      .slice(0, limit);
  }

  /** Unfiltered by status, all variants/images — for the admin edit page. */
  async adminFindOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_ADMIN_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async adminList(
    dto: AdminListProductsDto,
  ): Promise<PaginatedResult<unknown>> {
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? DEFAULT_LIMIT;

    const categoryIds = dto.categoryId
      ? await this.categoriesService.descendantIds(dto.categoryId)
      : undefined;

    const where: Prisma.ProductWhereInput = {
      status: dto.status,
      categoryId: categoryIds ? { in: categoryIds } : undefined,
      ...(dto.brand
        ? { brand: { contains: dto.brand, mode: 'insensitive' as const } }
        : {}),
      ...(dto.search
        ? { name: { contains: dto.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_ADMIN_INCLUDE,
        orderBy: { [dto.sortBy ?? 'createdAt']: dto.sortOrder ?? 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      offset,
      limit,
      hasMore: offset + items.length < total,
    };
  }

  async removeImage(id: string, requesterRole: Role): Promise<void> {
    const image = await this.prisma.productImage.findUnique({
      where: { id },
    });
    if (!image) {
      throw new NotFoundException('Image not found');
    }
    await this.assertProductNotProtected(image.productId, requesterRole);
    await this.prisma.productImage.delete({ where: { id } });

    // Same invariant as addImage() — never leave a product with images but no
    // primary one, or it silently drops out of every product card grid again.
    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId: image.productId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) {
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }

    await this.uploadsService.deleteImage(image.url);
    await this.invalidateDetailCache(image.productId);
  }

  async createVariant(
    dto: CreateVariantDto,
    requesterRole: Role,
  ): Promise<ProductVariant> {
    await this.assertProductNotProtected(dto.productId, requesterRole);
    await this.assertSkuAvailable(dto.skuCode, dto.barcode);

    const variant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productVariant.create({
        data: {
          productId: dto.productId,
          skuCode: dto.skuCode,
          barcode: dto.barcode,
          label: dto.label,
          quantity: dto.quantity,
          unit: dto.unit,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice,
        },
      });
      await tx.inventory.create({
        data: {
          variantId: created.id,
          quantity: dto.stockQuantity ?? 0,
          reorderLevel: dto.reorderLevel,
        },
      });
      return created;
    });
    await this.invalidateDetailCache(dto.productId);
    return variant;
  }

  async updateVariant(
    id: string,
    dto: UpdateVariantDto,
    requesterRole: Role,
  ): Promise<ProductVariant> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
    });
    if (!variant) {
      throw new NotFoundException('Variant not found');
    }
    await this.assertProductNotProtected(variant.productId, requesterRole);
    if (dto.barcode && dto.barcode !== variant.barcode) {
      await this.assertSkuAvailable(undefined, dto.barcode);
    }

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: {
        barcode: dto.barcode,
        label: dto.label,
        quantity: dto.quantity,
        unit: dto.unit,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice,
        status: dto.status,
      },
    });
    if (dto.stockQuantity !== undefined || dto.reorderLevel !== undefined) {
      await this.prisma.inventory.update({
        where: { variantId: id },
        data: { quantity: dto.stockQuantity, reorderLevel: dto.reorderLevel },
      });
    }
    await this.invalidateDetailCache(variant.productId);
    return updated;
  }

  async addImage(
    dto: CreateProductImageDto,
    requesterRole: Role,
  ): Promise<ProductImage> {
    await this.assertProductNotProtected(dto.productId, requesterRole);

    // A product with images but none flagged primary is invisible everywhere
    // that filters on isPrimary (every product card grid) — so the first image
    // ever added to a product is always primary, regardless of the checkbox.
    const hasPrimary = await this.prisma.productImage.findFirst({
      where: { productId: dto.productId, isPrimary: true },
      select: { id: true },
    });
    const shouldBePrimary = dto.isPrimary === true || !hasPrimary;

    const image = shouldBePrimary
      ? await this.prisma.$transaction(async (tx) => {
          await tx.productImage.updateMany({
            where: { productId: dto.productId },
            data: { isPrimary: false },
          });
          return tx.productImage.create({
            data: {
              productId: dto.productId,
              url: dto.url,
              altText: dto.altText,
              sortOrder: dto.sortOrder ?? 0,
              isPrimary: true,
            },
          });
        })
      : await this.prisma.productImage.create({
          data: {
            productId: dto.productId,
            url: dto.url,
            altText: dto.altText,
            sortOrder: dto.sortOrder ?? 0,
            isPrimary: false,
          },
        });

    await this.invalidateDetailCache(dto.productId);
    return image;
  }

  // Any ADMIN can delete their own (non-system) products — same isSystem
  // rule as update(). SUPER_ADMIN bypasses it, same as everywhere else.
  // Permanently deletes this product and its variants/images/inventory, in
  // FK-safe child-before-parent order. A product still referenced by an
  // order line item (ON DELETE RESTRICT) aborts the transaction instead of
  // silently half-deleting.
  async remove(id: string, requesterRole: Role): Promise<void> {
    await this.assertProductNotProtected(id, requesterRole);
    const images = await this.prisma.productImage.findMany({
      where: { productId: id },
      select: { url: true },
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.inventory.deleteMany({ where: { variant: { productId: id } } });
        await tx.productVariant.deleteMany({ where: { productId: id } });
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.product.delete({ where: { id } });
      });
    } catch {
      throw new ConflictException(
        'Cannot delete: this product has order history',
      );
    }

    await Promise.all(
      images.map((image) => this.uploadsService.deleteImage(image.url)),
    );
  }

  private async assertProductNotProtected(
    id: string,
    requesterRole: Role,
  ): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { isSystem: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (product.isSystem && requesterRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'This is a protected showcase product and cannot be edited',
      );
    }
  }

  private async assertCategoryExists(id: string): Promise<void> {
    const exists = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Category not found');
    }
  }

  private async assertProductExists(id: string): Promise<void> {
    const exists = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Product not found');
    }
  }

  private async assertSkuAvailable(
    skuCode?: string,
    barcode?: string,
  ): Promise<void> {
    if (skuCode) {
      const existing = await this.prisma.productVariant.findUnique({
        where: { skuCode },
      });
      if (existing) {
        throw new ConflictException(`SKU "${skuCode}" is already in use`);
      }
    }
    if (barcode) {
      const existing = await this.prisma.productVariant.findUnique({
        where: { barcode },
      });
      if (existing) {
        throw new ConflictException(`Barcode "${barcode}" is already in use`);
      }
    }
  }

  /** Looks up the product's slug and clears its cached detail page — call after any write that changes what the PDP shows (product fields, variants, images). */
  private async invalidateDetailCache(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { slug: true },
    });
    if (product) {
      await this.redis.del(DETAIL_CACHE_PREFIX + product.slug);
    }
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const existing = await this.prisma.product.findUnique({
      where: { slug: base },
    });
    if (!existing) {
      return base;
    }
    throw new ConflictException(
      `A product with a similar name already exists (slug "${base}" is taken)`,
    );
  }
}
