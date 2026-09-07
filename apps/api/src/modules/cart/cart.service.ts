import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponsService } from '../coupons/coupons.service';
import { SettingsService } from '../settings/settings.service';
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

const round2 = (value: number): number => Math.round(value * 100) / 100;

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
  discount: number;
  couponCode: string | null;
  handlingCharge: number;
  // Only meaningful when handlingChargeWaived is true — the amount it would
  // have been, so the UI can show it struck through next to "FREE".
  handlingChargeOriginalAmount: number;
  handlingChargeWaived: boolean;
  handlingChargeWaiverReason: string | null;
  deliveryFee: number;
  // Only meaningful when deliveryFee is 0 due to the free-delivery
  // threshold — the flat fee it would have been, so the UI can show it
  // struck through next to "FREE" (same pattern as handlingChargeOriginalAmount).
  deliveryFeeOriginalAmount: number;
  total: number;
}

const EMPTY_CART: CartSummary = {
  cartId: null,
  items: [],
  itemCount: 0,
  subtotal: 0,
  discount: 0,
  couponCode: null,
  handlingCharge: 0,
  handlingChargeOriginalAmount: 0,
  handlingChargeWaived: false,
  handlingChargeWaiverReason: null,
  deliveryFee: 0,
  deliveryFeeOriginalAmount: 0,
  total: 0,
};

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly couponsService: CouponsService,
    private readonly settingsService: SettingsService,
  ) {}

  async getCart(
    userId: string | undefined,
    guestCartId: string | undefined,
  ): Promise<CartSummary> {
    const cart = await this.findActiveCart(userId, guestCartId);
    if (!cart) {
      return EMPTY_CART;
    }
    return this.buildSummary(cart.id, userId);
  }

  // Cart-time apply only checks what's knowable without a checkout session —
  // a guest has no email yet, so their per-user usage limit is enforced
  // authoritatively at checkout instead (see CouponsService).
  async applyCoupon(
    userId: string | undefined,
    guestCartId: string | undefined,
    code: string,
  ): Promise<CartSummary> {
    const cart = await this.findActiveCart(userId, guestCartId);
    if (!cart) {
      throw new NotFoundException('Your cart is empty');
    }
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: { variant: true },
    });
    if (items.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }
    const subtotal = items.reduce((sum, item) => sum + Number(item.variant.price) * item.quantity, 0);
    const coupon = await this.couponsService.validateByCode(code, subtotal, userId);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponId: coupon.id } });
    return this.buildSummary(cart.id, userId);
  }

  async listAvailableCoupons(userId: string | undefined, guestCartId: string | undefined) {
    const cart = await this.findActiveCart(userId, guestCartId);
    if (!cart) {
      return [];
    }
    const items = await this.prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: { variant: true },
    });
    const subtotal = items.reduce((sum, item) => sum + Number(item.variant.price) * item.quantity, 0);
    return this.couponsService.listAvailableForCart(subtotal, userId);
  }

  async removeCoupon(
    userId: string | undefined,
    guestCartId: string | undefined,
  ): Promise<CartSummary> {
    const cart = await this.findActiveCart(userId, guestCartId);
    if (!cart) {
      throw new NotFoundException('Your cart is empty');
    }
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
    return this.buildSummary(cart.id, userId);
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

    const available = Math.max(
      variant.inventory ? variant.inventory.quantity - variant.inventory.reservedQuantity : 0,
      0,
    );
    if (available <= 0) {
      throw new NotFoundException('This item is out of stock');
    }
    const desiredQuantity = (existing?.quantity ?? 0) + dto.quantity;
    if (desiredQuantity > available) {
      // Reject rather than silently clamp — clamping to the same value the
      // cart was already at looks like the button did nothing.
      throw new BadRequestException(`Only ${available} available`);
    }

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: desiredQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: dto.variantId,
          quantity: desiredQuantity,
        },
      });
    }

    return { cartId: cart.id, summary: await this.buildSummary(cart.id, userId) };
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

    const available = Math.max(
      item.variant.inventory
        ? item.variant.inventory.quantity - item.variant.inventory.reservedQuantity
        : 0,
      0,
    );
    if (available <= 0) {
      throw new NotFoundException('This item is out of stock');
    }
    if (dto.quantity > available) {
      // Reject rather than silently clamp — clamping to the same value the
      // cart was already at looks like the +/- button did nothing.
      throw new BadRequestException(`Only ${available} available`);
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });
    return this.buildSummary(cart.id, userId);
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
    return this.buildSummary(cart.id, userId);
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

  private async buildSummary(cartId: string, userId?: string): Promise<CartSummary> {
    const cart = await this.prisma.cart.findUniqueOrThrow({ where: { id: cartId } });
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
    const hasItems = itemSummaries.length > 0;

    const settings = await this.settingsService.get();

    const freeDeliveryThreshold = settings.freeDeliveryThreshold
      ? Number(settings.freeDeliveryThreshold)
      : null;
    const deliveryFee = hasItems
      ? freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold
        ? 0
        : Number(settings.deliveryFee)
      : 0;

    const handling = this.settingsService.computeHandlingCharge(settings, subtotal);
    const handlingCharge = hasItems ? handling.amount : 0;

    let discount = 0;
    let couponCode: string | null = null;
    if (cart.couponId) {
      try {
        const coupon = await this.couponsService.revalidateById(cart.couponId, subtotal, userId);
        discount = this.couponsService.calculateDiscount(coupon, subtotal);
        couponCode = coupon.code;
      } catch {
        // No longer valid (expired, min order no longer met, usage limit hit
        // since it was applied...) — drop it silently rather than surfacing
        // an error on every cart GET. The customer can re-apply if they
        // still want to try, which will give them the real reason.
        await this.prisma.cart.update({ where: { id: cartId }, data: { couponId: null } });
      }
    }

    return {
      cartId,
      items: itemSummaries,
      itemCount: itemSummaries.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      discount,
      couponCode,
      handlingCharge,
      handlingChargeOriginalAmount: hasItems ? round2(handling.originalAmount) : 0,
      handlingChargeWaived: hasItems && handling.waived,
      handlingChargeWaiverReason: hasItems ? handling.waiverReason : null,
      deliveryFee,
      deliveryFeeOriginalAmount: hasItems ? Number(settings.deliveryFee) : 0,
      total: round2(subtotal - discount + handlingCharge + deliveryFee),
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
