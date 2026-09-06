import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CheckoutSession, Order, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DELIVERY_FEE } from '../../config/pricing.constants';
import { PaymentsService } from '../payments/payments.service';
import { OrdersService } from '../orders/orders.service';
import type { StartCheckoutDto } from './dto/start-checkout.dto';
import type { SetCheckoutAddressDto } from './dto/set-checkout-address.dto';
import type { VerifyPaymentDto } from './dto/verify-payment.dto';

// Doc-specified policy: checkout session ~15 min, inventory reservation ~10
// min — two separate clocks, the reservation can lapse first and force
// re-validation even while the session itself is still alive.
const SESSION_TTL_MS = 15 * 60 * 1000;
const RESERVATION_TTL_MS = 10 * 60 * 1000;

export interface CreatePaymentResult {
  checkoutSessionId: string;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amount: number;
  currency: string;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService,
  ) {}

  async start(
    userId: string | undefined,
    guestCartId: string | undefined,
    dto: StartCheckoutDto,
  ): Promise<CheckoutSession> {
    const cart = await this.findCart(userId, guestCartId);
    if (!cart) {
      throw new BadRequestException('Your cart is empty');
    }
    const itemCount = await this.prisma.cartItem.count({ where: { cartId: cart.id } });
    if (itemCount === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    return this.prisma.checkoutSession.create({
      data: {
        cartId: cart.id,
        userId,
        guestEmail: userId ? undefined : dto.guestEmail,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
  }

  async getSession(
    sessionId: string,
    userId: string | undefined,
    guestCartId: string | undefined,
  ): Promise<CheckoutSession> {
    return this.getOwnedSession(sessionId, userId, guestCartId);
  }

  async setAddress(
    sessionId: string,
    userId: string | undefined,
    guestCartId: string | undefined,
    dto: SetCheckoutAddressDto,
  ): Promise<CheckoutSession> {
    const session = await this.getOwnedSession(sessionId, userId, guestCartId);
    if (session.status === 'COMPLETED') {
      throw new ConflictException('This checkout has already been completed');
    }

    let addressFields: Prisma.CheckoutSessionUpdateInput;
    if (dto.savedAddressId) {
      if (!userId) {
        throw new BadRequestException('Guests cannot select a saved address');
      }
      const address = await this.prisma.address.findFirst({
        where: { id: dto.savedAddressId, userId, deletedAt: null },
      });
      if (!address) {
        throw new NotFoundException('Address not found');
      }
      addressFields = {
        savedAddressId: address.id,
        recipientName: address.recipientName,
        phone: address.phone,
        line1: address.line1,
        line2: address.line2,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        country: address.country,
        postalCode: address.postalCode,
        latitude: address.latitude,
        longitude: address.longitude,
        formattedAddress: address.formattedAddress,
      };
    } else {
      if (!dto.recipientName || !dto.phone || !dto.line1 || !dto.city || !dto.state || !dto.postalCode) {
        throw new BadRequestException(
          'recipientName, phone, line1, city, state and postalCode are required',
        );
      }
      addressFields = {
        savedAddressId: null,
        recipientName: dto.recipientName,
        phone: dto.phone,
        line1: dto.line1,
        line2: dto.line2,
        landmark: dto.landmark,
        city: dto.city,
        state: dto.state,
        country: dto.country ?? 'India',
        postalCode: dto.postalCode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        formattedAddress: dto.formattedAddress,
      };
    }

    if (!userId && dto.guestEmail) {
      addressFields.guestEmail = dto.guestEmail;
    }

    return this.prisma.checkoutSession.update({ where: { id: session.id }, data: addressFields });
  }

  // Revalidates the cart against the live catalog, atomically reserves stock
  // per line item, computes final pricing, and creates the Razorpay order.
  // Safe to call again on the same session (e.g. the customer reloads the
  // payment step) — any prior reservation for this session is released first.
  async createPayment(
    sessionId: string,
    userId: string | undefined,
    guestCartId: string | undefined,
  ): Promise<CreatePaymentResult> {
    const session = await this.getOwnedSession(sessionId, userId, guestCartId);
    if (session.status === 'COMPLETED') {
      throw new ConflictException('This checkout has already been completed');
    }
    if (
      !session.recipientName ||
      !session.phone ||
      !session.line1 ||
      !session.city ||
      !session.state ||
      !session.postalCode
    ) {
      throw new BadRequestException('Set a delivery address before payment');
    }

    const cartItems = await this.prisma.cartItem.findMany({
      where: { cartId: session.cartId },
      include: { variant: { include: { product: { select: { name: true } } } } },
    });
    if (cartItems.length === 0) {
      throw new BadRequestException('Your cart is empty');
    }

    let subtotal = 0;
    await this.prisma.$transaction(async (tx) => {
      await this.releaseReservationsInTx(tx, session.id);

      for (const item of cartItems) {
        if (item.variant.status !== 'ACTIVE') {
          throw new ConflictException(`${item.variant.product.name} is no longer available`);
        }

        // Atomic check-and-reserve — only succeeds if enough unreserved stock
        // remains right now. Column-to-column comparison isn't expressible in
        // Prisma's query builder, so this step needs raw SQL (per the
        // checkout doc's own pseudocode for this exact operation).
        // No ::uuid cast — variant_id is a TEXT column (Prisma's `String @id`
        // maps to TEXT, not a native Postgres uuid type), so casting the
        // parameter to uuid breaks the comparison with "operator does not
        // exist: text = uuid".
        const affected = await tx.$executeRaw`
          UPDATE inventory
          SET reserved_quantity = reserved_quantity + ${item.quantity}
          WHERE variant_id = ${item.variantId}
            AND quantity - reserved_quantity >= ${item.quantity}
        `;
        if (affected === 0) {
          throw new ConflictException(`Only a limited quantity of ${item.variant.product.name} is available`);
        }

        const unitPrice = Number(item.variant.price);
        subtotal += unitPrice * item.quantity;
        await tx.checkoutReservation.create({
          data: {
            checkoutSessionId: session.id,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: item.variant.price,
          },
        });
      }

      const deliveryFee = DELIVERY_FEE;
      const total = subtotal + deliveryFee;
      await tx.checkoutSession.update({
        where: { id: session.id },
        data: {
          status: 'AWAITING_PAYMENT',
          subtotal,
          deliveryFee,
          tax: 0,
          discount: 0,
          total,
          reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
        },
      });
    });

    const total = subtotal + DELIVERY_FEE;
    const razorpayOrder = await this.paymentsService.createOrder(total, session.id);

    const payment = await this.prisma.payment.upsert({
      where: { checkoutSessionId: session.id },
      create: {
        checkoutSessionId: session.id,
        provider: 'razorpay',
        providerOrderId: razorpayOrder.id,
        status: 'CREATED',
        amount: total,
      },
      update: {
        providerOrderId: razorpayOrder.id,
        providerPaymentId: null,
        status: 'CREATED',
        amount: total,
      },
    });

    return {
      checkoutSessionId: session.id,
      razorpayOrderId: payment.providerOrderId!,
      razorpayKeyId: this.paymentsService.keyId,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    };
  }

  async verifyPayment(
    sessionId: string,
    userId: string | undefined,
    guestCartId: string | undefined,
    dto: VerifyPaymentDto,
  ): Promise<Order> {
    const session = await this.getOwnedSession(sessionId, userId, guestCartId);
    const payment = await this.prisma.payment.findUnique({
      where: { checkoutSessionId: session.id },
    });
    if (!payment) {
      throw new NotFoundException('No payment found for this checkout session');
    }
    if (payment.orderId) {
      return this.ordersService.finalizeOrderForPayment(payment.id);
    }
    if (payment.providerOrderId !== dto.razorpayOrderId) {
      throw new BadRequestException('Payment order mismatch');
    }

    const valid = this.paymentsService.verifyPaymentSignature({
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
    });
    if (!valid) {
      throw new BadRequestException('Payment verification failed');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CAPTURED', providerPaymentId: dto.razorpayPaymentId },
    });
    return this.ordersService.finalizeOrderForPayment(payment.id);
  }

  // Server-to-server fallback for "customer closed the browser after paying"
  // — the client-side verify() call above never ran, so this is the only
  // path that finalizes the order. Idempotent against verifyPayment: both
  // ultimately call ordersService.finalizeOrderForPayment, which short-circuits
  // once payment.orderId is set, whichever of the two runs first.
  async processRazorpayWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<{ received: boolean }> {
    if (!this.paymentsService.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const entity = event.payload?.payment?.entity;
    const providerOrderId = entity?.order_id;
    const providerPaymentId = entity?.id;
    if (!providerOrderId) {
      return { received: true };
    }

    const payment = await this.prisma.payment.findUnique({ where: { providerOrderId } });
    if (!payment) {
      this.logger.warn(`Webhook for unknown Razorpay order ${providerOrderId}`);
      return { received: true };
    }

    if (event.event === 'payment.captured') {
      if (payment.status !== 'CAPTURED') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'CAPTURED', providerPaymentId },
        });
      }
      await this.ordersService.finalizeOrderForPayment(payment.id);
    } else if (event.event === 'payment.failed') {
      if (payment.status !== 'CAPTURED' && payment.checkoutSessionId) {
        await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
        await this.releaseReservations(payment.checkoutSessionId);
        await this.prisma.checkoutSession.update({
          where: { id: payment.checkoutSessionId },
          data: { status: 'PENDING' },
        });
      }
    }

    return { received: true };
  }

  // Shared by the expiry cron and (indirectly) by createPayment's own
  // re-reservation step — never leaves stock reserved with nothing tracking it.
  async releaseReservations(sessionId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.releaseReservationsInTx(tx, sessionId);
    });
  }

  private async releaseReservationsInTx(
    tx: Prisma.TransactionClient,
    sessionId: string,
  ): Promise<void> {
    const reservations = await tx.checkoutReservation.findMany({ where: { checkoutSessionId: sessionId } });
    for (const reservation of reservations) {
      await tx.inventory.update({
        where: { variantId: reservation.variantId },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      });
    }
    await tx.checkoutReservation.deleteMany({ where: { checkoutSessionId: sessionId } });
  }

  private async findCart(userId: string | undefined, guestCartId: string | undefined) {
    if (userId) {
      return this.prisma.cart.findFirst({ where: { userId, status: 'ACTIVE' } });
    }
    if (guestCartId) {
      return this.prisma.cart.findFirst({ where: { id: guestCartId, userId: null, status: 'ACTIVE' } });
    }
    return null;
  }

  private async getOwnedSession(
    sessionId: string,
    userId: string | undefined,
    guestCartId: string | undefined,
  ): Promise<CheckoutSession> {
    const session = await this.prisma.checkoutSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }
    const owned = userId ? session.userId === userId : !session.userId && session.cartId === guestCartId;
    if (!owned) {
      throw new ForbiddenException('This checkout session does not belong to you');
    }
    return session;
  }
}
