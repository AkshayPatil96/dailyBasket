import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const ORDER_DETAIL_INCLUDE = {
  items: true,
  payment: true,
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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
      const order = await tx.order.create({
        data: {
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
          status: 'CONFIRMED',
          subtotal: session.subtotal,
          discount: session.discount,
          deliveryFee: session.deliveryFee,
          tax: session.tax,
          total: session.total,
        },
      });

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

      await tx.checkoutReservation.deleteMany({ where: { checkoutSessionId: session.id } });
      await tx.checkoutSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', orderId: order.id },
      });
      await tx.payment.update({ where: { id: payment.id }, data: { orderId: order.id } });

      await tx.cartItem.deleteMany({ where: { cartId: session.cartId } });
      await tx.cart.update({ where: { id: session.cartId }, data: { status: 'CONVERTED' } });

      return order;
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
}
