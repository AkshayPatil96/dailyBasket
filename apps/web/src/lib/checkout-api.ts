import type { CheckoutSession, CreatePaymentResult, Order } from '@grocery-delivery/types';
import { apiClient } from './api-client';

export interface SetCheckoutAddressInput {
  savedAddressId?: string;
  recipientName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  formattedAddress?: string;
  guestEmail?: string;
}

export interface VerifyPaymentInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export const checkoutApi = {
  start: (guestEmail?: string) =>
    apiClient
      .post<CheckoutSession>('/checkout/start', guestEmail ? { guestEmail } : {})
      .then((res) => res.data),

  get: (sessionId: string) =>
    apiClient.get<CheckoutSession>(`/checkout?id=${sessionId}`).then((res) => res.data),

  setAddress: (sessionId: string, input: SetCheckoutAddressInput) =>
    apiClient
      .post<CheckoutSession>(`/checkout/address?id=${sessionId}`, input)
      .then((res) => res.data),

  createPayment: (sessionId: string) =>
    apiClient
      .post<CreatePaymentResult>(`/checkout/payment/create?id=${sessionId}`)
      .then((res) => res.data),

  verifyPayment: (sessionId: string, input: VerifyPaymentInput) =>
    apiClient.post<Order>(`/checkout/payment/verify?id=${sessionId}`, input).then((res) => res.data),
};
