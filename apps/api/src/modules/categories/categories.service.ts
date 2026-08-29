import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, CategoryStatus, Prisma } from '@prisma/client';
import type { Role } from '@grocery-delivery/types';
import { slugify } from '@grocery-delivery/utils';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { UploadsService } from '../uploads/uploads.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}

// Public, unauthenticated, hit on every homepage/category-page load; only ever
// changes through admin CRUD. Cache-aside with an explicit invalidation on every
// write — the TTL is just a safety net for whatever the invalidation misses.
const TREE_CACHE_KEY = 'cache:categories:tree';
const TREE_CACHE_TTL_SECONDS = 300;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateCategoryDto, requesterRole: Role): Promise<Category> {
    if (dto.parentId) {
      await this.assertCategoryExists(dto.parentId);
    }

    const slug = await this.generateUniqueSlug(dto.name);

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug,
        parentId: dto.parentId,
        description: dto.description,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder ?? 0,
        // Portfolio showcase data — anything a super admin adds is protected
        // from edit/delete the same way the original seed catalog is.
        isSystem: requesterRole === 'SUPER_ADMIN',
      },
    });
    await this.redis.del(TREE_CACHE_KEY);
    return category;
  }

  async update(
    id: string,
    dto: UpdateCategoryDto,
    requesterRole: Role,
  ): Promise<Category> {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Category not found');
    }
    if (existing.isSystem && requesterRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'This is a protected showcase category and cannot be edited',
      );
    }

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('A category cannot be its own parent');
      }
      await this.assertCategoryExists(dto.parentId);
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        parentId: dto.parentId,
        description: dto.description,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder,
        status: dto.status,
      },
    });

    if (
      dto.imageUrl !== undefined &&
      existing.imageUrl &&
      existing.imageUrl !== dto.imageUrl
    ) {
      await this.uploadsService.deleteImage(existing.imageUrl);
    }

    await this.redis.del(TREE_CACHE_KEY);
    return updated;
  }

  // Any ADMIN can delete their own (non-system) categories — same isSystem
  // rule as update(). SUPER_ADMIN bypasses it, same as everywhere else.
  // Permanently deletes this category and every descendant category/product/
  // variant/image beneath it, in FK-safe child-before-parent order. A product
  // still referenced by an order line item (ON DELETE RESTRICT) aborts the
  // whole transaction, so a category with real order history can't be
  // silently half-deleted.
  async remove(id: string, requesterRole: Role): Promise<void> {
    await this.assertCategoryExists(id);
    // Deliberately status-agnostic (unlike the public descendantIds(), which
    // is ACTIVE-only for customer browsing) — deleting a subtree must also
    // catch INACTIVE descendants, or they'd survive as orphaned root categories.
    const categoryIds = await this.allDescendantIds(id);

    const products = await this.prisma.product.findMany({
      where: { categoryId: { in: categoryIds } },
      select: { id: true, isSystem: true, images: { select: { url: true } } },
    });

    if (requesterRole !== 'SUPER_ADMIN') {
      const categories = await this.prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { isSystem: true },
      });
      const touchesProtectedData =
        categories.some((c) => c.isSystem) || products.some((p) => p.isSystem);
      if (touchesProtectedData) {
        throw new ForbiddenException(
          'This category (or something under it) is protected showcase data and cannot be deleted',
        );
      }
    }

    const productIds = products.map((p) => p.id);
    const categoryTiles = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, imageUrl: { not: null } },
      select: { imageUrl: true },
    });
    const imageUrls = [
      ...products.flatMap((p) => p.images.map((img) => img.url)),
      ...categoryTiles.map((c) => c.imageUrl!),
    ];

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.inventory.deleteMany({
          where: { variant: { productId: { in: productIds } } },
        });
        await tx.productVariant.deleteMany({
          where: { productId: { in: productIds } },
        });
        await tx.productImage.deleteMany({
          where: { productId: { in: productIds } },
        });
        await tx.product.deleteMany({ where: { id: { in: productIds } } });
        // Leaves before roots — descendantIds() is parent-first, so reverse it.
        for (const categoryId of [...categoryIds].reverse()) {
          await tx.category.delete({ where: { id: categoryId } });
        }
      });
    } catch {
      throw new ConflictException(
        'Cannot delete: this category (or a subcategory) has products with order history',
      );
    }

    await Promise.all(imageUrls.map((url) => this.uploadsService.deleteImage(url)));
    await this.redis.del(TREE_CACHE_KEY);
  }

  async findOne(id?: string, slug?: string): Promise<Category> {
    if (!id && !slug) {
      throw new BadRequestException('id or slug is required');
    }

    const where: Prisma.CategoryWhereInput = id ? { id } : { slug };
    const category = await this.prisma.category.findFirst({ where });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  /** Flat, all statuses — for the admin table and parent-category pickers. */
  async listAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async tree(): Promise<CategoryTreeNode[]> {
    const cached = await this.redis.get(TREE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as CategoryTreeNode[];
    }

    const categories = await this.prisma.category.findMany({
      where: { status: CategoryStatus.ACTIVE },
      orderBy: { sortOrder: 'asc' },
    });

    const byId = new Map<string, CategoryTreeNode>(
      categories.map((category) => [
        category.id,
        { ...category, children: [] },
      ]),
    );

    const roots: CategoryTreeNode[] = [];
    for (const category of byId.values()) {
      if (category.parentId && byId.has(category.parentId)) {
        byId.get(category.parentId)!.children.push(category);
      } else {
        roots.push(category);
      }
    }

    await this.redis.set(
      TREE_CACHE_KEY,
      JSON.stringify(roots),
      'EX',
      TREE_CACHE_TTL_SECONDS,
    );
    return roots;
  }

  /** categoryId itself plus every descendant id, so browsing a parent category surfaces products tagged to its children too. */
  async descendantIds(categoryId: string): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      where: { status: CategoryStatus.ACTIVE },
      select: { id: true, parentId: true },
    });

    const childrenByParent = new Map<string, string[]>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const siblings = childrenByParent.get(category.parentId) ?? [];
      siblings.push(category.id);
      childrenByParent.set(category.parentId, siblings);
    }

    const result = [categoryId];
    const stack = [categoryId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const childId of childrenByParent.get(current) ?? []) {
        result.push(childId);
        stack.push(childId);
      }
    }
    return result;
  }

  private async allDescendantIds(categoryId: string): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      select: { id: true, parentId: true },
    });

    const childrenByParent = new Map<string, string[]>();
    for (const category of categories) {
      if (!category.parentId) continue;
      const siblings = childrenByParent.get(category.parentId) ?? [];
      siblings.push(category.id);
      childrenByParent.set(category.parentId, siblings);
    }

    const result = [categoryId];
    const stack = [categoryId];
    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const childId of childrenByParent.get(current) ?? []) {
        result.push(childId);
        stack.push(childId);
      }
    }
    return result;
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

  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    const existing = await this.prisma.category.findUnique({
      where: { slug: base },
    });
    if (!existing) {
      return base;
    }
    throw new ConflictException(
      `A category with a similar name already exists (slug "${base}" is taken)`,
    );
  }
}
