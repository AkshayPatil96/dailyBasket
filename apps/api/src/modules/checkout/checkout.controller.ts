import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OptionalAuthGuard } from '../../common/guards/optional-auth.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CheckoutService } from './checkout.service';
import { StartCheckoutDto } from './dto/start-checkout.dto';
import { SetCheckoutAddressDto } from './dto/set-checkout-address.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

const GUEST_CART_COOKIE = 'cart_id';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

// Guest-friendly like Cart — checkout doc explicitly requires guest checkout
// support, so this uses the same OptionalAuthGuard + cart_id cookie identity
// as CartController rather than requiring login.
@Controller('checkout')
@UseGuards(OptionalAuthGuard)
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('start')
  async start(@Req() req: AuthenticatedRequest, @Body() dto: StartCheckoutDto) {
    return this.checkoutService.start(req.user?.id, this.guestCartId(req), dto);
  }

  @Get()
  async getSession(@Req() req: AuthenticatedRequest, @Query('id') id: string | undefined) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.checkoutService.getSession(id, req.user?.id, this.guestCartId(req));
  }

  @Post('address')
  @HttpCode(200)
  async setAddress(
    @Req() req: AuthenticatedRequest,
    @Query('id') id: string | undefined,
    @Body() dto: SetCheckoutAddressDto,
  ) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.checkoutService.setAddress(id, req.user?.id, this.guestCartId(req), dto);
  }

  @Post('payment/create')
  async createPayment(@Req() req: AuthenticatedRequest, @Query('id') id: string | undefined) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    return this.checkoutService.createPayment(id, req.user?.id, this.guestCartId(req));
  }

  @Post('payment/verify')
  @HttpCode(200)
  async verifyPayment(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Query('id') id: string | undefined,
    @Body() dto: VerifyPaymentDto,
  ) {
    if (!id) {
      throw new BadRequestException('id is required');
    }
    const order = await this.checkoutService.verifyPayment(id, req.user?.id, this.guestCartId(req), dto);
    // The cart this checkout came from is now CONVERTED — clear the guest
    // cookie the same way login does, so a fresh visit starts a fresh cart.
    if (!req.user) {
      res.clearCookie(GUEST_CART_COOKIE);
    }
    return order;
  }

  // Dev-only convenience — 404s in production so it's not even discoverable
  // (not a real payment method; see CheckoutService.devCompletePayment).
  @Post('payment/dev-complete')
  @HttpCode(200)
  async devCompletePayment(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
    @Query('id') id: string | undefined,
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    if (!id) {
      throw new BadRequestException('id is required');
    }
    const order = await this.checkoutService.devCompletePayment(id, req.user?.id, this.guestCartId(req));
    if (!req.user) {
      res.clearCookie(GUEST_CART_COOKIE);
    }
    return order;
  }

  // Razorpay calls this directly, server-to-server (POST /api/v1/checkout/webhook/razorpay)
  // — no cookie/session identity, verified purely by the webhook signature.
  // Lives on CheckoutController rather than PaymentsController because it
  // needs both PaymentsService and OrdersService, which only CheckoutModule
  // already has without creating a circular module dependency
  // (Checkout -> Payments, Checkout -> Orders; neither imports Checkout back).
  @Post('webhook/razorpay')
  @HttpCode(200)
  async handleRazorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ) {
    if (!req.rawBody) {
      throw new UnauthorizedException('Missing request body');
    }
    return this.checkoutService.processRazorpayWebhook(req.rawBody, signature);
  }

  private guestCartId(req: AuthenticatedRequest): string | undefined {
    return req.cookies?.[GUEST_CART_COOKIE] as string | undefined;
  }
}
