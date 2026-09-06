import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DELIVERY_FEE } from '../../config/pricing.constants';
import type { AddCartItemDto } from './dto/add-cart-item.dto';
import type { UpdateCartItemDto } from './dto/update-cart-item.dto';

const CART_ITEM_INCLUDE = {
  variant: {
    include: {
      inventory: true,
      product: {
        include: {
          images: { where: { isPrimary: true }, take: 1 },
        },
      },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{
  include: typeof CART_ITEM_INCLUDE;
}>;

export interface CartItemSummary {
  id: string;
  variantId: string;
  quantity: number;
  currentPrice: number;
  lineTotal: number;
  product: { id: string; name: string; slug: string; imageUrl: string | null };
  variant: {
    id: string;
    label: string;
    unit: string;
    price: number;
    compareAtPrice: number | null;
    status: string;
  };
  availability: { inStock: boolean; availableQuantity: number };
}

export interface CartSummary {
  cartId: string | null;
  items: CartItemSummary[];
  itemCount: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
}

const EMPTY_CART: CartSummary = {
  cartId: null,
  items: [],
  itemCount: 0,
  subtotal: 0,
  deliveryFee: 0,
  total: 0,
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(
    userId: string | undefined,
    guestCartId: string | undefined,
  ): Promise<CartSummary> {
    const cart = await this.findActiveCart(userId, guestCartId);
    if (!cart) {
      return EMPTY_CART;
    }
    return this.buildSummary(cart.id);
  }

  // Returns the cart id so the controller can (re)set the guest cookie —
  // a new guest cart may have been created if none existed yet.
  async addItem(
    userId: string | undefined,
    guestCartId: string | undefined,
    dto: AddCartItemDto,
  ): Promise<{ cartId: string; summary: CartSummary }> {
    const cart = await this.resolveOrCreateCart(userId, guestCartId);

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { inventory: true },
    });
    if (!variant || variant.status !== 'ACTIVE') {
      throw new NotFoundException('This item is no longer available');
    }

    const existing = await this.prisma.cartItem.findUnique({
      where: {
        cartId_variantId: { cartId: cart.id, variantId: dto.variantId },
      },
    });

    const available = variant.inventory
      ? variant.inventory.quantity - variant.inventory.reservedQuantity
      : 0;
    const desiredQuantity = (existing?.quantity ?? 0) + dto.quantity;
    const clampedQuantity = Math.min(desiredQuantity, Math.max(available, 0));

    if (clampedQuantity <= 0) {
      throw new NotFoundException('This item is out of stock');
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: clampedQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: dto.variantId,
          quantity: clampedQuantity,
        },
      });
    }

    return { cartId: cart.id, summary: await this.buildSummary(cart.id) };
  }

  async updateItemQuantity(
    userId: string | undefined,
    guestCartId: string | undefined,
    itemId: string,
    dto: UpdateCartItemDto,
  ): Promise<CartSummary> {
    const cart = await this.findActiveCart(userId, guestCartId);
    const item = cart
      ? await this.prisma.cartItem.findFirst({
          where: { id: itemId, cartId: cart.id },
          include: { variant: { include: { inventory: true } } },
        })
      : null;
    if (!cart || !item) {
      throw new NotFoundException('Cart item not found');
    }

    const available = item.variant.inventory
      ? item.variant.inventory.quantity -
        item.variant.inventory.reservedQuantity
      : 0;
    const clampedQuantity = Math.min(dto.quantity, Math.max(available, 0));
    if (clampedQuantity <= 0) {
      throw new NotFoundException('This item is out of stock');
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: clampedQuantity },
    });
    return this.buildSummary(cart.id);
  }

  async removeItem(
    userId: string | undefined,
    guestCartId: string | undefined,
    itemId: string,
  ): Promise<CartSummary> {
    const cart = await this.findActiveCart(userId, guestCartId);
    if (!cart) {
      throw new NotFoundException('Cart item not found');
    }
    await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cartId: cart.id },
    });
    return this.buildSummary(cart.id);
  }

  async clearCart(
    userId: string | undefined,
    guestCartId: string | undefined,
  ): Promise<CartSummary> {
    const cart = await this.findActiveCart(userId, guestCartId);
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return EMPTY_CART;
  }

  // Called right after login/register — folds a guest cart's lines into the
  // user's own cart (summing quantities, clamped to current stock) and marks
  // the guest cart MERGED so it's excluded from future lookups.
  async mergeGuestCartIntoUser(
    guestCartId: string | undefined,
    userId: string,
  ): Promise<void> {
    if (!guestCartId) {
      return;
    }
    const guestCart = await this.prisma.cart.findFirst({
      where: { id: guestCartId, userId: null, status: 'ACTIVE' },
      include: {
        items: { include: { variant: { include: { inventory: true } } } },
      },
    });
    if (!guestCart || guestCart.items.length === 0) {
      if (guestCart) {
        await this.prisma.cart.update({
          where: { id: guestCart.id },
          data: { status: 'MERGED' },
        });
      }
      return;
    }

    const userCart = await this.resolveOrCreateCart(userId, undefined);

    await this.prisma.$transaction(async (tx) => {
      for (const item of guestCart.items) {
        if (item.variant.status !== 'ACTIVE') {
          continue;
        }
        const available = item.variant.inventory
          ? item.variant.inventory.quantity -
            item.variant.inventory.reservedQuantity
          : 0;
        if (available <= 0) {
          continue;
        }

        const existing = await tx.cartItem.findUnique({
          where: {
            cartId_variantId: {
              cartId: userCart.id,
              variantId: item.variantId,
            },
          },
        });
        const mergedQuantity = Math.min(
          (existing?.quantity ?? 0) + item.quantity,
          available,
        );

        if (existing) {
          await tx.cartItem.update({
            where: { id: existing.id },
            data: { quantity: mergedQuantity },
          });
        } else {
          await tx.cartItem.create({
            data: {
              cartId: userCart.id,
              variantId: item.variantId,
              quantity: mergedQuantity,
            },
          });
        }
      }
      await tx.cart.update({
        where: { id: guestCart.id },
        data: { status: 'MERGED' },
      });
    });
  }

  private async findActiveCart(
    userId: string | undefined,
    guestCartId: string | undefined,
  ) {
    if (userId) {
      return this.prisma.cart.findFirst({
        where: { userId, status: 'ACTIVE' },
      });
    }
    if (guestCartId) {
      return this.prisma.cart.findFirst({
        where: { id: guestCartId, userId: null, status: 'ACTIVE' },
      });
    }
    return null;
  }

  private async resolveOrCreateCart(
    userId: string | undefined,
    guestCartId: string | undefined,
  ) {
    const existing = await this.findActiveCart(userId, guestCartId);
    if (existing) {
      return existing;
    }
    return this.prisma.cart.create({ data: { userId } });
  }

  private async buildSummary(cartId: string): Promise<CartSummary> {
    const items = await this.prisma.cartItem.findMany({
      where: { cartId },
      include: CART_ITEM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    const itemSummaries = items.map((item) => this.toItemSummary(item));
    const subtotal = itemSummaries.reduce(
      (sum, item) => sum + item.lineTotal,
      0,
    );
    const deliveryFee = itemSummaries.length > 0 ? DELIVERY_FEE : 0;

    return {
      cartId,
      items: itemSummaries,
      itemCount: itemSummaries.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      deliveryFee,
      total: subtotal + deliveryFee,
    };
  }

  private toItemSummary(item: CartItemWithRelations): CartItemSummary {
    const { variant } = item;
    const { product } = variant;
    const currentPrice = Number(variant.price);
    const available = variant.inventory
      ? variant.inventory.quantity - variant.inventory.reservedQuantity
      : 0;

    return {
      id: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      currentPrice,
      lineTotal: currentPrice * item.quantity,
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        imageUrl: product.images[0]?.url ?? null,
      },
      variant: {
        id: variant.id,
        label: variant.label,
        unit: variant.unit,
        price: currentPrice,
        compareAtPrice: variant.compareAtPrice
          ? Number(variant.compareAtPrice)
          : null,
        status: variant.status,
      },
      availability: {
        inStock: available > 0,
        availableQuantity: Math.max(available, 0),
      },
    };
  }
}
