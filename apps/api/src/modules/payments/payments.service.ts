import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly razorpay: Razorpay;
  private readonly keySecret: string;

  constructor(private readonly configService: ConfigService) {
    const keyId = this.configService.getOrThrow<string>('razorpay.keyId');
    this.keySecret = this.configService.getOrThrow<string>('razorpay.keySecret');
    // Razorpay's own SDK constructor option is snake_case, unlike this codebase's convention.
    this.razorpay = new Razorpay({ key_id: keyId, key_secret: this.keySecret });
  }

  get keyId(): string {
    return this.configService.getOrThrow<string>('razorpay.keyId');
  }

  // amountRupees: whole-rupee Decimal already resolved to a number by the
  // caller — Razorpay wants the amount in paise (smallest currency unit).
  async createOrder(amountRupees: number, receipt: string): Promise<RazorpayOrder> {
    const order = await this.razorpay.orders.create({
      amount: Math.round(amountRupees * 100),
      currency: 'INR',
      receipt,
    });
    return { id: order.id, amount: Number(order.amount), currency: order.currency };
  }

  // Client-side verification (doc: "Support client-side payment response
  // verification") — Razorpay's documented HMAC scheme for the checkout.js
  // success payload: HMAC-SHA256(order_id + "|" + payment_id, key_secret).
  verifyPaymentSignature(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    const expected = createHmac('sha256', this.keySecret)
      .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
      .digest('hex');
    return this.safeCompare(expected, params.razorpaySignature);
  }

  // Webhook verification — HMAC-SHA256 over the exact raw request body,
  // using the separate webhook secret configured in the Razorpay dashboard.
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const webhookSecret = this.configService.get<string>('razorpay.webhookSecret');
    if (!webhookSecret || !signatureHeader) {
      this.logger.warn('Rejected webhook: missing webhook secret or signature header');
      return false;
    }
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    return this.safeCompare(expected, signatureHeader);
  }

  private safeCompare(expected: string, actual: string): boolean {
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(actual);
    if (expectedBuf.length !== actualBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}
