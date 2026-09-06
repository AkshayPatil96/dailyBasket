import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CartService, type CartSummary } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';

const GUEST_CART_COOKIE = 'cart_id';
// Matches the cart architecture doc's abandoned-cart cleanup window — the
// cookie should outlive the cart for at least that long, or a returning
// guest loses their cart identity before the DB row would even be swept.
const GUEST_CART_COOKIE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Controller('cart')
@UseGuards(OptionalAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Req() req: AuthenticatedRequest): Promise<CartSummary> {
    return this.cartService.getCart(req.user?.id, this.guestCartId(req));
  }

  @Post('items')
  async addItem(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddCartItemDto,
  ): Promise<CartSummary> {
    const { cartId, summary } = await this.cartService.addItem(
      req.user?.id,
      this.guestCartId(req),
      dto,
    );
    if (!req.user) {
      this.setGuestCartCookie(res, cartId);
    }
    return summary;
  }

  @Post('items/update')
  @HttpCode(200)
  async updateItem(
    @Req() req: AuthenticatedRequest,
    @Query('id') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ): Promise<CartSummary> {
    return this.cartService.updateItemQuantity(
      req.user?.id,
      this.guestCartId(req),
      itemId,
      dto,
    );
  }

  @Post('items/delete')
  @HttpCode(200)
  async removeItem(
    @Req() req: AuthenticatedRequest,
    @Query('id') itemId: string,
  ): Promise<CartSummary> {
    return this.cartService.removeItem(req.user?.id, this.guestCartId(req), itemId);
  }

  @Post('clear')
  @HttpCode(200)
  async clearCart(@Req() req: AuthenticatedRequest): Promise<CartSummary> {
    return this.cartService.clearCart(req.user?.id, this.guestCartId(req));
  }

  @Get('coupons/available')
  async listAvailableCoupons(@Req() req: AuthenticatedRequest) {
    return this.cartService.listAvailableCoupons(req.user?.id, this.guestCartId(req));
  }

  @Post('coupon')
  @HttpCode(200)
  async applyCoupon(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ApplyCouponDto,
  ): Promise<CartSummary> {
    return this.cartService.applyCoupon(req.user?.id, this.guestCartId(req), dto.code);
  }

  @Post('coupon/remove')
  @HttpCode(200)
  async removeCoupon(@Req() req: AuthenticatedRequest): Promise<CartSummary> {
    return this.cartService.removeCoupon(req.user?.id, this.guestCartId(req));
  }

  private guestCartId(req: AuthenticatedRequest): string | undefined {
    return req.cookies?.[GUEST_CART_COOKIE] as string | undefined;
  }

  private setGuestCartCookie(res: Response, cartId: string): void {
    res.cookie(GUEST_CART_COOKIE, cartId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: GUEST_CART_COOKIE_MAX_AGE_MS,
    });
  }
}
