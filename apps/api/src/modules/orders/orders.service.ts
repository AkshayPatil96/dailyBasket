import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryStatus,
  NotificationType,
  Order,
  OrderEventActor,
  OrderEventType,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CouponsService } from '../coupons/coupons.service';
import { PRODUCT_CARD_INCLUDE } from '../products/products.service';
import { AdminListOrdersDto } from './dto/admin-list-orders.dto';

export interface BuyAgainItem {
  product: Prisma.ProductGetPayload<{ include: typeof PRODUCT_CARD_INCLUDE }>;
  lastOrderedAt: Date;
  lastQuantity: number;
}

// How many past order items to scan for distinct products, and how many
// distinct products to return — a scan window well beyond the return cap so
// a customer with lots of repeat orders of the same few things still surfaces
// a full list instead of stalling on early duplicates.
const BUY_AGAIN_SCAN_WINDOW = 200;
const BUY_AGAIN_LIMIT = 20;

const ORDER_DETAIL_INCLUDE = {
  items: true,
  payment: true,
  delivery: true,
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

// Manual, admin-driven transitions only — CONFIRMED is reached automatically
// at order creation (see finalizeOrderForPayment), never via this map.
// OUT_FOR_DELIVERY and DELIVERED are no longer admin-settable here: they're
// now a *side effect* of the Delivery state machine (a partner starting/
// completing the delivery — see DeliveryService), which is why PACKED's only
// manual next step is CANCELLED. OUT_FOR_DELIVERY -> CANCELLED stays open,
// but only for the admin-review path after a FAILED delivery
// (dailybasket-delivery-partner-operations.md "Failed Delivery"), not as a
// general customer-facing status advance.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [],
  PAYMENT_FAILED: [],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['PACKED', 'CANCELLED'],
  PACKED: ['CANCELLED'],
  OUT_FOR_DELIVERY: ['CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

// Each manual Order transition appends an audit event — dailybasket-orders-
// order-tracking.md §9-10 (append-only OrderEvent). Only CANCELLED still
// mirrors onto Delivery here; PROCESSING/PACKED no longer touch it — Delivery
// stays at PENDING_ASSIGNMENT (its default since creation) until an admin
// actually assigns a partner.
const TARGET_STATUS_EFFECTS: Partial<
  Record<OrderStatus, { eventType: OrderEventType; deliveryStatus?: DeliveryStatus }>
> = {
  PROCESSING: { eventType: 'PICKING_STARTED' },
  PACKED: { eventType: 'ORDER_PACKED' },
  CANCELLED: { eventType: 'ORDER_CANCELLED', deliveryStatus: 'CANCELLED' },
};

// Which manual transitions notify the customer, and how — deliberately
// excludes PROCESSING/PICKING_STARTED (internal, not customer-facing per
// dailybasket-orders-order-tracking.md §15's notification examples).
// OUT_FOR_DELIVERY/DELIVERED move to DELIVERY_DRIVEN_NOTIFICATIONS below.
const NOTIFICATION_FOR_STATUS: Partial<Record<OrderStatus, { type: NotificationType; label: string }>> = {
  PACKED: { type: 'ORDER_PACKED', label: 'Packed' },
  CANCELLED: { type: 'ORDER_CANCELLED', label: 'Cancelled' },
};

// Fired by DeliveryService via syncOrderStatusFromDelivery(), not through
// applyTransition() — these two Order statuses are reached as a side effect
// of the partner's own actions, not a direct admin status update.
const DELIVERY_DRIVEN_NOTIFICATIONS: Record<'OUT_FOR_DELIVERY' | 'DELIVERED', { type: NotificationType; label: string; eventType: OrderEventType }> = {
  OUT_FOR_DELIVERY: { type: 'ORDER_OUT_FOR_DELIVERY', label: 'Out for delivery', eventType: 'OUT_FOR_DELIVERY' },
  DELIVERED: { type: 'ORDER_DELIVERED', label: 'Delivered', eventType: 'DELIVERED' },
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificationsService: NotificationsService,
    private readonly couponsService: CouponsService,
  ) {}

  // Best-effort — a failed email/notification must never break order
  // creation or a status transition that already committed successfully.
  private async notifyOrderUpdate(order: Order, type: NotificationType, statusLabel: string): Promise<void> {
    try {
      let email: string | null | undefined;
      let name = order.recipientName;

      if (order.userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: order.userId },
          select: { email: true, firstName: true },
        });
        if (user) {
          email = user.email;
          name = user.firstName;
          const title = type === 'ORDER_CONFIRMED' ? 'Order confirmed' : `Order ${statusLabel.toLowerCase()}`;
          await this.notificationsService.createForUser(
            order.userId,
            type,
            title,
            `Your order ${order.orderNumber} is now ${statusLabel.toLowerCase()}.`,
            order.id,
          );
        }
      } else {
        email = order.guestEmail;
      }

      if (!email) {
        return;
      }
      if (type === 'ORDER_CONFIRMED') {
        await this.emailService.sendOrderConfirmedEmail(email, name, order.orderNumber, Number(order.total).toFixed(2));
      } else {
        await this.emailService.sendOrderStatusEmail(email, name, order.orderNumber, statusLabel);
      }
    } catch (error) {
      this.logger.warn(`Failed sending notification for order ${order.id}: ${error}`);
    }
  }

  // Idempotent — a payment already linked to an order returns that order
  // instead of creating a duplicate. Called from both the client-side verify
  // endpoint and the Razorpay webhook, which can race or both fire for the
  // same payment (see checkout doc: "payment succeeds but order creation
  // fails must be recoverable" and "webhook handling is idempotent").
  async finalizeOrderForPayment(paymentId: string): Promise<Order> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.orderId) {
      return this.prisma.order.findUniqueOrThrow({ where: { id: payment.orderId } });
    }
    if (!payment.checkoutSessionId) {
      throw new BadRequestException('Payment is not linked to a checkout session');
    }

    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: payment.checkoutSessionId },
      include: {
        reservations: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }
    if (session.reservations.length === 0) {
      throw new BadRequestException('Checkout session has no reserved items');
    }
    if (!session.recipientName || !session.line1 || !session.city || !session.state || !session.postalCode || !session.phone) {
      throw new BadRequestException('Checkout session is missing address details');
    }

    return this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.nextOrderNumber(tx);

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: session.userId,
          addressId: session.savedAddressId,
          recipientName: session.recipientName!,
          phone: session.phone!,
          line1: session.line1!,
          line2: session.line2,
          landmark: session.landmark,
          city: session.city!,
          state: session.state!,
          country: session.country ?? 'India',
          postalCode: session.postalCode!,
          latitude: session.latitude,
          longitude: session.longitude,
          formattedAddress: session.formattedAddress,
          guestEmail: session.guestEmail,
          couponId: session.couponId,
          status: 'CONFIRMED',
          subtotal: session.subtotal,
          discount: session.discount,
          deliveryFee: session.deliveryFee,
          handlingCharge: session.handlingCharge,
          tax: session.tax,
          total: session.total,
        },
      });

      if (session.couponId) {
        // Atomic usage-limit guard + redemption record, same transaction as
        // order creation — either both commit or neither does. In the rare
        // case a concurrent order exhausts the global usage limit in the gap
        // between createPayment's revalidation and this moment, this throws
        // and the whole order rolls back; the customer's Razorpay payment is
        // already captured by then, so this is the same known "payment
        // succeeded but order creation failed" edge case the checkout doc
        // already calls out — not something this feature needs to solve.
        await this.couponsService.redeem(tx, session.couponId, order.id, session.userId, session.guestEmail);
      }

      for (const reservation of session.reservations) {
        const unitPrice = Number(reservation.unitPrice);
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: reservation.variant.productId,
            variantId: reservation.variantId,
            productNameSnapshot: reservation.variant.product.name,
            variantNameSnapshot: reservation.variant.label,
            skuSnapshot: reservation.variant.skuCode,
            quantity: reservation.quantity,
            unitPrice: reservation.unitPrice,
            lineTotal: unitPrice * reservation.quantity,
          },
        });

        // Convert the short-lived hold into a real, permanent stock decrement.
        await tx.inventory.update({
          where: { variantId: reservation.variantId },
          data: {
            quantity: { decrement: reservation.quantity },
            reservedQuantity: { decrement: reservation.quantity },
          },
        });
      }

      // status omitted — defaults to PENDING_ASSIGNMENT, same as the schema.
      await tx.delivery.create({ data: { orderId: order.id } });
      // Order rows in this flow are only ever created post-payment (see the
      // Order model's status default), so all three happen together —
      // matches the doc's timeline example without pretending they were
      // spread over time.
      await tx.orderEvent.createMany({
        data: [
          { orderId: order.id, type: 'ORDER_PLACED', actorType: 'SYSTEM' },
          { orderId: order.id, type: 'PAYMENT_CONFIRMED', actorType: 'SYSTEM' },
          { orderId: order.id, type: 'ORDER_CONFIRMED', actorType: 'SYSTEM' },
        ],
      });

      await tx.checkoutReservation.deleteMany({ where: { checkoutSessionId: session.id } });
      await tx.checkoutSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', orderId: order.id },
      });
      await tx.payment.update({ where: { id: payment.id }, data: { orderId: order.id } });

      await tx.cartItem.deleteMany({ where: { cartId: session.cartId } });
      await tx.cart.update({ where: { id: session.cartId }, data: { status: 'CONVERTED' } });

      return order;
    }).then(async (createdOrder) => {
      // Outside the transaction — email/notification I/O has no business
      // being inside a DB transaction (same reasoning as never mixing a
      // Razorpay call into one, per AGENTS.md).
      await this.notifyOrderUpdate(createdOrder, 'ORDER_CONFIRMED', 'Confirmed');
      return createdOrder;
    });
  }

  // Guest checkouts never create a User row and are never retroactively
  // matched — called from AuthService on both register and login so a guest
  // order becomes visible in order history the moment its email gets an
  // account, however that account came to exist.
  async linkGuestOrders(userId: string, email: string): Promise<void> {
    await this.prisma.order.updateMany({
      where: { userId: null, guestEmail: { equals: email, mode: 'insensitive' } },
      data: { userId },
    });
  }

  async listForUser(userId: string, offset: number, limit: number) {
    const where: Prisma.OrderWhereInput = { userId };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_DETAIL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, offset, limit, hasMore: offset + items.length < total };
  }

  // Distinct products from the customer's own non-cancelled orders, most
  // recently ordered first. A product can never be hard-deleted while it
  // still has order history (see ProductsService.remove()'s FK-violation
  // catch), so every productId found here is guaranteed to still resolve.
  async buyAgain(userId: string): Promise<BuyAgainItem[]> {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { userId, status: { not: 'CANCELLED' } } },
      orderBy: { order: { createdAt: 'desc' } },
      take: BUY_AGAIN_SCAN_WINDOW,
      select: {
        productId: true,
        quantity: true,
        order: { select: { createdAt: true } },
      },
    });

    const latestByProduct = new Map<string, { lastOrderedAt: Date; lastQuantity: number }>();
    for (const item of items) {
      if (latestByProduct.size >= BUY_AGAIN_LIMIT) break;
      if (!latestByProduct.has(item.productId)) {
        latestByProduct.set(item.productId, {
          lastOrderedAt: item.order.createdAt,
          lastQuantity: item.quantity,
        });
      }
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: [...latestByProduct.keys()] } },
      include: PRODUCT_CARD_INCLUDE,
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    return [...latestByProduct.entries()]
      .map(([productId, meta]) => {
        const product = productById.get(productId);
        return product ? { product, ...meta } : null;
      })
      .filter((entry): entry is BuyAgainItem => entry !== null);
  }

  async findOneForUser(userId: string, orderId: string): Promise<Order> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  // Public, unauthenticated lookup — the orderNumber+email pair is the proof
  // of ownership (same trust model as any "track your package" flow), not a
  // session. Read-only by construction: this returns an Order, never
  // anything that lets the caller mutate it — every write endpoint on
  // OrdersController still requires a real session regardless of what this
  // reveals. A generic 404 either way (wrong orderNumber vs. wrong email)
  // avoids confirming which part was wrong.
  async trackOrder(orderNumber: string, email: string): Promise<Order> {
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber,
        OR: [
          { guestEmail: { equals: email, mode: 'insensitive' } },
          { user: { email: { equals: email, mode: 'insensitive' } } },
        ],
      },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('No order found for that order number and email');
    }
    return order;
  }

  // Customer self-service cancellation — only while the order hasn't left
  // the building yet (dailybasket-orders-order-tracking.md §12: once
  // OUT_FOR_DELIVERY, cancellation should route through support/admin).
  async cancelForUser(userId: string, orderId: string, reason?: string): Promise<Order> {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.applyTransition(order.id, 'CANCELLED', 'CUSTOMER', userId, reason ?? 'Cancelled by customer');
  }

  async adminList(dto: AdminListOrdersDto) {
    const offset = dto.offset ?? 0;
    const limit = dto.limit ?? 20;
    const where: Prisma.OrderWhereInput = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.search
        ? {
            OR: [
              { orderNumber: { contains: dto.search, mode: 'insensitive' } },
              { recipientName: { contains: dto.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: ORDER_DETAIL_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, offset, limit, hasMore: offset + items.length < total };
  }

  async adminFindOne(orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_DETAIL_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async adminUpdateStatus(
    adminUserId: string,
    orderId: string,
    targetStatus: OrderStatus,
    reason?: string,
  ): Promise<Order> {
    return this.applyTransition(orderId, targetStatus, 'ADMIN', adminUserId, reason);
  }

  private async applyTransition(
    orderId: string,
    targetStatus: OrderStatus,
    actorType: OrderEventActor,
    actorId: string | undefined,
    reason: string | undefined,
  ): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictException(`Cannot move order from ${order.status} to ${targetStatus}`);
    }
    if (targetStatus === 'CANCELLED' && !reason) {
      throw new BadRequestException('reason is required to cancel an order');
    }
    const effect = TARGET_STATUS_EFFECTS[targetStatus];
    if (!effect) {
      throw new BadRequestException(`Unsupported status transition target: ${targetStatus}`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: orderId }, data: { status: targetStatus } });
      if (effect.deliveryStatus) {
        // upsert, not update — orders created before this feature shipped
        // have no Delivery row at all.
        await tx.delivery.upsert({
          where: { orderId },
          create: { orderId, status: effect.deliveryStatus },
          update: { status: effect.deliveryStatus },
        });
      }
      await tx.orderEvent.create({
        data: { orderId, type: effect.eventType, message: reason, actorType, actorId },
      });

      if (targetStatus === 'CANCELLED') {
        // Stock already left the reserved pool at order creation (converted
        // to a real decrement) — cancelling before delivery returns it.
        const items = await tx.orderItem.findMany({ where: { orderId } });
        for (const item of items) {
          await tx.inventory.update({
            where: { variantId: item.variantId },
            data: { quantity: { increment: item.quantity } },
          });
        }
      }

      return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    }).then(async (updatedOrder) => {
      const notifyConfig = NOTIFICATION_FOR_STATUS[targetStatus];
      if (notifyConfig) {
        await this.notifyOrderUpdate(updatedOrder, notifyConfig.type, notifyConfig.label);
      }
      return updatedOrder;
    });
  }

  // Called by DeliveryService from within its own transaction when a partner
  // starts or completes a delivery — these two Order statuses are a side
  // effect of the Delivery state machine now, not a direct admin action (see
  // ALLOWED_TRANSITIONS above). Takes the caller's tx so the Order update and
  // the Delivery update that triggered it commit or roll back together.
  async syncOrderStatusFromDelivery(
    tx: Prisma.TransactionClient,
    orderId: string,
    orderStatus: 'OUT_FOR_DELIVERY' | 'DELIVERED',
  ): Promise<Order> {
    const config = DELIVERY_DRIVEN_NOTIFICATIONS[orderStatus];
    const order = await tx.order.update({ where: { id: orderId }, data: { status: orderStatus } });
    await tx.orderEvent.create({
      data: { orderId, type: config.eventType, actorType: 'SYSTEM' },
    });
    return order;
  }

  // Call after the transaction that called syncOrderStatusFromDelivery has
  // committed — same "never let notification failure roll back a state
  // transition" reasoning as applyTransition's post-commit .then().
  async notifyDeliveryStatusChange(order: Order, orderStatus: 'OUT_FOR_DELIVERY' | 'DELIVERED'): Promise<void> {
    const config = DELIVERY_DRIVEN_NOTIFICATIONS[orderStatus];
    await this.notifyOrderUpdate(order, config.type, config.label);
  }

  private async nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const [{ nextval }] = await tx.$queryRaw<
      { nextval: bigint }[]
    >`SELECT nextval('order_number_seq') AS nextval`;
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `DB-${datePrefix}-${nextval.toString().padStart(6, '0')}`;
  }
}
